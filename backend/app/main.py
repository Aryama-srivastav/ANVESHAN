import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .api import router
from .api_ext import router as extensions_router
from .auth import auth_router
from .db import SessionLocal, engine
from .services import RoleService


def _run_migrations() -> None:
    """Run Alembic migrations programmatically at startup.

    This replaces the old Base.metadata.create_all() call so that every
    environment -- local SQLite and production PostgreSQL -- is always at the
    correct schema version without any manual intervention.

    The routine is *baseline safe*. Databases created before Alembic was
    introduced already contain the V1 tables but have either no
    alembic_version table or an empty one. Raising those to head would
    replay migration 0001 and fail with table already exists, so they are
    stamped at head first.
    """
    import logging
    from pathlib import Path

    from alembic import command
    from alembic.config import Config
    from sqlalchemy import inspect

    from .db import DATABASE_URL, engine

    log = logging.getLogger("anveshan.migrations")
    log.info("migrations: starting Alembic migration run")
    log.info(
        "migrations: DATABASE_URL dialect = %s",
        DATABASE_URL.split(":")[0] if DATABASE_URL else "unknown",
    )

    ini_path = Path(__file__).resolve().parents[1] / "alembic.ini"
    cfg = Config(str(ini_path))
    cfg.set_main_option(
        "script_location",
        str(Path(__file__).resolve().parents[1] / "migrations"),
    )
    cfg.set_main_option("sqlalchemy.url", DATABASE_URL)

    try:
        tables = set(inspect(engine).get_table_names())
        log.info("migrations: existing tables = %s", sorted(tables))
        if "users" in tables:
            needs_baseline = "alembic_version" not in tables
            if not needs_baseline:
                with engine.connect() as connection:
                    needs_baseline = (
                        connection.exec_driver_sql(
                            "SELECT COUNT(*) FROM alembic_version"
                        ).scalar_one() == 0
                    )
            if needs_baseline:
                log.info("migrations: baseline stamp (pre-Alembic schema detected)")
                command.stamp(cfg, "head")

        log.info("migrations: running upgrade head")
        command.upgrade(cfg, "head")
        log.info("migrations: upgrade head completed successfully")
    except Exception:
        log.exception("migrations: Alembic migration failed")
        raise


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    # Run Alembic migrations — safe to call on every startup (idempotent).
    _run_migrations()

    # Seed default roles if they don't exist yet.
    db = SessionLocal()
    try:
        RoleService.ensure_default_roles(db)
    finally:
        db.close()

    yield


DEFAULT_CORS_ORIGINS = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
)


def _cors_origins() -> list[str]:
    """Allowed browser origins.

    ``CORS_ORIGINS`` (comma separated) is how a deployment declares its frontend
    host; the localhost Vite ports remain the development default. ``*`` is
    honoured only when explicitly configured, never implicitly.
    """
    configured = os.getenv("CORS_ORIGINS", "").strip()
    if not configured:
        return list(DEFAULT_CORS_ORIGINS)
    origins = [origin.strip() for origin in configured.split(",") if origin.strip()]
    return origins or list(DEFAULT_CORS_ORIGINS)


app = FastAPI(title="ANVESHAN Backend API", version="v1", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(router)
app.include_router(extensions_router)


@app.get("/health", tags=["ops"])
def health() -> dict[str, str]:
    """Liveness + DB connectivity check.

    Returns ``{"status": "ok", "db": "ok"}`` when the database is reachable,
    or ``{"status": "degraded", "db": "<error>"}`` when it is not.
    """
    return _health()


@app.get("/v1/health", tags=["ops"])
def health_v1() -> dict[str, str]:
    """Versioned alias of ``/health`` used by the deployment probes."""
    return _health()


def _health() -> dict[str, str]:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_status = "ok"
    except Exception as exc:  # pragma: no cover
        db_status = str(exc)

    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "db": db_status,
    }

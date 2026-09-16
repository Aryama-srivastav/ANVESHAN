from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .api import router
from .auth import auth_router
from .db import SessionLocal, engine
from .services import RoleService


def _run_migrations() -> None:
    """Run Alembic migrations programmatically at startup.

    This replaces the old Base.metadata.create_all() call so that every
    environment — local SQLite and production PostgreSQL — is always at the
    correct schema version without any manual intervention.
    """
    from alembic import command
    from alembic.config import Config
    from pathlib import Path

    ini_path = Path(__file__).resolve().parents[1] / "alembic.ini"
    cfg = Config(str(ini_path))
    # Ensure the script_location is resolved relative to the ini file so it
    # works regardless of the current working directory.
    cfg.set_main_option(
        "script_location",
        str(Path(__file__).resolve().parents[1] / "migrations"),
    )
    command.upgrade(cfg, "head")


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


app = FastAPI(title="ANVESHAN Backend API", version="v1", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(router)


@app.get("/health", tags=["ops"])
def health() -> dict[str, str]:
    """Liveness + DB connectivity check.

    Returns ``{"status": "ok", "db": "ok"}`` when the database is reachable,
    or ``{"status": "degraded", "db": "<error>"}`` when it is not.
    """
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

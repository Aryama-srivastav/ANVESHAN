from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from .api import router
from .auth import auth_router
from .db import SessionLocal, engine
from .models import Base
from .services import RoleService


def ensure_local_schema_compatibility() -> None:
    if engine.dialect.name != "sqlite":
        return
    inspector = inspect(engine)
    additions = {
        "users": [("mfa_enabled", "BOOLEAN NOT NULL DEFAULT FALSE")],
        "authorized_access": [
            ("department", "VARCHAR(120)"),
            ("agency", "VARCHAR(120)"),
            ("sensitivity_level", "VARCHAR(30)"),
        ],
    }
    with engine.begin() as connection:
        for table, columns in additions.items():
            existing = {column["name"] for column in inspector.get_columns(table)}
            for name, definition in columns:
                if name not in existing:
                    connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {definition}"))

@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    Base.metadata.create_all(bind=engine)
    ensure_local_schema_compatibility()
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


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

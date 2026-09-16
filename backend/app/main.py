from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from .api import router
from .auth import auth_router
from .db import SessionLocal, engine
from .models import Base
from .services import RoleService

@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        RoleService.ensure_default_roles(db)
    finally:
        db.close()
    yield


app = FastAPI(title="ANVESHAN Backend API", version="v1", lifespan=lifespan)
app.include_router(auth_router)
app.include_router(router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

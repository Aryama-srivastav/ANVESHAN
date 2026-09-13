from __future__ import annotations

from fastapi import FastAPI

from .api import router
from .db import engine
from .models import Base

app = FastAPI(title="ANVESHAN Backend API", version="v1")
app.include_router(router)


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

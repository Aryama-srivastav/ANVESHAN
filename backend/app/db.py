from __future__ import annotations

import os
from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./anveshan.db")

# SQLite requires check_same_thread=False for multi-threaded FastAPI usage.
# PostgreSQL does not use this argument, so we only pass it for SQLite.
_connect_args: dict = {}
if DATABASE_URL.startswith("sqlite"):
    _connect_args["check_same_thread"] = False

engine = create_engine(
    DATABASE_URL,
    future=True,
    connect_args=_connect_args,
    # For PostgreSQL: use a pool that recycles connections every 30 minutes
    # to survive cloud provider idle-connection resets.
    pool_recycle=1800,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, class_=Session)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

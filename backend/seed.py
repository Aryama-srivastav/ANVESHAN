"""
seed.py — ANVESHAN database seeder
===================================
Populates default roles and a bootstrap admin user for fresh environments.

Usage:
    python seed.py

Environment variables:
    DATABASE_URL        SQLAlchemy URL (defaults to SQLite dev DB)
    ADMIN_EMAIL         Bootstrap admin email  (default: admin@anveshan.local)
    ADMIN_PASSWORD      Bootstrap admin password (default: ChangeMe123!)
    ADMIN_FULL_NAME     Bootstrap admin display name

Run once after `python -m alembic upgrade head` on a fresh database.
Calling it again on an existing database is safe — it skips existing records.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Make the app importable when running directly from backend/.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.models import Role, User, UserRole
from app.services import _hash_password, _mfa_secret  # noqa: PLC2701

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./anveshan.db")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@anveshan.local")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "ChangeMe123!")
ADMIN_FULL_NAME = os.getenv("ADMIN_FULL_NAME", "System Administrator")

DEFAULT_ROLES = [
    ("admin", "Full system administrator — can manage users, roles, and all cases"),
    ("user", "Standard investigator — case-scoped access only"),
    ("auditor", "Read-only audit reviewer — can inspect evidence and audit trail"),
]

# ---------------------------------------------------------------------------
# Seed helpers
# ---------------------------------------------------------------------------

def _ensure_roles(db: Session) -> dict[str, Role]:
    roles: dict[str, Role] = {}
    for name, description in DEFAULT_ROLES:
        role = db.scalar(select(Role).where(Role.name == name))
        if role is None:
            role = Role(name=name, description=description)
            db.add(role)
            print(f"  [+] Created role: {name}")
        else:
            print(f"  [=] Role already exists: {name}")
        roles[name] = role
    db.flush()
    return roles


def _ensure_admin(db: Session, roles: dict[str, Role]) -> None:
    existing = db.scalar(select(User).where(User.email == ADMIN_EMAIL.lower()))
    if existing is not None:
        print(f"  [=] Admin already exists: {ADMIN_EMAIL}")
        return

    admin = User(
        email=ADMIN_EMAIL.lower(),
        full_name=ADMIN_FULL_NAME,
        password_hash=_hash_password(ADMIN_PASSWORD),
        mfa_enabled=True,
        mfa_secret=_mfa_secret(),
        is_active=True,
        clearance_level="top_secret",
        department="Administration",
        agency="ANVESHAN",
    )
    db.add(admin)
    db.flush()

    # Assign admin role.
    db.add(UserRole(user_id=admin.id, role_id=roles["admin"].id))
    print(f"  [+] Created admin user: {ADMIN_EMAIL}")
    print(f"      MFA secret (save this for TOTP setup): {admin.mfa_secret}")
    print(f"      TOTP URI: otpauth://totp/ANVESHAN:{admin.email}?secret={admin.mfa_secret}&issuer=ANVESHAN")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    print(f"Connecting to: {DATABASE_URL}")
    engine = create_engine(DATABASE_URL, future=True)

    with Session(engine) as db:
        print("\nSeeding roles...")
        roles = _ensure_roles(db)

        print("\nSeeding bootstrap admin...")
        _ensure_admin(db, roles)

        db.commit()

    print("\nSeed complete.")


if __name__ == "__main__":
    main()

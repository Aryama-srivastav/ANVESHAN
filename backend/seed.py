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

from app.models import Role, User, UserRole, LegalArticle, LegalSection, DocumentTemplate, TemplateField
from app.services import _hash_password, _mfa_secret  # noqa: PLC2701
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./anveshan.db")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@anveshan.local")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "ChangeMe123!")
ADMIN_FULL_NAME = os.getenv("ADMIN_FULL_NAME", "System Administrator")

DEFAULT_ROLES = [
    ("admin", "Full system administrator — can manage users, roles, and all cases"),
    ("user", "Standard investigator — case-scoped access only"),
    ("auditor", "Read-only audit reviewer — can inspect evidence and audit trail"),
]

DEFAULT_LEGAL_ARTICLES = [
    ("IPC", "Indian Penal Code, 1860", "active"),
    ("CrPC", "Code of Criminal Procedure, 1973", "active"),
    ("Evidence Act", "Indian Evidence Act, 1872", "active"),
    ("CPC", "Code of Civil Procedure, 1908", "active"),
]

DEFAULT_LEGAL_SECTIONS = [
    ("IPC", "302", "Murder", "Whoever commits murder shall be punished with death, or imprisonment for life, and shall also be liable to fine.", "murder, homicide, killing, death"),
    ("IPC", "307", "Attempt to murder", "Whoever does any act with such intention or knowledge...", "attempt to murder, attempt to kill"),
    ("IPC", "324", "Voluntarily causing hurt by dangerous weapons or means", "Whoever voluntarily causes hurt by means of any instrument...", "hurt, injury, weapon, assault"),
    ("IPC", "376", "Rape", "A man is said to commit rape if he...", "rape, sexual assault, violation"),
    ("IPC", "379", "Punishment for theft", "Whoever commits theft shall be punished with imprisonment...", "theft, stealing, robbery"),
    ("IPC", "420", "Cheating and dishonestly inducing delivery of property", "Whoever cheats and thereby dishonestly induces the person deceived...", "cheating, fraud, dishonesty"),
    ("IPC", "498A", "Husband or relative subjecting woman to cruelty", "Whoever, being the husband or relative of the husband...", "cruelty, domestic violence, dowry"),
    ("IPC", "506", "Punishment for criminal intimidation", "Whoever commits criminal intimidation shall be punished...", "criminal intimidation, threat"),
    ("IPC", "354", "Assault on woman with intent to outrage modesty", "Whoever assaults or uses criminal force to any woman...", "assault, modesty, woman"),
    ("CrPC", "154", "Information in cognizable cases", "Every information relating to cognizable offence...", "FIR, cognizable, police report"),
    ("CrPC", "161", "Examination of witnesses by police", "A police officer making an investigation may examine orally...", "witness examination, police investigation"),
    ("CrPC", "164", "Recording of confessions and statements", "Any Magistrate may record any confession or statement...", "confession, statement, magistrate"),
    ("CrPC", "173", "Report of police officer on completion of investigation", "Every investigation shall be completed without unnecessary delay.", "charge sheet, investigation report"),
    ("Evidence Act", "65B", "Admissibility of electronic records", "Any information contained in an electronic record...shall be deemed to be also a document.", "electronic evidence, CCTV, digital"),
    ("Evidence Act", "27", "How much of information received from accused may be proved", "When any fact is deposed as discovered from information from accused...", "discovery, accused, confession"),
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

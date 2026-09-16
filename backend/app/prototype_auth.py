from __future__ import annotations

from secrets import compare_digest

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models

DEFAULT_PROTOTYPE_LOGINS = {
    "investigator": {
        "email": "investigator@prototype.anveshan",
        "password": "investigator",
        "full_name": "Prototype Investigator",
        "role": "user",
    },
    "auditor": {
        "email": "auditor@prototype.anveshan",
        "password": "auditor",
        "full_name": "Prototype Auditor",
        "role": "auditor",
    },
    "admin": {
        "email": "admin@prototype.anveshan",
        "password": "admin",
        "full_name": "Prototype Administrator",
        "role": "admin",
    },
}


def ensure_default_users(db: Session) -> None:
    roles = {role.name: role for role in db.scalars(select(models.Role))}
    for account in DEFAULT_PROTOTYPE_LOGINS.values():
        role = roles[account["role"]]
        user = db.scalar(select(models.User).where(models.User.email == account["email"]))
        if user is None:
            user = models.User(
                email=account["email"],
                full_name=account["full_name"],
                mfa_enabled=True,
            )
            db.add(user)
            db.flush()
        if not any(user_role.role_id == role.id for user_role in user.roles):
            db.add(models.UserRole(user_id=user.id, role_id=role.id))
    db.commit()


def authenticate_default_user(db: Session, role_name: str, password: str) -> models.User | None:
    account = DEFAULT_PROTOTYPE_LOGINS.get(role_name)
    if account is None or not compare_digest(account["password"], password):
        return None
    return db.scalar(select(models.User).where(models.User.email == account["email"]))

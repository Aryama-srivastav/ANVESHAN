from __future__ import annotations

import os
from typing import Annotated

import jwt
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .db import get_db
from .models import User
from .prototype_auth import DEFAULT_PROTOTYPE_LOGINS, authenticate_default_user, ensure_default_users
from .services import RoleService
from .schemas import PrototypeLoginOut, PrototypeLoginRequest

bearer = HTTPBearer(auto_error=False)
auth_router = APIRouter(prefix="/v1/auth", tags=["auth"])


@auth_router.post("/prototype-login", response_model=PrototypeLoginOut)
def prototype_login(payload: PrototypeLoginRequest, db: Session = Depends(get_db)) -> PrototypeLoginOut:
    if payload.role not in DEFAULT_PROTOTYPE_LOGINS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown prototype role")
    RoleService.ensure_default_roles(db)
    ensure_default_users(db)
    user = authenticate_default_user(db, payload.role, payload.password)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid prototype credentials")
    token = jwt.encode(
        {
            "sub": user.id,
            "role": payload.role,
            "mfa_verified": True,
            "amr": ["prototype_mfa"],
            "exp": datetime.now(timezone.utc) + timedelta(minutes=30),
        },
        os.getenv("JWT_SECRET", "development-only-secret"),
        algorithm="HS256",
    )
    return PrototypeLoginOut(access_token=token, role=payload.role, user=user)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer token required")

    try:
        claims = jwt.decode(
            credentials.credentials,
            os.getenv("JWT_SECRET", "development-only-secret"),
            algorithms=["HS256"],
            options={"require": ["sub", "exp"]},
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token") from exc

    user = db.get(User, str(claims["sub"]))
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User is not active")

    require_mfa = os.getenv("REQUIRE_MFA", "false").lower() in {"1", "true", "yes", "on"}
    if require_mfa and (not user.mfa_enabled or not (claims.get("mfa_verified") or claims.get("amr"))):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="MFA verification required for this environment",
        )
    return user

from __future__ import annotations

import os
import base64
import hashlib
import hmac
import time
from secrets import token_bytes
from typing import Optional,  Annotated

import jwt
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import get_db
from .email_otp import OTP_MAX_ATTEMPTS, issue_otp
from .models import EmailOtp, User
from .prototype_auth import DEFAULT_PROTOTYPE_LOGINS, authenticate_default_user, ensure_default_users
from .services import RoleService
from .schemas import (LoginChallengeOut, LoginRequest, MfaSetupOut, MfaVerifyRequest, PasswordResetConfirm,
                      PasswordResetRequest, PasswordResetRequestOut, PrototypeLoginOut, PrototypeLoginRequest,
                      ViewerAuthOut, ViewerLoginRequest, ViewerRegisterRequest, ViewerVerifyRequest, UserOut)

bearer = HTTPBearer(auto_error=False)
auth_router = APIRouter(prefix="/v1/auth", tags=["auth"])


def _totp(secret: str, counter: int | None = None) -> str:
    counter = counter if counter is not None else int(time.time() // 30)
    raw = base64.b32decode(secret + "=" * (-len(secret) % 8), casefold=True)
    digest = hmac.new(raw, counter.to_bytes(8, "big"), hashlib.sha1).digest()
    offset = digest[-1] & 15
    value = (int.from_bytes(digest[offset:offset + 4], "big") & 0x7FFFFFFF) % 1_000_000
    return f"{value:06d}"


def _password_hash(password: str, salt: bytes | None = None) -> str:
    salt = salt or token_bytes(16)
    derived = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return base64.urlsafe_b64encode(salt + derived).decode()


def verify_password(password: str, encoded: Optional[str]) -> bool:
    if not encoded:
        return False
    raw = base64.urlsafe_b64decode(encoded.encode())
    return hmac.compare_digest(_password_hash(password, raw[:16]), encoded)


def _set_password(user: User, password: str) -> None:
    user.password_hash = _password_hash(password)


def _access_token(user: User, *, mfa_verified: bool) -> str:
    return jwt.encode(
        {"sub": user.id, "mfa_verified": mfa_verified, "amr": ["totp"] if mfa_verified else [],
         "exp": datetime.now(timezone.utc) + timedelta(minutes=30)},
        os.getenv("JWT_SECRET", "development-only-secret"), algorithm="HS256",
    )


@auth_router.post("/prototype-login", response_model=PrototypeLoginOut)
def prototype_login(payload: PrototypeLoginRequest, db: Session = Depends(get_db)) -> PrototypeLoginOut:
    if payload.role not in DEFAULT_PROTOTYPE_LOGINS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown prototype role")
    if payload.role == "viewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Viewer access requires email registration and verification. Use /v1/auth/viewer/register.",
        )
    RoleService.ensure_default_roles(db)
    ensure_default_users(db)
    user = authenticate_default_user(db, payload.role, payload.password)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid prototype credentials")
    # Explicitly labelled demo identities are the only MFA bypass.
    token = _access_token(user, mfa_verified=True)
    return PrototypeLoginOut(access_token=token, role=payload.role, user=UserOut.model_validate(user))


@auth_router.post("/viewer/register", response_model=ViewerAuthOut)
def viewer_register(payload: ViewerRegisterRequest, db: Session = Depends(get_db)) -> ViewerAuthOut:
    email = payload.email.lower()
    RoleService.ensure_default_roles(db)
    existing_user = db.scalar(select(User).where(User.email == email))
    if existing_user is not None and not verify_password(payload.password, existing_user.password_hash):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered. Use viewer login.")
    code, sent = issue_otp(
        db,
        email=email,
        full_name=payload.full_name,
        password_hash=None if existing_user is not None else _password_hash(payload.password),
    )
    message = "Verification code sent to your email." if sent else "Verification code issued."
    if os.getenv("APP_ENV", "development").lower() != "production" or not sent:
        return ViewerAuthOut(message=message, mfa_required=True, development_code=code)
    return ViewerAuthOut(message=message, mfa_required=True)


@auth_router.post("/viewer/login", response_model=ViewerAuthOut)
def viewer_login(payload: ViewerLoginRequest, db: Session = Depends(get_db)) -> ViewerAuthOut:
    email = payload.email.lower()
    user = db.scalar(select(User).where(User.email == email))
    stored_hash = user.password_hash if user is not None else None
    if stored_hash is None:
        challenge = db.scalar(select(EmailOtp).where(EmailOtp.email == email))
        stored_hash = challenge.password_hash if challenge is not None else None
    if stored_hash is None or not verify_password(payload.password, stored_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if user is not None:
        roles = {user_role.role.name for user_role in user.roles} if user.roles else set()
        if roles and "viewer" not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This login channel is for viewer accounts only")
    code, sent = issue_otp(db, email=email)
    message = "Verification code sent to your email." if sent else "Verification code issued."
    if os.getenv("APP_ENV", "development").lower() != "production" or not sent:
        return ViewerAuthOut(message=message, mfa_required=True, development_code=code)
    return ViewerAuthOut(message=message, mfa_required=True)


@auth_router.post("/viewer/verify", response_model=PrototypeLoginOut)
def viewer_verify(payload: ViewerVerifyRequest, db: Session = Depends(get_db)) -> PrototypeLoginOut:
    import hashlib

    from . import models

    email = payload.email.lower()
    challenge = db.scalar(select(EmailOtp).where(EmailOtp.email == email))
    if challenge is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No verification challenge for this email")
    if (challenge.attempts or 0) >= OTP_MAX_ATTEMPTS:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many attempts. Request a new code.")
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if challenge.expires_at is not None and now > challenge.expires_at:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Code expired. Request a new one.")
    expected = hashlib.sha256(payload.code.encode()).hexdigest()
    if not hmac.compare_digest(expected, challenge.code_hash):
        challenge.attempts = (challenge.attempts or 0) + 1
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid verification code")
    RoleService.ensure_default_roles(db)
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        if not challenge.password_hash:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Registration incomplete. Register again.")
        user = User(email=email, full_name=challenge.full_name or email, password_hash=challenge.password_hash, is_active=True)
        db.add(user)
        db.flush()
        viewer_role = db.scalar(select(models.Role).where(models.Role.name == "viewer"))
        if viewer_role is None:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Viewer role not configured")
        db.add(models.UserRole(user_id=user.id, role_id=viewer_role.id))
    elif not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User is not active")
    challenge.verified = True
    challenge.attempts = 0
    db.commit()
    token = _access_token(user, mfa_verified=True)
    return PrototypeLoginOut(access_token=token, role="viewer", user=UserOut.model_validate(user))


@auth_router.post("/login", response_model=LoginChallengeOut)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> LoginChallengeOut:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user is None or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.mfa_enabled:
        return LoginChallengeOut(mfa_required=False, access_token=_access_token(user, mfa_verified=False))
    challenge = jwt.encode(
        {"sub": user.id, "purpose": "mfa", "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
        os.getenv("JWT_SECRET", "development-only-secret"), algorithm="HS256",
    )
    return LoginChallengeOut(mfa_required=True, challenge_token=challenge)


@auth_router.post("/mfa/verify", response_model=LoginChallengeOut)
def verify_mfa(payload: MfaVerifyRequest, db: Session = Depends(get_db)) -> LoginChallengeOut:
    try:
        claims = jwt.decode(payload.challenge_token, os.getenv("JWT_SECRET", "development-only-secret"), algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid MFA challenge") from exc
    user = db.get(User, str(claims.get("sub")))
    if claims.get("purpose") != "mfa" or user is None or not user.mfa_secret:
        raise HTTPException(status_code=401, detail="Invalid MFA challenge")
    valid = any(hmac.compare_digest(payload.code, _totp(user.mfa_secret, int(time.time() // 30) + drift)) for drift in (-1, 0, 1))
    if not valid:
        raise HTTPException(status_code=401, detail="Invalid authentication code")
    return LoginChallengeOut(mfa_required=False, access_token=_access_token(user, mfa_verified=True))


@auth_router.post("/password-reset/request", response_model=PasswordResetRequestOut)
def request_password_reset(payload: PasswordResetRequest, db: Session = Depends(get_db)) -> PasswordResetRequestOut:
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    token = None
    if user is not None and user.is_active:
        token = jwt.encode(
            {"sub": user.id, "purpose": "password-reset", "exp": datetime.now(timezone.utc) + timedelta(minutes=15)},
            os.getenv("JWT_SECRET", "development-only-secret"), algorithm="HS256",
        )
    # A production mail provider delivers the opaque token. Local development exposes it only to exercise the flow.
    return PasswordResetRequestOut(
        message="If that account exists, password-reset instructions have been issued.",
        development_reset_token=token if os.getenv("APP_ENV", "development").lower() == "development" else None,
    )


@auth_router.post("/password-reset/confirm")
def confirm_password_reset(payload: PasswordResetConfirm, db: Session = Depends(get_db)) -> dict[str, str]:
    try:
        claims = jwt.decode(payload.reset_token, os.getenv("JWT_SECRET", "development-only-secret"), algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired reset token") from exc
    user = db.get(User, str(claims.get("sub")))
    if claims.get("purpose") != "password-reset" or user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid or expired reset token")
    _set_password(user, payload.new_password)
    db.commit()
    return {"message": "Password updated. Sign in with your new password."}


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
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        # RLS policies read this transaction-local setting; client identity never comes from a request header.
        from sqlalchemy import text
        db.execute(text("SELECT set_config('app.current_user_id', :user_id, true)"), {"user_id": user.id})
    return user


@auth_router.post("/mfa/setup", response_model=MfaSetupOut)
def mfa_setup(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> MfaSetupOut:
    secret = base64.b32encode(token_bytes(20)).decode().rstrip("=")
    current_user.mfa_secret = secret
    current_user.mfa_enabled = True
    db.commit()
    return MfaSetupOut(
        secret=secret,
        provisioning_uri=f"otpauth://totp/ANVESHAN:{current_user.email}?secret={secret}&issuer=ANVESHAN",
    )

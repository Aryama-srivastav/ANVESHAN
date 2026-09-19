from __future__ import annotations

import hashlib
import logging
import os
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from secrets import randbelow

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models

log = logging.getLogger("anveshan.email_otp")

OTP_TTL_MINUTES = 10
OTP_MAX_ATTEMPTS = 5


def _smtp_settings() -> dict[str, str]:
    return {
        "host": os.getenv("SMTP_HOST", ""),
        "port": os.getenv("SMTP_PORT", "587"),
        "username": os.getenv("SMTP_USERNAME", ""),
        "password": os.getenv("SMTP_PASSWORD", ""),
        "from_address": os.getenv("SMTP_FROM", os.getenv("SMTP_USERNAME", "")),
        "use_tls": os.getenv("SMTP_USE_TLS", "true"),
    }


def _send_email(to_email: str, subject: str, body: str) -> bool:
    """Send a transactional email via SMTP. Returns True on success.

    When SMTP is not configured the code is logged and False is returned so
    callers can fall back to the development-code path.
    """
    settings = _smtp_settings()
    if not settings["host"] or not settings["username"] or not settings["password"]:
        log.warning("email-otp: SMTP not configured; skipping send to %s", to_email)
        return False
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings["from_address"] or settings["username"]
    message["To"] = to_email
    message.set_content(body)
    try:
        with smtplib.SMTP(settings["host"], int(settings["port"] or 587), timeout=15) as client:
            if settings["use_tls"].lower() in {"1", "true", "yes", "on"}:
                client.starttls()
            client.login(settings["username"], settings["password"])
            client.send_message(message)
        return True
    except Exception:
        log.exception("email-otp: SMTP send failed for %s", to_email)
        return False


def _new_code() -> str:
    return f"{randbelow(1_000_000):06d}"


def issue_otp(
    db: Session,
    *,
    email: str,
    full_name: str | None = None,
    password_hash: str | None = None,
) -> tuple[str, bool]:
    """Create (or overwrite) the OTP challenge for an email.

    Returns ``(code, email_sent)``. The plaintext code is returned so the
    caller can expose it in development; only its SHA-256 hash is persisted.
    """
    email = email.lower().strip()
    code = _new_code()
    code_hash = hashlib.sha256(code.encode()).hexdigest()
    expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=OTP_TTL_MINUTES)

    existing = db.scalar(select(models.EmailOtp).where(models.EmailOtp.email == email))
    if existing is None:
        db.add(
            models.EmailOtp(
                email=email,
                full_name=full_name,
                password_hash=password_hash,
                code_hash=code_hash,
                attempts=0,
                verified=False,
                expires_at=expires_at,
            )
        )
    else:
        existing.code_hash = code_hash
        existing.attempts = 0
        existing.verified = False
        existing.expires_at = expires_at
        if full_name is not None:
            existing.full_name = full_name
        if password_hash is not None:
            existing.password_hash = password_hash
    db.commit()

    sent = _send_email(
        email,
        "ANVESHAN verification code",
        f"Your ANVESHAN verification code is {code}. It expires in {OTP_TTL_MINUTES} minutes.",
    )
    if not sent:
        log.warning("email-otp: code for %s not emailed (SMTP unconfigured or failed)", email)
    return code, sent

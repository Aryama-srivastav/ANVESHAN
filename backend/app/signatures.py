
from __future__ import annotations

import base64
import hashlib
import os
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models


def _secret_fernet() -> Fernet:
    """Encryption envelope for role signing keys, derived from APP_SECRET_KEY."""
    secret = os.getenv("APP_SECRET_KEY", "development-only-secret").encode()
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(secret).digest()))


class SignatureService:
    """Per-role signing keys: an investigator upload and an administrator
    upload are signed with different system keys, so their signatures are
    cryptographically distinct. The signer identity is recorded alongside."""

    @staticmethod
    def _system_private_key():
        """Legacy single-system key (still used when no role can be resolved)."""
        configured = os.getenv("SIGNING_PRIVATE_KEY_PEM")
        if configured:
            return serialization.load_pem_private_key(configured.encode(), password=None)
        path = Path(os.getenv("SIGNING_KEY_PATH", "backend/keys/document-signing-key.pem"))
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists():
            return serialization.load_pem_private_key(path.read_bytes(), password=None)
        key = rsa.generate_private_key(public_exponent=65537, key_size=3072)
        path.write_bytes(
            key.private_bytes(
                serialization.Encoding.PEM,
                serialization.PrivateFormat.PKCS8,
                serialization.NoEncryption(),
            )
        )
        return key

    @staticmethod
    def role_key(db: Session, role_name: str) -> models.RoleSigningKey:
        """Fetch (or lazily provision) the per-system signing key for a role."""
        record = db.scalar(select(models.RoleSigningKey).where(models.RoleSigningKey.role_name == role_name))
        if record is not None:
            return record
        key = rsa.generate_private_key(public_exponent=65537, key_size=3072)
        private_pem = key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
        public_pem = key.public_key().public_bytes(
            serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
        ).decode()
        record = models.RoleSigningKey(
            role_name=role_name,
            private_key_encrypted=_secret_fernet().encrypt(private_pem).decode(),
            public_key_pem=public_pem,
        )
        db.add(record)
        db.flush()
        db.refresh(record)
        return record

    @staticmethod
    def _private_key_for_role(db: Session, role_name: str | None):
        if not role_name:
            return SignatureService._system_private_key()
        record = SignatureService.role_key(db, role_name)
        try:
            private_pem = _secret_fernet().decrypt(record.private_key_encrypted.encode())
        except InvalidToken:
            raise ValueError("Role signing key cannot be decrypted with the current APP_SECRET_KEY") from None
        return serialization.load_pem_private_key(private_pem, password=None)

    @staticmethod
    def sign(db: Session, version: models.DocumentVersion, signer_user_id: str, *, key_role: str | None = None) -> models.DocumentSignature:
        key = SignatureService._private_key_for_role(db, key_role)
        signature = key.sign(
            version.content_hash.encode(),
            padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=padding.PSS.DIGEST_LENGTH),
            hashes.SHA256(),
        )
        record = models.DocumentSignature(
            document_version_id=version.id,
            signer_user_id=signer_user_id,
            signature=base64.b64encode(signature).decode(),
            public_key_pem=key.public_key().public_bytes(
                serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
            ).decode(),
            signed_hash=version.content_hash,
            key_role=key_role,
        )
        db.add(record)
        db.flush()
        db.refresh(record)
        return record

    @staticmethod
    def verify(db: Session, signature_id: str) -> tuple[models.DocumentSignature, bool] | None:
        record = db.get(models.DocumentSignature, signature_id)
        if record is None:
            return None
        version = db.get(models.DocumentVersion, record.document_version_id)
        if version is None or version.content_hash != record.signed_hash:
            return record, False
        try:
            public_key = serialization.load_pem_public_key(record.public_key_pem.encode())
            public_key.verify(
                base64.b64decode(record.signature),
                record.signed_hash.encode(),
                padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=padding.PSS.DIGEST_LENGTH),
                hashes.SHA256(),
            )
            return record, True
        except Exception:
            return record, False

    @staticmethod
    def list_for_version(db: Session, version_id: str) -> list[models.DocumentSignature]:
        return list(db.scalars(select(models.DocumentSignature).where(models.DocumentSignature.document_version_id == version_id)))


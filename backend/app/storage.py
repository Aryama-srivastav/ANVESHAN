from __future__ import annotations

import os
import shutil
import base64
import hashlib
from io import BytesIO
from pathlib import Path
from typing import BinaryIO

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


class StorageError(RuntimeError):
    pass


class StorageProvider:
    def put(self, key: str, source: BinaryIO, content_type: str | None) -> str:
        raise NotImplementedError

    def open(self, uri: str) -> BinaryIO:
        raise NotImplementedError

    def delete(self, uri: str) -> None:
        raise NotImplementedError


class EncryptedStorage(StorageProvider):
    """Envelope encryption wrapper; storage providers only ever receive ciphertext."""

    _MAGIC = b"ANVESHAN-E1\x00"

    def __init__(self, inner: StorageProvider, key: bytes) -> None:
        if len(key) != 32:
            raise StorageError("DOCUMENT_ENCRYPTION_KEY must decode to exactly 32 bytes")
        self.inner = inner
        self.cipher = AESGCM(key)

    def put(self, key: str, source: BinaryIO, content_type: str | None) -> str:
        plaintext = source.read()
        nonce = os.urandom(12)
        ciphertext = self._MAGIC + nonce + self.cipher.encrypt(nonce, plaintext, None)
        return self.inner.put(key, BytesIO(ciphertext), "application/octet-stream")

    def open(self, uri: str) -> BinaryIO:
        encrypted = self.inner.open(uri).read()
        if not encrypted.startswith(self._MAGIC) or len(encrypted) <= len(self._MAGIC) + 12:
            raise StorageError("Stored evidence is not an ANVESHAN encrypted object")
        nonce_start = len(self._MAGIC)
        nonce = encrypted[nonce_start : nonce_start + 12]
        try:
            plaintext = self.cipher.decrypt(nonce, encrypted[nonce_start + 12 :], None)
        except Exception as exc:
            raise StorageError("Stored evidence could not be decrypted") from exc
        return BytesIO(plaintext)

    def delete(self, uri: str) -> None:
        self.inner.delete(uri)


def _encryption_key() -> bytes:
    configured = os.getenv("DOCUMENT_ENCRYPTION_KEY")
    if configured:
        try:
            return base64.urlsafe_b64decode(configured + "=" * (-len(configured) % 4))
        except Exception as exc:
            raise StorageError("DOCUMENT_ENCRYPTION_KEY must be URL-safe base64") from exc
    # Local development fallback. Production requires a separately managed key.
    if os.getenv("APP_ENV", "development").lower() == "production":
        raise StorageError("DOCUMENT_ENCRYPTION_KEY is required in production")
    return hashlib.sha256(os.getenv("APP_SECRET_KEY", "anveshan-local-development-key").encode()).digest()


class LocalStorage(StorageProvider):
    def __init__(self, root: str) -> None:
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if self.root not in path.parents:
            raise StorageError("Invalid storage key")
        return path

    def put(self, key: str, source: BinaryIO, content_type: str | None) -> str:
        destination = self._path(key)
        destination.parent.mkdir(parents=True, exist_ok=True)
        with destination.open("wb") as output:
            shutil.copyfileobj(source, output, length=1024 * 1024)
        return f"local://{key}"

    def open(self, uri: str) -> BinaryIO:
        if not uri.startswith("local://"):
            raise StorageError("Unsupported local storage URI")
        path = self._path(uri.removeprefix("local://"))
        if not path.is_file():
            raise FileNotFoundError(uri)
        return path.open("rb")

    def delete(self, uri: str) -> None:
        if uri.startswith("local://"):
            self._path(uri.removeprefix("local://")).unlink(missing_ok=True)


class SupabaseStorage(StorageProvider):
    def __init__(self, url: str, service_key: str, bucket: str) -> None:
        try:
            from supabase import create_client
        except ImportError as exc:
            raise StorageError("Supabase storage requires the supabase package") from exc
        self.client = create_client(url, service_key)
        self.bucket = bucket

    def put(self, key: str, source: BinaryIO, content_type: str | None) -> str:
        options = {"content-type": content_type or "application/octet-stream", "upsert": "false"}
        try:
            self.client.storage.from_(self.bucket).upload(key, source.read(), options)
        except Exception as exc:
            raise StorageError("Unable to upload evidence to Supabase Storage") from exc
        return f"supabase://{self.bucket}/{key}"

    def open(self, uri: str) -> BinaryIO:
        prefix = "supabase://" + self.bucket + "/"
        if not uri.startswith(prefix):
            raise StorageError("Unsupported Supabase storage URI")
        try:
            content = self.client.storage.from_(self.bucket).download(uri.removeprefix(prefix))
        except Exception as exc:
            raise StorageError("Unable to download evidence from Supabase Storage") from exc
        return BytesIO(content)

    def delete(self, uri: str) -> None:
        prefix = "supabase://" + self.bucket + "/"
        if uri.startswith(prefix):
            self.client.storage.from_(self.bucket).remove([uri.removeprefix(prefix)])


def get_storage() -> StorageProvider:
    provider = os.getenv("OBJECT_STORAGE_PROVIDER", "local").lower()
    if provider == "local":
        storage: StorageProvider = LocalStorage(os.getenv("OBJECT_STORAGE_DIR", "backend/uploads"))
    elif provider == "supabase":
        url = os.getenv("SUPABASE_URL")
        service_key = os.getenv("SUPABASE_SERVICE_KEY")
        bucket = os.getenv("SUPABASE_STORAGE_BUCKET", "anveshan-evidence")
        if not url or not service_key:
            raise StorageError("SUPABASE_URL and SUPABASE_SERVICE_KEY are required")
        storage = SupabaseStorage(url, service_key, bucket)
    else:
        raise StorageError(f"Unsupported object storage provider: {provider}")
    if os.getenv("DOCUMENT_ENCRYPTION_ENABLED", "true").lower() not in {"1", "true", "yes", "on"}:
        if os.getenv("APP_ENV", "development").lower() == "production":
            raise StorageError("Document encryption cannot be disabled in production")
        return storage
    return EncryptedStorage(storage, _encryption_key())

from __future__ import annotations

import os
import shutil
from io import BytesIO
from pathlib import Path
from typing import BinaryIO


class StorageError(RuntimeError):
    pass


class StorageProvider:
    def put(self, key: str, source: BinaryIO, content_type: str | None) -> str:
        raise NotImplementedError

    def open(self, uri: str) -> BinaryIO:
        raise NotImplementedError

    def delete(self, uri: str) -> None:
        raise NotImplementedError


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
        return LocalStorage(os.getenv("OBJECT_STORAGE_DIR", "backend/uploads"))
    if provider == "supabase":
        url = os.getenv("SUPABASE_URL")
        service_key = os.getenv("SUPABASE_SERVICE_KEY")
        bucket = os.getenv("SUPABASE_STORAGE_BUCKET", "anveshan-evidence")
        if not url or not service_key:
            raise StorageError("SUPABASE_URL and SUPABASE_SERVICE_KEY are required")
        return SupabaseStorage(url, service_key, bucket)
    raise StorageError(f"Unsupported object storage provider: {provider}")
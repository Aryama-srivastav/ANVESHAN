"""Government identity verification adapter (V1 Step 11).

Two providers are supported and selected with ``GOV_ID_PROVIDER``:

``local`` (default)
    Deterministic, offline validation used for development, demos and the
    automated test-suite. It checks the *format* of the identifier and returns a
    stable verdict. It is explicitly **not** a real identity check.

``http``
    Calls a real government/agency endpoint (``GOV_ID_API_URL`` +
    ``GOV_ID_API_KEY``) and maps the response onto ``verified`` / ``failed`` /
    ``pending``. This is the production path.

Privacy: only the last four characters of the identifier are ever persisted, so
the verification record never becomes a secondary store of identity numbers.
"""


import os
import re
from typing import Optional,  Any

import httpx

ID_PATTERNS: dict[str, re.Pattern[str]] = {
    "aadhaar": re.compile(r"^[2-9]\d{11}$"),
    "pan": re.compile(r"^[A-Z]{5}\d{4}[A-Z]$"),
    "voter_id": re.compile(r"^[A-Z]{3}\d{7}$"),
    "mobile": re.compile(r"^[6-9]\d{9}$"),
    "employee_id": re.compile(r"^[A-Za-z0-9\-/]{4,32}$"),
    "badge_number": re.compile(r"^[A-Za-z0-9\-/]{4,32}$"),
}


class GovIdError(RuntimeError):
    pass


def mask_identifier(value: str) -> str:
    """Keep only the last four characters — data minimisation for stored records."""
    clean = (value or "").strip()
    if len(clean) <= 4:
        return "*" * len(clean)
    return "*" * (len(clean) - 4) + clean[-4:]


class GovIdVerificationAdapter:
    """Provider-agnostic identity verification entry point."""

    @staticmethod
    def provider_name() -> str:
        return os.getenv("GOV_ID_PROVIDER", "local").lower()

    @staticmethod
    def verify(id_type: str, id_number: str, full_name: Optional[str] = None) -> dict[str, Any]:
        provider = GovIdVerificationAdapter.provider_name()
        if provider == "local":
            return GovIdVerificationAdapter._verify_local(id_type, id_number)
        if provider == "http":
            return GovIdVerificationAdapter._verify_http(id_type, id_number, full_name)
        raise GovIdError(f"Unsupported GOV_ID_PROVIDER: {provider}")

    @staticmethod
    def _verify_local(id_type: str, id_number: str) -> dict[str, Any]:
        pattern = ID_PATTERNS.get((id_type or "").strip().lower())
        if pattern is None:
            return {
                "status": "failed",
                "reference": None,
                "detail": f"Unsupported identifier type '{id_type}'.",
                "method": "gov_api:local",
            }
        if pattern.match((id_number or "").strip().upper()):
            return {
                "status": "verified",
                "reference": f"LOCAL-{mask_identifier(id_number)}",
                "detail": f"{id_type} format validated by the local development provider.",
                "method": "gov_api:local",
            }
        return {
            "status": "failed",
            "reference": None,
            "detail": f"{id_type} failed local format validation.",
            "method": "gov_api:local",
        }

    @staticmethod
    def _verify_http(id_type: str, id_number: str, full_name: Optional[str]) -> dict[str, Any]:
        base_url = os.getenv("GOV_ID_API_URL")
        api_key = os.getenv("GOV_ID_API_KEY")
        if not base_url or not api_key:
            raise GovIdError("GOV_ID_API_URL and GOV_ID_API_KEY are required for the http provider")

        try:
            response = httpx.post(
                base_url.rstrip("/") + "/verify",
                json={"id_type": id_type, "id_number": id_number, "full_name": full_name},
                headers={"Authorization": f"Bearer {api_key}"},
                timeout=float(os.getenv("GOV_ID_API_TIMEOUT", "15")),
            )
            response.raise_for_status()
            payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise GovIdError("Government identity provider is unavailable") from exc

        raw_status = str(payload.get("status", "")).lower()
        if raw_status in {"verified", "success", "valid", "ok"}:
            status = "verified"
        elif raw_status in {"pending", "processing"}:
            status = "pending"
        else:
            status = "failed"
        return {
            "status": status,
            "reference": payload.get("reference") or payload.get("request_id"),
            "detail": payload.get("message") or f"Provider returned '{raw_status or 'unknown'}'.",
            "method": "gov_api:http",
        }
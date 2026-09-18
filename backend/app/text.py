"""Deterministic, dependency-free text utilities for ANVESHAN V1.

Used by the search service, the ML classification service and the HTTP layer to
turn evidence bytes and metadata into searchable text, lexical vectors and
extracted entities.

Design notes
------------
* Everything here is deterministic and offline. No model download, no network
  call and no heavyweight dependency is required for V1 to work.
* ``embed`` implements the hashing trick (feature hashing) with sub-linear term
  frequency and L2 normalisation, producing a fixed-dimension lexical
  vector-space representation. It is a *ranking* signal, not a neural
  embedding. ``search.py`` keeps the embedding behind a provider lookup, so a
  real model (or pgvector) can be swapped in without changing the API.
* ``extract_entities`` is a transparent rule-based extractor. Every match it
  returns can be pointed back at the originating text, which is what the
  field-level traceability requirement needs.
"""

from __future__ import annotations

import hashlib
import math
import re
from io import BytesIO
from typing import Iterable

STOPWORDS = frozenset(
    """
    a an the and or but if then than that this these those of in on at to for from by with without
    into over under again further once here there all any both each few more most other some such
    no nor not only own same so too very can will just should now is are was were be been being do
    does did doing have has had having it its as we you your they them he she his her
    """.split()
)

TOKEN_RE = re.compile(r"[a-z0-9][a-z0-9._/-]*")
EMBEDDING_DIM = 512


def normalize(value: str | None) -> str:
    """Lower-cased, whitespace-collapsed form used for matching and indexing."""
    if not value:
        return ""
    return re.sub(r"\s+", " ", value.lower()).strip()


def tokenize(text: str) -> list[str]:
    """Lower-case alphanumeric tokens with stop-words removed."""
    return [token for token in TOKEN_RE.findall(normalize(text)) if token not in STOPWORDS]


def _bucket(token: str) -> int:
    digest = hashlib.blake2b(token.encode("utf-8"), digest_size=8).digest()
    return int.from_bytes(digest, "big") % EMBEDDING_DIM


def _normalise_vector(vector: dict[int, float]) -> dict[int, float]:
    norm = math.sqrt(sum(value * value for value in vector.values()))
    if norm == 0:
        return {}
    return {index: value / norm for index, value in vector.items()}


def embed(text: str) -> dict[int, float]:
    """L2-normalised sparse lexical vector (hashing trick + sub-linear TF)."""
    if not text:
        return {}
    counts: dict[int, float] = {}
    for token in tokenize(text):
        index = _bucket(token)
        counts[index] = counts.get(index, 0.0) + 1.0
    return _normalise_vector({index: 1.0 + math.log(weight) for index, weight in counts.items()})


def boost_tokens(embedding: dict[int, float], tokens: Iterable[str], factor: float = 0.35) -> dict[int, float]:
    """Return a copy of ``embedding`` with extra weight on high-signal tokens."""
    if not embedding:
        return {}
    vector = dict(embedding)
    for token in tokens:
        if not token:
            continue
        index = _bucket(normalize(token))
        vector[index] = vector.get(index, 0.0) + factor
    return _normalise_vector(vector)


def cosine(left: dict[int, float], right: dict[int, float]) -> float:
    """Cosine similarity between two sparse vectors produced by ``embed``."""
    if not left or not right:
        return 0.0
    if len(left) > len(right):
        left, right = right, left
    return sum(weight * right.get(index, 0.0) for index, weight in left.items())


def excerpt(text: str, query: str = "", limit: int = 240) -> str:
    """Return a short, query-aware excerpt suitable for a result card."""
    clean = re.sub(r"\s+", " ", text or "").strip()
    if not clean:
        return ""
    if not query:
        return clean[:limit]
    lowered = clean.lower()
    for token in [token for token in tokenize(query) if len(token) > 3]:
        position = lowered.find(token)
        if position >= 0:
            start = max(0, position - limit // 3)
            return clean[start : start + limit]
    return clean[:limit]


_DATE_RE = re.compile(r"\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b")
_AMOUNT_RE = re.compile(
    r"\b(?:rs\.?|inr)\s?[\d,]+(?:\.\d{1,2})?\b|\b[\d,]{4,}\s?(?:lakh|crore|rupees)\b",
    re.IGNORECASE,
)
_CASE_RE = re.compile(r"\b(?:FIR|CR|CC|SC|RC|MACT)\s?(?:No\.?)?\s?\d{1,6}\s?(?:/\s?\d{2,4})?\b", re.IGNORECASE)
_ORG_CUES = (
    "station", "court", "bank", "hospital", "college", "university", "ltd", "limited",
    "pvt", "corporation", "department", "ministry", "bureau", "agency", "institute",
    "laboratory", "forensic", "police", "trust", "company", "council", "board",
)
_PERSON_CUES = (
    "shri", "smt", "mr", "mrs", "ms", "dr", "inspector", "sub-inspector", "si",
    "constable", "advocate",
)
_PROPER_NOUN_RE = re.compile(r"\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){1,3})\b")


def extract_entities(text: str, extra: Iterable[str] = ()) -> dict[str, list[str]]:
    """Rule-based entity extraction: dates, amounts, case numbers, people, orgs."""
    haystack = text or ""
    organisations: list[str] = []
    persons: list[str] = []

    for candidate in _PROPER_NOUN_RE.findall(haystack):
        lowered = candidate.lower()
        if any(cue in lowered for cue in _ORG_CUES):
            organisations.append(candidate)
        elif lowered.split()[0].rstrip(".") in _PERSON_CUES:
            persons.append(candidate)

    # Explicit metadata values (tags, station names, parties …) count as entities.
    for value in extra:
        cleaned = (value or "").strip()
        if cleaned and cleaned not in organisations and cleaned not in persons:
            organisations.append(cleaned)

    entities: dict[str, list[str]] = {
        "dates": sorted(set(_DATE_RE.findall(haystack)))[:20],
        "amounts": sorted({match.strip() for match in _AMOUNT_RE.findall(haystack)})[:20],
        "case_numbers": sorted({match.strip() for match in _CASE_RE.findall(haystack)})[:20],
        "persons": sorted(set(persons))[:25],
        "organisations": sorted(set(organisations))[:25],
    }
    return {key: value for key, value in entities.items() if value}


def extract_text(content: bytes | None, filename: str = "") -> str:
    """Best-effort plain-text extraction from an evidence artifact.

    Plain-text-like formats are decoded directly. PDFs are parsed with ``pypdf``
    when it is installed; if it is missing (or parsing fails) the caller simply
    gets an empty string and classification falls back to title/metadata rules.
    Never raises: extraction failure must not block an evidence upload.
    """
    if not content:
        return ""
    name = (filename or "").lower()
    if name.endswith((".txt", ".md", ".csv", ".json", ".xml", ".log")) or not name:
        for encoding in ("utf-8", "utf-16", "latin-1"):
            try:
                return content.decode(encoding)
            except (UnicodeDecodeError, LookupError):
                continue
        return ""
    if name.endswith(".pdf"):
        try:
            from pypdf import PdfReader  # type: ignore[import-not-found]
        except ImportError:
            return ""
        try:
            reader = PdfReader(BytesIO(content))
            return "\n".join((page.extract_text() or "") for page in reader.pages[:25])
        except Exception:
            return ""
    return ""
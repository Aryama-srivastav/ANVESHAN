"""Evidence search and retrieval for ANVESHAN V1 (Step 8).

Supports the three required search modes in a single query surface:

* **semantic-ish ranking** — lexical vector-space similarity (feature hashing)
  combined with literal phrase bonuses, ranked per document;
* **temporal filtering** — ``from_date`` / ``to_date`` against the document's
  activity timestamp;
* **entity filtering** — named entities extracted at ingestion (people,
  organisations, dates, amounts, case numbers) plus tags and metadata values.

Every result is scoped by the *same* authorization rules as the rest of the API:
a user only ever searches documents in cases they hold a live grant for, and an
administrator sees everything. ``search.py`` never trusts a client-supplied case
list.

Design notes
------------
* Candidate documents are capped (``SEARCH_MAX_CANDIDATES``) so this stays
  responsive on SQLite; the ranking itself is in-process.
* Postgres can later replace the ranking step with ``tsvector`` + ``pgvector``
  without changing this module's contract, the schemas or the frontend.
"""


import json
import time
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from . import models, schemas
from .text import boost_tokens, cosine, embed, excerpt, normalize, tokenize

MAX_CANDIDATES = 500
TITLE_WEIGHT = 3
TAG_WEIGHT = 2


def _authorized_case_ids(db: Session, user: models.User) -> list[str] | None:
    """Return the case ids a user may search, or ``None`` for unrestricted admins."""
    from .services import AccessService

    if AccessService._is_admin(db, user.id):
        return None
    now = datetime.now(timezone.utc)
    grants = db.scalars(
        select(models.AuthorizedAccess).where(
            models.AuthorizedAccess.user_id == user.id,
            models.AuthorizedAccess.case_id.is_not(None),
        )
    )
    case_ids: list[str] = []
    for grant in grants:
        valid_from = grant.valid_from
        if valid_from is not None and valid_from.tzinfo is None:
            valid_from = valid_from.replace(tzinfo=timezone.utc)
        valid_until = grant.valid_until
        if valid_until is not None and valid_until.tzinfo is None:
            valid_until = valid_until.replace(tzinfo=timezone.utc)
        if valid_from is not None and valid_from > now:
            continue
        if valid_until is not None and valid_until < now:
            continue
        if grant.case_id:
            case_ids.append(grant.case_id)
    return sorted(set(case_ids))


def _to_aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def _document_index(
    db: Session, document_ids: list[str]
) -> tuple[dict[str, list[str]], dict[str, dict[str, str]], dict[str, datetime]]:
    """Bulk-load tags, metadata and latest-version timestamps for candidates."""
    tag_map: dict[str, list[str]] = {document_id: [] for document_id in document_ids}
    metadata_map: dict[str, dict[str, str]] = {document_id: {} for document_id in document_ids}
    activity_map: dict[str, datetime] = {}

    if not document_ids:
        return tag_map, metadata_map, activity_map

    rows = db.execute(
        select(models.DocumentTag.document_id, models.ClassificationTag.name)
        .join(models.ClassificationTag, models.ClassificationTag.id == models.DocumentTag.tag_id)
        .where(models.DocumentTag.document_id.in_(document_ids))
    )
    for document_id, tag_name in rows:
        tag_map.setdefault(document_id, []).append(tag_name)

    for item in db.scalars(
        select(models.DocumentMetadata).where(models.DocumentMetadata.document_id.in_(document_ids))
    ):
        metadata_map.setdefault(item.document_id, {})[item.meta_key] = item.meta_value

    for version in db.scalars(
        select(models.DocumentVersion).where(models.DocumentVersion.document_id.in_(document_ids))
    ):
        created = _to_aware(version.created_at)
        if created is None:
            continue
        current = activity_map.get(version.document_id)
        if current is None or created > current:
            activity_map[version.document_id] = created

    return tag_map, metadata_map, activity_map


def _haystack(document: models.Document, case: models.Case, tags: list[str], metadata: dict[str, str]) -> str:
    parts = [
        document.title,
        document.doc_type,
        case.case_number,
        case.title,
        " ".join(tags),
        " ".join(value for value in metadata.values() if value),
    ]
    return " ".join(part for part in parts if part)


def _entity_terms(tags: list[str], metadata: dict[str, str]) -> set[str]:
    """Every normalized string a user could reasonably search by as an 'entity'."""
    terms: set[str] = {normalize(tag) for tag in tags}
    for key, value in metadata.items():
        if key == "ml_entities" or not value:
            continue
        terms.add(normalize(value))
    try:
        entities = json.loads(metadata.get("ml_entities", "{}"))
    except (ValueError, TypeError):
        entities = {}
    for names in entities.values():
        if isinstance(names, list):
            terms.update(normalize(name) for name in names)
    terms.discard("")
    return terms


def _as_aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def _version_counts(db: Session, document_ids: list[str]) -> dict[str, int]:
    counts: dict[str, int] = {document_id: 0 for document_id in document_ids}
    if not document_ids:
        return counts
    rows = db.execute(
        select(models.DocumentVersion.document_id, func.count())
        .where(models.DocumentVersion.document_id.in_(document_ids))
        .group_by(models.DocumentVersion.document_id)
    )
    for document_id, count in rows:
        counts[document_id] = int(count)
    return counts


def _safe_entities(metadata: dict[str, str]) -> dict[str, list[str]]:
    try:
        raw = json.loads(metadata.get("ml_entities", "{}"))
    except (ValueError, TypeError):
        return {}
    if not isinstance(raw, dict):
        return {}
    return {
        str(key): [str(name) for name in value]
        for key, value in raw.items()
        if isinstance(value, list) and value
    }


def _facets(hits: list[schemas.SearchHitOut]) -> schemas.SearchFacetsOut:
    """Filter chips derived from the current result set (authorization already applied)."""
    entities: dict[str, list[str]] = {}
    doc_types: set[str] = set()
    tags: set[str] = set()
    sensitivities: set[str] = set()
    for hit in hits:
        doc_types.add(hit.doc_type)
        sensitivities.add(hit.sensitivity_level)
        tags.update(hit.tags)
        for category, names in hit.entities.items():
            bucket = entities.setdefault(category, [])
            for name in names:
                if name not in bucket:
                    bucket.append(name)
    return schemas.SearchFacetsOut(
        entities={key: sorted(value)[:10] for key, value in sorted(entities.items())},
        doc_types=sorted(doc_types),
        tags=sorted(tags)[:40],
        sensitivity_levels=sorted(sensitivities),
    )


class SearchService:
    """Authorized, explainable search across case evidence."""

    @staticmethod
    def search(
        db: Session,
        user: models.User,
        *,
        query: str = "",
        case_id: Optional[str] = None,
        from_date: datetime | None = None,
        to_date: datetime | None = None,
        entity: Optional[str] = None,
        doc_type: Optional[str] = None,
        sensitivity: Optional[str] = None,
        limit: int = 25,
        offset: int = 0,
    ) -> schemas.SearchResponseOut:
        started = time.perf_counter()
        allowed = _authorized_case_ids(db, user)
        if case_id and allowed is not None and case_id not in allowed:
            raise PermissionError("No access to that case")
        if allowed is not None and not allowed:
            return schemas.SearchResponseOut(
                query=query, total=0, limit=limit, offset=offset, took_ms=0,
                hits=[], facets=schemas.SearchFacetsOut(),
            )

        stmt = (
            select(models.Document, models.Case)
            .join(models.Case, models.Case.id == models.Document.case_id)
            .order_by(models.Document.created_at.desc())
            .limit(MAX_CANDIDATES)
        )
        if allowed is not None:
            stmt = stmt.where(models.Document.case_id.in_(allowed))
        if case_id:
            stmt = stmt.where(models.Document.case_id == case_id)
        if doc_type:
            stmt = stmt.where(models.Document.doc_type == normalize(doc_type))
        if sensitivity:
            stmt = stmt.where(models.Document.sensitivity_level == normalize(sensitivity))

        rows = db.execute(stmt).all()
        documents = [row[0] for row in rows]
        cases = {row[0].id: row[1] for row in rows}
        document_ids = [document.id for document in documents]
        tag_map, metadata_map, activity_map = _document_index(db, document_ids)
        version_counts = _version_counts(db, document_ids)

        query_clean = normalize(query)
        query_tokens = tokenize(query)
        query_vector = boost_tokens(embed(query), query_tokens) if query_tokens else {}
        entity_needle = normalize(entity) if entity else ""
        from_bound = _as_aware(from_date)
        to_bound = _as_aware(to_date)

        hits: list[schemas.SearchHitOut] = []
        for document in documents:
            case = cases[document.id]
            tags = tag_map.get(document.id, [])
            metadata = metadata_map.get(document.id, {})
            haystack = _haystack(document, case, tags, metadata)
            excerpt_text = metadata.get("text_excerpt", "")

            # Temporal filter: the document's activity timestamp.
            activity = _to_aware(document.created_at)
            latest = activity_map.get(document.id)
            if latest is not None and (activity is None or latest > activity):
                activity = latest
            if from_bound is not None and (activity is None or activity < from_bound):
                continue
            if to_bound is not None and (activity is None or activity > to_bound):
                continue

            # Entity filter: tags, metadata values and extracted entities.
            if entity_needle:
                terms = _entity_terms(tags, metadata)
                if not any(entity_needle in term or term in entity_needle for term in terms):
                    continue

            score = 0.0
            matched_fields: list[str] = []
            if query_tokens:
                document_vector = boost_tokens(
                    embed(haystack),
                    [document.title] * TITLE_WEIGHT + tags * TAG_WEIGHT + [document.doc_type],
                )
                score = cosine(query_vector, document_vector)
                if query_clean and query_clean in normalize(haystack):
                    score += 0.25
                    matched_fields.append("phrase")
                title_lower = normalize(document.title)
                for token in query_tokens:
                    if token in title_lower and "title" not in matched_fields:
                        matched_fields.append("title")
                    if token in normalize(document.doc_type) and "doc_type" not in matched_fields:
                        matched_fields.append("doc_type")
                    if any(token in normalize(tag) for tag in tags) and "tags" not in matched_fields:
                        matched_fields.append("tags")
                    if any(token in normalize(v) for v in metadata.values()) and "metadata" not in matched_fields:
                        matched_fields.append("metadata")
                    if excerpt_text and token in normalize(excerpt_text) and "content" not in matched_fields:
                        matched_fields.append("content")
                if score <= 0.0:
                    continue
                score = round(min(1.0, score), 4)
            else:
                score = 1.0
                matched_fields.append("recent")

            hits.append(
                schemas.SearchHitOut(
                    document_id=document.id,
                    case_id=document.case_id,
                    case_number=case.case_number,
                    case_title=case.title,
                    title=document.title,
                    doc_type=document.doc_type,
                    sensitivity_level=document.sensitivity_level,
                    score=score,
                    excerpt=excerpt(excerpt_text or haystack, query),
                    tags=sorted(tags),
                    entities=_safe_entities(metadata),
                    matched_fields=matched_fields,
                    activity_at=activity or _to_aware(document.created_at) or datetime.now(timezone.utc),
                    version_count=version_counts.get(document.id, 0),
                )
            )

        hits.sort(key=lambda hit: (-hit.score, -hit.activity_at.timestamp(), hit.title.lower()))
        return schemas.SearchResponseOut(
            query=query,
            total=len(hits),
            limit=limit,
            offset=offset,
            took_ms=int((time.perf_counter() - started) * 1000),
            hits=hits[offset : offset + limit],
            facets=_facets(hits),
        )
"""ML-based document classification and tagging for ANVESHAN V1 (Step 9).

The classifier is a transparent, deterministic, offline scoring model over
document text (when extractable) plus title, ``doc_type`` and existing metadata.
It is intentionally dependency-free so that:

* V1 works with no model download, GPU, network egress or licence concerns;
* every prediction is explainable — each category score is the sum of named
  keyword hits, which satisfies field-level traceability;
* a heavier model (PaddleOCR + a fine-tuned transformer, per the V1 tech stack)
  can replace ``_score_categories`` without touching the API, the database or
  the frontend.

Output is always written through the *existing* document metadata and tagging
structures, never a parallel system, and never applied to the document until a
human accepts it (human-in-the-loop).
"""

from __future__ import annotations


import json
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models, schemas
from .ledger import AuditLedger
from .text import excerpt, extract_entities, extract_text, normalize

ENGINE_NAME = "anveshan-rule-v1"

# metadata keys written by this module
META_CATEGORY = "ml_category"
META_CONFIDENCE = "ml_confidence"
META_TAGS = "ml_tags"
META_ENTITIES = "ml_entities"
META_EXCERPT = "text_excerpt"
META_STATUS = "ml_status"
META_ENGINE = "ml_engine"
META_SCORED_AT = "ml_scored_at"
META_SCORES = "ml_scores"

STATUS_PENDING = "pending"
STATUS_ACCEPTED = "accepted"

# Weighted keyword evidence per document category.
CATEGORY_RULES: dict[str, dict[str, float]] = {
    "fir": {
        "first information report": 3.0, "fir": 2.5, "complainant": 1.5, "cognizable": 1.5,
        "police station": 1.0, "section 154": 2.0, "occurrence": 1.0, "informant": 1.5,
    },
    "charge_sheet": {
        "charge sheet": 3.0, "chargesheet": 3.0, "final report": 2.0, "section 173": 2.0,
        "accused": 1.0, "prosecution": 1.5, "committed to sessions": 2.0, "list of witnesses": 2.0,
    },
    "witness_statement": {
        "witness statement": 3.0, "statement of witness": 3.0, "deponent": 2.0,
        "deposition": 2.0, "section 161": 2.0, "i state that": 1.5, "examined": 1.0,
    },
    "forensic_report": {
        "forensic": 2.5, "examination report": 2.0, "cfsl": 2.5, "fsl": 2.5, "dna": 2.0,
        "ballistic": 2.0, "fingerprint": 1.5, "sample": 1.0, "laboratory": 1.0, "opinion": 1.0,
    },
    "post_mortem": {
        "post mortem": 3.0, "postmortem": 3.0, "autopsy": 3.0, "cause of death": 2.5,
        "rigor mortis": 2.0, "cadaver": 2.0, "morgue": 1.5,
    },
    "medical_report": {
        "medical": 2.0, "injury": 2.0, "treatment": 1.5, "hospital": 1.5, "discharge summary": 2.5,
        "medico legal": 2.5, "doctor": 1.0, "prescription": 1.5,
    },
    "surveillance_media": {
        "cctv": 3.0, "surveillance": 2.5, "footage": 2.5, "cdr": 1.5, "call detail": 2.0,
        "recording": 1.5, "camera": 1.5, "timestamp": 1.0,
    },
    "financial_record": {
        "bank statement": 3.0, "account number": 2.0, "transaction": 1.5, "cheque": 1.5,
        "beneficiary": 1.5, "investment": 1.0, "money trail": 2.5, "upi": 1.5, "ledger": 1.0,
    },
    "court_order": {
        "court": 2.0, "hon'ble": 2.5, "judgment": 2.5, "order": 1.5, "bail": 2.0,
        "petition": 1.5, "sessions judge": 2.5, "magistrate": 2.0, "adjourned": 1.5,
    },
    "seizure_memo": {
        "seizure": 3.0, "recovery memo": 3.0, "seized": 2.5, "recovered": 2.0, "memo": 1.5,
        "panchnama": 2.5, "inventory": 1.5, "witnesses to seizure": 2.0,
    },
    "arrest_memo": {
        "arrest": 3.0, "arrested": 2.5, "custody": 1.5, "remand": 2.0, "handcuff": 1.5,
        "arresting officer": 2.5, "grounds of arrest": 2.5,
    },
    "expert_opinion": {
        "expert opinion": 3.0, "section 45": 2.0, "handwriting": 2.0, "cyber forensics": 2.5,
        "analyst": 1.0, "opinion of": 1.5, "conclusion": 1.0,
    },
    "correspondence": {
        "letter": 1.5, "communication": 1.0, "memorandum": 1.5, "forwarded": 1.0,
        "reference number": 1.0, "subject": 1.0, "kindly": 1.0,
    },
}

# ``doc_type`` values strongly imply a category.
DOC_TYPE_HINTS: dict[str, str] = {
    "fir": "fir",
    "charge_sheet": "charge_sheet",
    "witness_statement": "witness_statement",
    "forensic_report": "forensic_report",
    "post_mortem": "post_mortem",
    "medical_report": "medical_report",
    "surveillance": "surveillance_media",
    "surveillance_footage": "surveillance_media",
    "financial_record": "financial_record",
    "court_order": "court_order",
    "seizure_memo": "seizure_memo",
    "arrest_memo": "arrest_memo",
    "expert_opinion": "expert_opinion",
}

DEFAULT_CATEGORY = "unclassified"


def _score_categories(text: str, doc_type: str, title: str) -> dict[str, float]:
    """Weighted keyword scoring across every category. Fully explainable."""
    haystack = normalize(" ".join(part for part in (title, text) if part))
    scores: dict[str, float] = {category: 0.0 for category in CATEGORY_RULES}

    for category, rules in CATEGORY_RULES.items():
        for phrase, weight in rules.items():
            occurrences = haystack.count(phrase)
            if occurrences:
                # First hit scores full weight; repeats add diminishing evidence.
                scores[category] += weight * (1.0 + 0.5 * min(occurrences - 1, 3))

    hint = DOC_TYPE_HINTS.get(normalize(doc_type))
    if hint:
        scores[hint] += 4.0

    return scores


def _explain(scores: dict[str, float], category: str, haystack: str) -> list[str]:
    """Return the high-signal phrases that produced the winning category."""
    if category == DEFAULT_CATEGORY:
        return []
    matched = [
        phrase
        for phrase, weight in CATEGORY_RULES[category].items()
        if weight >= 2.0 and phrase in haystack
    ]
    return sorted(matched)[:5]


def _metadata_map(document: models.Document) -> dict[str, str]:
    return {item.meta_key: item.meta_value for item in document.metadata_items}


def _upsert_metadata(db: Session, document_id: str, key: str, value: str) -> None:
    existing = db.scalar(
        select(models.DocumentMetadata).where(
            models.DocumentMetadata.document_id == document_id,
            models.DocumentMetadata.meta_key == key,
        )
    )
    if existing is None:
        db.add(models.DocumentMetadata(document_id=document_id, meta_key=key, meta_value=value))
    else:
        existing.meta_value = value


def _ensure_tag(db: Session, name: str, category: str) -> models.ClassificationTag:
    tag = db.scalar(select(models.ClassificationTag).where(models.ClassificationTag.name == name))
    if tag is None:
        tag = models.ClassificationTag(name=name, category=category)
        db.add(tag)
        db.flush()
    return tag


def _link_tag(db: Session, document_id: str, tag_id: str) -> bool:
    existing = db.scalar(
        select(models.DocumentTag).where(
            models.DocumentTag.document_id == document_id,
            models.DocumentTag.tag_id == tag_id,
        )
    )
    if existing is not None:
        return False
    db.add(models.DocumentTag(document_id=document_id, tag_id=tag_id))
    return True


class ClassificationService:
    """Produces, stores and applies ML classification + tagging suggestions."""

    @staticmethod
    def analyse(
        document: models.Document,
        content: bytes | None,
        filename: str = "",
        metadata: dict[str, str] | None = None,
    ) -> dict:
        """Pure analysis step: no database writes. Returns the suggestion payload."""
        metadata = metadata or _metadata_map(document)
        extracted = extract_text(content, filename or document.title)
        haystack = normalize(" ".join([document.title, document.doc_type, extracted]))
        scores = _score_categories(extracted, document.doc_type, document.title)

        top_score = max(scores.values()) if scores else 0.0
        total_score = sum(scores.values())
        if top_score <= 0:
            category = DEFAULT_CATEGORY
            confidence = 0.0
        else:
            category = max(scores, key=lambda name: scores[name])
            share = top_score / total_score if total_score else 0.0
            mass = min(1.0, top_score / 8.0)
            confidence = round(0.4 * share + 0.6 * mass, 2)

        suggested_tags = {category} if category != DEFAULT_CATEGORY else set()
        for phrase in _explain(scores, category, haystack):
            suggested_tags.add(phrase)
        if document.doc_type:
            suggested_tags.add(normalize(document.doc_type).replace("_", " "))

        entity_extra = [metadata.get("tags", ""), metadata.get("station", ""), metadata.get("parties", "")]
        entities = extract_entities(extracted, extra=entity_extra)
        for case_number in entities.get("case_numbers", [])[:3]:
            suggested_tags.add(normalize(case_number))

        return {
            "category": category,
            "confidence": confidence,
            "tags": sorted(tag for tag in suggested_tags if tag)[:8],
            "entities": entities,
            "excerpt": excerpt(extracted) or excerpt(document.title),
            "scores": {name: round(value, 2) for name, value in scores.items() if value > 0},
            "engine": ENGINE_NAME,
        }

    @staticmethod
    def _metadata_from_db(db: Session, document_id: str) -> dict[str, str]:
        """Re-read metadata straight from the database (never a stale relationship)."""
        rows = db.scalars(
            select(models.DocumentMetadata).where(models.DocumentMetadata.document_id == document_id)
        )
        return {row.meta_key: row.meta_value for row in rows}

    @staticmethod
    def suggest(db: Session, document: models.Document, content: bytes | None, filename: str = "") -> dict:
        """Run analysis and persist it as document metadata.

        The document itself is deliberately *not* tagged here: suggestions stay
        pending until an officer accepts or overrides them.
        """
        suggestion = ClassificationService.analyse(document, content, filename)
        _upsert_metadata(db, document.id, META_CATEGORY, str(suggestion["category"]))
        _upsert_metadata(db, document.id, META_CONFIDENCE, f"{float(suggestion['confidence']):.2f}")
        _upsert_metadata(db, document.id, META_TAGS, json.dumps(suggestion["tags"]))
        _upsert_metadata(db, document.id, META_ENTITIES, json.dumps(suggestion["entities"], sort_keys=True))
        _upsert_metadata(db, document.id, META_EXCERPT, str(suggestion["excerpt"]))
        _upsert_metadata(db, document.id, META_SCORES, json.dumps(suggestion["scores"], sort_keys=True))
        _upsert_metadata(db, document.id, META_ENGINE, str(suggestion["engine"]))
        _upsert_metadata(db, document.id, META_STATUS, STATUS_PENDING)
        _upsert_metadata(db, document.id, META_SCORED_AT, datetime.now(timezone.utc).isoformat())
        db.flush()
        return suggestion

    @staticmethod
    def suggestions(db: Session, document: models.Document) -> dict:
        """Current persisted suggestion state for a document."""
        metadata = ClassificationService._metadata_from_db(db, document.id)

        def _load(key: str, fallback):
            try:
                return json.loads(metadata[key])
            except (KeyError, ValueError, TypeError):
                return fallback

        status = metadata.get(META_STATUS, STATUS_PENDING)
        accepted_tags = _load("ml_accepted_tags", None)
        tags = accepted_tags if isinstance(accepted_tags, list) else _load(META_TAGS, [])
        return {
            "document_id": document.id,
            "engine": metadata.get(META_ENGINE, ENGINE_NAME),
            "status": status,
            # Once a human has confirmed, the confirmed values are the record of truth.
            "category": metadata.get("ml_accepted_category") or metadata.get(META_CATEGORY, DEFAULT_CATEGORY),
            "confidence": float(metadata.get(META_CONFIDENCE, "0") or 0.0),
            "tags": tags,
            "entities": _load(META_ENTITIES, {}),
            "scores": _load(META_SCORES, {}),
            "excerpt": metadata.get(META_EXCERPT, ""),
            "scored_at": metadata.get(META_SCORED_AT),
        }

    @staticmethod
    def accept(
        db: Session,
        document: models.Document,
        actor_user_id: Optional[str],
        *,
        tags: list[str] | None = None,
        category: Optional[str] = None,
    ) -> dict:
        """Human confirmation: apply suggestions into the real tagging system."""
        db.flush()
        metadata = ClassificationService._metadata_from_db(db, document.id)
        try:
            suggested_tags = json.loads(metadata.get(META_TAGS, "[]"))
        except (ValueError, TypeError):
            suggested_tags = []

        chosen_tags = [normalize(name) for name in (tags if tags is not None else suggested_tags)]
        chosen_tags = [name for name in dict.fromkeys(chosen_tags) if name]
        chosen_category = normalize(category) or metadata.get(META_CATEGORY, DEFAULT_CATEGORY)

        linked = 0
        for name in chosen_tags:
            tag = _ensure_tag(db, name, "ml-classification")
            if _link_tag(db, document.id, tag.id):
                linked += 1

        _upsert_metadata(db, document.id, META_STATUS, STATUS_ACCEPTED)
        _upsert_metadata(db, document.id, "ml_accepted_category", chosen_category)
        _upsert_metadata(db, document.id, "ml_accepted_tags", json.dumps(chosen_tags))
        db.flush()

        AuditLedger.record(
            db,
            event_type="ml_suggestions_accepted",
            actor_user_id=actor_user_id,
            case_id=document.case_id,
            document_id=document.id,
            payload={"category": chosen_category, "tags": chosen_tags, "tags_linked": linked},
        )
        db.commit()
        return {
            "document_id": document.id,
            "category": chosen_category,
            "tags": chosen_tags,
            "tags_linked": linked,
        }

    # ------------------------------------------------------------------
    # Manual tagging (the human-driven counterpart of the suggestions above)
    # ------------------------------------------------------------------

    @staticmethod
    def create_tag(db: Session, payload: schemas.TagCreate) -> models.ClassificationTag:
        """Create a classification tag, reusing an existing one with the same name."""
        name = normalize(payload.name)
        if not name:
            raise ValueError("Tag name is required")
        existing = db.scalar(
            select(models.ClassificationTag).where(models.ClassificationTag.name == name)
        )
        if existing is not None:
            return existing
        tag = models.ClassificationTag(name=name, category=payload.category)
        db.add(tag)
        db.commit()
        db.refresh(tag)
        return tag

    @staticmethod
    def link_tag(db: Session, document_id: str, tag_id: str) -> models.DocumentTag:
        """Link a tag to a document (idempotent)."""
        existing = db.scalar(
            select(models.DocumentTag).where(
                models.DocumentTag.document_id == document_id,
                models.DocumentTag.tag_id == tag_id,
            )
        )
        if existing is not None:
            return existing
        link = models.DocumentTag(document_id=document_id, tag_id=tag_id)
        db.add(link)
        db.commit()
        db.refresh(link)
        return link
# ANVESHAN Architecture

## Product boundary

ANVESHAN is an evidence-centric investigation platform. A case is the top-level investigation boundary; evidence, documents, people, events, and derived artifacts are linked to that case. Evidence must remain traceable to its source and every important action must be auditable.

## Initial workflow

```text
Create case
    -> Register investigator and access purpose
    -> Register source document or evidence
    -> Record immutable hash and acquisition metadata
    -> Add version without overwriting the original
    -> Record custody or derivation event
    -> Review timeline and related evidence
    -> Export or share only through an authorized transfer
```

The first implementation slice is deliberately small:

1. Create and list cases.
2. Register a document as evidence for a case.
3. Add immutable versions and source metadata.
4. Grant purpose-bound access.
5. Expose a stable API that later UI, search, and AI components can consume.

## Repository responsibilities

| Area | Responsibility | First milestone |
| --- | --- | --- |
| `backend/` | FastAPI API, persistence, and service layer | Complete the case/evidence API |
| `evidence-engine/` | Hashing, sealing, provenance, custody, and integrity checks | Hash and verify a synthetic artifact |
| `security/` | Authentication, authorization, audit, and threat controls | Define access and audit contracts |
| `search/` | Full-text and evidence relationship retrieval | Search case documents by metadata |
| `ai/` | Grounded extraction, timeline, contradiction, and question answering | Return answers with evidence references |
| `frontend/` | Investigator and review workflows | Case and evidence workspace |
| `offline-client/` | Encrypted field vault and synchronization queue | Store and sync synthetic evidence |
| `database/` | PostgreSQL schema and migrations | Keep schema aligned with models |
| `tests/` | Unit, API, security, and integration coverage | Test the first vertical slice |
| `demo-data/` | Synthetic cases and evidence only | Seed a safe demonstration scenario |

## Technology direction

- **API:** Python and FastAPI
- **Persistence:** PostgreSQL with SQLAlchemy; SQLite is suitable for local development
- **Object storage:** S3-compatible storage for evidence bytes
- **Search:** OpenSearch or Elasticsearch
- **AI:** Python-based OCR, extraction, retrieval, and grounded LLM adapters
- **Identity:** OAuth2/OIDC with JWT-backed API sessions
- **Integrity:** SHA-256 hashes, signatures, append-only audit records
- **Client:** React or Next.js investigator interface
- **Operations:** Docker-compatible local and deployment environments

Technology adapters should stay behind service boundaries so the API does not depend directly on a particular storage, search, or model vendor.

## Non-negotiable constraints

- Never overwrite an original evidence record.
- Never treat an AI response as evidence; responses must cite supporting records or abstain.
- Use synthetic or anonymized data in development and tests.
- Make authorization purpose-bound and case-aware.
- Preserve enough provenance to trace a derived artifact back to its source.

## Current limitations

- Authentication, MFA, RBAC, ABAC, and PostgreSQL RLS are not active yet.
- Evidence retrieval is implemented for development, but must be placed behind authenticated, case-aware authorization before production use.
- Local storage is private to the backend process but is not application-encrypted at rest.
- Supabase Storage integration is configuration-ready but requires a real private bucket integration test.
- Database migrations are not set up; the current local bootstrap uses SQLAlchemy table creation.
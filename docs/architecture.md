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

- JWT authentication and grant checks are active; provider MFA, full RBAC/ABAC policy coverage, and PostgreSQL RLS are not active yet.
- Evidence retrieval is implemented for development, but must be placed behind authenticated, case-aware authorization before production use.
- Local storage is private to the backend process but is not application-encrypted at rest.
- Supabase Storage integration is configuration-ready but requires a real private bucket integration test.
- Database migrations are not set up; the current local bootstrap uses SQLAlchemy table creation.

## Authentication contract

The V1 API expects a bearer JWT from the configured identity provider. The `sub` claim maps to an active local user. The backend evaluates case and document grants for every sensitive operation; frontend visibility is not an authorization mechanism. Supabase Auth is the planned provider, with MFA enabled at the provider boundary.

## Feature Roadmap & Scope

All features are drawn from the three tiers of the Problem Statement and are explicitly tracked here. V1 delivers the secure, auditable foundation; V2 adds intelligence and automation; V2+ completes the "winning project" layer.

---

### Category 1 — PS Basic Requirements (directly demanded by the problem statement)

| # | Feature | V1 | V2 |
|---|---|:---:|:---:|
| I | **Strong Security & Access Control** — Role-based perimeter, least-privilege grants, and case-aware authorization on every API call | ✅ | |
| II | **Centralized Case Related Archive** — Single authoritative store for all cases, evidence, documents, people, and events | ✅ | |
| III | **Tamper-Proof Blockchain Audit Trail** — Append-only, hash-chained audit log; every write event is sealed and verifiable | ✅ | |
| IV | **Admin Dashboard & Managed Authorized Access** — MFA, RBAC, and ABAC enforced at both the provider boundary and API layer | ✅ | |
| V | **Version Control – Document Lifecycle** — Every document version is stored immutably; originals are never overwritten | ✅ | |
| VI | **Semantic / Temporal / Entity Search & Retrieval** — Full-text, date-range, and named-entity search across all case records | ✅ (foundation) | ✅ (maturity) |
| VII | **Evidence Integrity** — SHA-256 hash recorded at ingestion; hash re-verified on every access; originals preserved | ✅ | |
| VIII | **Secure Inter-Department / Inter-Agency Transfer** — Encrypted, authenticated, and logged evidence handoff between teams | ✅ | |
| IX | **Cloud Computing** — S3-compatible object storage, managed identity, and horizontally scalable API deployment | ✅ | |
| X | **Document Metadata Logs — ML Classification & Tagging** — Automated tag suggestions and metadata enrichment from an ML classifier | | ✅ |
| XI | **Digital Signatures & SHA-256 Hashing** — Every evidence artifact is SHA-256 hashed and optionally signed by the submitting officer | ✅ | |
| XII | **Extra Privacy for Sensitive Data** — Field-level encryption, data minimization, and redaction controls for PII and classified records | ✅ | |
| XIII | **Integrated Datasets** — Schema and access control for Criminal Records (Prison + NCRBI), E-Forensics (NCRBI + Forensics team), and Nyaya (judicial verdicts + NCRBI) | ✅ (schema) | ✅ (live integration) |

---

### Category 2 — Other Mandatory / Commonly Expected Features

| # | Feature | V1 | V2 |
|---|---|:---:|:---:|
| I | **Document Interconnecting & Lineage** — Objects reference each other; the full derivation chain is maintained and queryable | | ✅ |
| II | **Government API – ID Verification** — Officer and witness identities validated against a government identity API | | ✅ |
| III | **Timeline Reconstruction** — Automated chronological event reconstruction from evidence timestamps and metadata | | ✅ |
| IV | **Field-Level Traceability** — Every extracted data point carries a back-reference to its source document and page | | ✅ |
| V | **Confidence Score & Contradiction Detection** — ML-assigned confidence on extractions; automatic flagging of contradictory records | | ✅ |
| VI | **Human-in-the-Loop Flagging** — Ambiguous, conflicting, or low-confidence items are routed to a human reviewer before any action | | ✅ |
| VII | **Case Summary & Action Suggestions** — AI-generated summaries, applicable law codes, and next-step recommendations, gated by mandatory human approval | | ✅ |
| VIII | **Official Templates & Charge Sheet Generation** — Structured generation of FIRs, charge sheets, and standard legal documents from case data | | ✅ |
| IX | **Encryption of Sensitive Documents** — AES-256 at rest and TLS 1.3 in transit for all evidence files and documents | ✅ | |
| X | **Backup & Recovery** — Automated scheduled backups with point-in-time recovery and tested restoration procedures | ✅ | |

---

### Category 3 — Special Ideas (the "winning project" layer)

| # | Feature | V2+ |
|---|---|:---:|
| I | **Provenance Graph** — Visual graph of document origin, custody transfers, derivations, and relationships across the entire case | ✅ |
| II | **Document Passport** — Per-document summary card tracking its full history, versions, custody chain, and current status | ✅ |
| III | **Offline Vault & Local Engine** — AES-encrypted local vault for field use; a local inference engine operates on sensitive data without cloud connectivity | ✅ |
| IV | **Multi-Source Evidence Fusion** — Unified analysis and cross-referencing of audio, video, image, and text evidence in a single pipeline | ✅ |
| V | **AI-Assisted Investigation** — Model trained on historical case patterns to surface connections, suggest leads, and highlight anomalies | ✅ |
# ANVESHAN V1 — Development Workflow

> **Reference document**: maps each build step to database, backend, and frontend responsibilities with a
> specific checkpoint that must pass before the next step begins.

---

## Current-State Audit (as of V1 baseline)

Before building, here is what already exists and what is still needed:

| Area | Status | Notes |
|---|---|---|
| DB schema — users, roles, user_roles | ✅ Done | `v1_schema.sql` + `models.py` |
| DB schema — cases, case_events | ✅ Done | Hash-chained event log |
| DB schema — documents, metadata, versions | ✅ Done | Immutable versioning |
| DB schema — document_signatures | ✅ Done | RSA-PSS-SHA256 |
| DB schema — classification_tags, document_tags | ✅ Done | |
| DB schema — original_document_records | ✅ Done | |
| DB schema — identity_verification_records | ✅ Done | |
| DB schema — external_record_references | ✅ Done | |
| DB schema — authorized_access | ✅ Done | ABAC grants |
| DB schema — audit_ledger_records | ✅ Done | Blockchain-linked |
| Backend — JWT auth + TOTP MFA | ✅ Done | auth.py |
| Backend — password hash (scrypt) | ✅ Done | |
| Backend — RBAC (admin/user/auditor roles) | ✅ Done | |
| Backend — ABAC grant checks (case + doc level) | ✅ Done | |
| Backend — SHA-256 hashing on upload | ✅ Done | _HashingReader |
| Backend — Integrity verification endpoint | ✅ Done | |
| Backend — Digital signature (RSA-PSS) + verify | ✅ Done | signatures.py |
| Backend — Blockchain audit ledger (local + Fabric) | ✅ Done | ledger.py |
| Backend — Document upload / version creation | ✅ Done | |
| Backend — Case event append-only trail | ✅ Done | |
| Backend — Access grant management | ✅ Done | |
| Backend — Tags / classification | ✅ Done | |
| Backend — External record references | ✅ Done | |
| Backend — Search (semantic/temporal/entity) | ❌ Missing | search/ is empty |
| Backend — ML classification / tagging | ❌ Missing | ai/ is empty |
| Backend — Secure inter-dept/agency transfer API | ❌ Missing | |
| Backend — Gov API identity verification bridge | ❌ Missing | Stub only |
| Backend — Backup and recovery automation | ❌ Missing | |
| Frontend — Auth screens (login, MFA) | ❌ Missing | Single App.jsx exists but needs proper routing |
| Frontend — Role-aware dashboard | ❌ Missing | |
| Frontend — Case list / creation | ❌ Missing | |
| Frontend — Document archive / upload | ❌ Missing | |
| Frontend — Version history view | ❌ Missing | |
| Frontend — Integrity / signature status | ❌ Missing | |
| Frontend — Search interface | ❌ Missing | |
| Frontend — Transfer interface | ❌ Missing | |
| Frontend — Blockchain audit view | ❌ Missing | |
| DB migrations (Alembic) | ❌ Missing | Currently uses raw SQLAlchemy create_all |
| Cloud deployment config | ❌ Missing | Docker-compose only |

---

## Step 1 — Database Foundation

**Goal:** All V1 tables are present, indexed, and migration-managed.

> NOTE: The DB schema is 100% complete in v1_schema.sql and models.py. The missing piece is a migration system.

### Database (database/)
- [x] Introduce Alembic for migration management
- [x] Convert v1_schema.sql into the initial Alembic migration (0001_initial.py)
- [x] Enable and test the RLS policies in v1_schema.sql (currently commented out)
- [x] Add a seed script for default roles (admin, user, auditor) and a bootstrap admin user

### Backend (backend/)
- [x] Replace db.create_all() bootstrap with Alembic upgrade head invocation in startup
- [x] Expose GET /v1/health returning DB connection status

### Checkpoint
> Can we create a user, a case, and a document record through the API using a fresh database?

---

## Step 2 — Authentication + Access Control

**Goal:** Every protected route enforces MFA + RBAC + ABAC. Different roles see only what they are permitted.

> NOTE: JWT, TOTP-MFA, RBAC, and ABAC grant checks are already implemented. Missing: REQUIRE_MFA enforcement flag in production config and the frontend auth screens.

### Backend (backend/)
- [x] Set REQUIRE_MFA=true as default in the production environment template
- [x] Add GET /v1/users/me — returns current user info with role list
- [x] Add POST /v1/roles/{user_id}/assign — admin-only role assignment endpoint
- [x] Activate PostgreSQL RLS by default when DATABASE_URL is a PostgreSQL URI

### Frontend (frontend/)
- [x] Login screen — email + password form, calls POST /v1/auth/login
- [x] MFA screen — TOTP code entry, calls POST /v1/auth/mfa/verify; shows QR setup if first time
- [x] Role-aware dashboard shell — sidebar and routes adapt based on JWT role claims
- [x] Admin panel — list users, assign roles, manage access grants
- [x] Authorized-access management screen — create/view purpose-bound grants

### Checkpoint
> Investigator logs in, enters TOTP, sees only their cases. Admin sees all. Auditor sees audit trail only.

---

## Step 3 — Centralized Case Related Archive

**Goal:** Cases are the primary workspace. Documents are organized inside cases with metadata and tags.

> NOTE: All backend APIs for cases, documents, metadata, and tags are implemented. Frontend is missing.

### Backend (backend/)
- [ ] Add GET /v1/cases/{case_id} — single case detail
- [ ] Add GET /v1/cases/{case_id}/documents — list all documents in a case
- [ ] Add GET /v1/tags — list all available classification tags
- [ ] Add GET /v1/documents/{document_id}/tags — list tags on a document

### Frontend (frontend/)
- [ ] Case list page — paginated list of accessible cases
- [ ] Case creation form — case number, title, description
- [ ] Case dashboard — document list, event timeline, access grants
- [ ] Document organization view — sort/filter by type, sensitivity, tags
- [ ] Metadata and tagging interface — key-value pairs and tag selector

### Checkpoint
> Create a case, add documents, apply metadata and tags, retrieve the organized case archive.

---

## Step 4 — Secure Document Management

**Goal:** Authorized upload, encrypted storage, and controlled retrieval of sensitive documents.

> NOTE: Backend upload, storage, and retrieval are implemented. Encryption at rest requires verifying S3 SSE or app-level AES.

### Backend (backend/)
- [ ] Verify S3-compatible storage has SSE enabled
- [ ] Add app-level AES-256 envelope encryption for documents marked sensitivity_level=classified
- [ ] Add GET /v1/cases/{case_id}/documents with sensitivity filter
- [ ] Enforce that download action is logged to the audit ledger

### Frontend (frontend/)
- [ ] Document upload panel — drag-and-drop + file picker, metadata entry, sensitivity selector
- [ ] Classification/tagging step — applied at upload
- [ ] Document explorer — filterable list with sensitivity badges
- [ ] Document preview/retrieval — authenticated streaming download

### Checkpoint
> Authorized user uploads a classified document, sees sensitivity badge, downloads it; unauthorized user is rejected.

---

## Step 5 — Document Lifecycle / Version Control

**Goal:** Every version is preserved. Originals are never overwritten. History is always inspectable.

> NOTE: DocumentVersion, OriginalDocumentRecord, and the upload endpoint that auto-creates the original record on version 1 are all done.

### Backend (backend/)
- [ ] Add GET /v1/documents/{document_id}/original — retrieve the sealed original record + its hash
- [ ] Ensure the original version is immutable: block DELETE on version_number=1

### Frontend (frontend/)
- [ ] Version history panel — ordered list of versions with author, timestamp, notes
- [ ] View original button — always links to version_number=1 with its sealed hash
- [ ] Document lifecycle timeline — visual representation of version history

### Checkpoint
> Upload a document, create a new version, view full history, retrieve and confirm the original is unchanged.

---

## Step 6 — SHA-256 + Evidence Integrity

**Goal:** Any tamper with stored evidence is detectable on demand.

> NOTE: Hash generation at upload and the integrity verification endpoint (POST /verify-integrity) are done.

### Backend (backend/)
- [ ] Add scheduled background integrity sweep: re-verify all versions daily and write results to audit ledger
- [ ] Add GET /v1/documents/{document_id}/integrity-summary — last known integrity status per version

### Frontend (frontend/)
- [ ] Integrity status badge on the document card (VERIFIED / TAMPERED / UNVERIFIED)
- [ ] Verify now button — triggers on-demand check, shows expected vs. observed hash
- [ ] Original document integrity display — prominently shows the sealed hash

### Checkpoint
> Change (corrupt) a stored file, call verify, system reports hash mismatch and TAMPERED status.

---

## Step 7 — Digital Signatures

**Goal:** Officers can sign document versions; any verifier can confirm signature validity.

> NOTE: signatures.py, the sign endpoint, and the verify endpoint are all implemented.

### Backend (backend/)
- [ ] Add GET /v1/documents/{document_id}/versions/{version_id}/signatures — list all signatures on a version
- [ ] Persist the signing officer's key pair securely (HSM or vault-backed in production)

### Frontend (frontend/)
- [ ] Sign button on version detail — triggers POST .../sign
- [ ] Signature status indicator — SIGNED / UNSIGNED / INVALID
- [ ] Signature detail panel — algorithm, signer, signed hash, verified result

### Checkpoint
> A document version is signed by an officer; another user verifies the signature and sees it as valid.

---

## Step 8 — Search and Retrieval

**Goal:** Users can find case documents naturally using text, date, and entity queries.

> CAUTION: search/ directory is empty. This step requires new service implementation.

### Backend (backend/ + search/)
- [ ] Integrate OpenSearch or Elasticsearch client
- [ ] Index document metadata, title, type, tags, and case info on upload
- [ ] Implement GET /v1/search?q=&from_date=&to_date=&entity=&case_id= — semantic + temporal + entity search
- [ ] Connect search results back to document IDs for authorized retrieval

### Database (database/)
- [ ] Ensure document_metadata, classification_tags, and case_events fields are correctly exported to the search index

### Frontend (frontend/)
- [ ] Global search bar — persistent in the top nav
- [ ] Semantic search results page — ranked results with document type, case, and sensitivity
- [ ] Temporal filters — date-range picker
- [ ] Entity filters — named-entity chips (people, locations, organizations)

### Checkpoint
> User types a natural-language query, relevant documents are returned across cases they have access to.

---

## Step 9 — ML Classification + Tagging

**Goal:** Uploaded documents are auto-classified and tagged; human reviewers can accept or override.

> CAUTION: ai/ directory is empty. This step requires new model integration.

### Backend (backend/ + ai/)
- [ ] Implement a document text extractor (PyMuPDF / Tesseract OCR for images)
- [ ] Integrate an ML classifier that returns category + confidence + suggested tags
- [ ] On document upload, trigger async classification and write results back as DocumentMetadata
- [ ] Add GET /v1/documents/{document_id}/ml-suggestions — returns predicted classification and tags
- [ ] Add POST /v1/documents/{document_id}/ml-suggestions/accept — officer confirms and applies ML output

### Frontend (frontend/)
- [ ] ML suggestion panel on document detail — predicted classification, confidence score, and suggested tags
- [ ] Accept / Override controls — officer must confirm before suggestions become permanent metadata

### Checkpoint
> Upload a document, ML returns classification and tags, they appear in the document record after officer confirmation.

---

## Step 10 — Secure Inter-Department / Inter-Agency Transfer

**Goal:** An authorized officer can securely hand evidence to another authorized stakeholder.

> CAUTION: No transfer API exists yet. Requires new backend endpoints and a new transfers table.

### Database (database/)
- [ ] Add document_transfers table: id, document_id, from_user_id, to_user_id, from_department, to_department, from_agency, to_agency, transfer_purpose, status, transferred_at, accepted_at, transfer_hash

### Backend (backend/)
- [ ] POST /v1/transfers — create a transfer request; generate a transfer hash; write to audit ledger
- [ ] POST /v1/transfers/{transfer_id}/accept — receiving party accepts; grants are updated
- [ ] GET /v1/transfers — list transfers the current user is a party to
- [ ] GET /v1/transfers/{transfer_id} — transfer detail with audit reference
- [ ] Ensure sensitive documents are re-encrypted for the recipient access scope

### Frontend (frontend/)
- [ ] Transfer initiation screen — select document, recipient, and stated purpose
- [ ] Transfer status tracker — pending / accepted / rejected
- [ ] Transfer history panel on document and case dashboards

### Checkpoint
> Officer A transfers a document to Officer B in another department; B accepts; the audit ledger records both events.

---

## Step 11 — Gov API Identity Verification

**Goal:** Officer and witness identities can be verified against a government identity API.

> NOTE: identity_verification_records table and a stub endpoint exist. The actual API bridge is missing.

### Backend (backend/)
- [ ] Implement GovIdVerificationAdapter — configurable via GOV_ID_API_URL and GOV_ID_API_KEY
- [ ] POST /v1/identity-verifications — now calls the adapter; stores result (verified / failed / pending)
- [ ] GET /v1/users/{user_id}/identity-verifications — list verification history

### Frontend (frontend/)
- [ ] Identity verification status badge on user profiles and investigator details
- [ ] Verify identity button — triggers the Gov API check; shows status in real time

### Checkpoint
> The system calls the Gov API with officer credentials and records a verified or failed result in the database.

---

## Step 12 — Criminal Records / e-Forensics / Nyaya Integration References

**Goal:** A case can reference records from the three external datasets without importing them.

> NOTE: external_record_references table and POST /v1/external-records endpoint exist. Frontend display is missing.

### Backend (backend/)
- [ ] Validate source_system against an allowlist: criminal_records, e_forensics, nyaya
- [ ] Add GET /v1/cases/{case_id}/external-records — list all external references for a case
- [ ] Add GET /v1/documents/{document_id}/external-records — list references on a document

### Frontend (frontend/)
- [ ] External records panel on the case dashboard — shows linked NCRBI / Prison / Nyaya record IDs with deep-link URLs
- [ ] Link external record form — source system selector, record ID, optional URL

### Checkpoint
> A case references a criminal record from NCRBI and a judicial verdict from Nyaya; both appear in the case dashboard.

---

## Step 13 — Blockchain Audit Trail

**Goal:** Every significant event is sealed in a tamper-proof, verifiable audit ledger.

> NOTE: AuditLedger with local chaining and Hyperledger Fabric gateway integration is done. Missing: frontend audit viewer and ledger verification endpoint.

### Backend (backend/)
- [ ] Add GET /v1/audit-trail — paginated list of audit records (admin / auditor only)
- [ ] Add GET /v1/audit-trail/{record_id}/verify — re-computes record_hash and compares against stored value
- [ ] Add GET /v1/cases/{case_id}/audit-trail — case-scoped audit view
- [ ] Add GET /v1/documents/{document_id}/audit-trail — document-scoped audit view

### Frontend (frontend/)
- [ ] Audit trail timeline on case and document dashboards
- [ ] Blockchain verification panel — shows record_hash, previous_hash, ledger_provider, transaction_id
- [ ] Verify chain button — calls the verify endpoint and displays pass / fail with hash comparison

### Checkpoint
> An audit event is created; its hash is verified against the ledger record; chain integrity is confirmed.

---

## Step 14 — Cloud Deployment

**Goal:** The complete V1 system runs outside the local development environment.

> IMPORTANT: This step is a deployment gate, not a feature build. Complete all Steps 1-13 locally first.

### Infrastructure
- [ ] Create docker-compose.yml covering: backend, frontend (nginx), postgres, opensearch
- [ ] Write a Dockerfile for the backend (FastAPI + uvicorn)
- [ ] Write a Dockerfile for the frontend (Vite build to nginx serve)
- [ ] Create .env.production template with all required environment variables

### Backend deployment
- [ ] Configure DATABASE_URL pointing to a managed PostgreSQL instance
- [ ] Configure S3 variables for a real private object-storage bucket
- [ ] Set REQUIRE_MFA=true, JWT_SECRET from a secrets manager
- [ ] Optionally configure BLOCKCHAIN_PROVIDER=fabric + FABRIC_GATEWAY_URL

### Frontend deployment
- [ ] Configure API base URL via environment injection at build time
- [ ] Deploy the Vite build to a CDN or static hosting

### Checkpoint
> The full system is accessible at a real URL, with a managed database and private object storage.

---

## Step 15 — V1 End-to-End Test

**Goal:** The complete V1 user journey works cleanly in one continuous flow.

Run the following scenario manually and via automated integration tests:

```
User Login
  -> MFA verification
  -> Role-aware dashboard loads
  -> Create Case
  -> Upload Document
      -> Metadata entry
      -> Classification / Tags applied
      -> Original record sealed
      -> SHA-256 hash generated and stored
  -> Sign document version (Digital Signature)
  -> Search for the document (semantic query)
  -> Retrieve document (integrity verified)
  -> Create a new Version (original still retrievable)
  -> Verify Integrity (both versions)
  -> Transfer document to another authorized officer
  -> Audit trail records all events
  -> Blockchain verification passes for each audit record
```

### Automated test commands (tests/)
```
pytest tests/ -v --tb=short
```

### Checkpoint
> If this entire flow passes, V1 is complete.

---

## Step Dependency Map

```
Step 1 (DB Foundation)
  Step 2 (Auth + Access Control)
    Step 3 (Case Archive)
      Step 4 (Secure Document Management)
        Step 5 (Version Control)
          Step 6 (SHA-256 Integrity)
            Step 7 (Digital Signatures)
              Step 8 (Search)
                Step 9 (ML Classification)
                  Step 10 (Transfer)
                    Step 11 (Gov ID Verification)
                      Step 12 (External Records)
                        Step 13 (Blockchain Audit)
                          Step 14 (Cloud Deployment)
                            Step 15 (E2E Test) [V1 COMPLETE]
```

# Backend

The backend is the first working slice of ANVESHAN. It currently provides a FastAPI API backed by SQLAlchemy models and supports:

- users and identity verification records
- cases
- documents, metadata, and immutable versions
- access grants
- classification tags and document signatures
- original and external record references
- append-only audit-ledger records

## Run locally

From the `backend` directory:

```powershell
python -m pip install -r requirements.txt
uvicorn app.main:app --reload
```

The default local database is `sqlite:///./anveshan.db`. Set `DATABASE_URL` to use PostgreSQL or another SQLAlchemy-supported database.

The API is available at `http://127.0.0.1:8000`; interactive documentation is at `/docs`.

## Authentication and authorization

All `/v1` routes require a bearer JWT. In the planned Supabase setup, Supabase Auth issues the token and the backend validates it with `JWT_SECRET`; the backend remains the authority for case and document access. The token `sub` claim must match an active local `users.id` record.

New case creators receive an `admin` access grant for that case. Case administrators can grant access to other users. Evidence reads require `read` access; uploads and metadata/reference changes require `write` access; access-grant management requires `admin` access.

```powershell
curl.exe http://127.0.0.1:8000/v1/cases -H "Authorization: Bearer <supabase-jwt>"
```

Authentication is validated by the API rather than trusted from frontend state. The named prototype identities are explicitly demo-only and bypass MFA. All created users receive a TOTP enrollment secret; an administrator retrieves their one-time enrollment URI from `GET /v1/users/<user-id>/mfa-enrollment`, shares it through an approved channel, and the user completes `/v1/auth/login` then `/v1/auth/mfa/verify`.

## Evidence upload

Upload evidence as multipart form data:

```powershell
curl.exe -X POST http://127.0.0.1:8000/v1/documents/<document-id>/upload `
	-F "file=@evidence.txt" `
	-F "notes=Synthetic evidence"
```

The server streams the uploaded bytes into private object storage, calculates SHA-256 from that stream, and creates the next immutable document version. The client cannot provide or override the stored hash. Empty files and files larger than `MAX_UPLOAD_BYTES` (100 MiB by default) are rejected.

Retrieve a stored version or verify its current bytes with:

```text
GET  /v1/documents/<document-id>/versions/<version-id>/content
POST /v1/documents/<document-id>/versions/<version-id>/verify-integrity
```

Both operations use the server-side storage URI. Integrity verification reads the stored bytes and calculates a fresh SHA-256 digest; it does not trust a hash submitted by the client. Versions can only be created through the upload endpoint.

Local development uses `OBJECT_STORAGE_PROVIDER=local` and stores files under `OBJECT_STORAGE_DIR`. Every stored object is wrapped with AES-256-GCM before it reaches either local or Supabase storage. Set a managed 32-byte URL-safe-base64 `DOCUMENT_ENCRYPTION_KEY`; it is mandatory when `APP_ENV=production`. For Supabase, set `OBJECT_STORAGE_PROVIDER=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and `SUPABASE_STORAGE_BUCKET`. Keep the service key and encryption key server-side.

## Signatures, RLS, and audit ledger

`POST /v1/documents/<document-id>/versions/<version-id>/sign` creates an RSA-PSS-SHA256 signature over the immutable version hash. Verify it with the nested `.../signatures/<signature-id>/verify` endpoint. Set `SIGNING_PRIVATE_KEY_PEM` from a secret manager in production; the local key-file fallback is for development only.

Apply `database/v1_schema.sql` then `database/rls_policies.sql` using a non-owner PostgreSQL migration role. The API sets `app.current_user_id` from the validated JWT so PostgreSQL RLS independently enforces case access. Do not connect application requests as a table owner.

Audit events are hash chained locally for development. Set `BLOCKCHAIN_PROVIDER=fabric`, `FABRIC_GATEWAY_URL`, and `FABRIC_GATEWAY_TOKEN` to commit every upload, case event, and signature to the deployed Fabric REST gateway. Fabric mode fails the request when the gateway does not return a transaction ID; it never silently falls back to a local ledger.

## Current security boundary

JWT/TOTP MFA, role checks for administration, case/document access grants, AES-256-GCM storage encryption, signatures, and PostgreSQL RLS migration scripts are implemented. Before production, provision managed encryption/signing keys, deploy and test the Supabase policies and Fabric gateway, and use a real identity provider rather than the demo identities.

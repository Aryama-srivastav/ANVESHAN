# Backend

The backend is the first working slice of ANVESHAN. It currently provides a FastAPI API backed by SQLAlchemy models and supports:

- users and identity verification records
- cases
- documents, metadata, and immutable versions
- access grants
- classification tags
- original and external record references

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

Authentication is intentionally validated by the API rather than trusted from frontend state. MFA remains the responsibility of the configured identity provider and must be enabled in Supabase before production use.

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

Local development uses `OBJECT_STORAGE_PROVIDER=local` and stores files under `OBJECT_STORAGE_DIR`. For the planned Supabase deployment, set `OBJECT_STORAGE_PROVIDER=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and `SUPABASE_STORAGE_BUCKET`. Keep the service key server-side and never expose it to the frontend.

## Current security boundary

JWT authentication and case/document grant enforcement are implemented. Provider MFA, full RBAC/ABAC policy coverage, and PostgreSQL RLS are still required before production use. Local files are also not encrypted at rest yet; use an encrypted host volume for development and add application/storage encryption before handling sensitive data.
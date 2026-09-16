-- ANVESHAN V1 database foundation (PostgreSQL-oriented SQL)

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY,
    name VARCHAR(80) UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    password_hash VARCHAR(255),
    mfa_secret VARCHAR(64),
    department VARCHAR(120),
    agency VARCHAR(120),
    clearance_level VARCHAR(30),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_roles (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    granted_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_role UNIQUE (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS cases (
    id UUID PRIMARY KEY,
    case_number VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'open',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS case_events (
    id UUID PRIMARY KEY,
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES users(id),
    event_type VARCHAR(80) NOT NULL,
    action VARCHAR(255) NOT NULL,
    details TEXT NOT NULL DEFAULT '{}',
    previous_event_hash VARCHAR(128),
    event_hash VARCHAR(128) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY,
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    doc_type VARCHAR(80) NOT NULL,
    sensitivity_level VARCHAR(30) NOT NULL DEFAULT 'restricted',
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    created_by_user_id UUID REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_metadata (
    id BIGSERIAL PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    meta_key VARCHAR(120) NOT NULL,
    meta_value TEXT NOT NULL,
    CONSTRAINT uq_document_meta_key UNIQUE (document_id, meta_key)
);

CREATE TABLE IF NOT EXISTS document_versions (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    storage_uri VARCHAR(500) NOT NULL,
    content_hash VARCHAR(128) NOT NULL,
    created_by_user_id UUID REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    notes TEXT,
    CONSTRAINT uq_document_version_number UNIQUE (document_id, version_number)
);

CREATE TABLE IF NOT EXISTS document_signatures (
    id UUID PRIMARY KEY,
    document_version_id UUID NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
    signer_user_id UUID REFERENCES users(id),
    algorithm VARCHAR(80) NOT NULL DEFAULT 'RSA-PSS-SHA256',
    signature TEXT NOT NULL,
    public_key_pem TEXT NOT NULL,
    signed_hash VARCHAR(128) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS classification_tags (
    id UUID PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS document_tags (
    id BIGSERIAL PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES classification_tags(id) ON DELETE CASCADE,
    CONSTRAINT uq_document_tag UNIQUE (document_id, tag_id)
);

CREATE TABLE IF NOT EXISTS original_document_records (
    id UUID PRIMARY KEY,
    document_id UUID UNIQUE NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    source_system VARCHAR(120),
    source_reference VARCHAR(255),
    acquired_at TIMESTAMP,
    immutable_hash VARCHAR(128)
);

CREATE TABLE IF NOT EXISTS identity_verification_records (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    verification_method VARCHAR(80) NOT NULL,
    verifier VARCHAR(255) NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'pending',
    verified_at TIMESTAMP,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS external_record_references (
    id UUID PRIMARY KEY,
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    source_system VARCHAR(120) NOT NULL,
    external_record_id VARCHAR(255) NOT NULL,
    record_url VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS authorized_access (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    purpose VARCHAR(255) NOT NULL,
    department VARCHAR(120),
    agency VARCHAR(120),
    sensitivity_level VARCHAR(30),
    access_level VARCHAR(50) NOT NULL DEFAULT 'read',
    valid_from TIMESTAMP NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_ledger_records (
    id UUID PRIMARY KEY,
    case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(80) NOT NULL,
    payload_hash VARCHAR(128) NOT NULL,
    previous_hash VARCHAR(128),
    record_hash VARCHAR(128) UNIQUE NOT NULL,
    ledger_provider VARCHAR(40) NOT NULL,
    transaction_id VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- PostgreSQL RLS scaffold for production enforcement.
-- Set app.current_user_id on every transaction before accessing protected tables.
-- ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE case_events ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE authorized_access ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY cases_case_access ON cases
--     USING (
--         current_user = 'anveshan_admin'
--         OR EXISTS (
--             SELECT 1 FROM authorized_access ga
--             WHERE ga.case_id = cases.id
--               AND ga.user_id = current_setting('app.current_user_id', true)::uuid
--               AND ga.valid_from <= NOW()
--               AND (ga.valid_until IS NULL OR ga.valid_until >= NOW())
--         )
--     );
-- CREATE POLICY documents_case_access ON documents
--     USING (
--         current_user = 'anveshan_admin'
--         OR EXISTS (
--             SELECT 1 FROM authorized_access ga
--             WHERE (ga.document_id = documents.id OR ga.case_id = documents.case_id)
--               AND ga.user_id = current_setting('app.current_user_id', true)::uuid
--               AND ga.valid_from <= NOW()
--               AND (ga.valid_until IS NULL OR ga.valid_until >= NOW())
--         )
--     );
-- CREATE POLICY case_events_case_access ON case_events
--     USING (
--         current_user = 'anveshan_admin'
--         OR EXISTS (
--             SELECT 1 FROM authorized_access ga
--             WHERE ga.case_id = case_events.case_id
--               AND ga.user_id = current_setting('app.current_user_id', true)::uuid
--               AND ga.valid_from <= NOW()
--               AND (ga.valid_until IS NULL OR ga.valid_until >= NOW())
--         )
--     )
--     WITH CHECK (current_user = 'anveshan_admin');
-- CREATE OR REPLACE FUNCTION prevent_case_event_mutation() RETURNS trigger
-- LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'case events are append-only'; END; $$;
-- CREATE TRIGGER case_events_append_only
--     BEFORE UPDATE OR DELETE ON case_events
--     FOR EACH ROW EXECUTE FUNCTION prevent_case_event_mutation();

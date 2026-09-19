-- Apply after v1_schema.sql with a non-owner migration role.
-- The API sets app.current_user_id from the validated JWT subject on every PostgreSQL session.
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorized_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_ledger_records ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION anveshan_is_admin() RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = current_setting('app.current_user_id', true)::text AND r.name = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION anveshan_has_case_access(target_case TEXT, required_level TEXT DEFAULT 'read') RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT anveshan_is_admin() OR EXISTS (
    SELECT 1 FROM authorized_access aa
    WHERE aa.user_id = current_setting('app.current_user_id', true)::text
      AND aa.case_id = target_case AND aa.valid_from <= NOW()
      AND (aa.valid_until IS NULL OR aa.valid_until >= NOW())
      AND CASE required_level WHEN 'admin' THEN aa.access_level = 'admin'
             WHEN 'write' THEN aa.access_level IN ('write', 'admin')
             ELSE aa.access_level IN ('read', 'write', 'admin') END
  );
$$;

CREATE POLICY cases_access ON cases USING (anveshan_has_case_access(id)) WITH CHECK (anveshan_is_admin());
CREATE POLICY documents_access ON documents USING (anveshan_has_case_access(case_id)) WITH CHECK (anveshan_has_case_access(case_id, 'write'));
CREATE POLICY versions_access ON document_versions USING (EXISTS (SELECT 1 FROM documents d WHERE d.id = document_id AND anveshan_has_case_access(d.case_id))) WITH CHECK (EXISTS (SELECT 1 FROM documents d WHERE d.id = document_id AND anveshan_has_case_access(d.case_id, 'write')));
CREATE POLICY metadata_access ON document_metadata USING (EXISTS (SELECT 1 FROM documents d WHERE d.id = document_id AND anveshan_has_case_access(d.case_id))) WITH CHECK (EXISTS (SELECT 1 FROM documents d WHERE d.id = document_id AND anveshan_has_case_access(d.case_id, 'write')));
CREATE POLICY tags_access ON document_tags USING (EXISTS (SELECT 1 FROM documents d WHERE d.id = document_id AND anveshan_has_case_access(d.case_id))) WITH CHECK (EXISTS (SELECT 1 FROM documents d WHERE d.id = document_id AND anveshan_has_case_access(d.case_id, 'write')));
CREATE POLICY events_access ON case_events USING (anveshan_has_case_access(case_id)) WITH CHECK (anveshan_has_case_access(case_id, 'write'));
CREATE POLICY grants_access ON authorized_access USING (user_id = current_setting('app.current_user_id', true)::text OR anveshan_is_admin()) WITH CHECK (anveshan_is_admin());
CREATE POLICY signatures_access ON document_signatures USING (EXISTS (SELECT 1 FROM document_versions v JOIN documents d ON d.id = v.document_id WHERE v.id = document_version_id AND anveshan_has_case_access(d.case_id::text))) WITH CHECK (TRUE);
CREATE POLICY ledger_access ON audit_ledger_records USING (anveshan_is_admin() OR (case_id IS NOT NULL AND anveshan_has_case_access(case_id::text))) WITH CHECK (TRUE);

ALTER TABLE case_events FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_ledger_records FORCE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit records are append-only'; END; $$;
CREATE TRIGGER case_events_append_only BEFORE UPDATE OR DELETE ON case_events FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
CREATE TRIGGER audit_ledger_append_only BEFORE UPDATE OR DELETE ON audit_ledger_records FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();

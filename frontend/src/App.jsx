import React, { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import {
  ArrowLeft, ArrowUpRight, BadgeCheck, Bell, CheckCircle2, ChevronDown,
  ClipboardList, Download, FileAudio, FileImage, FileText, FileVideo,
  Fingerprint, FolderOpen, KeyRound, LayoutDashboard, LockKeyhole,
  LogOut, Menu, Paperclip, Plus, RefreshCw, Search, Settings2,
  ShieldCheck, Upload, Users, X, Zap,
} from "lucide-react";

// ── Constants ─────────────────────────────────────────────────────────────────
const ROLES = {
  investigator: { label: "Investigator", initials: "IN", tone: "sage" },
  user:         { label: "Investigator", initials: "IN", tone: "sage" },
  auditor:      { label: "Auditor",      initials: "AU", tone: "amber" },
  admin:        { label: "Administrator", initials: "AD", tone: "coral" },
};

const DOC_TYPES = ["report", "photograph", "video", "audio", "statement", "forensic_report", "legal_document", "other"];
const SENSITIVITY = ["public", "restricted", "classified"];

function docIconClass(docType) {
  if (!docType) return "default";
  const t = docType.toLowerCase();
  if (t.includes("photo") || t.includes("image")) return "image";
  if (t.includes("audio")) return "audio";
  if (t.includes("video")) return "video";
  if (t.includes("pdf") || t.includes("legal") || t.includes("report")) return "pdf";
  return "text";
}

function DocIcon({ docType }) {
  const cls = docIconClass(docType);
  const icons = { image: FileImage, audio: FileAudio, video: FileVideo, pdf: FileText, text: FileText, default: FolderOpen };
  const Ic = icons[cls] || icons.default;
  return <div className={`doc-icon ${cls}`}><Ic size={18} /></div>;
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ── Tiny helpers ──────────────────────────────────────────────────────────────
function Modal({ title, icon: Icon, onClose, children, wide }) {
  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? "modal-wide" : ""}`}>
        <div className="modal-header">
          <div><div className="modal-icon">{Icon && <Icon size={17} />}</div><h2>{title}</h2></div>
          <button className="row-action" onClick={onClose}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Toast({ message }) {
  if (!message) return null;
  return <div className="toast"><CheckCircle2 size={15} />{message}</div>;
}

function StatusPill({ state, detail }) {
  const cls = state === "Active" ? "" : state === "Review" ? " review" : " expired";
  return <span className={`status-pill${cls}`}><i />{state}{detail && <small> · {detail}</small>}</span>;
}

function LoadingSpinner() {
  return <div className="loading-spinner"><RefreshCw size={16} className="spin" />Loading…</div>;
}

// ── Evidence Upload Modal ─────────────────────────────────────────────────────
function UploadEvidenceModal({ caseId, existingDoc, onClose, onSuccess }) {
  const [step, setStep] = useState(existingDoc ? "upload" : "meta"); // meta → upload → done
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("report");
  const [sensitivity, setSensitivity] = useState("restricted");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState(null);
  const [drag, setDrag] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [docId, setDocId] = useState(existingDoc ? existingDoc.id : null);
  const fileRef = useRef();

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }, []);

  async function submitMeta(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const doc = await api.createDocument({ case_id: caseId, title, doc_type: docType, sensitivity_level: sensitivity });
      setDocId(doc.id);
      setStep("upload");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function submitUpload(e) {
    e.preventDefault();
    if (!file) { setError("Please select a file to upload."); return; }
    setError(""); setLoading(true);
    try {
      await api.uploadDocumentVersion(docId, file, notes);
      setStep("done");
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={existingDoc ? "Upload New Version" : "Add Evidence"} icon={Upload} onClose={onClose} wide>
      {step === "meta" && (
        <form className="modal-form" onSubmit={submitMeta}>
          <label>Evidence title<input value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Crime scene photograph #4" /></label>
          <div className="form-grid">
            <label>Document type
              <select value={docType} onChange={e => setDocType(e.target.value)}>
                {DOC_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
              </select>
            </label>
            <label>Sensitivity level
              <select value={sensitivity} onChange={e => setSensitivity(e.target.value)}>
                {SENSITIVITY.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
          {error && <p className="auth-error">{error}</p>}
          <button className="primary-button" type="submit" disabled={loading}>{loading ? "Creating record…" : "Next: Upload File"} <ArrowUpRight size={15} /></button>
        </form>
      )}
      {step === "upload" && (
        <form className="modal-form" onSubmit={submitUpload}>
          <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
            {existingDoc ? "Select the new version file to upload. It will be securely hashed and appended." : "Record created. Now attach the evidence file — any format supported."}
          </p>
          {!file ? (
            <div
              className={`upload-zone ${drag ? "drag-over" : ""}`}
              onDragOver={e => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current.click()}
            >
              <input type="file" ref={fileRef} onChange={e => setFile(e.target.files[0])} accept="*/*" />
              <Upload size={28} style={{ color: "var(--sage-strong)", margin: "0 auto" }} />
              <p><strong>Drop any file here</strong></p>
              <p>Text, PDF, Image, Audio, Video — up to 200 MB</p>
            </div>
          ) : (
            <div className="upload-preview">
              <Paperclip size={15} />
              <strong>{file.name}</strong>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
              <button type="button" onClick={() => setFile(null)}><X size={14} /></button>
            </div>
          )}
          <label>Version notes (optional)<textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Brief description of this version…" /></label>
          {error && <p className="auth-error">{error}</p>}
          <div style={{ display: "flex", gap: 10 }}>
            {!existingDoc && <button type="button" className="secondary-button" onClick={() => setStep("meta")}>Back</button>}
            <button className="primary-button" type="submit" disabled={loading || !file}>{loading ? "Uploading & hashing…" : "Upload Evidence"} <ShieldCheck size={15} /></button>
          </div>
        </form>
      )}
      {step === "done" && (
        <div style={{ textAlign: "center", padding: "32px 0" }}>
          <div style={{ width: 52, height: 52, background: "var(--sage)", borderRadius: 12, display: "grid", placeItems: "center", margin: "0 auto 16px", color: "var(--sage-strong)" }}><CheckCircle2 size={26} /></div>
          <h3 style={{ margin: "0 0 8px", fontFamily: "'Space Grotesk', sans-serif" }}>Evidence uploaded</h3>
          <p style={{ color: "var(--muted)", fontSize: 13 }}>SHA-256 hash recorded. Original sealed. Audit event written.</p>
          <button className="primary-button" style={{ marginTop: 20 }} onClick={onClose}>Done</button>
        </div>
      )}
    </Modal>
  );
}

// ── Document Detail Modal ─────────────────────────────────────────────────────
function DocumentDetailModal({ doc, onClose, canWrite, onNotify, onVersionUploaded }) {
  const [versions, setVersions] = useState([]);
  const [integrity, setIntegrity] = useState({});
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(null);
  const [uploadingNewVersion, setUploadingNewVersion] = useState(false);

  useEffect(() => {
    api.getDocumentVersions(doc.id).then(setVersions).catch(() => {}).finally(() => setLoading(false));
  }, [doc.id]);

  async function verify(version) {
    setIntegrity(prev => ({ ...prev, [version.id]: "checking" }));
    try {
      const result = await api.verifyIntegrity(doc.id, version.id);
      setIntegrity(prev => ({ ...prev, [version.id]: result.verified ? "verified" : "tampered" }));
    } catch {
      setIntegrity(prev => ({ ...prev, [version.id]: "error" }));
    }
  }

  async function sign(version) {
    setSigning(version.id);
    try {
      await api.signVersion(doc.id, version.id);
      onNotify("Version signed successfully");
    } catch (err) {
      onNotify(err.message || "Signing failed");
    } finally {
      setSigning(null);
    }
  }

  const token = localStorage.getItem("anveshan_token");

  return (
    <Modal title={doc.title} icon={ClipboardList} onClose={onClose} wide>
      <div className="detail-stack">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span className={`doc-badge ${doc.sensitivity_level}`}>{doc.sensitivity_level}</span>
          <span className="doc-badge" style={{ background: "var(--canvas)", color: "var(--muted)" }}>{doc.doc_type?.replace(/_/g, " ")}</span>
          <StatusPill state={doc.status === "active" ? "Active" : doc.status} />
        </div>
        <div>
          <div className="section-label" style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Version history</span>
            {canWrite && (
              <button className="text-button" style={{ fontSize: 12 }} onClick={() => setUploadingNewVersion(true)}>
                <Upload size={12} /> New version
              </button>
            )}
          </div>
          {loading ? <LoadingSpinner /> : versions.length === 0 ? (
            <div className="empty-state" style={{ padding: "20px 0" }}><p>No file uploaded yet.</p></div>
          ) : (
            <div className="version-list">
              {versions.map(v => (
                <div key={v.id} className="version-row">
                  <div className="ver-num">v{v.version_number}</div>
                  <div className="ver-body">
                    <strong>Uploaded {formatDate(v.created_at)}</strong>
                    <span className="hash-display">{v.content_hash}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {integrity[v.id] && (
                      <span className={`integrity-badge ${integrity[v.id] === "checking" ? "unverified" : integrity[v.id]}`}>
                        {integrity[v.id] === "checking" ? "Checking…" : integrity[v.id] === "verified" ? "✓ Verified" : "⚠ Tampered"}
                      </span>
                    )}
                    <button className="secondary-button" style={{ minHeight: 32, padding: "0 10px", fontSize: 11 }} onClick={() => verify(v)}>
                      <ShieldCheck size={13} /> Verify
                    </button>
                    {canWrite && (
                      <button className="secondary-button" style={{ minHeight: 32, padding: "0 10px", fontSize: 11 }} disabled={signing === v.id} onClick={() => sign(v)}>
                        <BadgeCheck size={13} /> {signing === v.id ? "Signing…" : "Sign"}
                      </button>
                    )}
                    <a
                      href={`${api.downloadVersion(doc.id, v.id)}`}
                      target="_blank" rel="noreferrer"
                      className="secondary-button"
                      style={{ minHeight: 32, padding: "0 10px", fontSize: 11, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5 }}
                      onClick={(e) => {
                        // Append token as query param for download
                        e.preventDefault();
                        const url = `${api.downloadVersion(doc.id, v.id)}?token=${token || ""}`;
                        window.open(url, "_blank");
                      }}
                    >
                      <Download size={13} /> Download
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {uploadingNewVersion && (
        <UploadEvidenceModal
          caseId={doc.case_id}
          existingDoc={doc}
          onClose={() => setUploadingNewVersion(false)}
          onSuccess={() => {
            setUploadingNewVersion(false);
            setLoading(true);
            api.getDocumentVersions(doc.id).then(setVersions).catch(() => {}).finally(() => setLoading(false));
            onNotify("New version securely uploaded");
            if (onVersionUploaded) onVersionUploaded();
          }}
        />
      )}
    </Modal>
  );
}

// ── Edit Case Modal ─────────────────────────────────────────────────────────────
function EditCaseModal({ caseItem, onClose, onSuccess, onNotify }) {
  const [title, setTitle] = useState(caseItem.title);
  const [description, setDescription] = useState(caseItem.description || "");
  const [status, setStatus] = useState(caseItem.status);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submitEdit(e) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const updated = await api.updateCase(caseItem.id, { title, description, status });
      onSuccess(updated);
    } catch (err) {
      setError(err.message || "Failed to update case");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Edit Case" icon={Settings2} onClose={onClose}>
      <form className="modal-form" onSubmit={submitEdit}>
        <label>Investigation title <input value={title} onChange={e => setTitle(e.target.value)} required /></label>
        <label>Context notes <textarea value={description} onChange={e => setDescription(e.target.value)} /></label>
        <label>Status 
          <select value={status} onChange={e => setStatus(e.target.value)}>
            <option value="Active">Active</option>
            <option value="Review">Review</option>
            <option value="Closed">Closed</option>
            <option value="Dissolved">Dissolved</option>
          </select>
        </label>
        {error && <p className="auth-error">{error}</p>}
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button className="primary-button" type="submit" disabled={loading}>{loading ? "Saving…" : "Save Changes"}</button>
        </div>
      </form>
    </Modal>
  );
}

// ── Case Detail View ──────────────────────────────────────────────────────────
function CaseDetail({ caseItem, role, onBack, onNotify, onUpdate }) {
  const [tab, setTab] = useState("documents");
  const [docs, setDocs] = useState([]);
  const [auditTrail, setAuditTrail] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [modal, setModal] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);

  const canWrite = role === "investigator" || role === "user" || role === "admin";

  function loadDocs() {
    setLoadingDocs(true);
    api.getCaseDocuments(caseItem.id).then(setDocs).catch(() => {}).finally(() => setLoadingDocs(false));
  }

  useEffect(() => {
    loadDocs();
    api.getCaseAuditTrail(caseItem.id).then(setAuditTrail).catch(() => {}).finally(() => setLoadingAudit(false));
  }, [caseItem.id]);

  function timelineDotClass(eventType) {
    if (!eventType) return "";
    if (eventType.includes("upload") || eventType.includes("version")) return "upload";
    if (eventType.includes("sign")) return "sign";
    return "";
  }

  return (
    <div className="page-wrap">
      <button className="back-link" onClick={onBack}><ArrowLeft size={14} /> All cases</button>

      {/* Case header */}
      <div className="case-detail-header">
        <div className="case-detail-meta">
          <div className="eyebrow">{caseItem.case_number}</div>
          <h2>{caseItem.title}</h2>
          <div className="case-meta-row">
            <span className="case-meta-chip"><Zap size={12} />{caseItem.status}</span>
            <span className="case-meta-chip"><ClipboardList size={12} />{docs.length} documents</span>
          </div>
          {caseItem.description && <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--muted)", maxWidth: 560 }}>{caseItem.description}</p>}
        </div>
        {canWrite && (
          <div style={{ display: "flex", gap: 10 }}>
            <button className="secondary-button" onClick={() => setModal("edit")}>
              <Settings2 size={16} /> Edit Case
            </button>
            <button className="primary-button" onClick={() => setModal("upload")}>
              <Plus size={16} /> Add Evidence
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab-btn ${tab === "documents" ? "active" : ""}`} onClick={() => setTab("documents")}>
          <ClipboardList size={14} /> Documents <span className="tab-count">{docs.length}</span>
        </button>
        <button className={`tab-btn ${tab === "audit" ? "active" : ""}`} onClick={() => setTab("audit")}>
          <ShieldCheck size={14} /> Audit Trail <span className="tab-count">{auditTrail.length}</span>
        </button>
      </div>

      {/* Documents tab */}
      {tab === "documents" && (
        loadingDocs ? <LoadingSpinner /> : docs.length === 0 ? (
          <div className="empty-state">
            <FolderOpen size={40} />
            <strong style={{ display: "block", marginTop: 10 }}>No evidence yet</strong>
            <p>Add the first piece of evidence using the button above.</p>
          </div>
        ) : (
          <div className="doc-grid">
            {docs.map(doc => (
              <div key={doc.id} className="doc-card" onClick={() => setSelectedDoc(doc)}>
                <DocIcon docType={doc.doc_type} />
                <div className="doc-card-body">
                  <strong>{doc.title}<span className={`doc-badge ${doc.sensitivity_level}`}>{doc.sensitivity_level}</span></strong>
                  <p>{doc.doc_type?.replace(/_/g, " ")} · <StatusPill state={doc.status === "active" ? "Active" : doc.status} /></p>
                </div>
                <ArrowUpRight size={16} style={{ color: "var(--muted)", flexShrink: 0 }} />
              </div>
            ))}
          </div>
        )
      )}

      {/* Audit trail tab */}
      {tab === "audit" && (
        loadingAudit ? <LoadingSpinner /> : auditTrail.length === 0 ? (
          <div className="empty-state">
            <ShieldCheck size={40} />
            <strong style={{ display: "block", marginTop: 10 }}>No audit events yet</strong>
            <p>Events will appear here as actions are performed on this case.</p>
          </div>
        ) : (
          <div className="panel" style={{ padding: 22 }}>
            <div className="audit-timeline">
              {auditTrail.map(ev => (
                <div key={ev.id} className="timeline-item">
                  <div className={`timeline-dot ${timelineDotClass(ev.event_type)}`} />
                  <div className="timeline-body">
                    <strong>{ev.action}</strong>
                    <span>{ev.event_type} · hash: <span className="hash-display" style={{ display: "inline" }}>{ev.event_hash?.slice(0, 24)}…</span></span>
                  </div>
                  <time className="timeline-time">{formatDate(ev.created_at)}</time>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* Modals */}
      {modal === "upload" && (
        <UploadEvidenceModal
          caseId={caseItem.id}
          onClose={() => setModal(null)}
          onSuccess={() => { setModal(null); loadDocs(); onNotify("Evidence uploaded and sealed"); }}
        />
      )}
      {selectedDoc && (
        <DocumentDetailModal
          doc={selectedDoc}
          canWrite={canWrite}
          onClose={() => setSelectedDoc(null)}
          onNotify={onNotify}
          onVersionUploaded={() => {
            // refresh audit trail and doc list
            loadDocs();
            setLoadingAudit(true);
            api.getCaseAuditTrail(caseItem.id).then(setAuditTrail).catch(() => {}).finally(() => setLoadingAudit(false));
          }}
        />
      )}
      {modal === "edit" && (
        <EditCaseModal
          caseItem={caseItem}
          onClose={() => setModal(null)}
          onSuccess={(updated) => {
            setModal(null);
            if (onUpdate) onUpdate(updated);
            onNotify("Case updated successfully");
            setLoadingAudit(true);
            api.getCaseAuditTrail(caseItem.id).then(setAuditTrail).catch(() => {}).finally(() => setLoadingAudit(false));
          }}
          onNotify={onNotify}
        />
      )}
    </div>
  );
}

// ── Cases List View ───────────────────────────────────────────────────────────
function CasesView({ cases, role, onOpenCase, onCreateCase, onNotify, loading }) {
  const [search, setSearch] = useState("");
  const canCreate = role === "investigator" || role === "user" || role === "admin";
  const filtered = cases.filter(c => `${c.case_number} ${c.title}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="page-wrap">
      <div className="page-header">
        <div>
          <div className="eyebrow">Investigation archive</div>
          <h1>Cases</h1>
          <p>Open a case to view evidence, add documents, and review the audit trail.</p>
        </div>
        {canCreate && <button className="primary-button" onClick={onCreateCase}><Plus size={16} /> New case</button>}
      </div>
      <div className="search-box wide" style={{ marginBottom: 18 }}>
        <Search size={16} />
        <input placeholder="Search cases…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      {loading ? <LoadingSpinner /> : filtered.length === 0 ? (
        <div className="empty-state"><FolderOpen size={40} /><strong style={{ display: "block", marginTop: 10 }}>No cases found</strong><p>Create the first case or adjust your search.</p></div>
      ) : (
        <div className="panel case-list" style={{ padding: 0 }}>
          {filtered.map(c => (
            <div key={c.id} className="case-row" style={{ padding: "16px 22px" }} onClick={() => onOpenCase(c)}>
              <div className="case-icon"><FolderOpen size={17} /></div>
              <div className="case-row-copy">
                <strong>{c.title}</strong>
                <span>{c.case_number}</span>
              </div>
              <StatusPill state={c.status === "open" ? "Active" : c.status} />
              <ArrowUpRight size={16} className="row-arrow" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Admin View ────────────────────────────────────────────────────────────────
function AdminView({ onNotify }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [roleName, setRoleName] = useState("user");
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    api.listUsers().then(setUsers).catch(() => onNotify("Unable to load users — admin role required")).finally(() => setLoading(false));
  }, []);

  async function assignRole(userId) {
    setAssigning(true);
    try {
      await api.assignRole(userId, roleName);
      onNotify(`Role '${roleName}' assigned`);
      setModal(null);
      const fresh = await api.listUsers();
      setUsers(fresh);
    } catch (err) {
      onNotify(err.message || "Role assignment failed");
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="page-wrap">
      <div className="page-header">
        <div>
          <div className="eyebrow">System administration</div>
          <h1>Admin console</h1>
          <p>Manage identities, assign roles, and review platform controls.</p>
        </div>
        <button className="secondary-button" onClick={() => onNotify("Settings opened")}><Settings2 size={16} /> Settings</button>
      </div>

      <div className="admin-grid">
        <div className="panel admin-card">
          <div className="admin-card-top"><Users size={16} /> User management</div>
          <strong>{users.length}</strong>
          <p>Registered platform users</p>
          <button className="link-button" onClick={() => setModal("users")}>View all <ArrowUpRight size={14} /></button>
        </div>
        <div className="panel admin-card">
          <div className="admin-card-top"><KeyRound size={16} /> Role coverage</div>
          <strong>3</strong>
          <p>Active roles: admin, user, auditor</p>
          <button className="link-button" onClick={() => setModal("roles")}>Review roles <ArrowUpRight size={14} /></button>
        </div>
        <div className="panel admin-card">
          <div className="admin-card-top"><ShieldCheck size={16} /> Security controls</div>
          <strong>100%</strong>
          <p>MFA enforcement enabled</p>
          <button className="link-button" onClick={() => onNotify("Controls reviewed")}>View controls <ArrowUpRight size={14} /></button>
        </div>
      </div>

      <div className="panel audit-panel">
        <div className="panel-heading">
          <div><span className="section-label">User directory</span><h2>Registered users</h2></div>
        </div>
        {loading ? <LoadingSpinner /> : (
          <div className="admin-user-list" style={{ marginTop: 16 }}>
            {users.map(u => (
              <div key={u.id} className="user-row">
                <div className="ur-avatar">{(u.full_name || u.email || "U").slice(0, 2).toUpperCase()}</div>
                <div className="ur-info">
                  <strong>{u.full_name || u.email}</strong>
                  <span>{u.email} · {u.department || "No department"}</span>
                </div>
                <button className="secondary-button" style={{ fontSize: 11, minHeight: 32, padding: "0 10px" }}
                  onClick={() => { setSelectedUser(u); setModal("assign"); }}>
                  Assign role
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal === "assign" && selectedUser && (
        <Modal title="Assign role" icon={KeyRound} onClose={() => setModal(null)}>
          <div className="modal-form">
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>Assigning role to <strong>{selectedUser.full_name || selectedUser.email}</strong></p>
            <label>Role
              <select value={roleName} onChange={e => setRoleName(e.target.value)}>
                <option value="user">Investigator (user)</option>
                <option value="auditor">Auditor</option>
                <option value="admin">Administrator</option>
              </select>
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="secondary-button" onClick={() => setModal(null)}>Cancel</button>
              <button className="primary-button" disabled={assigning} onClick={() => assignRole(selectedUser.id)}>
                {assigning ? "Assigning…" : "Assign"} <BadgeCheck size={14} />
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Auditor View ──────────────────────────────────────────────────────────────
function AuditorView({ cases, onNotify }) {
  const [selectedCase, setSelectedCase] = useState(null);
  const [auditTrail, setAuditTrail] = useState([]);
  const [loading, setLoading] = useState(false);

  async function loadAudit(c) {
    setSelectedCase(c);
    setLoading(true);
    try {
      const trail = await api.getCaseAuditTrail(c.id);
      setAuditTrail(trail);
    } catch {
      onNotify("Unable to load audit trail");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-wrap">
      <div className="page-header">
        <div>
          <div className="eyebrow">Read-only review</div>
          <h1>Audit trail</h1>
          <p>Select a case to view its tamper-proof, hash-chained event log.</p>
        </div>
        <span className="access-readonly"><LockKeyhole size={14} /> Read-only access</span>
      </div>
      <div className="content-grid">
        <div className="panel case-list" style={{ padding: 0 }}>
          <div style={{ padding: "16px 22px 8px" }}><span className="section-label">Case archive</span></div>
          {cases.map(c => (
            <div key={c.id} className={`case-row ${selectedCase?.id === c.id ? "active" : ""}`} style={{ padding: "14px 22px" }} onClick={() => loadAudit(c)}>
              <div className="case-icon"><FolderOpen size={16} /></div>
              <div className="case-row-copy"><strong>{c.title}</strong><span>{c.case_number}</span></div>
              <ArrowUpRight size={15} className="row-arrow" />
            </div>
          ))}
        </div>
        <div className="panel" style={{ padding: 22, minHeight: 300 }}>
          {!selectedCase ? (
            <div className="empty-state" style={{ padding: "40px 0" }}>
              <ShieldCheck size={36} />
              <strong style={{ display: "block", marginTop: 10 }}>Select a case</strong>
              <p>The audit trail will appear here.</p>
            </div>
          ) : loading ? <LoadingSpinner /> : (
            <>
              <div className="panel-heading" style={{ marginBottom: 16 }}>
                <div><span className="section-label">Audit events</span><h2>{selectedCase.title}</h2></div>
              </div>
              {auditTrail.length === 0 ? (
                <div className="empty-state" style={{ padding: "20px 0" }}><p>No events recorded yet.</p></div>
              ) : (
                <div className="audit-timeline">
                  {auditTrail.map(ev => (
                    <div key={ev.id} className="timeline-item">
                      <div className="timeline-dot" />
                      <div className="timeline-body">
                        <strong>{ev.action}</strong>
                        <span>Type: {ev.event_type}</span>
                        <span className="hash-display" style={{ marginTop: 4, display: "block" }}>Hash: {ev.event_hash}</span>
                      </div>
                      <time className="timeline-time">{formatDate(ev.created_at)}</time>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Create Case Modal ─────────────────────────────────────────────────────────
function CreateCaseModal({ onClose, onCreated }) {
  const [caseNumber, setCaseNumber] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const created = await api.createCase({ case_number: caseNumber, title, description });
      onCreated(created);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="New case" icon={FolderOpen} onClose={onClose}>
      <form className="modal-form" onSubmit={submit}>
        <div className="form-grid">
          <label>Case number<input value={caseNumber} onChange={e => setCaseNumber(e.target.value)} placeholder="ANV-26-0001" required /></label>
          <label>Status<input value="open" disabled /></label>
        </div>
        <label>Title<input value={title} onChange={e => setTitle(e.target.value)} placeholder="Brief investigation title" required /></label>
        <label>Description<textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Context, scope, and initial information…" /></label>
        {error && <p className="auth-error">{error}</p>}
        <button className="primary-button" type="submit" disabled={loading}>{loading ? "Creating…" : "Create case"} <ArrowUpRight size={15} /></button>
      </form>
    </Modal>
  );
}

// ── Overview / Dashboard ──────────────────────────────────────────────────────
function OverviewView({ currentUser, cases, role, onOpenCase, onCreateCase }) {
  const canCreate = role === "investigator" || role === "user" || role === "admin";
  const activeCases = cases.filter(c => c.status === "open" || c.status === "Active");

  return (
    <div className="page-wrap">
      <div className="page-header">
        <div>
          <div className="eyebrow">Welcome back</div>
          <h1>{currentUser?.full_name || "Investigation workspace"}</h1>
          <p>Your role: <strong>{ROLES[role]?.label || role}</strong> · {cases.length} accessible cases</p>
        </div>
        {canCreate && <button className="primary-button" onClick={onCreateCase}><Plus size={16} /> New case</button>}
      </div>
      <div className="metric-grid">
        <div className="metric-card"><div className="metric-icon sage"><FolderOpen size={18} /></div><span className="metric-label">Total cases</span><strong>{cases.length}</strong></div>
        <div className="metric-card"><div className="metric-icon amber"><Zap size={18} /></div><span className="metric-label">Active</span><strong>{activeCases.length}</strong></div>
        <div className="metric-card"><div className="metric-icon ink"><ShieldCheck size={18} /></div><span className="metric-label">Integrity checks</span><strong>—</strong></div>
        <div className="metric-card"><div className="metric-icon coral"><LockKeyhole size={18} /></div><span className="metric-label">Role</span><strong>{ROLES[role]?.label || role}</strong></div>
      </div>
      <div className="panel" style={{ padding: 0 }}>
        <div style={{ padding: "18px 22px 8px" }}><span className="section-label">Recent cases</span></div>
        {cases.slice(0, 6).map(c => (
          <div key={c.id} className="case-row" style={{ padding: "14px 22px" }} onClick={() => onOpenCase(c)}>
            <div className="case-icon"><FolderOpen size={16} /></div>
            <div className="case-row-copy"><strong>{c.title}</strong><span>{c.case_number}</span></div>
            <StatusPill state={c.status === "open" ? "Active" : c.status} />
            <ArrowUpRight size={16} className="row-arrow" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Auth: Login ───────────────────────────────────────────────────────────────
function Login({ onContinue, onMfa, onReset }) {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function demoLogin(role) {
    setLoading(true); setError("");
    try {
      const result = await api.prototypeLogin(role, role);
      localStorage.setItem("anveshan_token", result.access_token);
      localStorage.setItem("anveshan_user_id", result.user.id);
      onContinue();
    } catch {
      setError("Prototype login unavailable — start the backend on port 8000.");
    } finally { setLoading(false); }
  }

  async function login(e) {
    e.preventDefault(); setError(""); setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const result = await api.login(form.get("email"), form.get("password"));
      if (result.mfa_required) onMfa(result.challenge_token);
      else { localStorage.setItem("anveshan_token", result.access_token); onContinue(); }
    } catch { setError("Invalid credentials or backend unreachable."); }
    finally { setLoading(false); }
  }

  return (
    <div className="auth-shell">
      <div className="prototype-banner">PROTOTYPE VERSION</div>
      <div className="auth-panel">
        <div className="auth-brand"><div className="brand-mark">A</div><div><strong>ANVESHAN</strong><span>Evidence intelligence platform</span></div></div>
        <div className="auth-intro"><div className="eyebrow">Secure investigator access</div><h1>Enter the evidence workspace.</h1><p>Review case archives, trace custody, and manage authorized access from one protected session.</p></div>
        <form className="auth-form" onSubmit={login}>
          <label>Agency email<input name="email" type="email" required /></label>
          <label>Password<div className="password-input"><input name="password" type="password" required /><Fingerprint size={18} /></div></label>
          <div className="auth-row"><label className="check-label"><input type="checkbox" defaultChecked /> Remember this device</label><button type="button" className="text-button" onClick={onReset}>Reset password</button></div>
          <button className="primary-button auth-submit" type="submit" disabled={loading}>{loading ? "Connecting…" : "Continue"} {!loading && <ArrowUpRight size={17} />}</button>
        </form>
        <div className="prototype-logins">
          <span>Demo identities bypass MFA</span>
          <div>
            <button type="button" onClick={() => demoLogin("investigator")} disabled={loading}>Investigator</button>
            <button type="button" onClick={() => demoLogin("auditor")} disabled={loading}>Auditor</button>
            <button type="button" onClick={() => demoLogin("admin")} disabled={loading}>Administrator</button>
          </div>
        </div>
        {error && <p className="auth-error">{error}</p>}
        <div className="auth-foot"><span><LockKeyhole size={14} /> End-to-end protected</span><span>V1 workspace</span></div>
      </div>
      <div className="auth-aside">
        <div className="aside-grid" />
        <div className="aside-copy"><span className="aside-kicker">Chain of custody</span><h2>Every record has a history.</h2><p>Immutable originals. Traceable handling. Access shaped by purpose.</p></div>
        <div className="aside-stamp"><BadgeCheck size={18} /><span>Integrity first<br /><strong>V1 workspace</strong></span></div>
      </div>
    </div>
  );
}

// ── Auth: MFA ─────────────────────────────────────────────────────────────────
function Mfa({ challenge, onVerified, onBack }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);

  async function verify(e) {
    e.preventDefault(); setVerifying(true); setError("");
    try {
      const result = await api.verifyMfa(challenge, code);
      localStorage.setItem("anveshan_token", result.access_token);
      onVerified();
    } catch { setError("That code could not be verified."); }
    finally { setVerifying(false); }
  }

  return (
    <div className="auth-shell">
      <div className="prototype-banner">PROTOTYPE VERSION</div>
      <div className="auth-panel mfa-panel">
        <button className="back-button" onClick={onBack}>Back to sign in</button>
        <div className={`mfa-icon fingerprint-scan ${verifying ? "is-scanning" : ""}`}><Fingerprint size={25} /></div>
        <div className="auth-intro"><div className="eyebrow">Step 2 of 2</div><h1>Verify your session.</h1><p>Enter the six-digit code from your registered authenticator.</p></div>
        <form className="auth-form" onSubmit={verify}>
          <label>Authentication code<input className="code-input" inputMode="numeric" placeholder="000 000" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} autoFocus required /></label>
          <button className="primary-button auth-submit" type="submit" disabled={verifying}>{verifying ? "Verifying…" : "Verify identity"} <ArrowUpRight size={17} /></button>
        </form>
        {error && <p className="auth-error">{error}</p>}
      </div>
      <div className="auth-aside mfa-aside">
        <div className="aside-grid" />
        <div className="aside-copy"><span className="aside-kicker">MFA required</span><h2>A quiet second check.</h2><p>Protected access requires a verified identity.</p></div>
        <div className="aside-stamp"><ShieldCheck size={18} /><span>Session status<br /><strong>{verifying ? "Verifying" : "Awaiting code"}</strong></span></div>
      </div>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ role, activeView, onNav, currentUser, onLogout, open }) {
  const navItems = role === "auditor"
    ? [{ id: "overview", icon: LayoutDashboard, label: "Overview" }, { id: "audit", icon: ShieldCheck, label: "Audit trail" }]
    : role === "admin"
    ? [{ id: "overview", icon: LayoutDashboard, label: "Overview" }, { id: "cases", icon: FolderOpen, label: "Cases" }, { id: "admin", icon: Settings2, label: "Admin" }]
    : [{ id: "overview", icon: LayoutDashboard, label: "Overview" }, { id: "cases", icon: FolderOpen, label: "Cases" }];

  return (
    <nav className={`sidebar ${open ? "is-open" : ""}`}>
      <div className="brand-lockup"><div className="brand-mark">A</div><div><strong>ANVESHAN</strong><span>Evidence platform</span></div></div>
      <div className="workspace-label">Workspace <span>V1</span></div>
      <div className="primary-nav">
        {navItems.map(({ id, icon: Icon, label }) => (
          <button key={id} className={`nav-item ${activeView === id ? "active" : ""}`} onClick={() => onNav(id)}>
            <Icon size={16} /><span>{label}</span>
          </button>
        ))}
      </div>
      <div className="sidebar-bottom">
        <div className="security-note"><ShieldCheck size={15} /><div><strong>Secured session</strong><span>JWT · MFA active</span></div></div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 10px 0", borderTop: "1px solid #405049" }}>
          <div className={`avatar ${ROLES[role]?.tone || "sage"}`}>{(currentUser?.full_name || "US").slice(0, 2).toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ display: "block", fontSize: 12, color: "#eef3ea" }}>{currentUser?.full_name || "User"}</strong>
            <span style={{ display: "block", fontSize: 10, color: "#9eaaa3" }}>{ROLES[role]?.label || role}</span>
          </div>
          <button className="sidebar-link" style={{ padding: 6 }} onClick={onLogout} title="Sign out"><LogOut size={15} /></button>
        </div>
      </div>
    </nav>
  );
}

// ── Password Reset ────────────────────────────────────────────────────────────
function PasswordReset({ onClose, onComplete }) {
  const [email, setEmail] = useState(""); const [token, setToken] = useState(""); const [password, setPassword] = useState("");
  const [requested, setRequested] = useState(false); const [error, setError] = useState("");

  async function request(e) {
    e.preventDefault(); setError("");
    try { const r = await api.requestPasswordReset(email); setToken(r.development_reset_token || ""); setRequested(true); } catch { setError("Unable to start reset."); }
  }
  async function confirm(e) {
    e.preventDefault(); setError("");
    try { const r = await api.confirmPasswordReset(token, password); onComplete(r.message); } catch { setError("Token invalid or password too short."); }
  }
  return (
    <Modal title="Reset password" icon={KeyRound} onClose={onClose}>
      {!requested
        ? <form className="modal-form" onSubmit={request}><p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>Enter your agency email to issue a reset token.</p><label>Agency email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>{error && <p className="auth-error">{error}</p>}<button className="primary-button" type="submit">Issue reset token</button></form>
        : <form className="modal-form" onSubmit={confirm}><p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>{token ? "Development token issued — set your new password." : "Check your agency mailbox for the reset token."}</p><label>Reset token<input value={token} onChange={e => setToken(e.target.value)} required /></label><label>New password (12+ chars)<input type="password" minLength="12" value={password} onChange={e => setPassword(e.target.value)} required /></label>{error && <p className="auth-error">{error}</p>}<button className="primary-button" type="submit">Update password</button></form>
      }
    </Modal>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [stage, setStage] = useState("login");
  const [role, setRole] = useState("investigator");
  const [activeView, setActiveView] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [cases, setCases] = useState([]);
  const [casesLoading, setCasesLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState("");
  const [mfaChallenge, setMfaChallenge] = useState(null);
  const [openedCase, setOpenedCase] = useState(null);

  function notify(msg) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  function logout() {
    localStorage.removeItem("anveshan_token");
    localStorage.removeItem("anveshan_user_id");
    setCurrentUser(null); setCases([]); setStage("login"); setOpenedCase(null);
  }

  useEffect(() => {
    if (stage !== "app") return;
    setCasesLoading(true);
    async function load() {
      try {
        const user = await api.getUserMe();
        setCurrentUser(user);
        const backendRole = user.roles?.[0] || "investigator";
        setRole(backendRole);
      } catch { notify("Session loaded in prototype mode"); }
      try {
        const remoteCases = await api.listCases();
        setCases(remoteCases.map(c => ({ ...c, status: c.status || "open" })));
      } catch { notify("Could not load cases from backend"); }
      finally { setCasesLoading(false); }
    }
    load();
  }, [stage]);

  if (stage === "login") return <Login onContinue={() => setStage("app")} onMfa={(c) => { setMfaChallenge(c); setStage("mfa"); }} onReset={() => setModal("reset")} />;
  if (stage === "mfa") return <Mfa challenge={mfaChallenge} onVerified={() => setStage("app")} onBack={() => { setMfaChallenge(null); setStage("login"); }} />;

  // If a case is open, show CaseDetail full-screen
  if (openedCase) {
    return (
      <div className="app-shell">
        <div className="prototype-banner" style={{ position: "fixed" }}>PROTOTYPE VERSION</div>
        <Sidebar role={role} activeView="cases" onNav={(v) => { setOpenedCase(null); setActiveView(v); }} currentUser={currentUser} onLogout={logout} open={sidebarOpen} />
        {sidebarOpen && <button className="mobile-scrim" onClick={() => setSidebarOpen(false)} />}
        <div className="main-content" style={{ paddingTop: 24 }}>
          <div className="topbar">
            <button className="icon-button menu-button" onClick={() => setSidebarOpen(!sidebarOpen)}><Menu size={18} /></button>
            <div className="breadcrumb">Cases <ChevronDown size={12} /> <strong>{openedCase.case_number}</strong></div>
            <div className="topbar-actions">
              <div className={`avatar ${ROLES[role]?.tone || "sage"}`}>{(currentUser?.full_name || "US").slice(0, 2).toUpperCase()}</div>
            </div>
          </div>
          <CaseDetail caseItem={openedCase} role={role} onBack={() => setOpenedCase(null)} onNotify={notify} onUpdate={updated => {
            setOpenedCase(updated);
            setCases(cases.map(c => c.id === updated.id ? updated : c));
          }} />
        </div>
        <Toast message={toast} />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="prototype-banner" style={{ position: "fixed" }}>PROTOTYPE VERSION</div>
      <Sidebar role={role} activeView={activeView} onNav={v => { setActiveView(v); setSidebarOpen(false); }} currentUser={currentUser} onLogout={logout} open={sidebarOpen} />
      {sidebarOpen && <button className="mobile-scrim" onClick={() => setSidebarOpen(false)} />}
      <div className="main-content" style={{ paddingTop: 24 }}>
        <div className="topbar">
          <button className="icon-button menu-button" onClick={() => setSidebarOpen(!sidebarOpen)}><Menu size={18} /></button>
          <div className="breadcrumb">ANVESHAN <ChevronDown size={12} /> <strong>{activeView.charAt(0).toUpperCase() + activeView.slice(1)}</strong></div>
          <div className="topbar-actions">
            <div className={`avatar ${ROLES[role]?.tone || "sage"}`}>{(currentUser?.full_name || "US").slice(0, 2).toUpperCase()}</div>
          </div>
        </div>

        {activeView === "overview" && (
          <OverviewView currentUser={currentUser} cases={cases} role={role} onOpenCase={c => { setOpenedCase(c); setActiveView("cases"); }} onCreateCase={() => setModal("create-case")} />
        )}
        {activeView === "cases" && (
          <CasesView cases={cases} role={role} onOpenCase={setOpenedCase} onCreateCase={() => setModal("create-case")} onNotify={notify} loading={casesLoading} />
        )}
        {activeView === "admin" && role === "admin" && <AdminView onNotify={notify} />}
        {activeView === "audit" && role === "auditor" && <AuditorView cases={cases} onNotify={notify} />}
      </div>

      {modal === "create-case" && (
        <CreateCaseModal
          onClose={() => setModal(null)}
          onCreated={(newCase) => {
            setCases(prev => [{ ...newCase, status: newCase.status || "open" }, ...prev]);
            setModal(null);
            notify(`Case ${newCase.case_number} created`);
          }}
        />
      )}
      {modal === "reset" && <PasswordReset onClose={() => setModal(null)} onComplete={(msg) => { setModal(null); notify(msg || "Password updated"); }} />}

      <Toast message={toast} />
    </div>
  );
}

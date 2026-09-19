const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const TOKEN_KEY = "anveshan_token";
const ROLE_KEY = "anveshan_role";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setSession(token, role) {
  localStorage.setItem(TOKEN_KEY, token);
  if (role) localStorage.setItem(ROLE_KEY, role);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
}

export async function apiRequest(path, options = {}) {
  const token = getToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const bodyText = await response.text();
    let detail = "";
    try {
      const j = JSON.parse(bodyText);
      detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail ?? j);
    } catch { detail = bodyText; }
    if (response.status === 401 && token) clearSession();
    throw new Error(detail || `Request failed with ${response.status}`);
  }
  return response.status === 204 ? null : response.json();
}

/** Authenticated binary fetch that triggers a browser download. */
async function apiDownload(path, fallbackName) {
  const token = getToken();
  const response = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    let detail = `Download failed with ${response.status}`;
    try { const j = await response.json(); if (typeof j.detail === "string") detail = j.detail; } catch { /* ignore */ }
    throw new Error(detail);
  }
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const name = match ? decodeURIComponent(match[1]) : fallbackName;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return name;
}

export function query(params) {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) value.forEach(v => search.append(key, String(v)));
    else search.append(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const api = {
  // ── Auth ────────────────────────────────────────────────────────────
  prototypeLogin: (role, password) => apiRequest("/v1/auth/prototype-login", { method: "POST", body: JSON.stringify({ role, password }) }),
  viewerRegister: (email, password, fullName) => apiRequest("/v1/auth/viewer/register", { method: "POST", body: JSON.stringify({ email, password, full_name: fullName }) }),
  viewerLogin: (email, password) => apiRequest("/v1/auth/viewer/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  viewerVerify: (email, code) => apiRequest("/v1/auth/viewer/verify", { method: "POST", body: JSON.stringify({ email, code }) }),
  login: (email, password) => apiRequest("/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  verifyMfa: (challengeToken, code) => apiRequest("/v1/auth/mfa/verify", { method: "POST", body: JSON.stringify({ challenge_token: challengeToken, code }) }),
  requestPasswordReset: (email) => apiRequest("/v1/auth/password-reset/request", { method: "POST", body: JSON.stringify({ email }) }),
  confirmPasswordReset: (resetToken, newPassword) => apiRequest("/v1/auth/password-reset/confirm", { method: "POST", body: JSON.stringify({ reset_token: resetToken, new_password: newPassword }) }),
  setupMfa: () => apiRequest("/v1/auth/mfa/setup", { method: "POST" }),

  // ── Current user ───────────────────────────────────────────────────
  getUserMe: () => apiRequest("/v1/users/me"),

  // ── Users & roles (admin) ───────────────────────────────────────────
  listUsers: () => apiRequest("/v1/users"),
  createUser: (payload) => apiRequest("/v1/users", { method: "POST", body: JSON.stringify(payload) }),
  assignRole: (userId, roleName) => apiRequest(`/v1/roles/${userId}/assign`, { method: "POST", body: JSON.stringify({ role_name: roleName }) }),

  // ── Access grants (ABAC) ────────────────────────────────────────────
  createGrant: (payload) => apiRequest("/v1/access-grants", { method: "POST", body: JSON.stringify(payload) }),

  // ── Cases ──────────────────────────────────────────────────────────
  listCases: () => apiRequest("/v1/cases"),
  getCase: (caseId) => apiRequest(`/v1/cases/${caseId}`),
  createCase: (payload) => apiRequest("/v1/cases", { method: "POST", body: JSON.stringify(payload) }),
  updateCase: (caseId, payload) => apiRequest(`/v1/cases/${caseId}`, { method: "PUT", body: JSON.stringify(payload) }),
  getCaseDocuments: (caseId) => apiRequest(`/v1/cases/${caseId}/documents`),
  getCaseAuditTrail: (caseId) => apiRequest(`/v1/cases/${caseId}/audit-trail`),
  getCaseEvents: (caseId) => apiRequest(`/v1/cases/${caseId}/events`),
  createCaseEvent: (caseId, payload) => apiRequest(`/v1/cases/${caseId}/events`, { method: "POST", body: JSON.stringify(payload) }),
  getCaseLedger: (caseId) => apiRequest(`/v1/cases/${caseId}/ledger`),
  getCaseExternalRecords: (caseId) => apiRequest(`/v1/cases/${caseId}/external-records`),
  createExternalRecord: (payload) => apiRequest("/v1/external-records", { method: "POST", body: JSON.stringify(payload) }),

  // ── Documents ──────────────────────────────────────────────────────
  getDocument: (docId) => apiRequest(`/v1/documents/${docId}`),
  createDocument: (payload) => apiRequest("/v1/documents", { method: "POST", body: JSON.stringify(payload) }),
  getDocumentVersions: (docId) => apiRequest(`/v1/documents/${docId}/versions`),
  uploadDocumentVersion: (docId, file, notes) => {
    const fd = new FormData();
    fd.append("file", file);
    if (notes) fd.append("notes", notes);
    return apiRequest(`/v1/documents/${docId}/upload`, { method: "POST", body: fd });
  },
  verifyIntegrity: (docId, versionId) => apiRequest(`/v1/documents/${docId}/versions/${versionId}/verify-integrity`, { method: "POST" }),
  getIntegritySummary: (docId) => apiRequest(`/v1/documents/${docId}/integrity-summary`),
  getOriginalRecord: (docId) => apiRequest(`/v1/documents/${docId}/original`),
  attachOriginalRecord: (docId, payload) => apiRequest(`/v1/documents/${docId}/original-record`, { method: "POST", body: JSON.stringify(payload) }),
  getDocumentAuditTrail: (docId) => apiRequest(`/v1/documents/${docId}/audit-trail`),
  getDocumentExternalRecords: (docId) => apiRequest(`/v1/documents/${docId}/external-records`),
  downloadVersion: (docId, versionId, fileName) => apiDownload(`/v1/documents/${docId}/versions/${versionId}/content`, fileName || "evidence.bin"),

  // ── Digital signatures ─────────────────────────────────────────────
  signVersion: (docId, versionId) => apiRequest(`/v1/documents/${docId}/versions/${versionId}/sign`, { method: "POST" }),
  listSignatures: (docId, versionId) => apiRequest(`/v1/documents/${docId}/versions/${versionId}/signatures`),
  verifySignature: (docId, versionId, signatureId) => apiRequest(`/v1/documents/${docId}/versions/${versionId}/signatures/${signatureId}/verify`, { method: "POST" }),

  // ── Tags & ML classification (Step 9) ──────────────────────────────
  listTags: () => apiRequest("/v1/tags"),
  createTag: (payload) => apiRequest("/v1/tags", { method: "POST", body: JSON.stringify(payload) }),
  getDocumentTags: (docId) => apiRequest(`/v1/documents/${docId}/tags`),
  linkTag: (docId, tagId) => apiRequest(`/v1/documents/${docId}/tags/${tagId}`, { method: "POST" }),
  getMlSuggestions: (docId) => apiRequest(`/v1/documents/${docId}/ml-suggestions`),
  acceptMlSuggestions: (docId, payload) => apiRequest(`/v1/documents/${docId}/ml-suggestions/accept`, { method: "POST", body: JSON.stringify(payload || {}) }),
  reclassifyDocument: (docId) => apiRequest(`/v1/documents/${docId}/classify`, { method: "POST" }),

  // ── Search (Step 8) ────────────────────────────────────────────────
  search: (params) => apiRequest(`/v1/search${query(params)}`),

  // ── Transfers (Step 10) ────────────────────────────────────────────
  createTransfer: (payload) => apiRequest("/v1/transfers", { method: "POST", body: JSON.stringify(payload) }),
  listTransfers: () => apiRequest("/v1/transfers"),
  getTransfer: (transferId) => apiRequest(`/v1/transfers/${transferId}`),
  acceptTransfer: (transferId) => apiRequest(`/v1/transfers/${transferId}/accept`, { method: "POST" }),
  rejectTransfer: (transferId, reason) => apiRequest(`/v1/transfers/${transferId}/reject${query({ reason })}`, { method: "POST" }),

  // ── Audit ledger & blockchain verification (Step 13) ───────────────
  listAuditTrail: (params) => apiRequest(`/v1/audit-trail${query(params)}`),
  verifyAuditChain: (limit) => apiRequest(`/v1/audit-trail/chain/verify${query({ limit })}`),
  verifyAuditRecord: (recordId) => apiRequest(`/v1/audit-trail/${recordId}/verify`),

  // ── Government identity verification (Step 11) ─────────────────────
  verifyGovId: (payload) => apiRequest("/v1/identity-verifications/gov-api", { method: "POST", body: JSON.stringify(payload) }),
  listIdentityVerifications: (userId) => apiRequest(`/v1/users/${userId}/identity-verifications`),

  // ── Operations ─────────────────────────────────────────────────────
  backupStatus: () => apiRequest("/v1/ops/backup/status"),
  health: () => fetch(`${API_BASE}/health`).then(r => r.json()),
};

export default api;
export { API_BASE };



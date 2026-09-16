const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem("anveshan_token");
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    let detail = "";
    try { const j = await response.json(); detail = j.detail || JSON.stringify(j); } catch { detail = await response.text(); }
    throw new Error(detail || `Request failed with ${response.status}`);
  }
  return response.status === 204 ? null : response.json();
}

export const api = {
  // Auth
  prototypeLogin: (role, password) => apiRequest("/v1/auth/prototype-login", { method: "POST", body: JSON.stringify({ role, password }) }),
  login: (email, password) => apiRequest("/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  verifyMfa: (challenge_token, code) => apiRequest("/v1/auth/mfa/verify", { method: "POST", body: JSON.stringify({ challenge_token, code }) }),
  requestPasswordReset: (email) => apiRequest("/v1/auth/password-reset/request", { method: "POST", body: JSON.stringify({ email }) }),
  confirmPasswordReset: (reset_token, new_password) => apiRequest("/v1/auth/password-reset/confirm", { method: "POST", body: JSON.stringify({ reset_token, new_password }) }),

  // Current user
  getUserMe: () => apiRequest("/v1/users/me"),

  // Users & Roles (admin only)
  listUsers: () => apiRequest("/v1/users"),
  createUser: (payload) => apiRequest("/v1/users", { method: "POST", body: JSON.stringify(payload) }),
  assignRole: (userId, roleName) => apiRequest(`/v1/roles/${userId}/assign`, { method: "POST", body: JSON.stringify({ role_name: roleName }) }),

  // Cases
  listCases: () => apiRequest("/v1/cases"),
  getCase: (caseId) => apiRequest(`/v1/cases/${caseId}`),
  createCase: (payload) => apiRequest("/v1/cases", { method: "POST", body: JSON.stringify(payload) }),
  getCaseDocuments: (caseId) => apiRequest(`/v1/cases/${caseId}/documents`),
  getCaseAuditTrail: (caseId) => apiRequest(`/v1/cases/${caseId}/audit-trail`),
  getCaseEvents: (caseId) => apiRequest(`/v1/cases/${caseId}/events`),

  // Documents
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
  downloadVersion: (docId, versionId) => `${API_BASE}/v1/documents/${docId}/versions/${versionId}/content`,
  signVersion: (docId, versionId) => apiRequest(`/v1/documents/${docId}/versions/${versionId}/sign`, { method: "POST" }),

  // Tags
  listTags: () => apiRequest("/v1/tags"),
  getDocumentTags: (docId) => apiRequest(`/v1/documents/${docId}/tags`),

  // Access grants
  createGrant: (payload) => apiRequest("/v1/access-grants", { method: "POST", body: JSON.stringify(payload) }),
};



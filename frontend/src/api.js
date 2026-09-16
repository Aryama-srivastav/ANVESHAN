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
    const detail = await response.text();
    throw new Error(detail || `Request failed with ${response.status}`);
  }
  return response.status === 204 ? null : response.json();
}

export const api = {
  prototypeLogin: (role, password) => apiRequest("/v1/auth/prototype-login", {
    method: "POST",
    body: JSON.stringify({ role, password }),
  }),
  login: (email, password) => apiRequest("/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  verifyMfa: (challenge_token, code) => apiRequest("/v1/auth/mfa/verify", { method: "POST", body: JSON.stringify({ challenge_token, code }) }),
  requestPasswordReset: (email) => apiRequest("/v1/auth/password-reset/request", { method: "POST", body: JSON.stringify({ email }) }),
  confirmPasswordReset: (reset_token, new_password) => apiRequest("/v1/auth/password-reset/confirm", { method: "POST", body: JSON.stringify({ reset_token, new_password }) }),
  listCases: () => apiRequest("/v1/cases"),
  listUsers: () => apiRequest("/v1/users"),
  createCase: (payload) => apiRequest("/v1/cases", { method: "POST", body: JSON.stringify(payload) }),
  createGrant: (payload) => apiRequest("/v1/access-grants", { method: "POST", body: JSON.stringify(payload) }),
};

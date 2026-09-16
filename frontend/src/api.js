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
  listCases: () => apiRequest("/v1/cases"),
  listUsers: () => apiRequest("/v1/users"),
  createCase: (payload) => apiRequest("/v1/cases", { method: "POST", body: JSON.stringify(payload) }),
  createGrant: (payload) => apiRequest("/v1/access-grants", { method: "POST", body: JSON.stringify(payload) }),
};

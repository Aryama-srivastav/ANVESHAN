import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api, setSession, clearSession, getToken, query, API_BASE } from "../src/api";

// The API client is the thin glue between the UI and the FastAPI backend.
// These tests validate its shape and behaviour without hitting a real server.

/** Minimal Response-like stub so the tests never depend on a real fetch stack. */
function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    headers: { get: () => null },
  };
}

function stubFetch(impl) {
  const mock = vi.fn(impl);
  globalThis.fetch = mock;
  window.fetch = mock;
  return mock;
}

describe("api client", () => {
  beforeEach(() => {
    clearSession();
    stubFetch(() => Promise.reject(new Error("no fetch stub installed")));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exposes the documented surface", () => {
    // Auth & session
    expect(typeof api.prototypeLogin).toBe("function");
    expect(typeof api.login).toBe("function");
    expect(typeof api.viewerRegister).toBe("function");
    expect(typeof api.viewerLogin).toBe("function");
    expect(typeof api.viewerVerify).toBe("function");
    expect(typeof api.verifyMfa).toBe("function");
    expect(typeof api.setupMfa).toBe("function");
    expect(typeof api.requestPasswordReset).toBe("function");
    expect(typeof api.confirmPasswordReset).toBe("function");
    // Users, roles and access grants
    expect(typeof api.getUserMe).toBe("function");
    expect(typeof api.listUsers).toBe("function");
    expect(typeof api.createUser).toBe("function");
    expect(typeof api.assignRole).toBe("function");
    expect(typeof api.createGrant).toBe("function");
    // Cases, documents and integrity
    expect(typeof api.listCases).toBe("function");
    expect(typeof api.createCase).toBe("function");
    expect(typeof api.getCase).toBe("function");
    expect(typeof api.updateCase).toBe("function");
    expect(typeof api.getCaseDocuments).toBe("function");
    expect(typeof api.getCaseAuditTrail).toBe("function");
    expect(typeof api.getCaseEvents).toBe("function");
    expect(typeof api.createCaseEvent).toBe("function");
    expect(typeof api.getCaseLedger).toBe("function");
    expect(typeof api.createDocument).toBe("function");
    expect(typeof api.getDocument).toBe("function");
    expect(typeof api.getDocumentVersions).toBe("function");
    expect(typeof api.uploadDocumentVersion).toBe("function");
    expect(typeof api.downloadVersion).toBe("function");
    expect(typeof api.verifyIntegrity).toBe("function");
    expect(typeof api.getIntegritySummary).toBe("function");
    expect(typeof api.signVersion).toBe("function");
    expect(typeof api.verifySignature).toBe("function");
    // Tags, ML classification and search
    expect(typeof api.listTags).toBe("function");
    expect(typeof api.createTag).toBe("function");
    expect(typeof api.getDocumentTags).toBe("function");
    expect(typeof api.linkTag).toBe("function");
    expect(typeof api.getMlSuggestions).toBe("function");
    expect(typeof api.acceptMlSuggestions).toBe("function");
    expect(typeof api.reclassifyDocument).toBe("function");
    expect(typeof api.search).toBe("function");
    // Custody transfers, identity and audit
    expect(typeof api.createTransfer).toBe("function");
    expect(typeof api.listTransfers).toBe("function");
    expect(typeof api.getTransfer).toBe("function");
    expect(typeof api.acceptTransfer).toBe("function");
    expect(typeof api.rejectTransfer).toBe("function");
    expect(typeof api.verifyGovId).toBe("function");
    expect(typeof api.listIdentityVerifications).toBe("function");
    expect(typeof api.listAuditTrail).toBe("function");
    expect(typeof api.verifyAuditChain).toBe("function");
    expect(typeof api.verifyAuditRecord).toBe("function");
    // Ops
    expect(typeof api.backupStatus).toBe("function");
    expect(typeof api.health).toBe("function");
  });

  it("sends the bearer token and JSON content type on protected calls", async () => {
    setSession("token-123", "investigator");
    const fetchMock = stubFetch(async () => jsonResponse([]));
    await api.listCases();
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`${API_BASE}/v1/cases`);
    expect(options.headers.Authorization).toBe("Bearer token-123");
    expect(options.headers["Content-Type"]).toBe("application/json");
  });

  it("omits the JSON content type for multipart uploads", async () => {
    setSession("token-123", "investigator");
    const fetchMock = stubFetch(async () => jsonResponse({ id: "v2" }));
    await api.uploadDocumentVersion("doc-1", new File(["x"], "a.txt"), "note");
    const [, options] = fetchMock.mock.calls[0];
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.headers["Content-Type"]).toBeUndefined();
    expect(options.headers.Authorization).toBe("Bearer token-123");
  });

  it("sessions are stored in localStorage under known keys", () => {
    setSession("token-123", "investigator");
    expect(getToken()).toBe("token-123");
    expect(localStorage.getItem("anveshan_role")).toBe("investigator");
    clearSession();
    expect(getToken()).toBeNull();
    expect(localStorage.getItem("anveshan_token")).toBeNull();
  });

  it("apiRequest throws on non-ok responses and clears the token on 401", async () => {
    setSession("token-123", "investigator");
    stubFetch(async () => jsonResponse({ detail: "Invalid token" }, 401));
    await expect(api.getUserMe()).rejects.toThrow("Invalid token");
    expect(localStorage.getItem("anveshan_token")).toBeNull();
  });

  it("apiRequest surfaces nested validation detail objects", async () => {
    stubFetch(async () => jsonResponse({ detail: [{ loc: ["body", "title"], msg: "field required" }] }, 422));
    await expect(api.createCase({ description: "d" })).rejects.toThrow(/field required/);
  });

  it("apiRequest returns null for 204 responses", async () => {
    stubFetch(async () => jsonResponse(null, 204));
    const result = await api.createCase({ title: "t", description: "d" });
    expect(result).toBeNull();
  });

  it("apiRequest keeps the status readable when the error body is not JSON", async () => {
    stubFetch(async () => jsonResponse("not json", 500));
    await expect(api.listCases()).rejects.toThrow(/Request failed with 500/);
    await expect(api.listCases()).rejects.toThrow(/not json/);
  });

  it("query() skips empty values and repeats array params", () => {
    expect(query({ q: "seized", case_id: undefined, tag: null, page: 0 })).toBe("?q=seized&page=0");
    expect(query({ status: ["open", "closed"] })).toBe("?status=open&status=closed");
    expect(query()).toBe("");
  });

  it("API_BASE falls back to localhost:8000 when VITE_API_URL is unset", () => {
    expect(API_BASE).toBe("http://localhost:8000");
  });
});

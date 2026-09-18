import { describe, it, expect, vi, beforeEach } from "vitest";
import { api, setSession, clearSession, getToken, API_BASE } from "../src/api";

// The API client is the thin glue between the UI and the FastAPI backend.
// These tests validate its shape and behaviour without hitting a real server.

describe("api client", () => {
  beforeEach(() => {
    clearSession();
    window.fetch = vi.fn();
  });

  it("exposes the documented surface", () => {
    expect(typeof api.prototypeLogin).toBe("function");
    expect(typeof api.login).toBe("function");
    expect(typeof api.verifyMfa).toBe("function");
    expect(typeof api.setupMfa).toBe("function");
    expect(typeof api.getUserMe).toBe("function");
    expect(typeof api.listRoles).toBe("function");
    expect(typeof api.listUsers).toBe("function");
    expect(typeof api.createUser).toBe("function");
    expect(typeof api.updateUserSensitiveFields).toBe("function");
    expect(typeof api.createAccessGrant).toBe("function");
    expect(typeof api.listCases).toBe("function");
    expect(typeof api.createCase).toBe("function");
    expect(typeof api.getCase).toBe("function");
    expect(typeof api.updateCase).toBe("function");
    expect(typeof api.getCaseDocuments).toBe("function");
    expect(typeof api.createDocument).toBe("function");
    expect(typeof api.uploadDocumentVersion).toBe("function");
    expect(typeof api.getCaseAuditTrail).toBe("function");
    expect(typeof api.listTags).toBe("function");
    expect(typeof api.createTag).toBe("function");
    expect(typeof api.getDocumentTags).toBe("function");
    expect(typeof api.linkTag).toBe("function");
    expect(typeof api.getMlSuggestions).toBe("function");
    expect(typeof api.acceptMlSuggestions).toBe("function");
    expect(typeof api.reclassifyDocument).toBe("function");
    expect(typeof api.search).toBe("function");
    expect(typeof api.createTransfer).toBe("function");
    expect(typeof api.listTransfers).toBe("function");
    expect(typeof api.acceptTransfer).toBe("function");
    expect(typeof api.rejectTransfer).toBe("function");
    expect(typeof api.verifyGovId).toBe("function");
    expect(typeof api.listIdentityVerifications).toBe("function");
    expect(typeof api.backupStatus).toBe("function");
    expect(typeof api.health).toBe("function");
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
    const err = new Response(JSON.stringify({ detail: "Invalid token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
    window.fetch = vi.fn().mockResolvedValue(err);
    await expect(api.getUserMe()).rejects.toThrow("Invalid token");
    expect(localStorage.getItem("anveshan_token")).toBeNull();
  });

  it("apiRequest returns null for 204 responses", async () => {
    const ok = new Response(null, { status: 204 });
    window.fetch = vi.fn().mockResolvedValue(ok);
    const result = await api.createCase({ title: "t", description: "d" });
    expect(result).toBeNull();
  });

  it("apiRequest parses JSON detail for unknown error shapes", async () => {
    const err = new Response('not json', { status: 500 });
    window.fetch = vi.fn().mockResolvedValue(err);
    await expect(api.listCases()).rejects.toThrow(/Request failed with 500/);
  });

  it("API_BASE falls back to localhost:8000 when VITE_API_URL is unset", () => {
    expect(API_BASE).toBe("http://localhost:8000");
  });
});

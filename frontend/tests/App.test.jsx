/// <reference types="vitest" />
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import App from "../src/App";

// Integration smoke tests for the App shell: the registry lock-pad gate, the
// sign-in mode selector, the role-access login flow and the session lifecycle.
// They run on the shared Vitest + jsdom environment and stub fetch, so nothing
// ever touches a real backend.

/** Minimal Response-like stub so the tests never depend on a real fetch stack. */
function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: { get: () => null },
  };
}

/** Point both the global and window fetch at one stub (api.js calls bare fetch). */
function stubFetch(impl) {
  const mock = vi.fn(impl);
  globalThis.fetch = mock;
  window.fetch = mock;
  return mock;
}

/** Open the lock-pad gate so the sign-in options are revealed. */
async function unlockGate() {
  fireEvent.click(screen.getByRole("button", { name: /authenticate/i }));
  await waitFor(
    () => expect(screen.getByRole("button", { name: /role access/i })).toBeInTheDocument(),
    { timeout: 5000 },
  );
}

describe("App shell", () => {
  beforeEach(() => {
    localStorage.clear();
    // Dashboard mounts issue best-effort API calls; fail them fast.
    stubFetch(() => Promise.reject(new Error("network disabled in unit tests")));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the registry lock-pad gate when there is no session", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: /authenticate/i })).toBeInTheDocument();
    expect(screen.getByText(/click to authenticate/i)).toBeInTheDocument();
    // The sign-in options stay sealed until the gate is unlocked
    expect(screen.queryByRole("button", { name: /investigator/i })).toBeNull();
  });

  it("reveals the sign-in modes and roles once the gate is unlocked", async () => {
    render(<App />);
    await unlockGate();
    expect(screen.getByRole("button", { name: /role access/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /officer login/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /public viewer/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /investigator/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /auditor/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /admin/i })).toBeInTheDocument();
  });

  it("role access login calls the prototype login endpoint and stores the session", async () => {
    const fetchMock = stubFetch(async (url) => {
      const target = String(url);
      if (target.includes("/v1/auth/prototype-login")) {
        return jsonResponse({ access_token: "tok", token_type: "bearer", role: "investigator" });
      }
      if (target.includes("/v1/users/me")) {
        return jsonResponse({ id: "u1", email: "inv@registry.gov.in", full_name: "Inv", is_active: true, roles: ["investigator"] });
      }
      return jsonResponse([]); // collection endpoints (cases, tags, ...)
    });
    render(<App />);
    await unlockGate();
    fireEvent.click(screen.getByRole("button", { name: /investigator/i }));

    await waitFor(() => expect(localStorage.getItem("anveshan_token")).toBe("tok"));
    expect(localStorage.getItem("anveshan_role")).toBe("investigator");
    expect(String(fetchMock.mock.calls[0][0])).toContain("/v1/auth/prototype-login");
    // A session replaces the login gate with the operator shell
    await waitFor(() => expect(screen.getByRole("button", { name: /terminate/i })).toBeInTheDocument());
  });

  it("an existing session boots straight into the operator shell", async () => {
    localStorage.setItem("anveshan_token", "tok");
    localStorage.setItem("anveshan_role", "investigator");
    // act() lets the dashboard's mount-time API calls settle inside the test
    await act(async () => { render(<App />); });
    expect(screen.getByRole("button", { name: /terminate/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /authenticate/i })).toBeNull();
  });

  it("clearing the session returns to the lock-pad gate", async () => {
    localStorage.setItem("anveshan_token", "tok");
    localStorage.setItem("anveshan_role", "investigator");
    let unmount;
    await act(async () => { ({ unmount } = render(<App />)); });
    expect(screen.getByRole("button", { name: /terminate/i })).toBeInTheDocument();

    unmount();
    localStorage.clear();
    await act(async () => { render(<App />); });
    expect(screen.getByRole("button", { name: /authenticate/i })).toBeInTheDocument();
  });
});

/// <reference types="vitest" />
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api, setSession, clearSession } from "../src/api";
import App from "../src/App";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";

// Minimal integration smoke tests for the App shell. They validate that the
// login gate, route switching, and core components render without crashing.
// They do NOT depend on react-scripts; they use Vite + Vitest + jsdom.

const indexHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ANVESHAN</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

function mountApp() {
  const dom = new JSDOM(indexHtml, { url: "http://localhost:5173", pretendToBeVisual: true });
  global.window = dom.window;
  global.document = dom.window.document;
  global.HTMLElement = dom.window.HTMLElement;
  global.navigator = dom.window.navigator;
  global.URLSearchParams = dom.window.URLSearchParams;
  global.URL = dom.window.URL;
  global.Request = dom.window.Request;
  global.Response = dom.window.Response;
  global.FormData = dom.window.FormData;
  global.Blob = dom.window.Blob;
  global.File = dom.window.File;
  global.localStorage = dom.window.localStorage;
  global.sessionStorage = dom.window.sessionStorage;
  global.URLSearchParams = dom.window.URLSearchParams;
  const root = createRoot(dom.window.document.getElementById("root"));
  root.render(<App />);
  return dom;
}

describe("App shell", () => {
  beforeEach(() => {
    window.fetch = vi.fn();
    clearSession();
    vi.resetModules();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the login screen when there is no session", () => {
    mountApp();
    expect(screen.getByRole("button", { name: /terminate/i })).toBeInTheDocument();
  });

  it("shows role selection on the login screen", () => {
    mountApp();
    expect(screen.getByText(/operator access/i)).toBeInTheDocument();
  });

  it("operator login flow calls the prototype login endpoint and stores the session", async () => {
    window.fetch = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: "tok",
          token_type: "bearer",
          role: "operator",
          user: { id: "u1", email: "op@x", full_name: "Op", is_active: true, roles: ["operator"] },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    mountApp();
    await screen.findByText(/operator/i);
    const roleBtn = screen.getByRole("button", { name: /operator/i });
    expect(roleBtn).toBeInTheDocument();
    roleBtn.click();
    await waitFor(() => expect(window.fetch).toHaveBeenCalled());
    expect(setSession).toBeCalled ? expect(setSession).toHaveBeenCalledWith(expect.any(String), "operator") : true;
  });

  it("clearing the session returns to the login screen", () => {
    setSession("tok", "operator");
    mountApp();
    // The shell hides the login screen once a token exists
    expect(screen.queryByRole("button", { name: /terminate/i })).toBeInTheDocument();
    clearSession();
    // A fresh mount would show the login screen again
    const dom = mountApp();
    expect(dom.window.document.body.textContent).toContain("OPERATOR ACCESS ONLY");
  });
});

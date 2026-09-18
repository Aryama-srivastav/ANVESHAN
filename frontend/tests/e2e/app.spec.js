import { test, expect } from "@playwright/test";

// E2E smoke tests for the ANVESHAN frontend. They start the Vite preview
// server on port 5173 (not the dev server) and verify that the shell renders.
// These tests are intentionally backend-agnostic: they validate the UI, not API.

test.describe("ANVESHAN frontend", () => {
  test("landing page renders the login shell", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toHaveText(/operator access only/i);
  });

  test("app contains the ANVESHAN branding", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toContainText(/ANVESHAN/i);
  });

  test("no console errors on load", async ({ page }) => {
    const errors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Ignore favicon / resource errors; only surface real JS errors
    expect(errors.filter((e) => !e.includes("favicon") && !e.includes("net::ERR"))).toHaveLength(0);
  });
});

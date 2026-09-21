/// <reference types="vitest" />
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Evidence Vault: the semantic-search surface plus the pinned-evidence strip.
// The shared api client is stubbed so the whole flow runs without a backend.

const { hits, searchMock } = vi.hoisted(() => {
  const hits = [
    {
      document_id: "doc-1",
      case_id: "case-1",
      case_number: "CR-2024-001",
      case_title: "State v. Rao",
      title: "Seized hard drive image",
      doc_type: "disk_image",
      sensitivity_level: "restricted",
      score: 0.92,
      excerpt: "Imaged on 2024-03-02",
      tags: ["digital"],
      matched_fields: ["title"],
      activity_at: "2024-03-02T10:00:00.000Z",
      version_count: 2,
    },
    {
      document_id: "doc-2",
      case_id: "case-1",
      case_number: "CR-2024-001",
      case_title: "State v. Rao",
      title: "Witness statement",
      doc_type: "statement",
      sensitivity_level: "confidential",
      score: 0.71,
      excerpt: "Recorded statement",
      tags: ["testimony"],
      matched_fields: ["body"],
      activity_at: "2024-03-05T10:00:00.000Z",
      version_count: 1,
    },
  ];
  return { hits, searchMock: vi.fn(async () => ({ hits, total: hits.length, took_ms: 4 })) };
});

vi.mock("../src/api", () => ({ api: { search: searchMock } }));

import { VaultView } from "../src/panels";

const noop = () => { };

describe("Evidence Vault", () => {
  beforeEach(() => {
    searchMock.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the hits returned by the search endpoint", async () => {
    render(<VaultView onOpenDocument={noop} />);
    expect(await screen.findByText("Seized hard drive image")).toBeInTheDocument();
    expect(screen.getByText("Witness statement")).toBeInTheDocument();
    expect(searchMock).toHaveBeenCalledTimes(1);
    // Match counter reflects the response metadata
    expect(screen.getByText(/2 MATCHES/)).toBeInTheDocument();
  });

  it("pins an evidence hit onto the pinned strip and unpins it again", async () => {
    render(<VaultView onOpenDocument={noop} />);
    await screen.findByText("Seized hard drive image");
    expect(screen.queryByText(/^pinned$/i)).toBeNull();

    const pinButtons = screen.getAllByRole("button", { name: /^pin evidence$/i });
    expect(pinButtons).toHaveLength(2);
    fireEvent.click(pinButtons[0]);

    // The strip lists the pinned document and offers an unpin control
    expect(await screen.findByText(/^pinned$/i)).toBeInTheDocument();
    const unpin = screen.getByRole("button", { name: /^unpin seized hard drive image$/i });
    expect(screen.getAllByRole("button", { name: /^pin evidence$/i })).toHaveLength(1);

    fireEvent.click(unpin);
    await waitFor(() => expect(screen.queryByText(/^pinned$/i)).toBeNull());
    expect(screen.getAllByRole("button", { name: /^pin evidence$/i })).toHaveLength(2);
  });

  it("clears every pin through CLEAR ALL", async () => {
    render(<VaultView onOpenDocument={noop} />);
    await screen.findByText("Witness statement");

    screen.getAllByRole("button", { name: /^pin evidence$/i }).forEach((b) => fireEvent.click(b));

    // Both hits appear as chips on the pinned strip
    expect(await screen.findByRole("button", { name: /^unpin seized hard drive image$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^unpin witness statement$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /clear all/i }));
    await waitFor(() => expect(screen.queryByText(/^pinned$/i)).toBeNull());
    expect(screen.getAllByRole("button", { name: /^pin evidence$/i })).toHaveLength(2);
  });

  it("re-runs the search when the query is submitted", async () => {
    const { container } = render(<VaultView onOpenDocument={noop} />);
    await screen.findByText("Seized hard drive image");

    const input = container.querySelector("input");
    expect(input).not.toBeNull();
    fireEvent.change(input, { target: { value: "witness" } });
    fireEvent.submit(container.querySelector("form"));

    await waitFor(() => expect(searchMock).toHaveBeenCalledTimes(2));
    expect(searchMock).toHaveBeenLastCalledWith({ q: "witness" });
  });
});

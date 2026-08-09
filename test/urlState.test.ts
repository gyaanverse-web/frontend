import { describe, it, expect } from "vitest";
import {
  buildUrl, patchQuery, resolveChoice, resolveFlag, resolvePage,
} from "@/lib/urlState";

describe("patchQuery", () => {
  it("sets a param on an empty query", () => {
    expect(patchQuery("", { tab: "completed" })).toBe("tab=completed");
  });

  it("preserves params it was not asked to change", () => {
    // The student screens carry `?screen=` alongside their own tab param — a tab
    // click must not navigate the dashboard back to Home.
    expect(patchQuery("screen=Exams", { tab: "completed" })).toBe("screen=Exams&tab=completed");
  });

  it("drops a param set to null", () => {
    expect(patchQuery("screen=Exams&tab=completed", { tab: null })).toBe("screen=Exams");
  });

  it("drops a param set to the empty string", () => {
    // The 'All …' option in a Select has the value "", and the clean URL for it
    // is no param at all.
    expect(patchQuery("type=integer", { type: "" })).toBe("");
  });

  it("applies several keys in one patch", () => {
    // Filter-plus-page-reset has to be a single navigation.
    expect(patchQuery("status=draft&page=7", { status: "flagged", page: null }))
      .toBe("status=flagged");
  });

  it("replaces rather than appends a repeated key", () => {
    expect(patchQuery("tab=todo", { tab: "upcoming" })).toBe("tab=upcoming");
  });
});

describe("buildUrl", () => {
  it("omits the '?' when nothing is left in the query", () => {
    expect(buildUrl("/coaching/exams", "")).toBe("/coaching/exams");
  });

  it("joins path and query", () => {
    expect(buildUrl("/coaching/exams", "filter=live")).toBe("/coaching/exams?filter=live");
  });
});

describe("resolveChoice", () => {
  const tabs = ["todo", "in-progress", "completed", "upcoming"] as const;

  it("accepts a known value", () => {
    expect(resolveChoice("completed", tabs, "todo")).toBe("completed");
  });

  it("falls back when the param is absent", () => {
    expect(resolveChoice(null, tabs, "todo")).toBe("todo");
  });

  it("falls back on an unknown value rather than rendering nothing", () => {
    // Query strings get hand-edited and outlive the values they named.
    expect(resolveChoice("archived", tabs, "todo")).toBe("todo");
  });

  it("is case-sensitive — the slug is the contract", () => {
    expect(resolveChoice("Completed", tabs, "todo")).toBe("todo");
  });

  it("treats the empty string as a real choice when it is allowed", () => {
    // The question bank's "All types" option is genuinely "".
    expect(resolveChoice("", ["", "integer"], "")).toBe("");
  });
});

describe("resolveFlag", () => {
  it("reads '1' as on", () => {
    expect(resolveFlag("1")).toBe(true);
  });

  it("reads anything else as off", () => {
    for (const raw of [null, "", "0", "true", "yes"]) {
      expect(resolveFlag(raw)).toBe(false);
    }
  });
});

describe("resolvePage", () => {
  it("reads a page above 1", () => {
    expect(resolvePage("7")).toBe(7);
  });

  it("defaults to 1 when absent", () => {
    expect(resolvePage(null)).toBe(1);
  });

  it("defaults to 1 on garbage, zero, negatives and fractions", () => {
    for (const raw of ["", "0", "-3", "2.5", "abc", "1e9999"]) {
      expect(resolvePage(raw)).toBe(1);
    }
  });
});

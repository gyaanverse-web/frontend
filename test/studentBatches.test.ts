import { describe, it, expect } from "vitest";
import {
  normalizeBatchCode,
  validateBatchCode,
  batchJoinPath,
  examState,
} from "@/lib/studentBatches";

describe("normalizeBatchCode", () => {
  it("upper-cases what the student typed", () => {
    expect(normalizeBatchCode("abcd2345")).toBe("ABCD2345");
  });

  it("strips the punctuation a pasted code often carries", () => {
    // Teachers share codes as "PHY-2K4X" or with a stray trailing space.
    expect(normalizeBatchCode("abcd-2345")).toBe("ABCD2345");
    expect(normalizeBatchCode("  ABCD2345 ")).toBe("ABCD2345");
  });

  it("caps at the code length so the input can't overflow", () => {
    expect(normalizeBatchCode("ABCD2345EXTRA")).toBe("ABCD2345");
  });

  it("leaves an empty string empty", () => {
    expect(normalizeBatchCode("")).toBe("");
  });
});

describe("validateBatchCode", () => {
  it("accepts a well-formed code", () => {
    expect(validateBatchCode("ABCD2345")).toBeNull();
  });

  it("rejects a short code by length", () => {
    expect(validateBatchCode("ABCD")).toMatch(/8 characters/);
  });

  it("rejects the empty string", () => {
    expect(validateBatchCode("")).toMatch(/8 characters/);
  });

  it("names the 0/O and 1/I trap for a full-length code with ambiguous chars", () => {
    // The backend alphabet excludes these precisely because they get misread
    // off a whiteboard, so the message has to say which ones.
    for (const bad of ["ABCD234O", "ABCD2341", "ABCD234I", "ABCD2340"]) {
      expect(validateBatchCode(bad)).toMatch(/0\/O and 1\/I/);
    }
  });
});

describe("batchJoinPath", () => {
  // The original bug: this card sent the student to /join, which redeems a
  // COACHING code and rejected their batch code as invalid. Both code types are
  // 8 chars from the same alphabet, so nothing but the route distinguishes them.
  it("points at the batch redeemer, not the coaching one", () => {
    expect(batchJoinPath("ABCD2345")).toBe("/join/batch/ABCD2345");
  });

  it("is never the bare coaching join route", () => {
    expect(batchJoinPath("ABCD2345")).not.toBe("/join");
    expect(batchJoinPath("ABCD2345")).not.toBe("/join/ABCD2345");
  });
});

describe("examState", () => {
  const attempt = (status: string) => [{ status }];

  it("calls an unattempted scheduled exam upcoming", () => {
    expect(examState({ status: "scheduled" })).toEqual({ label: "Upcoming", tone: "neutral" });
  });

  it("calls an unattempted live exam open", () => {
    expect(examState({ status: "live" })).toEqual({ label: "Open now", tone: "accent" });
  });

  it("prefers 'in progress' over everything else when a session is open", () => {
    expect(examState({ status: "live", mySessions: attempt("in_progress") }).label).toBe("In progress");
    // Even mid-evaluation, a still-open session is the actionable fact.
    expect(examState({ status: "under_evaluation", mySessions: attempt("in_progress") }).label).toBe("In progress");
  });

  it("calls a live exam with a finished attempt submitted", () => {
    expect(examState({ status: "live", mySessions: attempt("submitted") })).toEqual({
      label: "Submitted", tone: "warning",
    });
  });

  it("holds results back until the exam is completed", () => {
    // Publishing IS completing — ready_to_publish must not read as results out.
    for (const status of ["under_evaluation", "ready_to_publish"]) {
      expect(examState({ status, mySessions: attempt("evaluated") })).toEqual({
        label: "Awaiting results", tone: "warning",
      });
    }
    expect(examState({ status: "completed", mySessions: attempt("evaluated") })).toEqual({
      label: "Result ready", tone: "success",
    });
  });

  it("distinguishes a missed exam from one whose results are ready", () => {
    expect(examState({ status: "completed" }).label).toBe("Missed");
    expect(examState({ status: "completed", mySessions: attempt("submitted") }).label).toBe("Result ready");
  });

  it("calls an unattempted mid-lifecycle exam closed", () => {
    expect(examState({ status: "under_evaluation" })).toEqual({ label: "Closed", tone: "neutral" });
  });

  it("treats a missing sessions array the same as an empty one", () => {
    expect(examState({ status: "live" })).toEqual(examState({ status: "live", mySessions: [] }));
  });
});

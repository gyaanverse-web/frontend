import { describe, it, expect } from "vitest";
import { buildAppNav, type NavEntry } from "@/components/dashboard/appNav";
import {
  bucketsForRole, TEACHER_BUCKETS, ADMIN_BUCKETS,
  isExamEditable, canSubmitForReview, canPublishResults, canPublishResultsAsOwner, canArchive,
  canSchedule, canGoLiveNow, EXAM_STATUSES,
} from "@/lib/examStatus";

// ── The role split, as the UI expresses it ───────────────────────────────────
//
// The server is the authority (`requireTenantRole`), but a screen that offers a
// control the server will refuse is worse than one that hides it: the teacher
// clicks and gets a 403 they can do nothing about. These are the pure functions
// that decide what each role is shown, so they are worth pinning down.

const keys = (nav: NavEntry[]) => nav.flatMap((e) => ("key" in e ? [e.key] : []));

describe("buildAppNav — authoring is a teacher capability", () => {
  it("CRITICAL: the owner has no Test Engine entry", () => {
    // Every route behind it is teacher-only, so for an owner it is a dead link.
    expect(keys(buildAppNav("coaching_owner"))).not.toContain("test-engine");
  });

  it("the teacher does have the Test Engine", () => {
    expect(keys(buildAppNav("teacher"))).toContain("test-engine");
  });

  it("CRITICAL: only the owner gets the Approvals queue", () => {
    expect(keys(buildAppNav("coaching_owner"))).toContain("approvals");
    expect(keys(buildAppNav("teacher"))).not.toContain("approvals");
  });

  it("both staff roles keep the shared surfaces", () => {
    for (const role of ["coaching_owner", "teacher"]) {
      const k = keys(buildAppNav(role));
      expect(k).toContain("exams");
      expect(k).toContain("question-bank");
      expect(k).toContain("classes");
    }
  });

  it("a student sees neither authoring nor review surfaces", () => {
    const k = keys(buildAppNav("student"));
    expect(k).not.toContain("test-engine");
    expect(k).not.toContain("approvals");
    expect(k).not.toContain("question-bank");
  });
});

describe("bucketsForRole — the owner has no Drafts tab", () => {
  it("CRITICAL: no owner bucket includes the draft status", () => {
    const owner = bucketsForRole("coaching_owner");
    expect(owner.flatMap((b) => b.statuses)).not.toContain("draft");
    expect(owner.map((b) => b.key)).not.toContain("drafts");
  });

  it("the teacher's first bucket is their drafts", () => {
    const teacher = bucketsForRole("teacher");
    expect(teacher[0].key).toBe("drafts");
    expect(teacher[0].statuses).toContain("draft");
  });

  it("resolves to the right bucket set", () => {
    expect(bucketsForRole("coaching_owner")).toBe(ADMIN_BUCKETS);
    expect(bucketsForRole("teacher")).toBe(TEACHER_BUCKETS);
    // An unresolved role must not accidentally get the admin view.
    expect(bucketsForRole(null)).toBe(TEACHER_BUCKETS);
  });

  it("every owner bucket status is one the API will actually return", () => {
    // The API strips drafts from an owner's list, so a bucket containing one
    // would render as a permanently empty tab.
    for (const b of ADMIN_BUCKETS) {
      for (const s of b.statuses) expect(s).not.toBe("draft");
    }
  });
});

describe("lifecycle capability helpers", () => {
  it("editing is confined to the two author-owned states", () => {
    expect(isExamEditable("draft")).toBe(true);
    expect(isExamEditable("changes_requested")).toBe(true);
    for (const s of ["under_review", "approved", "scheduled", "live", "completed", "rejected"] as const) {
      expect(isExamEditable(s)).toBe(false);
    }
  });

  it("submit-for-review matches the backend's two entry states", () => {
    expect(canSubmitForReview("draft")).toBe(true);
    expect(canSubmitForReview("changes_requested")).toBe(true);
    // `rejected` is terminal — salvaging means duplicating, not resubmitting.
    expect(canSubmitForReview("rejected")).toBe(false);
    expect(canSubmitForReview("under_review")).toBe(false);
  });

  it("results publish only from ready_to_publish, archive only from completed", () => {
    expect(canPublishResults("ready_to_publish")).toBe(true);
    // CRITICAL: `under_evaluation` means sessions are still being graded, so the
    // marks are incomplete. Offering publish here would release a partial
    // cohort's results — the teacher waits for `ready_to_publish` instead.
    expect(canPublishResults("under_evaluation")).toBe(false);
    expect(canPublishResults("live")).toBe(false);
    // Publishing IS the completion event, so it is not on offer afterwards.
    expect(canPublishResults("completed")).toBe(false);
    expect(canArchive("completed")).toBe(true);
    expect(canArchive("live")).toBe(false);
  });

  it("the owner's break-glass publish opens on exactly the same state", () => {
    // It exists so an absent teacher cannot strand computed marks — not to give
    // the owner an earlier window than the teacher has.
    for (const s of EXAM_STATUSES) {
      expect(canPublishResultsAsOwner(s)).toBe(canPublishResults(s));
    }
  });
});

// Approving a paper and dating it are two separate admin decisions — an approved
// exam is expected to sit undated for as long as the admin wants. The UI has to
// express that split or the admin is back to being forced into a date at review
// time, which is exactly what was confusing.
describe("approve and schedule are separate decisions", () => {
  it("an approved exam can be scheduled; scheduling is not offered before approval", () => {
    expect(canSchedule("approved")).toBe(true);
    // Still movable after the fact — an admin who mistyped a date needs a way back.
    expect(canSchedule("scheduled")).toBe(true);
    for (const s of ["draft", "under_review", "changes_requested", "rejected", "live", "completed"] as const) {
      expect(canSchedule(s)).toBe(false);
    }
  });

  it("CRITICAL: 'Go live now' is not offered on an approved-but-undated exam", () => {
    // The backend has no `approved → live` transition: an undated exam must be
    // scheduled first. Offering the button here would be a guaranteed 422.
    expect(canGoLiveNow("approved")).toBe(false);
    expect(canGoLiveNow("scheduled")).toBe(true);
  });

  it("the admin gets a distinct tab for papers still owing a date", () => {
    const approvedTab = ADMIN_BUCKETS.find((b) => b.statuses.includes("approved"));
    expect(approvedTab?.statuses).toEqual(["approved"]);
    // Merged with `scheduled` it would be invisible work.
    const scheduledTab = ADMIN_BUCKETS.find((b) => b.key === "scheduled");
    expect(scheduledTab?.statuses).toEqual(["scheduled"]);
  });

  it("every lifecycle status is reachable from some teacher bucket", () => {
    // A status with no bucket is an exam that vanishes from the teacher's hub.
    const covered = new Set(TEACHER_BUCKETS.flatMap((b) => b.statuses));
    for (const s of EXAM_STATUSES) expect(covered.has(s)).toBe(true);
  });
});

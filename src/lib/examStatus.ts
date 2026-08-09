// Single source of truth for the 11-status exam lifecycle (PRD v1).
// Mirrors the backend union in `exam.types.ts` — keep the two in sync.
//   draft → under_review → changes_requested → rejected → approved → scheduled →
//   live → under_evaluation → ready_to_publish → completed → archived
//
// `completed` is the publish event: the teacher's click both reveals results to
// students and ends the lifecycle. There is no separate "results published"
// state — it and `completed` always meant the same moment.
import type { BadgeTone } from "@/components/ui";

export type ExamStatus =
  | "draft"
  | "under_review"
  | "changes_requested"
  | "rejected"
  | "approved"
  | "scheduled"
  | "live"
  | "under_evaluation"
  | "ready_to_publish"
  | "completed"
  | "archived";

export const EXAM_STATUSES: readonly ExamStatus[] = [
  "draft", "under_review", "changes_requested", "rejected", "approved",
  "scheduled", "live", "under_evaluation", "ready_to_publish", "completed",
  "archived",
] as const;

export interface ExamStatusMeta {
  /** Title-case display label. */
  label: string;
  /** DS badge tone. */
  tone: BadgeTone;
  /** One-line description of what the state means (tooltips / empty states). */
  hint: string;
}

export const EXAM_STATUS_META: Record<ExamStatus, ExamStatusMeta> = {
  draft:             { label: "Draft",             tone: "neutral", hint: "Being authored by the teacher." },
  under_review:      { label: "Under Review",      tone: "warning", hint: "Submitted — awaiting admin review." },
  changes_requested: { label: "Changes Requested", tone: "warning", hint: "Admin asked for changes before approval." },
  rejected:          { label: "Rejected",          tone: "danger",  hint: "Admin rejected this exam." },
  approved:          { label: "Approved",          tone: "accent",  hint: "Approved — awaiting scheduling." },
  scheduled:         { label: "Scheduled",         tone: "accent",  hint: "Scheduled to go live at the set time." },
  live:              { label: "Live",              tone: "success", hint: "In progress — students can attempt now." },
  under_evaluation:  { label: "Under Evaluation",  tone: "warning", hint: "Window closed — sessions being evaluated." },
  ready_to_publish:  { label: "Ready to Publish",  tone: "accent",  hint: "All sessions evaluated — review the reports, then publish." },
  completed:         { label: "Completed",         tone: "success", hint: "Results published — students can see their scores & reports." },
  archived:          { label: "Archived",          tone: "neutral", hint: "Retired from active lists." },
};

export function examStatusLabel(status: ExamStatus): string {
  return EXAM_STATUS_META[status]?.label ?? status;
}

export function examStatusTone(status: ExamStatus): BadgeTone {
  return EXAM_STATUS_META[status]?.tone ?? "neutral";
}

// ── Editable / capability helpers ──────────────────────────────────────────

/** A teacher may edit metadata/questions only in these states. */
export const EDITABLE_STATUSES: readonly ExamStatus[] = ["draft", "changes_requested"] as const;

export function isExamEditable(status: ExamStatus): boolean {
  return (EDITABLE_STATUSES as readonly string[]).includes(status);
}

/** States from which a teacher can submit for review. */
export function canSubmitForReview(status: ExamStatus): boolean {
  return status === "draft" || status === "changes_requested";
}

/**
 * Publishing is only offered once every session has been evaluated — that is
 * what `ready_to_publish` means. While the exam is still `under_evaluation` the
 * numbers are incomplete, so there is deliberately nothing to click: the teacher
 * reviews finished reports first, then publishes.
 */
export function canPublishResults(status: ExamStatus): boolean {
  return status === "ready_to_publish";
}

/**
 * Normally the authoring teacher publishes. The owner is allowed as a
 * break-glass so an absent teacher cannot strand marks that are already
 * computed — the backend records who actually did it either way.
 */
export function canPublishResultsAsOwner(status: ExamStatus): boolean {
  return status === "ready_to_publish";
}

/**
 * Owner-only. Approving is a verdict on the paper and does NOT set a date —
 * scheduling is a separate decision made whenever a slot is free. So an
 * `approved` exam can be scheduled, and a `scheduled` one can still have its
 * window moved right up until it goes live.
 */
export function canSchedule(status: ExamStatus): boolean {
  return status === "approved" || status === "scheduled";
}

/**
 * Whether student reports can exist for this exam yet.
 *
 * Reports are written per session as each paper finishes evaluation, so they
 * start appearing during `under_evaluation` — the teacher does not have to wait
 * for the whole cohort before reviewing the ones that are done. Before the exam
 * has run there is nothing to show at all.
 */
export function hasReports(status: ExamStatus): boolean {
  return status === "under_evaluation" || status === "ready_to_publish"
    || status === "completed" || status === "archived";
}

/** Owner-only: start a scheduled exam ahead of its start time. */
export function canGoLiveNow(status: ExamStatus): boolean {
  return status === "scheduled";
}

/** Archive is owner-only and only from completed. */
export function canArchive(status: ExamStatus): boolean {
  return status === "completed";
}

/**
 * `rejected` is a terminal verdict — the admin judged the paper unusable, so the
 * teacher cannot edit it or resubmit it (there is no `rejected → draft`
 * transition in the backend state machine). Duplicating it into a fresh draft is
 * the only way forward. Contrast with `changes_requested`, which *is* the
 * fix-and-resubmit loop.
 */
export function isExamRejected(status: ExamStatus): boolean {
  return status === "rejected";
}

// ── Dashboard buckets ───────────────────────────────────────────────────────
// Both teacher and admin dashboards group the 11 states into a handful of
// tabs. `statuses` maps 1:1 to the backend `?status=a,b` filter param.

export interface StatusBucket {
  key: string;
  label: string;
  statuses: ExamStatus[];
}

/**
 * Teacher-facing buckets (their own exams across the lifecycle). "Drafts" holds
 * only the states the teacher can actually act on — `rejected` is terminal (see
 * `isExamRejected`), so it sits with the other closed states instead.
 */
export const TEACHER_BUCKETS: readonly StatusBucket[] = [
  { key: "drafts",     label: "Drafts",           statuses: ["draft", "changes_requested"] },
  { key: "review",     label: "In Review",        statuses: ["under_review"] },
  { key: "scheduled",  label: "Approved",         statuses: ["approved", "scheduled"] },
  { key: "live",       label: "Live",             statuses: ["live"] },
  { key: "evaluation", label: "Evaluation",       statuses: ["under_evaluation"] },
  // The teacher's action queue: these are the exams waiting on them to review
  // reports and release marks, so it gets its own tab rather than sitting
  // alongside `under_evaluation`, where there is nothing to do but wait.
  { key: "publish",    label: "Ready to Publish", statuses: ["ready_to_publish"] },
  { key: "closed",     label: "Closed",           statuses: ["completed", "archived", "rejected"] },
] as const;

/**
 * Admin-facing buckets (approval + run monitoring across the tenant).
 *
 * "Approved" and "Scheduled" are deliberately separate tabs: approving a paper
 * and dating it are two decisions the admin makes at different times, so
 * `approved` is a real resting state and this tab is the admin's list of papers
 * that still owe a date. Merging them would hide that work.
 */
export const ADMIN_BUCKETS: readonly StatusBucket[] = [
  { key: "queue",      label: "Approval Queue",   statuses: ["under_review"] },
  { key: "approved",   label: "To Schedule",      statuses: ["approved"] },
  { key: "scheduled",  label: "Scheduled",        statuses: ["scheduled"] },
  { key: "live",       label: "Live",             statuses: ["live"] },
  { key: "evaluation", label: "Evaluation",       statuses: ["under_evaluation"] },
  // The owner SEES this bucket — it is how they know which teachers still owe a
  // publish — but the publish button is the teacher's, not theirs (bar the
  // break-glass in `canPublishResultsAsOwner`).
  { key: "publish",    label: "Ready to Publish", statuses: ["ready_to_publish"] },
  { key: "published",  label: "Published",        statuses: ["completed"] },
  { key: "changes",    label: "Bounced",          statuses: ["changes_requested", "rejected"] },
] as const;

/**
 * The buckets a given tenant role should see on the exams hub.
 *
 * These are not two views of the same list — they are two different lists. A
 * teacher's hub starts at "Drafts" because authoring is their job; the owner's
 * starts at "Approval Queue" because a paper only becomes their business when
 * it is submitted. The owner has no Drafts tab at all, and asking the API for
 * `?status=draft` as an owner returns nothing, so there is nothing to show.
 */
export function bucketsForRole(role: string | null): readonly StatusBucket[] {
  return role === "coaching_owner" ? ADMIN_BUCKETS : TEACHER_BUCKETS;
}

/** Serialize a bucket's statuses into the `?status=` query param. */
export function bucketStatusParam(bucket: StatusBucket): string {
  return bucket.statuses.join(",");
}

/** Shape of `GET /tenant/exams/stats` → `{ stats.byStatus }`. */
export type ByStatusCounts = Record<ExamStatus, number>;

/** Sum a bucket's counts from a `byStatus` map (for tab badge counts). */
export function bucketCount(bucket: StatusBucket, byStatus?: Partial<ByStatusCounts>): number {
  if (!byStatus) return 0;
  return bucket.statuses.reduce((n, s) => n + (byStatus[s] ?? 0), 0);
}

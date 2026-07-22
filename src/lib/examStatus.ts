// Single source of truth for the 11-status exam lifecycle (PRD v1).
// Mirrors the backend union in `exam.types.ts` — keep the two in sync.
//   draft → under_review → changes_requested → rejected → approved → scheduled →
//   live → under_evaluation → results_published → completed → archived
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
  | "results_published"
  | "completed"
  | "archived";

export const EXAM_STATUSES: readonly ExamStatus[] = [
  "draft", "under_review", "changes_requested", "rejected", "approved",
  "scheduled", "live", "under_evaluation", "results_published", "completed",
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
  results_published: { label: "Results Published", tone: "success", hint: "Scores & reports are visible to students." },
  completed:         { label: "Completed",         tone: "neutral", hint: "Lifecycle finished." },
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

/** A teacher publishes results only from under_evaluation. */
export function canPublishResults(status: ExamStatus): boolean {
  return status === "under_evaluation";
}

/** Archive is owner-only and only from completed. */
export function canArchive(status: ExamStatus): boolean {
  return status === "completed";
}

// ── Dashboard buckets ───────────────────────────────────────────────────────
// Both teacher and admin dashboards group the 11 states into a handful of
// tabs. `statuses` maps 1:1 to the backend `?status=a,b` filter param.

export interface StatusBucket {
  key: string;
  label: string;
  statuses: ExamStatus[];
}

/** Teacher-facing buckets (their own exams across the lifecycle). */
export const TEACHER_BUCKETS: readonly StatusBucket[] = [
  { key: "drafts",     label: "Drafts",      statuses: ["draft", "changes_requested", "rejected"] },
  { key: "review",     label: "In Review",   statuses: ["under_review"] },
  { key: "scheduled",  label: "Scheduled",   statuses: ["approved", "scheduled"] },
  { key: "live",       label: "Live",        statuses: ["live"] },
  { key: "evaluation", label: "Evaluation",  statuses: ["under_evaluation", "results_published"] },
  { key: "completed",  label: "Completed",   statuses: ["completed", "archived"] },
] as const;

/** Admin-facing buckets (approval + run monitoring across the tenant). */
export const ADMIN_BUCKETS: readonly StatusBucket[] = [
  { key: "queue",      label: "Approval Queue", statuses: ["under_review"] },
  { key: "scheduled",  label: "Scheduled",      statuses: ["approved", "scheduled"] },
  { key: "live",       label: "Live",           statuses: ["live"] },
  { key: "evaluation", label: "Evaluation",     statuses: ["under_evaluation"] },
  { key: "published",  label: "Published",      statuses: ["results_published", "completed"] },
  { key: "changes",    label: "Bounced",        statuses: ["changes_requested", "rejected"] },
] as const;

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

import type { BadgeTone } from "@/components/ui";
import type { ExamStatus } from "@/lib/examStatus";

/**
 * Types + display helpers for the people (student / teacher) detail screens,
 * mirroring `backend/src/modules/people/people.types.ts`.
 *
 * Money is **paise**, as everywhere else — `formatPaise` in lib/fee.ts is the
 * only place that divides by 100.
 *
 * Dates arrive as ISO strings (JSON), not `Date`, which is why every timestamp
 * here is typed `string` even though the backend type says `Date`.
 */

export interface PersonIdentity {
  id: string;
  name: string;
  email: string | null;
  emailVerified: boolean;
  phone: string | null;
  phoneVerified: boolean;
  image: string | null;
  role: "coaching_owner" | "teacher" | "student";
  /** Joined THIS coaching. Not the account's signup date — that is `accountCreatedAt`. */
  joinedAt: string;
  accountCreatedAt: string;
}

export interface StudentBatchRef {
  id: string;
  name: string;
  grade: string | null;
  /** The enrollment's state, not the batch's. */
  status: "pending" | "approved" | "rejected";
  enrolledAt: string;
  teachers: { id: string; name: string }[];
}

export interface StudentExamAttempt {
  sessionId: string;
  examId: string;
  examTitle: string;
  examStatus: ExamStatus;
  attemptNumber: number;
  sessionStatus: "in_progress" | "submitted" | "evaluated" | "abandoned";
  startedAt: string;
  submittedAt: string | null;
  totalMarks: number;
  reportId: string | null;
  score: number | null;
  maxScore: number | null;
  /** Whether the STUDENT can see this mark yet. Staff see the score either way. */
  resultPublished: boolean;
}

export interface StudentActivitySummary {
  attempted: number;
  submitted: number;
  evaluated: number;
  /** 0–100, or null when nothing has been marked. */
  averagePercent: number | null;
}

export interface StudentFeeBlock {
  totalBilled: number;
  totalPaid: number;
  totalWaived: number;
  balance: number;
  overdueAmount: number;
  creditBalance: number;
  nextDue: { invoiceId: string; label: string; dueDate: string; amount: number } | null;
}

export interface GuardianRef {
  id: string;
  name: string;
  relation: string;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
}

export interface OwnerStudentProfile {
  scope: "owner";
  student: PersonIdentity;
  batches: StudentBatchRef[];
  attempts: StudentExamAttempt[];
  activity: StudentActivitySummary;
  /** `null` = fees are switched off platform-wide, NOT "owes nothing". */
  fees: StudentFeeBlock | null;
  guardians: GuardianRef[];
}

/**
 * The teacher's narrower payload. `fees` and `guardians` are **absent keys**,
 * not nulls — so branch on `scope` rather than testing for undefined, and let
 * TypeScript refuse the money fields on this arm.
 */
export interface TeacherStudentProfile {
  scope: "teacher";
  student: PersonIdentity;
  batches: StudentBatchRef[];
  attempts: StudentExamAttempt[];
  activity: StudentActivitySummary;
}

export type StudentProfile = OwnerStudentProfile | TeacherStudentProfile;

export interface StudentListRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  joinedAt: string;
  batchCount: number;
  batchNames: string[];
  attemptCount: number;
  lastActiveAt: string | null;
  /** `null` = not shown (teacher, or fees off). Never read it as ₹0. */
  outstanding: number | null;
}

export interface TeacherBatchRef {
  id: string;
  name: string;
  grade: string | null;
  studentCount: number;
  assignedAt: string;
}

export interface TeacherPaperRef {
  id: string;
  title: string;
  status: ExamStatus;
  totalMarks: number;
  scheduledAt: string | null;
  createdAt: string;
}

export interface TeacherProfile {
  teacher: PersonIdentity;
  batches: TeacherBatchRef[];
  /** Never contains a `draft` — the backend excludes them, and so does the count. */
  papers: TeacherPaperRef[];
  workload: { batchCount: number; studentCount: number; paperCount: number };
}

// ── Display helpers ─────────────────────────────────────────────────────────

export const ENROLLMENT_TONE: Record<StudentBatchRef["status"], BadgeTone> = {
  approved: "success",
  pending: "warning",
  rejected: "danger",
};

export const ENROLLMENT_LABEL: Record<StudentBatchRef["status"], string> = {
  approved: "Enrolled",
  pending: "Awaiting approval",
  rejected: "Rejected",
};

/**
 * One badge for an attempt, read from the staff side.
 *
 * The order matters: an unsubmitted paper is "In progress" whatever the exam's
 * own lifecycle says, and a marked paper the student cannot see yet is held
 * back rather than shown as done — that distinction is the whole reason
 * `resultPublished` is on the wire.
 */
export function attemptBadge(a: StudentExamAttempt): { tone: BadgeTone; label: string } {
  if (a.sessionStatus === "abandoned") return { tone: "neutral", label: "Abandoned" };
  if (a.sessionStatus === "in_progress") return { tone: "accent", label: "In progress" };
  if (!a.reportId) return { tone: "warning", label: "Awaiting evaluation" };
  if (!a.resultPublished) return { tone: "warning", label: "Marked, not released" };
  return { tone: "success", label: "Result released" };
}

/** `17 / 20 (85%)`, or a dash while the paper is unmarked. */
export function formatScore(a: Pick<StudentExamAttempt, "score" | "maxScore">): string {
  if (a.score === null || a.maxScore === null) return "—";
  if (a.maxScore === 0) return `${a.score}`;
  return `${a.score} / ${a.maxScore} (${Math.round((a.score / a.maxScore) * 100)}%)`;
}

export const fmtPersonDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** "Never" reads better than an empty cell for a student who has not sat a paper. */
export const fmtLastActive = (iso: string | null): string => (iso ? fmtPersonDate(iso) : "Never");

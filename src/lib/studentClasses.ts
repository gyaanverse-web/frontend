/**
 * The student-facing shape of a batch, shared by the "My classes" grid and the
 * single-batch screen. Mirrors the student branch of `GET /tenant/classes`
 * (getClassesForStudent) — staff callers of the same route get a different
 * payload, so this type is deliberately not the one the coaching pages use.
 */
export type StudentClass = {
  id: string;
  name: string;
  grade: string | null;
  description: string | null;
  teacherName: string | null;
  /** approved | pending — rejected rows are never returned. */
  enrollmentStatus: string;
  enrolledAt: string;
  /** Approved classmates, this student included. */
  studentCount: number;
  /** Papers assigned to the batch in a state the student can see. */
  examCount: number;
};

/** A classmate as students see each other: a name, never contact details. */
export type Classmate = {
  id: string;
  studentId: string;
  name: string;
  status: string;
  enrolledAt: string;
};

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

// ── Class join codes ────────────────────────────────────────────────────────

/**
 * 8 chars from an unambiguous alphabet (no 0/O, 1/I) — mirrors CLASS_CODE_CHARS
 * in the backend class.schema.ts. A *coaching* code has the identical shape, so
 * nothing about a code tells you which kind it is; only the screen it was typed
 * into does. That is why `classJoinPath` exists and is tested.
 */
const CODE_RE = /^[A-HJ-NP-Z2-9]{8}$/;

/** Upper-case, strip anything that isn't alphanumeric, cap at the code length. */
export function normalizeClassCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

/** Null when the code is well-formed, otherwise the message to show. */
export function validateClassCode(code: string): string | null {
  if (CODE_RE.test(code)) return null;
  return code.length < 8
    ? "Class codes are 8 characters long."
    : "That code contains characters we don't use. Check for 0/O and 1/I mix-ups.";
}

/**
 * Where a *class* code is redeemed.
 *
 * `/join/[code]` redeems a COACHING code and would reject this one as invalid —
 * that mismatch is exactly the bug this function exists to prevent, so the path
 * is pinned by a test rather than written inline at the call site.
 */
export function classJoinPath(code: string): string {
  return `/join/class/${code}`;
}

// ── Per-exam state, as the student experiences it ───────────────────────────

export type ExamStateTone = "success" | "warning" | "accent" | "neutral";

export type ExamLike = {
  status: string;
  mySessions?: { status: string }[];
};

/** What the student can do about this paper right now, in their own terms. */
export function examState(e: ExamLike): { label: string; tone: ExamStateTone } {
  const sessions = e.mySessions ?? [];
  const attempted = sessions.length > 0;

  if (sessions.some((s) => s.status === "in_progress")) return { label: "In progress", tone: "accent" };
  if (e.status === "scheduled") return { label: "Upcoming", tone: "neutral" };
  if (e.status === "live") {
    return attempted ? { label: "Submitted", tone: "warning" } : { label: "Open now", tone: "accent" };
  }
  // Publishing IS completing — `completed` is the only state where results are out.
  if (e.status === "completed") {
    return attempted ? { label: "Result ready", tone: "success" } : { label: "Missed", tone: "neutral" };
  }
  // under_evaluation | ready_to_publish — graded or not, the student sees the
  // same thing until the teacher publishes.
  return attempted ? { label: "Awaiting results", tone: "warning" } : { label: "Closed", tone: "neutral" };
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useTenantSession } from "@/lib/useTenantSession";
import { QuestionEditor, parseToEditor, buildPayloadAnswer, emptyEditor, Field, type EditorState } from "@/components/QuestionEditor";
import { TeacherShell } from "@/components/dashboard/TeacherShell";
import { MathText } from "@/components/Math";
import { Button, Badge, Input, Icon } from "@/components/ui";
import type { BadgeTone, IconName } from "@/components/ui";
import { examStatusLabel, type ExamStatus } from "@/lib/examStatus";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tenant = { id: string; slug: string; name: string };
type Subject = { id: string; name: string; gradeLevel: string | null };
type Item = { id: string; name: string };
type ClassItem = { id: string; name: string; grade: string | null; studentCount?: number };

type Difficulty = "easy" | "medium" | "hard";
type DraftStatus = "pending" | "kept" | "discarded" | null;
type ScopeType = "single" | "multi" | "full-subject" | "custom";

type Question = {
  id: string;
  bankQuestionId: string | null;
  order: number;
  type: string;
  difficulty: string | null;
  body: string;
  marks: number;
  negativeMarks?: number;
  explanation?: string | null;
  payload?: Record<string, unknown>;
  answerKey?: Record<string, unknown>;
  draftStatus: DraftStatus;
};

type Exam = {
  id: string;
  title: string;
  status: string;
  totalMarks: number;
  estimatedDurationMins: number | null;
  durationMins: number;
  wizardStep?: number | null;
  wizardState?: WizardState | null;
};

/**
 * The wizard's form state as the server stores it (`exams.wizard_state`).
 *
 * The draft row is created the moment the teacher starts, and this blob is
 * written back on every step — so closing the tab, navigating away, or coming
 * back tomorrow all resume exactly where they left off. It is the client's own
 * form state round-tripped, not a second source of truth: what the paper was
 * actually generated from is recorded server-side in `generationParams`.
 */
type WizardState = {
  classIds?: string[];
  subjectId?: string;
  scopeType?: ScopeType;
  chapterIds?: string[];
  typeCounts?: Record<string, number>;
  difficultyPct?: Partial<Record<Difficulty, number>>;
  verifiedOnly?: boolean;
};

/** A row on the "pick up where you left off" list. */
type DraftSummary = {
  id: string;
  title: string;
  wizardStep: number | null;
  questionCount: number;
  totalMarks: number;
  updatedAt: string;
};

type Shortage = { type: string; difficulty: string; requested: number; filled: number };

type Availability = {
  chapterCounts: { chapterId: string; count: number }[];
  byTypeDifficulty: { type: string; difficulty: string; count: number }[];
  total: number;
};

// Question types offered by the generator UI (matches the design). The manual
// "add" editor in step 3 still supports the full set.
const STEP2_TYPES: [string, string][] = [
  ["mcq_single", "MCQ Single"],
  ["mcq_multiple", "MCQ Multiple"],
  ["numerical", "Numerical"],
  ["subjective", "Subjective"],
  ["assertion_reason", "Assertion–Reason"],
];

const MANUAL_TYPES: [string, string][] = [
  ["mcq_single", "MCQ (single)"],
  ["mcq_multiple", "MCQ (multiple)"],
  ["integer", "Integer"],
  ["numerical", "Numerical"],
  ["subjective", "Subjective"],
  ["match", "Match"],
  ["assertion_reason", "Assertion/Reason"],
  ["fill_blanks", "Fill blanks"],
];

const DIFF_META: { key: Difficulty; label: string; color: string }[] = [
  { key: "easy", label: "Easy", color: "var(--success)" },
  { key: "medium", label: "Moderate", color: "var(--accent)" },
  { key: "hard", label: "Hard", color: "var(--danger)" },
];

const DIFF_TONE: Record<string, BadgeTone> = { easy: "success", medium: "warning", hard: "danger" };

const SCOPES: { key: ScopeType; label: string; desc: string }[] = [
  { key: "single", label: "Single chapter", desc: "One chapter from the hierarchy" },
  { key: "multi", label: "Multi-chapter", desc: "Pick 2+ chapters across a subject" },
  { key: "full-subject", label: "Full subject", desc: "Entire subject syllabus" },
  { key: "custom", label: "Custom", desc: "Build your own scope" },
];

// Split a total into easy/medium/hard integer counts by the sliders' relative
// weights, using largest-remainder rounding so the parts always sum to the
// total — even when the sliders don't add up to exactly 100.
function distributeByPct(total: number, pct: Record<Difficulty, number>): Record<Difficulty, number> {
  const keys: Difficulty[] = ["easy", "medium", "hard"];
  const weight = pct.easy + pct.medium + pct.hard || 1;
  const raw = keys.map((k) => (total * pct[k]) / weight);
  const floors = raw.map(Math.floor);
  let rem = total - floors.reduce((a, b) => a + b, 0);
  const order = keys.map((_, i) => i).sort((a, b) => (raw[b] - floors[b]) - (raw[a] - floors[a]));
  for (const i of order) { if (rem <= 0) break; floors[i]++; rem--; }
  return { easy: floors[0], medium: floors[1], hard: floors[2] };
}

const cardStyle: React.CSSProperties = { background: "var(--surface-card)", border: "1px solid var(--border-light)", borderRadius: 14, padding: 22 };
const lblStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 2 };

// ── Landing: action card ───────────────────────────────────────────────────────

function ActionCard({
  icon, title, desc, cta, primary = false, busy = false, onClick,
}: {
  icon: IconName; title: string; desc: string; cta: string;
  primary?: boolean; busy?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="gv-action-card"
      style={{
        textAlign: "left", cursor: busy ? "default" : "pointer", display: "flex", flexDirection: "column", gap: 14,
        padding: 24, borderRadius: 16,
        border: primary ? "1px solid rgba(43,80,245,.25)" : "1px solid var(--border-light)",
        background: primary ? "linear-gradient(135deg, var(--accent-soft) 0%, var(--surface-card) 70%)" : "var(--surface-card)",
        boxShadow: "var(--shadow-sm)", minHeight: 172, transition: "transform .12s ease, box-shadow .12s ease",
      }}
    >
      <span style={{ width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: primary ? "var(--accent)" : "var(--surface-inset)", color: primary ? "#fff" : "var(--accent)", flexShrink: 0 }}>
        <Icon name={icon} size={22} />
      </span>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text-heading)", marginBottom: 5 }}>{title}</div>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "var(--text-muted)" }}>{desc}</p>
      </div>
      <span className={`gv-btn gv-btn--${primary ? "app" : "secondary"} gv-btn--md`} style={{ pointerEvents: "none", alignSelf: "flex-start" }}>
        <span>{busy ? "Working…" : cta}</span>
        <span aria-hidden="true" style={{ fontSize: "1.05em" }}>→</span>
      </span>
    </button>
  );
}

// ── Stepper ───────────────────────────────────────────────────────────────────

function Stepper({
  current, furthest, onGo,
}: { current: number; furthest: number; onGo?: (n: number) => void }) {
  const steps = [
    { n: 1, l: "Class & Subject" },
    { n: 2, l: "Select Scope" },
    { n: 3, l: "Distribution" },
    { n: 4, l: "Review & Submit" },
  ];
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 24 }}>
      {steps.map((s, i) => {
        // Any step the teacher has already reached is clickable — backwards to
        // revise, forwards to return without redoing the ones in between. The
        // draft holds the state, so moving between steps never loses anything.
        const navigable = !!onGo && s.n !== current && s.n <= furthest;
        return (
          <div key={s.n} style={{ display: "contents" }}>
            <button
              type="button"
              onClick={navigable ? () => onGo!(s.n) : undefined}
              disabled={!navigable}
              title={navigable ? `Go to ${s.l}` : undefined}
              style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", padding: 0, cursor: navigable ? "pointer" : "default" }}
            >
              <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, fontFamily: "var(--font-sans)", background: s.n === current ? "var(--accent)" : s.n <= furthest ? "var(--success)" : "var(--surface-inset)", color: s.n === current || s.n <= furthest ? "#fff" : "var(--text-muted)" }}>
                {s.n !== current && s.n <= furthest ? "✓" : s.n}
              </div>
              <span style={{ fontSize: 14, fontWeight: s.n === current ? 600 : 400, color: s.n === current ? "var(--text-heading)" : "var(--text-muted)", fontFamily: "var(--font-body)", textDecoration: navigable ? "underline" : "none", textUnderlineOffset: 3 }}>{s.l}</span>
            </button>
            {i < steps.length - 1 && <div style={{ flex: 1, height: 1, background: s.n < furthest ? "var(--success)" : "var(--border-light)", margin: "0 12px" }} />}
          </div>
        );
      })}
    </div>
  );
}

// ── Autosave indicator ────────────────────────────────────────────────────────
//
// A draft that saves itself is only reassuring if the teacher can see it
// happening — otherwise "did my work survive?" is answered by closing the tab
// and hoping.

function SaveIndicator({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  if (state === "idle") return null;
  const meta = {
    saving: { icon: "sparkles" as IconName, text: "Saving…", color: "var(--text-muted)" },
    saved: { icon: "check-circle" as IconName, text: "Draft saved", color: "var(--success)" },
    error: { icon: "alert-triangle" as IconName, text: "Couldn’t save — will retry", color: "var(--danger)" },
  }[state];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: meta.color, whiteSpace: "nowrap" }}>
      <Icon name={meta.icon} size={14} />
      {meta.text}
    </span>
  );
}

// ── Resume list ───────────────────────────────────────────────────────────────

const STEP_LABELS = ["Class & Subject", "Select Scope", "Distribution", "Review & Submit"];

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function DraftCard({
  draft, resuming, discarding, onResume, onDiscard,
}: {
  draft: DraftSummary;
  resuming: boolean;
  discarding: boolean;
  onResume: () => void;
  onDiscard: () => void;
}) {
  const stepIdx = Math.min(4, Math.max(1, draft.wizardStep ?? 1)) - 1;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", borderRadius: 11, border: "1px solid var(--border-light)", background: "var(--surface-card)" }}>
      <span style={{ width: 36, height: 36, borderRadius: 9, background: "var(--surface-inset)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon name="file-text" size={17} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-heading)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {draft.title}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
          Step {stepIdx + 1} of 4 · {STEP_LABELS[stepIdx]}
          {draft.questionCount > 0 && ` · ${draft.questionCount} question${draft.questionCount === 1 ? "" : "s"}`}
          {" · edited "}{relativeTime(draft.updatedAt)}
        </div>
      </div>
      <Button variant="secondary" size="sm" disabled={resuming || discarding} onClick={onResume}>
        {resuming ? "Opening…" : "Resume"}
      </Button>
      <Button variant="ghost" size="sm" disabled={resuming || discarding} style={{ color: "var(--danger)" }} onClick={onDiscard}>
        {discarding ? "…" : "Discard"}
      </Button>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TestEnginePage() {
  const router = useRouter();
  // Authoring is a teacher capability. The coaching owner reviews and schedules
  // papers — every route this page calls is `requireTenantRole('teacher')`, so
  // an owner landing here would see controls whose every request 403s.
  const { loading, user, tenant, role } = useTenantSession<Tenant>({
    allow: ["teacher"],
  });

  const [pageError, setPageError] = useState("");

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [creating, setCreating] = useState(false);
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");

  // ── The draft ───────────────────────────────────────────────────────────────
  // `draftId` is set the instant the teacher starts, before a single question
  // has been picked, and everything below autosaves onto it. `started` is just
  // "do we have a draft open?" — there is no unsaved-wizard state any more.
  const [draftId, setDraftId] = useState<string | null>(null);
  const started = draftId !== null;
  // The furthest step reached, so the stepper can jump forwards as well as back.
  const [furthest, setFurthest] = useState(1);
  const [starting, setStarting] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // ── Resume list ─────────────────────────────────────────────────────────────
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [draftsLoading, setDraftsLoading] = useState(true);
  const [resuming, setResuming] = useState<string | null>(null);
  const [discardingId, setDiscardingId] = useState<string | null>(null);

  // ── Class & subject (step 1) ────────────────────────────────────────────────
  // The paper is authored *for* a class, so the class is picked before any
  // scope/distribution work. `submitForReview` rejects a classless private exam
  // anyway — asking here turns a late error into an upfront choice.
  const [classList, setClassList] = useState<ClassItem[]>([]);
  const [classesLoading, setClassesLoading] = useState(true);
  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(new Set());

  // ── Scope (step 2) ──────────────────────────────────────────────────────────
  const [subjectId, setSubjectId] = useState("");
  const [scopeType, setScopeType] = useState<ScopeType>("multi");
  const [groups, setGroups] = useState<{ module: Item; chapters: Item[] }[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [chapterSearch, setChapterSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // ── Distribution (step 3) ─────────────────────────────────────────────────────
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>(
    { mcq_single: 15, mcq_multiple: 5, numerical: 7, subjective: 3, assertion_reason: 0 },
  );
  const [diffPct, setDiffPct] = useState<Record<Difficulty, number>>({ easy: 30, medium: 50, hard: 20 });
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genErr, setGenErr] = useState("");

  // ── Availability preview ──────────────────────────────────────────────────────
  const [avail, setAvail] = useState<Availability | null>(null);

  // ── Draft result (step 4) ─────────────────────────────────────────────────────
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [shortages, setShortages] = useState<Shortage[]>([]);
  const [actingId, setActingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitErr, setSubmitErr] = useState("");

  // edit a draft question
  const [editingQId, setEditingQId] = useState<string | null>(null);
  const [eqType, setEqType] = useState("mcq_single");
  const [eqBody, setEqBody] = useState("");
  const [eqMarks, setEqMarks] = useState("4");
  const [eqEd, setEqEd] = useState<EditorState>(emptyEditor);
  const [eqErr, setEqErr] = useState("");

  // add a manual question
  const [showAddManual, setShowAddManual] = useState(false);
  const [amType, setAmType] = useState("mcq_single");
  const [amBody, setAmBody] = useState("");
  const [amMarks, setAmMarks] = useState("4");
  const [amEd, setAmEd] = useState<EditorState>(emptyEditor);
  const [amErr, setAmErr] = useState("");

  // ── Init ──────────────────────────────────────────────────────────────────

  const refreshDrafts = useCallback(() => {
    if (!tenant) return;
    setDraftsLoading(true);
    api.get<{ drafts: DraftSummary[] }>("/tenant/exams/drafts", { tenant: tenant.slug })
      .then((d) => setDrafts(d.drafts))
      .catch(() => setDrafts([]))
      .finally(() => setDraftsLoading(false));
  }, [tenant]);

  useEffect(() => {
    if (!tenant) return;
    api.get<{ subjects: Subject[] }>("/tenant/subjects", { tenant: tenant.slug })
      .then((d) => setSubjects(d.subjects))
      .catch((err) => setPageError(err instanceof Error ? err.message : "Failed to load subjects"));
    api.get<{ classes: ClassItem[] }>("/tenant/classes", { tenant: tenant.slug })
      .then((d) => setClassList(d.classes))
      .catch(() => setClassList([]))
      .finally(() => setClassesLoading(false));
    refreshDrafts();
  }, [tenant, refreshDrafts]);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const effectiveChapterIds = useMemo(
    () => (scopeType === "full-subject" ? [] : [...checked]),
    [scopeType, checked],
  );
  const checkedKey = effectiveChapterIds.slice().sort().join(",");

  const typeTotal = STEP2_TYPES.reduce((s, [k]) => s + (typeCounts[k] ?? 0), 0);
  const diffCounts = useMemo(() => distributeByPct(typeTotal, diffPct), [typeTotal, diffPct]);
  const pctTotal = diffPct.easy + diffPct.medium + diffPct.hard;

  // availability grouped by type, within the selected scope
  const typeAvail = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of avail?.byTypeDifficulty ?? []) m[r.type] = (m[r.type] ?? 0) + r.count;
    return m;
  }, [avail]);

  // availability grouped by difficulty, within the selected scope
  const diffAvail = useMemo(() => {
    const m: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
    for (const r of avail?.byTypeDifficulty ?? []) {
      if (r.difficulty === "easy" || r.difficulty === "medium" || r.difficulty === "hard") m[r.difficulty] += r.count;
    }
    return m;
  }, [avail]);

  // Per-(type × difficulty) bucket check — mirrors how the generator apportions
  // each type's count across the difficulty weights. This is the only honest
  // "can the bank fill this?" signal: e.g. 100% hard is short unless the bank
  // actually holds enough hard questions of each requested type.
  const bucketCheck = useMemo(() => {
    const have: Record<string, number> = {};
    for (const r of avail?.byTypeDifficulty ?? []) have[`${r.type}|${r.difficulty}`] = r.count;
    const shortByDiff: Record<Difficulty, boolean> = { easy: false, medium: false, hard: false };
    let allOk = true;
    for (const [type] of STEP2_TYPES) {
      const n = typeCounts[type] ?? 0;
      if (n <= 0) continue;
      const per = distributeByPct(n, diffPct);
      for (const d of ["easy", "medium", "hard"] as Difficulty[]) {
        if (per[d] <= 0) continue;
        if ((have[`${type}|${d}`] ?? 0) < per[d]) { allOk = false; shortByDiff[d] = true; }
      }
    }
    return { allOk, shortByDiff };
  }, [avail, typeCounts, diffPct]);

  const allTypesAvailable = avail != null && bucketCheck.allOk;

  // Adjust one difficulty slider and rebalance the other two so the mix always
  // sums to exactly 100%. The remainder is shared proportionally to the other
  // two sliders' current values (evenly if both are zero).
  function adjustDiff(key: Difficulty, value: number) {
    setDiffPct((prev) => {
      const v = Math.max(0, Math.min(100, value));
      const others = (["easy", "medium", "hard"] as Difficulty[]).filter((k) => k !== key);
      const remaining = 100 - v;
      const otherSum = prev[others[0]] + prev[others[1]];
      const next = { ...prev, [key]: v } as Record<Difficulty, number>;
      if (otherSum === 0) {
        next[others[0]] = Math.round(remaining / 2);
      } else {
        next[others[0]] = Math.round((prev[others[0]] / otherSum) * remaining);
      }
      next[others[1]] = remaining - next[others[0]];
      return next;
    });
  }

  // Step 1 — a paper must be *for* someone, and drawn from *something*.
  const canContinueClass = selectedClassIds.size > 0 && !!subjectId;

  // Step 2 — the chapter scope must match the chosen scope type.
  const canContinueScope =
    !!subjectId &&
    (scopeType === "full-subject"
      ? true
      : scopeType === "single"
        ? checked.size === 1
        : checked.size >= 1);

  const canGenerate = canContinueClass && canContinueScope && typeTotal > 0 && pctTotal > 0 && !generating;

  // ── Load chapters when subject changes ────────────────────────────────────────

  /**
   * Load a subject's module/chapter tree.
   *
   * `keepChecked` is passed only when resuming a saved draft — the stored
   * chapter selection has to survive the load. A teacher *choosing* a different
   * subject gets the selection cleared, since those chapter ids belong to the
   * old subject.
   */
  async function selectSubject(sid: string, keepChecked?: Set<string>) {
    setSubjectId(sid);
    setChecked(keepChecked ?? new Set());
    setGroups([]);
    setAvail(null);
    if (!sid || !tenant) return;
    setGroupsLoading(true);
    try {
      const md = await api.get<{ modules: Item[] }>(`/tenant/subjects/${sid}/modules`, { tenant: tenant.slug });
      const grps = await Promise.all(
        md.modules.map(async (m) => {
          const cd = await api
            .get<{ chapters: Item[] }>(`/tenant/modules/${m.id}/chapters`, { tenant: tenant.slug })
            .catch(() => ({ chapters: [] as Item[] }));
          return { module: m, chapters: cd.chapters };
        }),
      );
      setGroups(grps);
    } finally {
      setGroupsLoading(false);
    }
  }

  // ── Fetch availability whenever scope changes ────────────────────────────────

  useEffect(() => {
    // `avail` is cleared in selectSubject when the subject changes, so we only
    // need to fetch here — never set state synchronously in the effect body.
    if (!tenant || !subjectId) return;
    let cancelled = false;
    const params = new URLSearchParams({ subjectId });
    if (effectiveChapterIds.length) params.set("chapterIds", effectiveChapterIds.join(","));
    if (verifiedOnly) params.set("verifiedOnly", "true");
    api.get<{ availability: Availability }>(`/tenant/question-bank/availability?${params.toString()}`, { tenant: tenant.slug })
      .then((d) => { if (!cancelled) setAvail(d.availability); })
      .catch(() => { if (!cancelled) setAvail(null); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant, subjectId, scopeType, checkedKey, verifiedOnly]);

  // ── Class actions ─────────────────────────────────────────────────────────────

  function toggleClass(id: string) {
    setSelectedClassIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // ── Scope actions ─────────────────────────────────────────────────────────────

  function toggleChapter(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (scopeType === "single") { next.clear(); if (!prev.has(id)) next.add(id); return next; }
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleModule(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const chapterCountOf = (id: string) => avail?.chapterCounts.find((c) => c.chapterId === id)?.count ?? null;

  // ── Draft lifecycle: start, autosave, resume, discard ───────────────────────

  // The current form state, in the shape the server stores. Kept in a ref as
  // well so the unmount/tab-close save reads today's values rather than the ones
  // captured when the effect was registered.
  const snapshot = useCallback((): WizardState => ({
    classIds: [...selectedClassIds],
    subjectId: subjectId || undefined,
    scopeType,
    chapterIds: [...checked],
    typeCounts,
    difficultyPct: diffPct,
    verifiedOnly,
  }), [selectedClassIds, subjectId, scopeType, checked, typeCounts, diffPct, verifiedOnly]);

  const liveRef = useRef({ draftId, step, title, snapshot });
  liveRef.current = { draftId, step, title, snapshot };

  /** Persist the wizard onto the draft. Safe to call often; never throws. */
  const persist = useCallback(async (atStep: number) => {
    const { draftId: id, title: t, snapshot: snap } = liveRef.current;
    if (!tenant || !id) return;
    setSaveState("saving");
    try {
      await api.put(`/tenant/exams/${id}/wizard`, {
        step: atStep,
        state: snap(),
        ...(t.trim() ? { title: t.trim() } : {}),
      }, { tenant: tenant.slug });
      setSaveState("saved");
    } catch {
      // A failed autosave is not worth interrupting authoring for — the next
      // step change retries, and the indicator tells the teacher it is stale.
      setSaveState("error");
    }
  }, [tenant]);

  /** Move between steps, saving the step being left behind. */
  const goToStep = useCallback((n: number) => {
    // Persist outside the state updater — React may invoke an updater twice in
    // development StrictMode, and a save is a side effect, not a reducer.
    if (liveRef.current.step !== n) void persist(n);
    setStep(n);
    setFurthest((f) => Math.max(f, n));
  }, [persist]);

  // Save on the way out: closing the tab, or navigating to another page.
  useEffect(() => {
    if (!draftId) return;
    const onHide = () => {
      const { draftId: id, step: s, title: t, snapshot: snap } = liveRef.current;
      if (!tenant || !id) return;
      api.keepalivePut(
        `/tenant/exams/${id}/wizard`,
        { step: s, state: snap(), ...(t.trim() ? { title: t.trim() } : {}) },
        { tenant: tenant.slug },
      );
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      onHide();
    };
  }, [draftId, tenant]);

  /**
   * Open a fresh draft. The exam row exists from here on, so everything the
   * teacher does next is durable — this is the "clicking generate creates a
   * draft" behaviour. It costs nothing against the monthly mock quota; that is
   * charged at submit-for-review.
   */
  async function startNewDraft() {
    if (!tenant || starting) return;
    setStarting(true); setPageError("");
    try {
      const res = await api.post<{ exam: Exam }>("/tenant/exams/wizard", {}, { tenant: tenant.slug });
      setDraftId(res.exam.id);
      setStep(1);
      setFurthest(1);
      setSaveState("saved");
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Failed to start a draft");
    } finally {
      setStarting(false);
    }
  }

  /** Pick an existing draft back up, rehydrating the form and the step. */
  async function resumeDraft(id: string) {
    if (!tenant || resuming) return;
    setResuming(id); setPageError("");
    try {
      const { exam: full } = await api.get<{ exam: Exam & { questions: Question[] } }>(
        `/tenant/exams/${id}`, { tenant: tenant.slug },
      );
      const st = full.wizardState ?? {};

      setDraftId(full.id);
      setTitle(full.title === "Untitled paper" ? "" : full.title);
      setSelectedClassIds(new Set(st.classIds ?? []));
      setScopeType(st.scopeType ?? "multi");
      setChecked(new Set(st.chapterIds ?? []));
      if (st.typeCounts) setTypeCounts(st.typeCounts);
      if (st.difficultyPct) {
        setDiffPct({
          easy: st.difficultyPct.easy ?? 0,
          medium: st.difficultyPct.medium ?? 0,
          hard: st.difficultyPct.hard ?? 0,
        });
      }
      setVerifiedOnly(st.verifiedOnly ?? true);

      // Loading the subject also loads its module/chapter tree for step 2.
      if (st.subjectId) await selectSubject(st.subjectId, new Set(st.chapterIds ?? []));

      // A draft with questions has already been generated, so the review step is
      // meaningful. Without them there is nothing to review, so a draft saved at
      // step 4 (generation was never run, or every question was discarded)
      // resumes at Distribution rather than on an empty screen.
      const hasQuestions = full.questions.length > 0;
      if (hasQuestions) {
        setExam(full);
        setQuestions(full.questions);
      }
      const saved = Math.min(4, Math.max(1, full.wizardStep ?? 1));
      const resumeAt = saved === 4 && !hasQuestions ? 3 : saved;
      setStep(resumeAt);
      setFurthest(hasQuestions ? 4 : resumeAt);
      setSaveState("saved");
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Failed to open that draft");
    } finally {
      setResuming(null);
    }
  }

  /** Throw away a draft the teacher no longer wants. */
  async function discardDraftById(id: string) {
    if (!tenant || discardingId) return;
    setDiscardingId(id); setPageError("");
    try {
      await api.delete(`/tenant/exams/${id}`, { tenant: tenant.slug });
      setDrafts((prev) => prev.filter((d) => d.id !== id));
      if (draftId === id) resetToLanding({ save: false });
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Failed to discard the draft");
    } finally {
      setDiscardingId(null);
    }
  }

  // ── Generate ──────────────────────────────────────────────────────────────────

  async function handleGenerate() {
    if (!tenant || !draftId || !canGenerate) return;
    setGenErr(""); setGenerating(true);
    try {
      const typeDistribution: Record<string, number> = {};
      for (const [k] of STEP2_TYPES) if ((typeCounts[k] ?? 0) > 0) typeDistribution[k] = typeCounts[k];
      const difficultyDistribution: Record<string, number> = {};
      for (const k of ["easy", "medium", "hard"] as Difficulty[]) if (diffCounts[k] > 0) difficultyDistribution[k] = diffCounts[k];

      const params: Record<string, unknown> = {
        subjectId,
        totalQuestions: typeTotal,
        typeDistribution,
        difficultyDistribution,
      };
      if (effectiveChapterIds.length > 0) params.chapterIds = effectiveChapterIds;
      if (verifiedOnly) params.verifiedOnly = true;

      // Generation fills the draft that already exists. Re-running it (after
      // stepping back to change the mix) replaces the previous picks and keeps
      // any questions the teacher wrote by hand.
      const body = {
        title: title.trim() || `Generated Test — ${new Date().toLocaleDateString()}`,
        classIds: [...selectedClassIds],
        params,
      };
      const res = await api.post<{ exam: Exam; questions: Question[]; shortages: Shortage[] }>(
        `/tenant/exams/${draftId}/generate`, body, { tenant: tenant.slug },
      );
      setExam(res.exam);
      setQuestions(res.questions);
      setShortages(res.shortages);
      setFinalized(false);
      goToStep(4);
    } catch (err) {
      setGenErr(err instanceof Error ? err.message : "Failed to generate test");
    } finally {
      setGenerating(false);
    }
  }

  // ── Draft review actions ──────────────────────────────────────────────────────

  async function questionAction(qid: string, action: "keep" | "discard" | "regenerate") {
    if (!tenant || !exam) return;
    setActingId(qid);
    try {
      const res = await api.post<{ question: Question }>(
        `/tenant/exams/${exam.id}/questions/${qid}/${action}`, {}, { tenant: tenant.slug },
      );
      setQuestions((prev) => prev.map((q) => (q.id === res.question.id ? res.question : q)));
    } catch (err) {
      setPageError(err instanceof Error ? err.message : `Failed to ${action} question`);
    } finally {
      setActingId(null);
    }
  }

  function startEditQ(q: Question) {
    setEditingQId(q.id);
    setEqType(q.type);
    setEqBody(q.body);
    setEqMarks(String(q.marks));
    setEqEd(parseToEditor(q.type, q.payload, q.answerKey));
    setEqErr("");
  }

  async function saveEditQ() {
    if (!tenant || !exam || !editingQId) return;
    setEqErr("");
    if (!eqBody.trim()) { setEqErr("Enter the question text"); return; }
    const built = buildPayloadAnswer(eqType, eqEd);
    if ("error" in built) { setEqErr(built.error); return; }
    setActingId(editingQId);
    try {
      const res = await api.patch<{ question: Question }>(
        `/tenant/exams/${exam.id}/questions/${editingQId}/edit`,
        { body: eqBody.trim(), payload: built.payload, answerKey: built.answerKey, marks: parseInt(eqMarks, 10) || 1 },
        { tenant: tenant.slug },
      );
      setQuestions((prev) => prev.map((q) => (q.id === res.question.id ? res.question : q)));
      setEditingQId(null);
    } catch (err) {
      setEqErr(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setActingId(null);
    }
  }

  async function addManual(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant || !exam) return;
    setAmErr("");
    if (!amBody.trim()) { setAmErr("Enter the question text"); return; }
    const built = buildPayloadAnswer(amType, amEd);
    if ("error" in built) { setAmErr(built.error); return; }
    setBusy(true);
    try {
      const res = await api.post<{ question: Question }>(
        `/tenant/exams/${exam.id}/questions`,
        { type: amType, body: amBody.trim(), payload: built.payload, answerKey: built.answerKey, marks: parseInt(amMarks, 10) || 1 },
        { tenant: tenant.slug },
      );
      setQuestions((prev) => [...prev, res.question]);
      setAmBody(""); setAmEd(emptyEditor); setShowAddManual(false);
    } catch (err) {
      setAmErr(err instanceof Error ? err.message : "Failed to add question");
    } finally {
      setBusy(false);
    }
  }

  // Bulk-keep every still-pending draft question in one call, so the teacher
  // doesn't have to click "Keep" on each one. Discarded questions are untouched.
  async function handleKeepAll() {
    if (!tenant || !exam) return;
    setBusy(true); setPageError("");
    try {
      await api.post(`/tenant/exams/${exam.id}/questions/keep-all`, {}, { tenant: tenant.slug });
      setQuestions((prev) => prev.map((q) => (q.draftStatus === "pending" ? { ...q, draftStatus: "kept" } : q)));
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Failed to keep all questions");
    } finally {
      setBusy(false);
    }
  }

  // Finalize drops anything not kept and saves the paper as a draft. Publishing
  // (with class assignment + scheduling) happens later on the exam page.
  async function handleFinalize() {
    if (!tenant || !exam) return;
    setBusy(true); setPageError("");
    try {
      await api.post(`/tenant/exams/${exam.id}/finalize`, {}, { tenant: tenant.slug });
      const data = await api.get<{ exam: Exam & { questions: Question[] } }>(`/tenant/exams/${exam.id}`, { tenant: tenant.slug });
      setExam(data.exam);
      setQuestions(data.exam.questions);
      setFinalized(true);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Failed to finalize");
    } finally {
      setBusy(false);
    }
  }

  // Finalized draft → admin review queue. Same endpoint the exam page uses; the
  // teacher loses edit rights the moment this succeeds (backend EDITABLE_STATUSES),
  // and this is where the paper first becomes visible to the coaching owner.
  async function handleSubmitForReview() {
    if (!tenant || !exam || busy) return;
    setSubmitErr(""); setBusy(true);
    try {
      const res = await api.post<{ exam: Exam }>(`/tenant/exams/${exam.id}/submit`, {}, { tenant: tenant.slug });
      setExam(res.exam);
      setSubmitted(true);
      refreshDrafts();
    } catch (err) {
      setSubmitErr(err instanceof Error ? err.message : "Failed to submit for review");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Close the wizard and go back to the landing page. The draft is NOT deleted —
   * it stays on the resume list, which is the whole point: leaving is not the
   * same as throwing the work away. Use "Discard" for that.
   */
  function resetToLanding(opts: { save?: boolean } = {}) {
    // Save on the way out. The unmount hook can't do it here: `draftId` is about
    // to become null, so by the time the effect cleanup runs there is nothing
    // left for it to save. Skipped when the draft was just deleted.
    if (opts.save !== false) void persist(step);
    setExam(null); setQuestions([]); setShortages([]); setEditingQId(null);
    setFinalized(false); setSubmitted(false); setSubmitErr("");
    setStep(1); setFurthest(1); setDraftId(null); setSaveState("idle");
    setTitle(""); setSelectedClassIds(new Set()); setChecked(new Set());
    setSubjectId(""); setGroups([]); setAvail(null);
    refreshDrafts();
  }

  async function createBlankExam() {
    if (!tenant || creating) return;
    setCreating(true); setPageError("");
    try {
      const t = `Untitled exam — ${new Date().toLocaleDateString()}`;
      const res = await api.post<{ exam: { id: string } }>(
        "/tenant/exams",
        { title: t, durationMins: 60, visibility: "private" },
        { tenant: tenant.slug },
      );
      router.push(`/coaching/exams/${res.exam.id}`);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Failed to create exam");
      setCreating(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading || !user || !tenant) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "var(--text-muted)" }}>
        Loading…
      </div>
    );
  }

  const liveQuestions = questions.filter((q) => q.draftStatus !== "discarded");
  const pendingCount = questions.filter((q) => q.draftStatus === "pending").length;
  const isDraft = exam?.status === "draft";
  const subjectName = subjects.find((s) => s.id === subjectId)?.name ?? "";
  const assignedClassNames = classList
    .filter((c) => selectedClassIds.has(c.id))
    .map((c) => c.name)
    .join(", ");
  const visibleGroups = groups
    .map((g) => ({
      module: g.module,
      chapters: chapterSearch.trim()
        ? g.chapters.filter((c) => c.name.toLowerCase().includes(chapterSearch.trim().toLowerCase()))
        : g.chapters,
    }))
    .filter((g) => g.chapters.length > 0 || !chapterSearch.trim());

  // Header action: the autosave indicator, plus a subject picker while in the
  // scope/distribution steps. Step 1 has its own subject control, and step 4 is
  // past the point of changing it.
  const headerAction = started ? (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <SaveIndicator state={saveState} />
      {step > 1 && step < 4 && (
        <select
          value={subjectId}
          onChange={(e) => selectSubject(e.target.value)}
          className="gv-select"
          style={{ minWidth: 170, height: 38 }}
        >
          <option value="">Select subject…</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}
    </div>
  ) : undefined;

  return (
    <TeacherShell tenant={tenant} user={user} role={role} active="test-engine" eyebrow="Test Engine" title="Generate a new test" action={headerAction}>
      {pageError && (
        <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 16, padding: "10px 14px", border: "1px solid rgba(244,63,94,0.35)", background: "var(--danger-soft)", borderRadius: "var(--radius-md)" }}>{pageError}</p>
      )}

      {/* ── Landing: resume, cards, guidelines ─────────────────────────────── */}
      {!started && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Unfinished work comes first — it is the thing a returning teacher
              is here for. Drafts are private: no one else in the coaching,
              owner included, can see or open these. */}
          {!draftsLoading && drafts.length > 0 && (
            <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 34, height: 34, borderRadius: 9, background: "var(--surface-inset)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon name="file-text" size={17} />
                </span>
                <div>
                  <div style={{ fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 700, color: "var(--text-heading)" }}>
                    Pick up where you left off
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    {drafts.length} unfinished draft{drafts.length === 1 ? "" : "s"} — only you can see these.
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {drafts.map((d) => (
                  <DraftCard
                    key={d.id}
                    draft={d}
                    resuming={resuming === d.id}
                    discarding={discardingId === d.id}
                    onResume={() => resumeDraft(d.id)}
                    onDiscard={() => discardDraftById(d.id)}
                  />
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 16 }}>
            <ActionCard
              primary
              icon="sparkles"
              title="Generate from Question Bank"
              desc="Auto-build a balanced paper from your verified bank — pick a subject, set the type and difficulty mix, and review in seconds. Saved as a draft from the first click."
              cta="Generate a paper"
              busy={starting}
              onClick={startNewDraft}
            />
            <ActionCard
              icon="book-open"
              title="Question Bank"
              desc="Add, verify, and organise questions so generation always has fresh material to draw from."
              cta="Open bank"
              onClick={() => router.push("/coaching/question-bank")}
            />
            <ActionCard
              icon="file-text"
              title="Blank exam"
              desc="Start an empty exam and add questions by hand or from the bank as you go."
              cta="Create blank"
              busy={creating}
              onClick={createBlankExam}
            />
          </div>

          <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 34, height: 34, borderRadius: 9, background: "var(--surface-inset)", color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon name="sparkles" size={17} />
              </span>
              <div>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 700, color: "var(--text-heading)" }}>How paper generation works</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Four steps, saved as you go — nothing goes live until an admin approves it.</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              {[
                { n: 1, t: "Class & subject", d: "Pick the class (or classes) the paper is for, and the subject it draws from. A draft is created the moment you start — close the tab whenever you like." },
                { n: 2, t: "Select scope", d: "Pick a scope type, then tick the chapters to draw from." },
                { n: 3, t: "Set distribution", d: "Decide how many questions per type and the easy/moderate/hard split. Live availability tells you what the bank can fill." },
                { n: 4, t: "Review & submit", d: "Curate the drafted questions, finalize, then submit for review. Only at that point does your admin see the paper — until then the draft is yours alone." },
              ].map((s) => (
                <div key={s.n} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0, background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, fontFamily: "var(--font-sans)" }}>{s.n}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-heading)", marginBottom: 3 }}>{s.t}</div>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--text-muted)" }}>{s.d}</p>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <Button variant="app" size="lg" icon={<Icon name="sparkles" size={16} />} disabled={starting} onClick={startNewDraft}>
                {starting ? "Starting…" : "Generate a paper"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {started && <Stepper current={step} furthest={furthest} onGo={goToStep} />}

      {/* ── Step 1: Class & subject ───────────────────────────────────────── */}
      {started && step === 1 && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, alignItems: "start" }}>
            {/* Class picker */}
            <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={lblStyle}>Who is this paper for?</div>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
                  Pick at least one class. Every student enrolled in it gets the exam once your admin approves and schedules it.
                </p>
              </div>

              {classesLoading ? (
                <div style={{ padding: "28px 8px", textAlign: "center", fontSize: 13.5, color: "var(--text-muted)" }}>Loading classes…</div>
              ) : classList.length === 0 ? (
                <div style={{ padding: "24px 8px", textAlign: "center", fontSize: 13.5, color: "var(--text-muted)" }}>
                  You have no classes yet.{" "}
                  <button
                    type="button"
                    onClick={() => router.push("/coaching/classes")}
                    style={{ background: "none", border: "none", padding: 0, color: "var(--accent)", fontWeight: 600, cursor: "pointer" }}
                  >
                    Create a class
                  </button>{" "}
                  first — a paper has to be assigned to one before it can go for review.
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 10 }}>
                  {classList.map((c) => {
                    const on = selectedClassIds.has(c.id);
                    return (
                      <label
                        key={c.id}
                        style={{
                          display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                          padding: "11px 13px", borderRadius: 10,
                          border: "1.5px solid " + (on ? "var(--accent)" : "var(--border-light)"),
                          background: on ? "var(--accent-soft)" : "var(--surface-card)",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggleClass(c.id)}
                          style={{ accentColor: "var(--accent)", width: 15, height: 15, flexShrink: 0 }}
                        />
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: "block", fontSize: 13.5, fontWeight: on ? 600 : 500, color: on ? "var(--accent)" : "var(--text-heading)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                          <span style={{ display: "block", fontSize: 11.5, color: "var(--text-muted)", marginTop: 1 }}>
                            {c.grade ? `Grade ${c.grade}` : "No grade"}
                            {c.studentCount != null && ` · ${c.studentCount} student${c.studentCount === 1 ? "" : "s"}`}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Subject + title rail */}
            <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <div style={lblStyle}>Subject</div>
                <p style={{ margin: "6px 0 10px", fontSize: 13, color: "var(--text-muted)" }}>
                  Questions are drawn from this subject&rsquo;s bank.
                </p>
                <select
                  value={subjectId}
                  onChange={(e) => selectSubject(e.target.value)}
                  className="gv-select"
                  style={{ width: "100%", height: 38 }}
                >
                  <option value="">Select subject…</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <Input
                label="Test title (optional)"
                maxLength={255}
                placeholder="Generated Test — today"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
          </div>

          {/* Summary bar */}
          <div style={{ display: "flex", alignItems: "center", marginTop: 20, padding: "16px 20px", background: "var(--surface-card)", border: "1px solid var(--border-light)", borderRadius: 12, gap: 14 }}>
            <Icon name={canContinueClass ? "check-circle" : "sparkles"} size={18} style={{ color: canContinueClass ? "var(--success)" : "var(--warning)", flexShrink: 0 }} />
            <span style={{ fontSize: 14, color: "var(--text-heading)", flex: 1 }}>
              {selectedClassIds.size === 0
                ? "Select the class this paper is for."
                : !subjectId
                  ? <><strong>{selectedClassIds.size} class{selectedClassIds.size > 1 ? "es" : ""} selected</strong> · now pick a subject.</>
                  : <><strong>{selectedClassIds.size} class{selectedClassIds.size > 1 ? "es" : ""}</strong> · {subjectName}</>}
            </span>
            <Button variant="secondary" onClick={() => resetToLanding()}>← All drafts</Button>
            <Button variant="app" disabled={!canContinueClass} onClick={() => goToStep(2)}>Continue to Scope →</Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Scope ─────────────────────────────────────────────────── */}
      {started && step === 2 && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "270px 1fr", gap: 20, alignItems: "start" }}>
            {/* Scope type rail */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={lblStyle}>Scope type</div>
              {SCOPES.map((s) => {
                const on = scopeType === s.key;
                return (
                  <button key={s.key} onClick={() => setScopeType(s.key)}
                    style={{ border: "1.5px solid " + (on ? "var(--accent)" : "var(--border-light)"), borderRadius: 10, padding: "12px 14px", background: on ? "var(--accent-soft)" : "var(--surface-card)", textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, color: on ? "var(--accent)" : "var(--text-heading)" }}>{s.label}</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{s.desc}</div>
                  </button>
                );
              })}
              {/* Recap of step 1 so the teacher can see what they're scoping for. */}
              <div style={{ marginTop: 4, padding: "11px 13px", borderRadius: 10, background: "var(--surface-inset)", display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--text-muted)" }}>Paper for</span>
                <span style={{ fontSize: 13, color: "var(--text-heading)", fontWeight: 600 }}>
                  {classList.filter((c) => selectedClassIds.has(c.id)).map((c) => c.name).join(", ") || "—"}
                </span>
                <button
                  type="button"
                  onClick={() => goToStep(1)}
                  style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, fontSize: 12, color: "var(--accent)", fontWeight: 600, cursor: "pointer" }}
                >
                  Change class
                </button>
              </div>
            </div>

            {/* Chapter picker */}
            <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={lblStyle}>{subjectName ? `Select chapters — ${subjectName}` : "Select chapters"}</div>

              {!subjectId ? (
                <div style={{ padding: "28px 8px", textAlign: "center", fontSize: 13.5, color: "var(--text-muted)" }}>
                  Choose a subject to load its chapters.
                </div>
              ) : groupsLoading ? (
                <div style={{ padding: "28px 8px", textAlign: "center", fontSize: 13.5, color: "var(--text-muted)" }}>Loading chapters…</div>
              ) : groups.length === 0 ? (
                <div style={{ padding: "28px 8px", textAlign: "center", fontSize: 13.5, color: "var(--text-muted)" }}>No chapters yet — generation will use the whole subject.</div>
              ) : (
                <>
                  <div style={{ position: "relative" }}>
                    <Icon name="search" size={14} style={{ position: "absolute", left: 10, top: 11, color: "var(--text-muted)" }} />
                    <input className="gv-input" placeholder="Search modules or chapters…" value={chapterSearch} onChange={(e) => setChapterSearch(e.target.value)} style={{ paddingLeft: 30, height: 36, fontSize: 13 }} />
                  </div>

                  {scopeType === "full-subject" && (
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)", background: "var(--surface-inset)", borderRadius: 8, padding: "8px 12px" }}>
                      Full-subject scope selected — every chapter below is included. Chapter ticks are ignored.
                    </div>
                  )}

                  {visibleGroups.map((g) => {
                    const isCollapsed = collapsed.has(g.module.id);
                    const sel = g.chapters.filter((c) => checked.has(c.id)).length;
                    const disabled = scopeType === "full-subject";
                    return (
                      <div key={g.module.id}>
                        <button onClick={() => toggleModule(g.module.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--border-light)", width: "100%", background: "none", border: "none", borderBottomWidth: 1, borderBottomStyle: "solid", borderBottomColor: "var(--border-light)", cursor: "pointer" }}>
                          <Icon name="chevron-down" size={14} style={{ color: "var(--text-muted)", transform: isCollapsed ? "rotate(-90deg)" : "none", transition: "transform .12s ease" }} />
                          <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text-heading)", flex: 1, textAlign: "left" }}>{g.module.name}</span>
                          {g.chapters.length > 0 && <Badge tone="neutral" style={{ fontSize: 10 }}>{sel}/{g.chapters.length} selected</Badge>}
                        </button>
                        {!isCollapsed && g.chapters.length > 0 && (
                          <div style={{ paddingLeft: 22, display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                            {g.chapters.map((c) => {
                              const on = checked.has(c.id);
                              const cnt = chapterCountOf(c.id);
                              return (
                                <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, cursor: disabled ? "default" : "pointer", padding: "5px 8px", borderRadius: 7, background: on && !disabled ? "var(--accent-soft)" : "transparent", opacity: disabled ? 0.55 : 1 }}>
                                  <input type={scopeType === "single" ? "radio" : "checkbox"} name={scopeType === "single" ? "scope-chapter" : undefined} checked={on} disabled={disabled} onChange={() => toggleChapter(c.id)} style={{ accentColor: "var(--accent)", width: 15, height: 15 }} />
                                  <span style={{ fontSize: 13.5, color: on && !disabled ? "var(--accent)" : "var(--text-heading)", fontWeight: on && !disabled ? 600 : 400, flex: 1 }}>{c.name}</span>
                                  {cnt != null && <Badge tone={on ? "accent" : "neutral"} style={{ fontSize: 10 }}>~{cnt} qs</Badge>}
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          {/* Summary bar */}
          <div style={{ display: "flex", alignItems: "center", marginTop: 20, padding: "16px 20px", background: "var(--surface-card)", border: "1px solid var(--border-light)", borderRadius: 12, gap: 14 }}>
            <Icon name={canContinueScope ? "check-circle" : "sparkles"} size={18} style={{ color: canContinueScope ? "var(--success)" : "var(--warning)", flexShrink: 0 }} />
            <span style={{ fontSize: 14, color: "var(--text-heading)", flex: 1 }}>
              {!subjectId ? (
                "Select a subject to begin."
              ) : scopeType === "full-subject" ? (
                <>
                  <strong>Whole subject</strong>
                  {avail != null && <> · ~{avail.total} questions available</>}
                </>
              ) : checked.size === 0 ? (
                "Tick at least one chapter."
              ) : (
                <>
                  <strong>{checked.size} chapter{checked.size > 1 ? "s" : ""} selected</strong>
                  {avail != null && <> · ~{avail.total} questions available</>}
                </>
              )}
            </span>
            <Button variant="secondary" onClick={() => goToStep(1)}>← Class &amp; Subject</Button>
            <Button variant="app" disabled={!canContinueScope} onClick={() => goToStep(3)}>Continue to Distribution →</Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Distribution ──────────────────────────────────────────── */}
      {started && step === 3 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 290px", gap: 20, alignItems: "start" }}>
          {/* Question types */}
          <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={lblStyle}>Question types</div>
            {STEP2_TYPES.map(([key, label]) => {
              const val = typeCounts[key] ?? 0;
              const bump = (d: number) => setTypeCounts((p) => ({ ...p, [key]: Math.max(0, Math.min(200, (p[key] ?? 0) + d)) }));
              const btn: React.CSSProperties = { width: 26, height: 26, border: "1px solid var(--border-light)", borderRadius: "50%", background: "var(--surface-card)", cursor: "pointer", fontSize: 16, color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center" };
              return (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13.5, color: "var(--text-heading)", flex: 1 }}>{label}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <button type="button" style={btn} onClick={() => bump(-1)}>−</button>
                    <input value={val} onChange={(e) => setTypeCounts((p) => ({ ...p, [key]: Math.max(0, Math.min(200, parseInt(e.target.value || "0", 10))) }))}
                      style={{ width: 48, textAlign: "center", border: "1px solid var(--border-light)", borderRadius: 8, padding: "4px 0", fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 700, color: "var(--text-heading)", outline: "none", background: "var(--surface-card)" }} />
                    <button type="button" style={btn} onClick={() => bump(1)}>+</button>
                  </div>
                </div>
              );
            })}
            <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1 }}>Total</span>
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 24, fontWeight: 700, letterSpacing: "-.02em", color: "var(--text-heading)" }}>{typeTotal}</span>
              <span style={{ fontSize: 14, color: "var(--text-muted)" }}>questions</span>
            </div>
          </div>

          {/* Difficulty mix */}
          <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={lblStyle}>Difficulty mix</div>
            <div style={{ height: 10, borderRadius: 99, overflow: "hidden", display: "flex", gap: 2 }}>
              {DIFF_META.map((d) => <div key={d.key} style={{ width: `${pctTotal ? (diffPct[d.key] / pctTotal) * 100 : 0}%`, background: d.color, borderRadius: 99 }} />)}
            </div>
            {DIFF_META.map((d) => (
              <div key={d.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13.5, color: "var(--text-heading)", flex: 1 }}>{d.label}</span>
                <input type="range" min={0} max={100} value={diffPct[d.key]} onChange={(e) => adjustDiff(d.key, parseInt(e.target.value, 10))} style={{ width: 80, accentColor: "var(--accent)" }} />
                <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text-heading)", width: 34, textAlign: "right" }}>{diffPct[d.key]}%</span>
                <span style={{ fontSize: 12, color: "var(--text-muted)", width: 28 }}>{diffCounts[d.key]}q</span>
              </div>
            ))}
            <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 14 }}>
                <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} style={{ accentColor: "var(--accent)", width: 15, height: 15 }} />
                <span style={{ color: "var(--text-heading)" }}>Verified questions only</span>
              </label>
              <p className="gv-help" style={{ margin: 0 }}>Sliders always total 100% — moving one rebalances the others. They split the {typeTotal} questions across easy / moderate / hard.</p>
            </div>
          </div>

          {/* Question availability */}
          <div style={{ ...cardStyle, padding: 18, display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 16 }}>
            <div style={lblStyle}>Question availability</div>

            {typeTotal === 0 ? (
              <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "20px 4px", textAlign: "center" }}>
                Set some question counts to check what the bank can fill.
              </div>
            ) : (
              <>
                {/* By difficulty — does the bank hold enough easy / moderate / hard? */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-body)" }}>By difficulty</div>
                  {DIFF_META.map((d) => {
                    const need = diffCounts[d.key];
                    const have = diffAvail[d.key];
                    const pending = avail == null;
                    const ok = pending || have >= need;
                    return (
                      <div key={d.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 8, background: need === 0 ? "var(--surface-inset)" : ok ? "var(--success-soft)" : "var(--danger-soft)", border: "1px solid " + (need === 0 ? "var(--border-light)" : ok ? "rgba(16,185,129,.28)" : "rgba(244,63,94,.32)") }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: "var(--text-heading)", flex: 1 }}>{d.label}</span>
                        <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                          <strong style={{ color: ok ? "var(--text-heading)" : "var(--danger)", fontWeight: 700 }}>{pending ? "…" : have}</strong> / {need}
                        </span>
                        {need > 0 && !pending && (
                          <Icon name={ok ? "check-circle" : "alert-triangle"} size={14} style={{ color: ok ? "var(--success)" : "var(--danger)", flexShrink: 0 }} />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* By type */}
                <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-body)", marginBottom: 2 }}>By type</div>
                  {STEP2_TYPES.filter(([k]) => (typeCounts[k] ?? 0) > 0).map(([k, label]) => {
                    const need = typeCounts[k] ?? 0;
                    const have = typeAvail[k] ?? 0;
                    const pending = avail == null;
                    const ok = pending || have >= need;
                    return (
                      <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                        <Icon name={ok ? "check-circle" : "alert-triangle"} size={13} style={{ color: pending ? "var(--text-muted)" : ok ? "var(--success)" : "var(--danger)", flexShrink: 0 }} />
                        <span style={{ color: "var(--text-heading)", flex: 1 }}>{label}</span>
                        <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                          <strong style={{ color: ok ? "var(--text-heading)" : "var(--danger)", fontWeight: 700 }}>{pending ? "…" : have}</strong> / {need}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: 12 }}>
              {typeTotal > 0 && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 7, marginBottom: 12 }}>
                  <Icon name={allTypesAvailable ? "check-circle" : "alert-triangle"} size={15} style={{ color: allTypesAvailable ? "var(--success)" : "var(--warning)", flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 12.5, color: "var(--text-body)", lineHeight: 1.4 }}>
                    {avail == null ? "Checking the bank…" : allTypesAvailable ? `All ${typeTotal} questions can be filled.` : "Some buckets are short — generation fills what it can and flags the rest."}
                  </span>
                </div>
              )}
              <Button variant="app" icon={<Icon name="sparkles" size={15} />} disabled={!canGenerate} onClick={handleGenerate} style={{ width: "100%" }}>
                {generating ? "Generating…" : "Generate Test"}
              </Button>
            </div>
          </div>

          {/* Back control spans the row */}
          <div style={{ gridColumn: "1 / -1", display: "flex" }}>
            <Button type="button" variant="secondary" onClick={() => goToStep(2)}>← Back to Scope</Button>
            {genErr && <span style={{ marginLeft: 12, alignSelf: "center", fontSize: 13, color: "var(--danger)" }}>{genErr}</span>}
          </div>
        </div>
      )}

      {/* ── Step 4: Review & submit ───────────────────────────────────────── */}
      {started && step === 4 && exam && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Summary header */}
          <div style={{ background: "var(--accent-soft)", border: "1px solid rgba(43,80,245,.2)", borderRadius: 14, padding: "14px 20px", display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 18, fontWeight: 700, color: "var(--text-heading)" }}>{exam.title}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                {examStatusLabel(exam.status as ExamStatus)}
                {assignedClassNames && <> · for {assignedClassNames}</>}
              </div>
            </div>
            {[["Questions", liveQuestions.length], ["Marks", exam.totalMarks], ["~Minutes", exam.estimatedDurationMins ?? exam.durationMins]].map(([l, n]) => (
              <div key={l} style={{ textAlign: "center", flexShrink: 0 }}>
                <div style={{ fontFamily: "var(--font-sans)", fontSize: 20, fontWeight: 700, color: "var(--accent)" }}>{n}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{l}</div>
              </div>
            ))}
          </div>

          {shortages.length > 0 && (
            <div style={{ background: "var(--warning-soft)", border: "1px solid rgba(245,158,11,.35)", borderRadius: 10, padding: "10px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <Icon name="sparkles" size={16} style={{ color: "var(--warning)", flexShrink: 0 }} />
              <span style={{ fontSize: 13.5, color: "var(--text-heading)" }}>
                Bank shortage — some buckets weren’t fully filled: {shortages.map((s) => `${s.type}/${s.difficulty} ${s.filled}/${s.requested}`).join(", ")}
              </span>
            </div>
          )}

          {questions.length === 0 ? (
            <div className="gv-card" style={{ padding: 28, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>No questions.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {questions.map((q) => {
                const discarded = q.draftStatus === "discarded";
                const acting = actingId === q.id;
                return (
                  <div key={q.id} style={{ display: "flex", gap: 14, alignItems: "flex-start", background: "var(--surface-card)", border: "1px solid var(--border-light)", borderRadius: 10, padding: "14px 16px", opacity: discarded ? 0.5 : 1 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)", marginTop: 2, width: 28, flexShrink: 0 }}>Q{q.order}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 7, marginBottom: 7, flexWrap: "wrap" }}>
                        <Badge tone="accent" style={{ fontSize: 10 }}>{q.type}</Badge>
                        {q.difficulty && <Badge tone={DIFF_TONE[q.difficulty] ?? "neutral"} style={{ fontSize: 10 }}>{q.difficulty}</Badge>}
                        {q.draftStatus && <Badge tone={q.draftStatus === "kept" ? "success" : q.draftStatus === "discarded" ? "danger" : "warning"} style={{ fontSize: 10 }}>{q.draftStatus}</Badge>}
                      </div>
                      <MathText text={q.body} style={{ display: "block", fontSize: 13.5, color: "var(--text-heading)", lineHeight: 1.5 }} />
                    </div>
                    {isDraft && (
                      discarded ? (
                        <span style={{ fontSize: 11, color: "var(--text-muted)", alignSelf: "center", flexShrink: 0 }}>removed on finalize</span>
                      ) : (
                        <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                          <Button variant={q.draftStatus === "kept" ? "secondary" : "app"} size="sm" disabled={acting} onClick={() => questionAction(q.id, "keep")}>{q.draftStatus === "kept" ? "Kept ✓" : "Keep"}</Button>
                          <Button variant="secondary" size="sm" disabled={acting} onClick={() => questionAction(q.id, "regenerate")}>Swap</Button>
                          <Button variant="ghost" size="sm" disabled={acting} onClick={() => startEditQ(q)}>Edit</Button>
                          <Button variant="ghost" size="sm" disabled={acting} style={{ color: "var(--danger)" }} onClick={() => questionAction(q.id, "discard")}>Discard</Button>
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Edit a draft question */}
          {isDraft && editingQId && (
            <div className="gv-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Edit question</div>
              <div>
                <span className="gv-label">Question text *</span>
                <textarea value={eqBody} onChange={(e) => setEqBody(e.target.value)} rows={2} className="gv-input" style={{ height: "auto", padding: "10px 14px", resize: "vertical" }} />
              </div>
              <QuestionEditor type={eqType} ed={eqEd} setEd={setEqEd} />
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <Field label="Marks"><input type="number" min={1} max={1000} value={eqMarks} onChange={(e) => setEqMarks(e.target.value)} className="gv-input" style={{ width: 70, height: 34 }} /></Field>
                <Button variant="app" disabled={actingId === editingQId} onClick={saveEditQ}>Save</Button>
                <Button variant="ghost" onClick={() => setEditingQId(null)}>Cancel</Button>
                {eqErr && <span style={{ fontSize: 12, color: "var(--danger)" }}>{eqErr}</span>}
              </div>
            </div>
          )}

          {/* Add manual question */}
          {isDraft && (
            <div className="gv-card" style={{ padding: 18 }}>
              {!showAddManual ? (
                <Button variant="secondary" icon={<Icon name="plus" size={15} />} onClick={() => setShowAddManual(true)}>Add manual question</Button>
              ) : (
                <form onSubmit={addManual} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <Field label="Type">
                      <select value={amType} onChange={(e) => { setAmType(e.target.value); setAmEd(emptyEditor); }} className="gv-select" style={{ height: 34 }}>
                        {MANUAL_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    </Field>
                    <Field label="Marks"><input type="number" min={1} max={1000} value={amMarks} onChange={(e) => setAmMarks(e.target.value)} className="gv-input" style={{ width: 70, height: 34 }} /></Field>
                  </div>
                  <div>
                    <span className="gv-label">Question text *</span>
                    <textarea value={amBody} onChange={(e) => setAmBody(e.target.value)} rows={2} className="gv-input" style={{ height: "auto", padding: "10px 14px", resize: "vertical" }} />
                  </div>
                  <QuestionEditor type={amType} ed={amEd} setEd={setAmEd} />
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <Button type="submit" variant="app" disabled={busy}>Add</Button>
                    <Button type="button" variant="ghost" onClick={() => setShowAddManual(false)}>Cancel</Button>
                    {amErr && <span style={{ fontSize: 12, color: "var(--danger)" }}>{amErr}</span>}
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Finalize → draft → submit for review. The class was chosen in step 1,
              so the whole flow ends here rather than on the exam page. */}
          <div className="gv-card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Button variant="ghost" size="sm" onClick={() => goToStep(3)}>← Back to Distribution</Button>
            <Button variant="ghost" size="sm" onClick={() => resetToLanding()}>Save &amp; exit</Button>
            <div style={{ flex: 1 }} />
            {submitted ? (
              <>
                <span style={{ fontSize: 13, color: "var(--success)", fontWeight: 600 }}>
                  <Icon name="check-circle" size={14} style={{ verticalAlign: "-2px", marginRight: 5 }} />
                  Sent for review — locked until your admin approves it or asks for changes.
                </span>
                <Button variant="app" onClick={() => router.push(`/coaching/exams/${exam.id}`)}>View exam →</Button>
              </>
            ) : finalized ? (
              <>
                {submitErr && <span style={{ fontSize: 13, color: "var(--danger)" }}>{submitErr}</span>}
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  Saved to drafts{assignedClassNames && <> for <strong style={{ color: "var(--text-heading)" }}>{assignedClassNames}</strong></>}. Submitting locks the paper for editing.
                </span>
                <Button variant="secondary" onClick={() => router.push(`/coaching/exams/${exam.id}`)}>Go to exam</Button>
                <Button variant="app" disabled={busy} onClick={handleSubmitForReview}>
                  {busy ? "Submitting…" : "Submit for review →"}
                </Button>
              </>
            ) : isDraft ? (
              <>
                {pendingCount > 0 && (
                  <Button variant="secondary" disabled={busy} onClick={handleKeepAll}>
                    {busy ? "Working…" : `Keep all (${pendingCount})`}
                  </Button>
                )}
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  Finalize drops anything not kept and saves to drafts — you can still edit before submitting.
                </span>
                <Button variant="app" disabled={busy} onClick={handleFinalize}>
                  {busy ? "Working…" : "Finalize & move to draft"}
                </Button>
              </>
            ) : (
              <>
                <span style={{ fontSize: 13, color: "var(--success)", fontWeight: 600 }}>Exam is {examStatusLabel(exam.status as ExamStatus)}.</span>
                <Button variant="app" onClick={() => router.push(`/coaching/exams/${exam.id}`)}>Manage exam →</Button>
              </>
            )}
          </div>
        </div>
      )}
    </TeacherShell>
  );
}

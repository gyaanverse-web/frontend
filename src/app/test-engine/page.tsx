"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { QuestionEditor, parseToEditor, buildPayloadAnswer, emptyEditor, Field, type EditorState } from "@/components/QuestionEditor";
import { TeacherShell } from "@/components/dashboard/TeacherShell";
import { Button, Badge, Input, Icon } from "@/components/ui";
import type { BadgeTone, IconName } from "@/components/ui";

// ── Types ─────────────────────────────────────────────────────────────────────

type Role = "super_admin" | "coaching_owner" | "teacher" | "student";
type User = { id: string; name: string; role: Role };
type Tenant = { id: string; slug: string; name: string };
type Subject = { id: string; name: string; gradeLevel: string | null };
type Item = { id: string; name: string };

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

function Stepper({ current, onGo }: { current: number; onGo?: (n: number) => void }) {
  const steps = [
    { n: 1, l: "Select Scope" },
    { n: 2, l: "Distribution" },
    { n: 3, l: "Review & Finalize" },
  ];
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 24 }}>
      {steps.map((s, i) => {
        // A completed step (before the current one) is clickable when navigation
        // is enabled — lets the teacher jump straight back to Scope or Distribution.
        const navigable = !!onGo && s.n < current;
        return (
          <div key={s.n} style={{ display: "contents" }}>
            <button
              type="button"
              onClick={navigable ? () => onGo!(s.n) : undefined}
              disabled={!navigable}
              title={navigable ? `Back to ${s.l}` : undefined}
              style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", padding: 0, cursor: navigable ? "pointer" : "default" }}
            >
              <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, fontFamily: "var(--font-sans)", background: s.n === current ? "var(--accent)" : s.n < current ? "var(--success)" : "var(--surface-inset)", color: s.n <= current ? "#fff" : "var(--text-muted)" }}>
                {s.n < current ? "✓" : s.n}
              </div>
              <span style={{ fontSize: 14, fontWeight: s.n === current ? 600 : 400, color: s.n === current ? "var(--text-heading)" : "var(--text-muted)", fontFamily: "var(--font-body)", textDecoration: navigable ? "underline" : "none", textUnderlineOffset: 3 }}>{s.l}</span>
            </button>
            {i < steps.length - 1 && <div style={{ flex: 1, height: 1, background: s.n < current ? "var(--success)" : "var(--border-light)", margin: "0 12px" }} />}
          </div>
        );
      })}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TestEnginePage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [started, setStarted] = useState(false);
  const [creating, setCreating] = useState(false);
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");

  // ── Scope (step 1) ──────────────────────────────────────────────────────────
  const [subjectId, setSubjectId] = useState("");
  const [scopeType, setScopeType] = useState<ScopeType>("multi");
  const [groups, setGroups] = useState<{ module: Item; chapters: Item[] }[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [chapterSearch, setChapterSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // ── Distribution (step 2) ─────────────────────────────────────────────────────
  const [typeCounts, setTypeCounts] = useState<Record<string, number>>(
    { mcq_single: 15, mcq_multiple: 5, numerical: 7, subjective: 3, assertion_reason: 0 },
  );
  const [diffPct, setDiffPct] = useState<Record<Difficulty, number>>({ easy: 30, medium: 50, hard: 20 });
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genErr, setGenErr] = useState("");

  // ── Availability preview ──────────────────────────────────────────────────────
  const [avail, setAvail] = useState<Availability | null>(null);

  // ── Draft result (step 3) ─────────────────────────────────────────────────────
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [shortages, setShortages] = useState<Shortage[]>([]);
  const [actingId, setActingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [finalized, setFinalized] = useState(false);

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

  useEffect(() => {
    Promise.allSettled([
      api.get<{ user: User }>("/api/auth/get-session"),
      api.get<{ tenant: Tenant }>("/tenants/me"),
    ]).then(([sr, tr]) => {
      if (sr.status === "rejected") { router.push("/login"); return; }
      const u = sr.value?.user;
      if (!u) { router.push("/login"); return; }
      if (u.role === "student") { router.push("/dashboard"); return; }
      setUser(u);
      if (tr.status === "rejected") { router.push("/dashboard"); return; }
      const t = tr.value.tenant;
      setTenant(t);
      api.get<{ subjects: Subject[] }>("/tenant/subjects", { tenant: t.slug })
        .then((d) => setSubjects(d.subjects))
        .catch((err) => setPageError(err instanceof Error ? err.message : "Failed to load subjects"))
        .finally(() => setLoading(false));
    });
  }, [router]);

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

  const canContinue1 =
    !!subjectId &&
    (scopeType === "full-subject"
      ? true
      : scopeType === "single"
        ? checked.size === 1
        : checked.size >= 1);

  const canGenerate = canContinue1 && typeTotal > 0 && pctTotal > 0 && !generating;

  // ── Load chapters when subject changes ────────────────────────────────────────

  async function selectSubject(sid: string) {
    setSubjectId(sid);
    setChecked(new Set());
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

  // ── Generate ──────────────────────────────────────────────────────────────────

  async function handleGenerate() {
    if (!tenant || !canGenerate) return;
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

      const body = {
        title: title.trim() || `Generated Test — ${new Date().toLocaleDateString()}`,
        params,
      };
      const res = await api.post<{ exam: Exam; questions: Question[]; shortages: Shortage[] }>(
        "/tenant/exams/generate", body, { tenant: tenant.slug },
      );
      setExam(res.exam);
      setQuestions(res.questions);
      setShortages(res.shortages);
      setStep(3);
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

  function startOver() {
    setExam(null); setQuestions([]); setShortages([]); setEditingQId(null); setFinalized(false); setStep(1); setStarted(false);
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
      router.push(`/exams/${res.exam.id}`);
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
  const visibleGroups = groups
    .map((g) => ({
      module: g.module,
      chapters: chapterSearch.trim()
        ? g.chapters.filter((c) => c.name.toLowerCase().includes(chapterSearch.trim().toLowerCase()))
        : g.chapters,
    }))
    .filter((g) => g.chapters.length > 0 || !chapterSearch.trim());

  // Header action: subject picker while in the wizard scope/distribution steps.
  const headerAction = started && !exam ? (
    <select
      value={subjectId}
      onChange={(e) => selectSubject(e.target.value)}
      className="gv-select"
      style={{ minWidth: 170, height: 38 }}
    >
      <option value="">Select subject…</option>
      {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>
  ) : undefined;

  return (
    <TeacherShell tenant={tenant} user={user} active="test-engine" eyebrow="Test Engine" title="Generate a new test" action={headerAction}>
      {pageError && (
        <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 16, padding: "10px 14px", border: "1px solid rgba(244,63,94,0.35)", background: "var(--danger-soft)", borderRadius: "var(--radius-md)" }}>{pageError}</p>
      )}

      {/* ── Landing: cards + guidelines ───────────────────────────────────── */}
      {!started && !exam && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 16 }}>
            <ActionCard
              primary
              icon="sparkles"
              title="Generate from Question Bank"
              desc="Auto-build a balanced paper from your verified bank — pick a subject, set the type and difficulty mix, and review in seconds."
              cta="Generate a paper"
              onClick={() => { setStep(1); setStarted(true); }}
            />
            <ActionCard
              icon="book-open"
              title="Question Bank"
              desc="Add, verify, and organise questions so generation always has fresh material to draw from."
              cta="Open bank"
              onClick={() => router.push("/question-bank")}
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
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Three quick steps — nothing goes live until an admin approves it.</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              {[
                { n: 1, t: "Select scope", d: "Choose a subject, pick a scope type, then tick the chapters to draw from." },
                { n: 2, t: "Set distribution", d: "Decide how many questions per type and the easy/moderate/hard split. Live availability tells you what the bank can fill." },
                { n: 3, t: "Review & finalize", d: "Keep all or curate each drafted question, then finalize to save it as a draft. Assign classes and submit for review from the exam page." },
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
              <Button variant="app" size="lg" icon={<Icon name="sparkles" size={16} />} onClick={() => { setStep(1); setStarted(true); }}>
                Generate a paper
              </Button>
            </div>
          </div>
        </div>
      )}

      {(started || exam) && <Stepper current={exam ? 3 : step} onGo={exam ? undefined : (n) => setStep(n)} />}

      {/* ── Step 1: Scope ─────────────────────────────────────────────────── */}
      {!exam && started && step === 1 && (
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
              <div style={{ marginTop: 4 }}>
                <Input label="Test title (optional)" maxLength={255} placeholder="Generated Test — today" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
            </div>

            {/* Chapter picker */}
            <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={lblStyle}>{subjectName ? `Select chapters — ${subjectName}` : "Select chapters"}</div>

              {!subjectId ? (
                <div style={{ padding: "28px 8px", textAlign: "center", fontSize: 13.5, color: "var(--text-muted)" }}>
                  Choose a subject from the top-right to load its chapters.
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
            <Icon name={canContinue1 ? "check-circle" : "sparkles"} size={18} style={{ color: canContinue1 ? "var(--success)" : "var(--warning)", flexShrink: 0 }} />
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
            <Button variant="secondary" onClick={() => setStarted(false)}>← Guidelines</Button>
            <Button variant="app" disabled={!canContinue1} onClick={() => setStep(2)}>Continue to Distribution →</Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Distribution ──────────────────────────────────────────── */}
      {!exam && started && step === 2 && (
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
            <Button type="button" variant="secondary" onClick={() => setStep(1)}>← Back to Scope</Button>
            {genErr && <span style={{ marginLeft: 12, alignSelf: "center", fontSize: 13, color: "var(--danger)" }}>{genErr}</span>}
          </div>
        </div>
      )}

      {/* ── Step 3: Review ────────────────────────────────────────────────── */}
      {exam && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Summary header */}
          <div style={{ background: "var(--accent-soft)", border: "1px solid rgba(43,80,245,.2)", borderRadius: 14, padding: "14px 20px", display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontFamily: "var(--font-sans)", fontSize: 18, fontWeight: 700, color: "var(--text-heading)" }}>{exam.title}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2, textTransform: "capitalize" }}>{exam.status}</div>
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
                      <p style={{ fontSize: 13.5, color: "var(--text-heading)", margin: 0, lineHeight: 1.5 }}>{q.body}</p>
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

          {/* Finalize → draft (publishing happens later on the exam page) */}
          <div className="gv-card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Button variant="ghost" size="sm" onClick={startOver}>Start over</Button>
            <div style={{ flex: 1 }} />
            {finalized ? (
              <>
                <span style={{ fontSize: 13, color: "var(--success)", fontWeight: 600 }}>
                  <Icon name="check-circle" size={14} style={{ verticalAlign: "-2px", marginRight: 5 }} />
                  Saved to drafts. Assign classes, then submit for review from the exam page.
                </span>
                <Button variant="app" onClick={() => router.push(`/exams/${exam.id}`)}>Go to exam →</Button>
              </>
            ) : isDraft ? (
              <>
                {pendingCount > 0 && (
                  <Button variant="secondary" disabled={busy} onClick={handleKeepAll}>
                    {busy ? "Working…" : `Keep all (${pendingCount})`}
                  </Button>
                )}
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  Finalize drops anything not kept and saves to drafts — assign classes &amp; schedule later.
                </span>
                <Button variant="app" disabled={busy} onClick={handleFinalize}>
                  {busy ? "Working…" : "Finalize & move to draft"}
                </Button>
              </>
            ) : (
              <>
                <span style={{ fontSize: 13, color: "var(--success)", fontWeight: 600, textTransform: "capitalize" }}>Exam is {exam.status}.</span>
                <Button variant="app" onClick={() => router.push(`/exams/${exam.id}`)}>Manage exam →</Button>
              </>
            )}
          </div>
        </div>
      )}
    </TeacherShell>
  );
}

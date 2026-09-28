"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { Card, Badge, Button, Icon, AIEvaluationCard } from "@/components/ui";
import type { ScannedStep } from "@/components/ui/ScannedUpload";
import { MathText } from "@/components/Math";
import { StudentFocusStrip, FocusPage } from "./StudentFocusStrip";

// ── Backend contracts (mirror /sessions/:id/results and /sessions/:id/evaluation) ─
type QuestionType =
  | "mcq_single" | "mcq_multiple" | "integer" | "numerical"
  | "subjective" | "match" | "assertion_reason" | "fill_blanks";

type AnswerRow = {
  questionId: string;
  answer: Record<string, unknown> | null;
  imageUrl: string | null;
  isCorrect: boolean | null;
  awardedMarks: number | null;
};

type SessionResult = {
  id: string;
  examId: string;
  status: string;
  attemptNumber: number;
  autoScore: number | null;
  manualScore: number | null;
  totalMarks: number;
  startedAt: string;
  submittedAt: string | null;
  answers: AnswerRow[];
};

type ExamQuestion = {
  id: string;
  order: number;
  type: QuestionType;
  body: string;
  payload: Record<string, unknown>;
  marks: number;
  negativeMarks: number;
  explanation: string | null;
};

type ExamInfo = { id: string; title: string; totalMarks: number; questions: ExamQuestion[] };

type EvaluatedStep = {
  stepId: string;
  text: string;
  step_status: "right" | "wrong" | "unknown" | "incomplete";
  description?: string;
  topic?: string;
};
type AiFeedback = { steps: EvaluatedStep[]; topics: string[] };
type EvalQuestionResult = { questionId: string; score: number; maxScore: number; aiFeedback: AiFeedback | { error: string } | string | null };
// `failed` is deliberately absent, and so is `error`. The API collapses a job
// between retry attempts into `processing` and never sends the engine's error
// to a student — evaluation retries itself, so there is no state here that
// means "this will not finish".
type Evaluation = { status: "pending" | "processing" | "completed"; results: EvalQuestionResult[] };

// ── Helpers ──────────────────────────────────────────────────────────────────────
function studentAnswerText(type: QuestionType, answer: Record<string, unknown> | null, payload: Record<string, unknown>): string {
  if (!answer) return "Not answered";
  switch (type) {
    case "mcq_single":
    case "assertion_reason": {
      const id = answer.optionId as string;
      if (!id) return "Not answered";
      const opts = (payload.options as { id: string; text: string }[]) ?? [];
      const o = opts.find((x) => x.id === id);
      return o ? `${o.id.toUpperCase()}. ${o.text}` : `Option ${id.toUpperCase()}`;
    }
    case "mcq_multiple": {
      const ids = (answer.optionIds as string[]) ?? [];
      return ids.length ? ids.map((i) => i.toUpperCase()).join(", ") : "Not answered";
    }
    case "integer":
    case "numerical":
      return answer.value !== undefined && answer.value !== null ? String(answer.value) : "Not answered";
    case "subjective":
      return (answer.text as string) || "See uploaded working";
    case "match": {
      const pairs = (answer.pairs as { leftId: string; rightId: string }[]) ?? [];
      return pairs.length ? pairs.map((p) => `${p.leftId}→${p.rightId}`).join(", ") : "Not answered";
    }
    case "fill_blanks": {
      const a = (answer.answers as { blankId: string; value: string }[]) ?? [];
      return a.length ? a.map((x) => `"${x.value}"`).join(", ") : "Not answered";
    }
    default:
      return "—";
  }
}

function BigScoreBadge({ score, total, pct }: { score: number; total: number; pct: number }) {
  return (
    <div style={{ position: "relative", width: 96, height: 96, flex: "none" }}>
      <div style={{ width: 96, height: 96, borderRadius: "50%", background: `conic-gradient(var(--accent) ${pct * 3.6}deg, var(--border-default) 0deg)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: "var(--surface-card)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 20, color: "var(--text-heading)", letterSpacing: "-0.02em" }}>{score}</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>/ {total}</span>
        </div>
      </div>
    </div>
  );
}

function ObjectiveRow({ q, a }: { q: ExamQuestion; a: AnswerRow | undefined }) {
  const correct = a?.isCorrect;
  const awarded = a?.awardedMarks;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)" }}>
      <Icon name="check-circle" size={18} style={{ color: correct ? "var(--success)" : correct === false ? "var(--danger)" : "var(--text-muted)", flex: "none" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 14, color: "var(--text-heading)" }}>Q{q.order}. <MathText text={q.body} /></div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
          {/* The option the student picked carries the same maths as the question
              body, so it is rendered the same way rather than as raw source. */}
          Your answer: <MathText text={studentAnswerText(q.type, a?.answer ?? null, q.payload)} />
        </div>
      </div>
      <Badge tone={correct ? "success" : correct === false ? "danger" : "neutral"}>
        {awarded !== null && awarded !== undefined ? (awarded >= 0 ? `+${awarded}` : awarded) : "—"} / {q.marks}
      </Badge>
    </div>
  );
}

export function StudentResults({ examId, sessionId }: { examId: string; sessionId: string }) {
  const router = useRouter();

  const [result, setResult] = useState<SessionResult | null>(null);
  const [exam, setExam] = useState<ExamInfo | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Private-exam results stay hidden until the teacher publishes them —
  // the backend answers 422 "not been published" on the results read.
  const [gated, setGated] = useState(false);

  // Load results + exam questions.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rr = await api.get<{ results: SessionResult }>(`/sessions/${sessionId}/results`);
        if (cancelled) return;
        setResult(rr.results);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 422 && /not been published/i.test(e.message)) {
          setGated(true);
        } else {
          setError(e instanceof Error ? e.message : "Results not available.");
        }
        setLoading(false);
        return;
      }
      try {
        const ed = await api.get<{ exam: ExamInfo }>(`/exams/${examId}`).catch(() => api.get<{ exam: ExamInfo }>(`/tenant/exams/${examId}`));
        if (!cancelled) setExam(ed.exam);
      } catch { /* breakdown is best-effort */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [examId, sessionId]);

  // Poll AI evaluation until it settles; refresh results when it completes.
  useEffect(() => {
    if (!result) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      try {
        const data = await api.get<Evaluation | null>(`/sessions/${sessionId}/evaluation`);
        if (cancelled) return;
        setEvaluation(data);
        // Any job that exists and is not `completed` means "keep polling".
        // This used to stop on `failed`, which left the card on "Pending"
        // forever even though the retry ladder went on to grade the paper
        // minutes later — there is no longer a status that means "this will
        // never finish", so there is nothing to bail out on. (`null` still
        // stops: no job row means no subjective answers to grade.)
        if (data && data.status !== "completed") {
          timer = setTimeout(tick, 4000);
        } else if (data) {
          try {
            const fresh = await api.get<{ results: SessionResult }>(`/sessions/${sessionId}/results`);
            if (!cancelled) setResult(fresh.results);
          } catch { /* keep stale */ }
        }
      } catch {
        if (!cancelled) timer = setTimeout(tick, 8000);
      }
    };
    tick();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, result?.id]);

  const backToExams = () => router.push("/student/exams");
  const toResults = () => router.push("/student/results");

  if (loading) {
    return (
      <FocusPage>
        <StudentFocusStrip title="Results" backLabel="My Exams" onBack={backToExams} />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading your results…</div>
      </FocusPage>
    );
  }

  if (gated) {
    return (
      <FocusPage>
        <StudentFocusStrip title="Results" backLabel="My Exams" onBack={backToExams} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 40, textAlign: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="clock" size={32} style={{ color: "var(--accent)" }} />
          </div>
          <h3 style={{ margin: 0, fontSize: 20 }}>Results not published yet</h3>
          <p style={{ margin: 0, fontSize: 14.5, color: "var(--text-body)", maxWidth: 420 }}>
            Your attempt was submitted. Scores and feedback will appear here once your
            teacher publishes the results — we&apos;ll notify you when they do.
          </p>
          <Button variant="app" onClick={backToExams}>Back to my exams</Button>
        </div>
      </FocusPage>
    );
  }

  if (error || !result) {
    return (
      <FocusPage>
        <StudentFocusStrip title="Results" backLabel="My Exams" onBack={backToExams} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 40 }}>
          <p style={{ color: "var(--danger)", fontSize: 14.5 }}>{error || "Results not available."}</p>
          <Button variant="app" onClick={backToExams}>Back to my exams</Button>
        </div>
      </FocusPage>
    );
  }

  const questions = exam?.questions ?? [];
  const answerMap = Object.fromEntries(result.answers.map((a) => [a.questionId, a]));
  const evalMap = Object.fromEntries((evaluation?.results ?? []).map((r) => [r.questionId, r]));

  const objectiveQs = questions.filter((q) => q.type !== "subjective");
  const subjectiveQs = questions.filter((q) => q.type === "subjective");
  const hasSubjective = subjectiveQs.length > 0;

  const autoScore = result.autoScore ?? 0;
  const aiScore = result.manualScore ?? 0;
  const score = result.autoScore === null && result.manualScore === null ? null : autoScore + aiScore;
  const total = result.totalMarks;
  const pct = total > 0 && score !== null ? Math.round((score / total) * 100) : 0;

  const aiRunning = evaluation?.status === "pending" || evaluation?.status === "processing";
  const aiPending = hasSubjective && (aiRunning || (evaluation === null && result.manualScore === null));

  // Objective portion of the marks (from graded objective questions).
  const objectiveTotal = objectiveQs.reduce((sum, q) => sum + q.marks, 0);
  const aiTotal = subjectiveQs.reduce((sum, q) => sum + q.marks, 0);
  const objPct = total > 0 ? (autoScore / total) * 100 : 0;
  const aiPct = aiPending || total === 0 ? 0 : (aiScore / total) * 100;

  const submitted = result.submittedAt ? new Date(result.submittedAt).toLocaleString() : "—";

  return (
    <FocusPage>
      <StudentFocusStrip title="Results" backLabel="My Exams" onBack={backToExams} />
      <div style={{ flex: 1, padding: "32px 40px", maxWidth: 1100, width: "100%", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 22, marginBottom: 26, flexWrap: "wrap" }}>
          <BigScoreBadge score={score ?? 0} total={total} pct={pct} />
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <h2 style={{ margin: 0, fontSize: 24 }}>{exam?.title ?? "Exam results"}</h2>
              <Badge tone={aiPending ? "warning" : "success"}>{aiPending ? "AI review pending" : "Result ready"}</Badge>
            </div>
            <p style={{ margin: 0, fontSize: 13.5 }}>Attempt #{result.attemptNumber} · Submitted {submitted}</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Button variant="secondary" onClick={() => router.push(`/student/exams/${examId}/intro`)}>Retake</Button>
            <Button variant="ghost" onClick={toResults}>See all my reports</Button>
          </div>
        </div>

        {/* Score split */}
        <Card padding={20} style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", gap: 32, marginBottom: 14, flexWrap: "wrap" }}>
            {objectiveQs.length > 0 && (
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>Objective (auto-graded)</div>
                <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 20, color: "var(--text-heading)" }}>{autoScore} / {objectiveTotal}</div>
              </div>
            )}
            {hasSubjective && (
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>AI-evaluated (subjective)</div>
                <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 20, color: aiPending ? "var(--text-muted)" : "var(--text-heading)" }}>{aiPending ? "Pending…" : `${aiScore} / ${aiTotal}`}</div>
              </div>
            )}
          </div>
          <div style={{ height: 10, borderRadius: 999, background: "var(--border-default)", overflow: "hidden", display: "flex" }}>
            <div style={{ width: `${objPct}%`, background: "var(--accent)" }} />
            <div style={{ width: `${aiPct}%`, background: "var(--success)" }} />
          </div>
        </Card>

        {/* Objective breakdown */}
        {objectiveQs.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
            {objectiveQs.map((q) => <ObjectiveRow key={q.id} q={q} a={answerMap[q.id]} />)}
          </div>
        )}

        {/* Subjective — AI evaluation */}
        {subjectiveQs.map((q) => {
          const ev = evalMap[q.id];
          const fb = ev?.aiFeedback;
          const structured = fb && typeof fb === "object" && "steps" in fb ? (fb as AiFeedback) : null;
          const evalSteps = structured?.steps ?? [];
          const steps: ScannedStep[] = evalSteps.map((s) => ({ text: s.text, wrong: s.step_status === "wrong" }));
          // Surface the AI's actual per-step feedback (Error/Missing … Correct step …),
          // not the topic list. Only wrong / incomplete steps carry a description.
          const issues = evalSteps.filter(
            (s) => (s.step_status === "wrong" || s.step_status === "incomplete") && s.description,
          );
          const mistake = issues.length ? (
            <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
              {issues.map((s, i) => <li key={i}><MathText text={s.description ?? ""} /></li>)}
            </ul>
          ) : null;
          const status = ev ? "evaluated" : aiRunning ? "evaluating" : "pending";
          return (
            <AIEvaluationCard
              key={q.id}
              style={{ marginBottom: 16 }}
              student={`Q${q.order}`}
              exam={<MathText text={q.body} />}
              score={ev ? ev.score : "…"}
              outOf={ev ? ev.maxScore : q.marks}
              status={status}
              steps={steps}
              stepsAsMath
              mistake={mistake}
            />
          );
        })}

        <div style={{ display: "flex", gap: 10, marginTop: 26, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <Button variant="secondary" onClick={() => router.push(`/student/exams/${examId}/intro`)}>Retake</Button>
          <Button variant="app" onClick={toResults}>See all my reports</Button>
        </div>
      </div>
    </FocusPage>
  );
}

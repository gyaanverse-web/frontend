"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import type { CSSProperties } from "react";
import { api } from "@/lib/api";
import { Tex, MathText } from "@/components/Math";
import { btnPrimary as btnP, tableCell } from "@/lib/uiStyles";

// ── Types ─────────────────────────────────────────────────────────────────────

type QuestionType =
  | "mcq_single" | "mcq_multiple" | "integer" | "numerical"
  | "subjective" | "match" | "assertion_reason" | "fill_blanks";

type SessionResult = {
  id: string;
  examId: string;
  studentId: string;
  tenantId: string | null;
  status: string;
  attemptNumber: number;
  autoScore: number | null;
  manualScore: number | null;
  totalMarks: number;
  startedAt: string;
  submittedAt: string | null;
  createdAt: string;
  answers: AnswerRow[];
};

type AnswerRow = {
  id: string;
  sessionId: string;
  questionId: string;
  answer: Record<string, unknown> | null;
  imageUrl: string | null;
  isCorrect: boolean | null;
  awardedMarks: number | null;
};

type ExamQuestion = {
  id: string;
  order: number;
  type: QuestionType;
  body: string;
  imageUrls: string[] | null;
  payload: Record<string, unknown>;
  marks: number;
  negativeMarks: number;
  explanation: string | null;
  // answerKey is NOT returned to students — see note below
};

type ExamInfo = {
  id: string;
  title: string;
  durationMins: number;
  totalMarks: number;
  questions: ExamQuestion[];
};

type StepStatus = "right" | "wrong" | "unknown" | "incomplete";

type EvaluatedStep = {
  stepId: string;
  text: string;
  step_status: StepStatus;
  step_weight: number;
  topic: string;
  step_understanding: string;
  description: string;
};

type AiFeedback = {
  steps: EvaluatedStep[];
  topics: string[];
  summary: {
    totalSteps: number;
    rightSteps: number;
    wrongSteps: number;
    incompleteSteps: number;
    unknownSteps: number;
    rightWeight: number;
    totalWeight: number;
  };
};

type EvalQuestionResult = {
  questionId: string;
  score: number;
  maxScore: number;
  aiFeedback: AiFeedback | { error: string } | string | null;
};

type Evaluation = {
  status: "pending" | "processing" | "completed" | "failed";
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  results: EvalQuestionResult[];
};

// ── Styles ────────────────────────────────────────────────────────────────────


const cell: CSSProperties = {
  ...tableCell,
  padding: "8px 12px",
  borderBottom: "1px solid #eee",
  verticalAlign: "top",
};

const QTYPE_LABELS: Record<QuestionType, string> = {
  mcq_single:       "MCQ Single",
  mcq_multiple:     "MCQ Multiple",
  integer:          "Integer",
  numerical:        "Numerical",
  subjective:       "Subjective",
  match:            "Match",
  assertion_reason: "Assertion-Reason",
  fill_blanks:      "Fill Blanks",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatStudentAnswer(type: QuestionType, answer: Record<string, unknown> | null, payload: Record<string, unknown>): string {
  if (!answer) return "Not answered";
  switch (type) {
    case "mcq_single":
    case "assertion_reason": {
      const optId = answer.optionId as string;
      if (!optId) return "Not answered";
      if (type === "assertion_reason") return `Option ${optId}`;
      const opts = (payload.options as { id: string; text: string }[]) ?? [];
      const opt = opts.find(o => o.id === optId);
      return opt ? `${opt.id.toUpperCase()}. ${opt.text}` : optId;
    }
    case "mcq_multiple": {
      const ids = (answer.optionIds as string[]) ?? [];
      if (ids.length === 0) return "Not answered";
      const opts = (payload.options as { id: string; text: string }[]) ?? [];
      return ids.map(id => {
        const o = opts.find(o => o.id === id);
        return o ? `${o.id.toUpperCase()}. ${o.text}` : id;
      }).join(" | ");
    }
    case "integer":
    case "numerical":
      return answer.value !== undefined && answer.value !== null ? String(answer.value) : "Not answered";
    case "subjective":
      return (answer.text as string) || "Not answered";
    case "match": {
      const pairs = (answer.pairs as { leftId: string; rightId: string }[]) ?? [];
      return pairs.length > 0 ? pairs.map(p => `${p.leftId} → ${p.rightId}`).join(", ") : "Not answered";
    }
    case "fill_blanks": {
      const answers = (answer.answers as { blankId: string; value: string }[]) ?? [];
      return answers.length > 0 ? answers.map(a => `${a.blankId}: "${a.value}"`).join(", ") : "Not answered";
    }
    default: return JSON.stringify(answer);
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ResultsPage() {
  const router = useRouter();
  const params = useParams();
  const examId    = params.id as string;
  const sessionId = params.sessionId as string;

  const [result, setResult]     = useState<SessionResult | null>(null);
  const [exam, setExam]         = useState<ExamInfo | null>(null);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [loading, setLoading]   = useState(true);
  const [pageError, setPageError] = useState("");
  const [showAll, setShowAll]   = useState(false);

  useEffect(() => {
    Promise.allSettled([
      api.get<{ user: unknown }>("/api/auth/get-session"),
      api.get<{ tenant: { slug: string } }>("/tenants/me"),
      api.get<{ results: SessionResult }>(`/sessions/${sessionId}/results`),
    ]).then(async ([sr, tr, rr]) => {
      // Only redirect to login if the results call itself says unauthorized (401/403).
      // A transient get-session failure (e.g. rate-limit → 500) must not kick out a
      // student whose session is clearly valid (they just submitted the exam).
      if (rr.status === "rejected") {
        const msg = rr.reason instanceof Error ? rr.reason.message : "Failed to load results";
        if (msg.includes("401") || msg.includes("403") || msg.includes("Unauthorized") || msg.includes("Forbidden")) {
          router.push("/login");
        } else {
          setPageError(msg);
          setLoading(false);
        }
        return;
      }
      // Belt-and-suspenders: if get-session explicitly 401'd and results also failed, redirect
      if (sr.status === "rejected") {
        const msg = sr.reason instanceof Error ? sr.reason.message : "";
        if (msg.includes("401") || msg.includes("Unauthorized")) {
          router.push("/login"); return;
        }
        // Otherwise (rate-limit, 5xx, network) — continue rendering with the data we have
      }

      setResult(rr.value.results);

      // Fetch exam questions for the breakdown (answerKey stripped for students by backend)
      if (tr.status === "fulfilled") {
        try {
          const ed = await api.get<{ exam: ExamInfo }>(`/tenant/exams/${examId}`, { tenant: tr.value.tenant.slug });
          setExam(ed.exam);
        } catch { /* non-critical */ }
      }

      setLoading(false);
    });
  }, [sessionId, examId, router]);

  // ── Poll AI evaluation until completed or failed ────────────────────────────
  // Returns null if no AI job exists (objective-only exam, or tenant out of
  // quota). Re-fetches the main session results when AI finishes so the score
  // card picks up the freshly-written manualScore.
  useEffect(() => {
    if (!result) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      try {
        const data = await api.get<Evaluation | null>(`/sessions/${sessionId}/evaluation`);
        if (cancelled) return;
        setEvaluation(data);
        if (data && (data.status === "pending" || data.status === "processing")) {
          timer = setTimeout(tick, 4000);
        } else if (data && data.status === "completed") {
          // AI finished — pull fresh session results to refresh manualScore
          try {
            const fresh = await api.get<{ results: SessionResult }>(`/sessions/${sessionId}/results`);
            if (!cancelled) setResult(fresh.results);
          } catch { /* keep stale result */ }
        }
      } catch {
        // Transient failure — try again unless we've been cancelled
        if (!cancelled) timer = setTimeout(tick, 8000);
      }
    };

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId, result?.id]);

  if (loading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px" }}>Loading results…</div>;
  }

  if (pageError || !result) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px" }}>
        <p style={{ color: "#c00", fontSize: "13px" }}>{pageError || "Results not available."}</p>
        <a href="/dashboard" style={{ ...btnP, textDecoration: "none" }}>← Dashboard</a>
      </div>
    );
  }

  const autoScore = result.autoScore ?? 0;
  const aiScore   = result.manualScore ?? 0;
  // Show a score only once at least one component has been computed
  const score   = result.autoScore === null && result.manualScore === null ? null : autoScore + aiScore;
  const total   = result.totalMarks;
  const pct     = total > 0 && score !== null ? Math.round((score / total) * 100) : null;
  const hasSubjective = exam?.questions.some(q => q.type === "subjective") ?? false;
  const aiRunning = evaluation?.status === "pending" || evaluation?.status === "processing";
  const pendingReview = hasSubjective && (aiRunning || (evaluation === null && result.manualScore === null));

  const answerMap = Object.fromEntries(result.answers.map(a => [a.questionId, a]));
  const evalMap = Object.fromEntries((evaluation?.results ?? []).map(r => [r.questionId, r]));
  const questions = exam?.questions ?? [];

  const questionsToShow = showAll
    ? questions
    : questions.filter(q => {
        const a = answerMap[q.id];
        return !a || a.isCorrect !== true;
      });

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      <header style={{ background: "#1a2e4a", color: "#fff", padding: "8px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
        <a href="/dashboard" style={{ color: "#aac4e8", fontSize: "12px", textDecoration: "none" }}>← Dashboard</a>
        <span style={{ color: "#4a6a8a", fontSize: "12px" }}>|</span>
        <a href="/" style={{ fontWeight: "bold", fontSize: "15px", color: "#fff", textDecoration: "none" }}>GYANVERSE</a>
        <span style={{ flex: 1 }} />
        <a href="/exams/public" style={{ color: "#aac4e8", fontSize: "12px", textDecoration: "none" }}>Exams</a>
        <a href="/dashboard" style={{ color: "#aac4e8", fontSize: "12px", textDecoration: "none" }}>Dashboard</a>
      </header>

      <main style={{ flex: 1, padding: "20px 24px" }}>
        <div style={{ maxWidth: "720px" }}>

          {/* Score card */}
          <div style={{ background: "#fff", border: "1px solid #aaa", marginBottom: "20px" }}>
            <div style={{ background: "#1a2e4a", color: "#fff", padding: "10px 16px" }}>
              <span style={{ fontWeight: "bold", fontSize: "14px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Your Score
              </span>
            </div>
            <div style={{ padding: "20px 16px", textAlign: "center" }}>
              {score !== null ? (
                <>
                  <div style={{ fontSize: "48px", fontWeight: "bold", color: pct !== null && pct >= 50 ? "#166534" : "#991b1b", lineHeight: 1 }}>
                    {score}
                  </div>
                  <div style={{ fontSize: "18px", color: "#555", marginTop: "4px" }}>out of {total}</div>
                  {pct !== null && (
                    <div style={{ fontSize: "24px", fontWeight: "bold", marginTop: "8px", color: pct >= 50 ? "#166534" : "#991b1b" }}>
                      {pct}%
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: "18px", color: "#555" }}>Score pending</div>
              )}

              {pendingReview && (
                <div style={{ marginTop: "12px", background: "#fffbeb", border: "1px solid #f59e0b", padding: "8px 12px", fontSize: "12px", color: "#92400e", display: "inline-block", textAlign: "left" }}>
                  <strong>Your report is being prepared.</strong><br />
                  {aiRunning
                    ? "AI is evaluating your subjective answers — this usually takes 30-90 seconds. This page will refresh automatically, and we'll email you when your report is ready."
                    : "We'll email you when your detailed report is published. You can also come back to this page anytime."}
                </div>
              )}
              {evaluation?.status === "failed" && (
                <div style={{ marginTop: "12px", background: "#fee2e2", border: "1px solid #fca5a5", padding: "8px 12px", fontSize: "12px", color: "#991b1b", display: "inline-block" }}>
                  AI evaluation failed{evaluation.error ? `: ${evaluation.error}` : ""}. A teacher will review your answers.
                </div>
              )}
              {autoScore > 0 && aiScore > 0 && (
                <div style={{ marginTop: "12px", fontSize: "12px", color: "#555" }}>
                  Objective: <strong>{autoScore}</strong> + AI: <strong>{aiScore}</strong> = <strong>{autoScore + aiScore}</strong>
                </div>
              )}
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td style={{ ...cell, fontWeight: "bold", background: "#f5f5f5", width: "160px" }}>Attempt</td>
                  <td style={cell}>#{result.attemptNumber}</td>
                </tr>
                <tr>
                  <td style={{ ...cell, fontWeight: "bold", background: "#f5f5f5" }}>Status</td>
                  <td style={cell}>
                    <span style={{ padding: "1px 8px", fontSize: "12px", fontWeight: "bold", background: "#dcfce7", color: "#166534", border: "1px solid #86efac" }}>
                      {result.status}
                    </span>
                  </td>
                </tr>
                {questions.length > 0 && (
                  <>
                    <tr>
                      <td style={{ ...cell, fontWeight: "bold", background: "#f5f5f5" }}>Correct</td>
                      <td style={cell}>
                        {result.answers.filter(a => a.isCorrect === true).length} / {questions.filter(q => q.type !== "subjective").length} objective
                      </td>
                    </tr>
                    <tr>
                      <td style={{ ...cell, fontWeight: "bold", background: "#f5f5f5" }}>Attempted</td>
                      <td style={cell}>{result.answers.filter(a => a.answer !== null).length} / {questions.length}</td>
                    </tr>
                  </>
                )}
                <tr>
                  <td style={{ ...cell, fontWeight: "bold", background: "#f5f5f5" }}>Date</td>
                  <td style={cell}>{new Date(result.startedAt).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Question breakdown */}
          {questions.length > 0 && (
            <div style={{ background: "#fff", border: "1px solid #aaa", marginBottom: "16px" }}>
              <div style={{ background: "#1a2e4a", color: "#fff", padding: "8px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontWeight: "bold", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Question Breakdown
                </span>
                <button
                  onClick={() => setShowAll(v => !v)}
                  style={{ background: "transparent", color: "#aac4e8", border: "1px solid #aac4e8", padding: "2px 10px", cursor: "pointer", fontSize: "11px" }}
                >
                  {showAll ? "Show Wrong / Unanswered" : "Show All"}
                </button>
              </div>

              {questionsToShow.length === 0 && showAll === false ? (
                <div style={{ padding: "16px", fontSize: "13px", color: "#166534" }}>
                  All objective questions answered correctly!
                </div>
              ) : questionsToShow.length === 0 ? (
                <div style={{ padding: "12px", fontSize: "13px", color: "#555" }}>No questions to show.</div>
              ) : (
                questionsToShow.map((q) => {
                  const a = answerMap[q.id];
                  const correct = a?.isCorrect;
                  const awarded = a?.awardedMarks;
                  const bgColor = correct === true ? "#f0fdf4" : correct === false ? "#fff5f5" : "#fafafa";
                  const borderColor = correct === true ? "#86efac" : correct === false ? "#fca5a5" : "#ddd";

                  return (
                    <div key={q.id} style={{ padding: "14px 16px", borderBottom: "1px solid #eee", background: bgColor, borderLeft: `4px solid ${borderColor}` }}>
                      <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", marginBottom: "8px" }}>
                        <span style={{ fontWeight: "bold", fontSize: "13px", color: "#1a4db8", minWidth: "28px" }}>Q{q.order}</span>
                        <span style={{ fontSize: "11px", background: "#e0e7ff", color: "#3730a3", padding: "1px 6px", fontWeight: "bold" }}>
                          {QTYPE_LABELS[q.type]}
                        </span>
                        <span style={{ marginLeft: "auto", fontSize: "12px", fontWeight: "bold", color: correct === true ? "#166534" : correct === false ? "#991b1b" : "#555" }}>
                          {awarded !== null && awarded !== undefined ? (awarded >= 0 ? `+${awarded}` : `${awarded}`) : "—"} / {q.marks}
                        </span>
                      </div>

                      {/* Assertion-Reason body */}
                      {q.type === "assertion_reason" && (
                        <div style={{ marginBottom: "8px" }}>
                          <div style={{ fontSize: "13px", marginBottom: "4px" }}>
                            <strong>A:</strong> {(q.payload.assertion as string) ?? ""}
                          </div>
                          <div style={{ fontSize: "13px" }}>
                            <strong>R:</strong> {(q.payload.reason as string) ?? ""}
                          </div>
                        </div>
                      )}

                      {/* Question body */}
                      <p style={{ margin: "0 0 8px", fontSize: "14px", lineHeight: "1.6" }}>
                        <MathText text={q.body} />
                      </p>

                      {/* Student's answer */}
                      <div style={{ fontSize: "12px", marginBottom: "4px" }}>
                        <span style={{ color: "#555", fontWeight: "bold" }}>Your answer: </span>
                        <span style={{ color: correct === false ? "#991b1b" : "#111" }}>
                          {formatStudentAnswer(q.type, a?.answer ?? null, q.payload)}
                        </span>
                      </div>

                      {/* Result indicator for non-subjective */}
                      {q.type !== "subjective" && correct !== null && (
                        <div style={{ fontSize: "12px", marginBottom: "4px" }}>
                          <span style={{ color: correct ? "#166534" : "#991b1b", fontWeight: "bold" }}>
                            {correct ? "✓ Correct" : "✗ Wrong"}
                          </span>
                        </div>
                      )}

                      {/* Subjective — AI breakdown if available */}
                      {q.type === "subjective" && (() => {
                        const ev = evalMap[q.id];
                        if (!ev) {
                          return (
                            <div style={{ fontSize: "12px", color: "#555", fontStyle: "italic" }}>
                              {aiRunning ? "🤖 AI is evaluating…" : "⏳ Pending review"}
                            </div>
                          );
                        }
                        const fb = ev.aiFeedback;
                        const hasStructured = fb && typeof fb === "object" && "steps" in (fb as any);
                        const feedback = hasStructured ? (fb as AiFeedback) : null;
                        return (
                          <div style={{ marginTop: "10px", padding: "10px 12px", background: "#f8faff", border: "1px solid #c7d2fe" }}>
                            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap", marginBottom: "8px" }}>
                              <span style={{ fontWeight: "bold", fontSize: "12px", color: "#3730a3" }}>🤖 AI Evaluation</span>
                              <span style={{ fontSize: "12px", fontWeight: "bold", color: "#1a4db8" }}>{ev.score} / {ev.maxScore}</span>
                              {feedback?.topics && feedback.topics.length > 0 && (
                                <span style={{ fontSize: "11px", color: "#555" }}>
                                  Topic{feedback.topics.length > 1 ? "s" : ""}: {feedback.topics.join(", ")}
                                </span>
                              )}
                            </div>

                            {a?.imageUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={a.imageUrl} alt="Your answer" style={{ maxWidth: "260px", maxHeight: "200px", border: "1px solid #ddd", marginBottom: "8px", display: "block" }} />
                            )}

                            {feedback ? (
                              <>
                                <div style={{ fontSize: "11px", color: "#555", marginBottom: "6px" }}>
                                  {feedback.summary.rightSteps} right · {feedback.summary.wrongSteps} wrong · {feedback.summary.incompleteSteps} incomplete{feedback.summary.unknownSteps > 0 ? ` · ${feedback.summary.unknownSteps} unclear` : ""}
                                </div>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                                  <tbody>
                                    {feedback.steps.map((s) => {
                                      const colors = s.step_status === "right"
                                        ? { bg: "#f0fdf4", border: "#86efac", text: "#166534" }
                                        : s.step_status === "wrong"
                                          ? { bg: "#fff5f5", border: "#fca5a5", text: "#991b1b" }
                                          : s.step_status === "incomplete"
                                            ? { bg: "#fffbeb", border: "#fde68a", text: "#92400e" }
                                            : { bg: "#f5f5f5", border: "#ddd", text: "#555" };
                                      return (
                                        <tr key={s.stepId} style={{ borderBottom: `1px solid ${colors.border}`, background: colors.bg }}>
                                          <td style={{ padding: "6px 8px", verticalAlign: "top", width: "30px", fontWeight: "bold", color: colors.text }}>
                                            {s.stepId}
                                          </td>
                                          <td style={{ padding: "6px 8px", verticalAlign: "top" }}>
                                            <div style={{ fontSize: "13px", lineHeight: "1.5" }}>
                                              <Tex expression={s.text} />
                                            </div>
                                            {s.description && (
                                              <MathText
                                                text={s.description}
                                                style={{ fontSize: "11px", color: colors.text, marginTop: "3px", display: "block" }}
                                              />
                                            )}
                                          </td>
                                          <td style={{ padding: "6px 8px", verticalAlign: "top", width: "70px", textAlign: "right", fontWeight: "bold", color: colors.text, textTransform: "uppercase", fontSize: "10px", letterSpacing: "0.5px" }}>
                                            {s.step_status}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </>
                            ) : (
                              <div style={{ fontSize: "12px", color: "#555" }}>
                                {typeof fb === "object" && fb && "error" in fb ? (fb as { error: string }).error : "No detailed feedback available."}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Explanation */}
                      {q.explanation && (
                        <div style={{ marginTop: "8px", background: "#fffbeb", border: "1px solid #f59e0b", padding: "8px 10px", fontSize: "12px", color: "#92400e", lineHeight: "1.5" }}>
                          <strong>Explanation:</strong> {q.explanation}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <a href="/dashboard" style={{ ...btnP, textDecoration: "none" }}>← Back to Dashboard</a>
            <a href={`/exams/${examId}/take`} style={{ background: "#fff", color: "#1a4db8", border: "1px solid #1a4db8", padding: "6px 16px", fontWeight: "bold", textDecoration: "none", fontSize: "13px" }}>
              Retake Exam
            </a>
          </div>

        </div>
      </main>

      <footer style={{ background: "#ddd", borderTop: "1px solid #aaa", padding: "6px 16px", fontSize: "12px", color: "#333" }}>
        &copy; {new Date().getFullYear()} Gyanverse
      </footer>
    </div>
  );
}

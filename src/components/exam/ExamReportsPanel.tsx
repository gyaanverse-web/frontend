"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { api } from "@/lib/api";
import { Badge, Button, DataTable, FeedbackCallout, Icon, Modal } from "@/components/ui";
import type { BadgeTone, Column } from "@/components/ui";
import { MathText } from "@/components/Math";
import { QUESTION_TYPE_LABELS, type QuestionType } from "@/lib/questionTypes";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Row of `GET /tenant/exams/:examId/reports`. */
export type TeacherReportRow = {
  id: string;
  sessionId: string;
  examId: string;
  examTitle: string;
  studentId: string;
  studentName: string;
  studentEmail: string | null;
  totalScore: number;
  maxScore: number;
  autoScore: number;
  aiScore: number;
  status: "pending" | "ready" | "archived";
  publishedAt: string | null;
  createdAt: string;
};

/** Item of `GET /tenant/reports/:reportId`. `feedback` is non-null iff the AI graded it. */
export type ReportItem = {
  id: string;
  reportId: string;
  questionId: string;
  score: number;
  maxScore: number;
  feedback: string | null;
  imageUrl: string | null;
};

export type ReportDetail = Omit<TeacherReportRow, "examTitle"> & { items: ReportItem[] };

/** The slice of an exam question the review screen needs. */
export type ReviewQuestion = {
  id: string;
  order: number;
  type: QuestionType;
  body: string;
  marks: number;
};

/** One OCR'd line of the student's working, with the AI's verdict on it. */
type EvaluatedStep = {
  stepId: string;
  text: string;
  step_status: "right" | "wrong" | "unknown" | "incomplete";
  description?: string;
  topic?: string;
};

/** Shape the evaluation worker JSON-stringifies into `report_items.feedback`. */
type AiFeedback = {
  steps: EvaluatedStep[];
  topics?: string[];
  summary?: {
    totalSteps: number;
    rightSteps: number;
    wrongSteps: number;
    incompleteSteps: number;
    unknownSteps: number;
    rightWeight: number;
    totalWeight: number;
  };
};

export interface ExamReportsPanelProps {
  examId: string;
  tenantSlug: string;
  /** `exam.questions` — items are matched to these by `questionId`. */
  questions: ReviewQuestion[];
  /** True once the exam is `completed`, i.e. students can already see these marks. */
  published: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(score: number, max: number): number {
  return max > 0 ? Math.round((score / max) * 100) : 0;
}

/** Shared threshold for score colouring — fail / borderline / pass. */
function scoreTone(score: number, max: number): BadgeTone {
  const p = pct(score, max);
  if (p >= 60) return "success";
  if (p >= 35) return "warning";
  return "danger";
}

/**
 * `report_items.feedback` is text, but the evaluation worker writes JSON into it
 * — either the step-by-step payload or `{ error }` when OCR found nothing. Older
 * or hand-written rows may be neither, so an unparseable value falls through to
 * being shown verbatim rather than swallowed.
 */
function parseFeedback(raw: string): AiFeedback | { error: string } | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if ("steps" in parsed) return parsed as AiFeedback;
    if ("error" in parsed) return parsed as { error: string };
    return null;
  } catch {
    return null;
  }
}

const STEP_TONE: Record<EvaluatedStep["step_status"], string> = {
  right: "var(--success)",
  wrong: "var(--danger)",
  incomplete: "var(--warning)",
  unknown: "var(--text-muted)",
};

function toneColor(tone: BadgeTone): string {
  if (tone === "success") return "var(--success)";
  if (tone === "warning") return "var(--warning)";
  if (tone === "danger") return "var(--danger)";
  return "var(--text-muted)";
}

const muted: CSSProperties = { fontSize: 12, color: "var(--text-muted)" };
const emptyCard: CSSProperties = {
  padding: 28, textAlign: "center", color: "var(--text-muted)", fontSize: 14,
};

// ── Panel ─────────────────────────────────────────────────────────────────────

/**
 * The teacher's pre-publish review surface: every student's report for one exam,
 * with a per-question drill-down showing what the AI awarded and why.
 *
 * Publishing itself is deliberately NOT here — it is a page-level lifecycle
 * action and lives in the exam header, so a teacher cannot release marks from
 * inside a single student's report by accident.
 */
export function ExamReportsPanel({ examId, tenantSlug, questions, published }: ExamReportsPanelProps) {
  const [reports, setReports] = useState<TeacherReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"name" | "score-desc" | "score-asc">("name");

  // Drill-down. `openIndex` indexes into the *visible* list so prev/next walks
  // the same order the teacher is reading.
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState("");

  const questionById = useMemo(
    () => new Map(questions.map((q) => [q.id, q])),
    [questions],
  );

  // Bumped by Retry to re-run the fetch effect.
  const [reloadKey, setReloadKey] = useState(0);

  const fetchReports = useCallback(
    () => api.get<{ reports: TeacherReportRow[] }>(
      `/tenant/exams/${examId}/reports`,
      { tenant: tenantSlug },
    ),
    [examId, tenantSlug],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchReports();
        if (cancelled) return;
        setReports(data.reports);
        setErr("");
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load reports");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fetchReports, reloadKey]);

  const retry = useCallback(() => {
    setLoading(true);
    setErr("");
    setReloadKey(k => k + 1);
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = q
      ? reports.filter(r =>
          r.studentName.toLowerCase().includes(q) ||
          (r.studentEmail ?? "").toLowerCase().includes(q))
      : reports.slice();
    if (sort === "score-desc") rows.sort((a, b) => pct(b.totalScore, b.maxScore) - pct(a.totalScore, a.maxScore));
    if (sort === "score-asc") rows.sort((a, b) => pct(a.totalScore, a.maxScore) - pct(b.totalScore, b.maxScore));
    if (sort === "name") rows.sort((a, b) => a.studentName.localeCompare(b.studentName));
    return rows;
  }, [reports, query, sort]);

  // ── Stats ───────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (reports.length === 0) return null;
    const percents = reports.map(r => pct(r.totalScore, r.maxScore));
    const avg = Math.round(percents.reduce((a, b) => a + b, 0) / percents.length);
    const top = reports.reduce((a, b) => (pct(b.totalScore, b.maxScore) > pct(a.totalScore, a.maxScore) ? b : a));
    const low = reports.reduce((a, b) => (pct(b.totalScore, b.maxScore) < pct(a.totalScore, a.maxScore) ? b : a));
    return { avg, top, low, aiGraded: reports.filter(r => r.aiScore > 0).length };
  }, [reports]);

  // ── Detail fetch ────────────────────────────────────────────────────────
  const openAt = useCallback(async (index: number) => {
    const row = visible[index];
    if (!row) return;
    setOpenIndex(index);
    setDetail(null);
    setDetailErr("");
    setDetailLoading(true);
    try {
      const data = await api.get<ReportDetail>(`/tenant/reports/${row.id}`, { tenant: tenantSlug });
      setDetail(data);
    } catch (e) {
      setDetailErr(e instanceof Error ? e.message : "Failed to load this report");
    } finally {
      setDetailLoading(false);
    }
  }, [visible, tenantSlug]);

  const closeDetail = useCallback(() => {
    setOpenIndex(null);
    setDetail(null);
    setDetailErr("");
  }, []);

  const columns: Column<TeacherReportRow>[] = [
    {
      key: "student",
      label: "Student",
      render: (r) => (
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, color: "var(--text-heading)", fontWeight: 500 }}>{r.studentName}</div>
          {r.studentEmail && <div style={muted}>{r.studentEmail}</div>}
        </div>
      ),
    },
    {
      key: "total",
      label: "Score",
      width: 120,
      render: (r) => (
        <span style={{ fontSize: 14, fontWeight: 600, color: toneColor(scoreTone(r.totalScore, r.maxScore)) }}>
          {r.totalScore} / {r.maxScore}
        </span>
      ),
    },
    {
      key: "pct",
      label: "%",
      width: 80,
      render: (r) => <Badge tone={scoreTone(r.totalScore, r.maxScore)}>{pct(r.totalScore, r.maxScore)}%</Badge>,
    },
    {
      key: "auto",
      label: "Auto",
      width: 80,
      render: (r) => <span style={{ fontSize: 13, color: "var(--text-body)" }}>{r.autoScore}</span>,
    },
    {
      key: "ai",
      label: "AI",
      width: 90,
      render: (r) => (
        <span style={{ fontSize: 13, color: r.aiScore > 0 ? "var(--accent)" : "var(--text-muted)" }}>
          {r.aiScore > 0 ? r.aiScore : "—"}
        </span>
      ),
    },
    {
      key: "action",
      label: "",
      width: 100,
      render: (r) => {
        const idx = visible.findIndex(v => v.id === r.id);
        // The whole row is clickable; stop the bubble so the button doesn't
        // fire the same open twice (and fetch the report twice).
        return (
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); void openAt(idx); }}>
            Review →
          </Button>
        );
      },
    },
  ];

  // ── Detail body ─────────────────────────────────────────────────────────
  const openRow = openIndex === null ? null : visible[openIndex] ?? null;

  const detailBody = (() => {
    if (detailLoading) return <p style={{ ...muted, fontSize: 14, margin: 0 }}>Loading report…</p>;
    if (detailErr) return <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{detailErr}</p>;
    if (!detail) return null;

    // Report items are stored per question with no ordering of their own, so the
    // exam's question order is what makes the drill-down readable.
    const items = detail.items
      .map(it => ({ item: it, question: questionById.get(it.questionId) ?? null }))
      .sort((a, b) => (a.question?.order ?? 1e9) - (b.question?.order ?? 1e9));
    const aiCount = items.filter(i => i.item.feedback !== null).length;

    return (
      <div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <ScoreTile label="Total" value={`${detail.totalScore} / ${detail.maxScore}`} tone={scoreTone(detail.totalScore, detail.maxScore)} />
          <ScoreTile label="Percentage" value={`${pct(detail.totalScore, detail.maxScore)}%`} tone={scoreTone(detail.totalScore, detail.maxScore)} />
          <ScoreTile label="Auto-marked" value={String(detail.autoScore)} />
          <ScoreTile label="AI-marked" value={String(detail.aiScore)} />
        </div>

        <p style={{ ...muted, margin: "0 0 14px" }}>
          {aiCount > 0
            ? `${aiCount} of ${items.length} answers were graded by AI — check the feedback below before publishing.`
            : "Every answer on this paper was auto-marked against the answer key."}
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map(({ item, question }, i) => {
            const isAi = item.feedback !== null;
            const tone = scoreTone(item.score, item.maxScore);
            return (
              <div
                key={item.id}
                style={{
                  border: "1px solid var(--border-light)",
                  borderRadius: "var(--radius-md)",
                  padding: "14px 16px",
                  background: "var(--surface-card)",
                }}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)", minWidth: 26, paddingTop: 3 }}>
                    Q{question ? question.order : i + 1}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 5 }}>
                      {question && <Badge tone="accent">{QUESTION_TYPE_LABELS[question.type]}</Badge>}
                      {isAi && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent)" }}>
                          <Icon name="sparkles" size={12} /> AI-graded
                        </span>
                      )}
                    </div>
                    {question ? (
                      <MathText text={question.body} style={{ display: "block", fontSize: 14, lineHeight: 1.45, color: "var(--text-heading)" }} />
                    ) : (
                      <em style={muted}>Question no longer on this paper.</em>
                    )}
                  </div>
                  <span style={{ flexShrink: 0, fontSize: 14, fontWeight: 700, color: toneColor(tone) }}>
                    {item.score} / {item.maxScore}
                  </span>
                </div>

                {item.feedback && <AiFeedbackBlock raw={item.feedback} />}

                {item.imageUrl && (
                  <a
                    href={item.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 10, fontSize: 13, color: "var(--accent)", textDecoration: "none" }}
                  >
                    <Icon name="file-text" size={13} /> View scanned answer
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  })();

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return <div className="gv-card" style={emptyCard}>Loading reports…</div>;
  }
  if (err) {
    return (
      <div className="gv-card" style={{ ...emptyCard, color: "var(--danger)" }}>
        {err}
        <div style={{ marginTop: 12 }}>
          <Button variant="secondary" size="sm" onClick={retry}>Retry</Button>
        </div>
      </div>
    );
  }
  if (reports.length === 0) {
    return (
      <div className="gv-card" style={emptyCard}>
        No reports yet. They appear here as each student&rsquo;s paper finishes evaluation.
      </div>
    );
  }

  return (
    <div>
      {stats && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <ScoreTile label="Reports" value={String(reports.length)} />
          <ScoreTile label="Class average" value={`${stats.avg}%`} tone={scoreTone(stats.avg, 100)} />
          <ScoreTile label="Highest" value={`${pct(stats.top.totalScore, stats.top.maxScore)}%`} sub={stats.top.studentName} />
          <ScoreTile label="Lowest" value={`${pct(stats.low.totalScore, stats.low.maxScore)}%`} sub={stats.low.studentName} />
          <ScoreTile label="AI-graded" value={`${stats.aiGraded}`} sub="papers with AI marks" />
        </div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <input
          className="gv-input"
          placeholder="Search student…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{ maxWidth: 260 }}
        />
        <select
          className="gv-select"
          value={sort}
          onChange={e => setSort(e.target.value as typeof sort)}
          style={{ maxWidth: 200 }}
        >
          <option value="name">Sort: Name</option>
          <option value="score-desc">Sort: Highest score</option>
          <option value="score-asc">Sort: Lowest score</option>
        </select>
        <span style={{ ...muted, marginLeft: "auto" }}>
          {published
            ? "Published — students can see these marks."
            : "Not published — nothing here is visible to students yet."}
        </span>
      </div>

      {visible.length === 0 ? (
        <div className="gv-card" style={emptyCard}>No student matches &ldquo;{query}&rdquo;.</div>
      ) : (
        <DataTable columns={columns} rows={visible} onRowClick={(r) => void openAt(visible.findIndex(v => v.id === r.id))} />
      )}

      <Modal
        open={openIndex !== null}
        onClose={closeDetail}
        title={openRow ? openRow.studentName : "Report"}
        width={760}
      >
        {detailBody}
        <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center", marginTop: 18 }}>
          <span style={muted}>
            {openIndex !== null && `${openIndex + 1} of ${visible.length}`}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <Button
              variant="ghost"
              disabled={openIndex === null || openIndex === 0 || detailLoading}
              onClick={() => openIndex !== null && void openAt(openIndex - 1)}
            >
              ‹ Previous
            </Button>
            <Button
              variant="secondary"
              disabled={openIndex === null || openIndex >= visible.length - 1 || detailLoading}
              onClick={() => openIndex !== null && void openAt(openIndex + 1)}
            >
              Next ›
            </Button>
            <Button variant="app" onClick={closeDetail}>Done</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Local bits ────────────────────────────────────────────────────────────────

/**
 * What the AI actually did to one answer: the student's working as it was read,
 * the verdict on each step, and the reasons behind any marks lost.
 *
 * This is the whole point of the review screen — a teacher cannot sign off on a
 * machine's marking from a number alone, so the working is shown at the same
 * level of detail the grader saw it.
 */
function AiFeedbackBlock({ raw }: { raw: string }) {
  const parsed = parseFeedback(raw);

  if (parsed === null) {
    return (
      <FeedbackCallout kind="mistake" title="AI feedback" style={{ marginTop: 12 }}>
        {raw}
      </FeedbackCallout>
    );
  }

  if ("error" in parsed) {
    return (
      <FeedbackCallout kind="mistake" title="Not evaluated" style={{ marginTop: 12 }}>
        The AI could not grade this answer ({parsed.error}). It was scored 0 — check the scanned
        sheet and re-run the evaluation if the upload is legible.
      </FeedbackCallout>
    );
  }

  const steps = parsed.steps ?? [];
  const issues = steps.filter(
    (s) => (s.step_status === "wrong" || s.step_status === "incomplete") && s.description,
  );
  const right = parsed.summary?.rightSteps ?? steps.filter(s => s.step_status === "right").length;

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ ...muted, marginBottom: 8 }}>
        {right} of {steps.length} step{steps.length === 1 ? "" : "s"} marked correct
        {parsed.topics && parsed.topics.length > 0 && ` · ${parsed.topics.join(", ")}`}
      </div>

      {steps.length > 0 && (
        <ol style={{ margin: "0 0 10px", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
          {steps.map((s, i) => (
            <li key={s.stepId || i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span
                aria-hidden="true"
                style={{ width: 7, height: 7, borderRadius: "50%", flex: "none", marginTop: 7, background: STEP_TONE[s.step_status] }}
              />
              <MathText text={s.text} style={{ flex: 1, minWidth: 0, fontSize: 13.5, lineHeight: 1.55, color: "var(--text-body)" }} />
              <span style={{ ...muted, marginLeft: "auto", flex: "none", color: STEP_TONE[s.step_status] }}>
                {s.step_status}
              </span>
            </li>
          ))}
        </ol>
      )}

      {issues.length > 0 ? (
        <FeedbackCallout kind="mistake" title="Why marks were lost">
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
            {issues.map((s, i) => (
              <li key={s.stepId || i}><MathText text={s.description ?? ""} /></li>
            ))}
          </ul>
        </FeedbackCallout>
      ) : (
        <FeedbackCallout kind="alternative" title="No issues flagged">
          The AI found nothing wrong with this working.
        </FeedbackCallout>
      )}
    </div>
  );
}

function ScoreTile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: BadgeTone }) {
  return (
    <div
      className="gv-card"
      style={{ padding: "12px 16px", minWidth: 130, display: "flex", flexDirection: "column", gap: 2 }}
    >
      <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)" }}>
        {label}
      </span>
      <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: tone ? toneColor(tone) : "var(--text-heading)" }}>
        {value}
      </span>
      {sub && <span style={{ ...muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160 }}>{sub}</span>}
    </div>
  );
}

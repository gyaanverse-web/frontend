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

/**
 * `awaitingReport` of the same call — a student whose paper is in but whose
 * report does not exist yet.
 *
 * Carries no score and no reason, because the API deliberately sends neither: the
 * list mixes papers still being evaluated with papers held for a final check by
 * Gyanverse, and the teacher must not be able to tell which is which. Render it
 * with one neutral label for every row.
 */
export type AwaitingReportRow = {
  sessionId: string;
  studentId: string;
  studentName: string;
  studentEmail: string | null;
  submittedAt: string | null;
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
  const [awaiting, setAwaiting] = useState<AwaitingReportRow[]>([]);
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
    () => api.get<{ reports: TeacherReportRow[]; awaitingReport: AwaitingReportRow[] }>(
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
        setAwaiting(data.awaitingReport ?? []);
        setErr("");
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load reports");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [fetchReports, reloadKey]);

  // Re-fetch while anyone is still waiting. Both reasons a student sits in this
  // list resolve without the teacher doing anything — evaluation finishes, or a
  // Gyanverse operator scores the answer — so the list has to be able to empty
  // itself, or the teacher is left refreshing a page to find out whether the
  // thing they were told needs nothing from them is done.
  // `reloadKey` is in the deps so each poll re-arms the next one. Without it the
  // effect would not re-run when a fetch returned the same number of waiting
  // students, and the polling would stop after exactly one round.
  useEffect(() => {
    if (loading || err || awaiting.length === 0) return;
    const timer = setTimeout(() => setReloadKey(k => k + 1), 15000);
    return () => clearTimeout(timer);
  }, [awaiting.length, loading, err, reloadKey]);

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

  // Same search, so a teacher looking for one student finds them whether or not
  // their report exists yet — which is the entire point of showing this list.
  // Not sorted by score, because there is no score to sort by.
  const visibleAwaiting = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return awaiting;
    return awaiting.filter(a =>
      a.studentName.toLowerCase().includes(q) ||
      (a.studentEmail ?? "").toLowerCase().includes(q));
  }, [awaiting, query]);

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
  // Only truly empty when nobody is waiting either — otherwise the teacher gets
  // "no reports yet" on a screen that could be naming the students it is waiting
  // on, which is the gap this list closes.
  if (reports.length === 0 && awaiting.length === 0) {
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

      {/* Both lists empty can only happen under an active search — the early
          return above already covers "nothing on this exam at all". */}
      {visible.length === 0 && visibleAwaiting.length === 0 ? (
        <div className="gv-card" style={emptyCard}>No student matches &ldquo;{query}&rdquo;.</div>
      ) : (
        <>
          <AwaitingReportList rows={visibleAwaiting} />
          {visible.length > 0 && (
            <DataTable columns={columns} rows={visible} onRowClick={(r) => void openAt(visible.findIndex(v => v.id === r.id))} />
          )}
        </>
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
 * The students this exam is still waiting on, named so the roster adds up.
 *
 * Without it, a paper held for a final check is simply absent from the marks
 * table: 29 rows on a 30-student exam, and the only acknowledgement anywhere is
 * a count next to the publish button in a different part of the screen.
 *
 * Three deliberate restraints, all of them the same decision:
 *
 *   1. **One label for every row.** The API cannot tell us why a given student is
 *      here and must not — mid-evaluation and held-for-review look identical, on
 *      purpose, because distinguishing them would name the student whose answer
 *      the AI could not read.
 *   2. **Muted, never a warning.** No amber, no alert icon, no "unresolved". This
 *      is a step in the process, and colour is read faster than copy.
 *   3. **Not a table row and not clickable.** There is no score behind it and
 *      nothing to drill into; a row of em-dashes in a marks table invites a click
 *      that can only disappoint, and would drag these into the class average.
 */
function AwaitingReportList({ rows }: { rows: AwaitingReportRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div
      className="gv-card"
      style={{
        padding: "14px 16px",
        marginBottom: 12,
        borderStyle: "dashed",
        background: "var(--surface-inset)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
        <Icon name="clock" size={14} style={{ color: "var(--text-muted)" }} />
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--text-muted)",
          }}
        >
          Final check in progress
        </span>
      </div>
      <p style={{ ...muted, margin: "0 0 10px" }}>
        {rows.length === 1 ? "This paper is" : `These ${rows.length} papers are`} still being
        marked, so {rows.length === 1 ? "it has" : "they have"} no report yet. This finishes on
        its own — nothing for you to do.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {rows.map((r) => (
          <span
            key={r.sessionId}
            title={r.studentEmail ?? undefined}
            style={{
              fontSize: 13,
              color: "var(--text-body)",
              border: "1px solid var(--border-light)",
              borderRadius: "var(--radius-sm)",
              padding: "3px 9px",
              background: "var(--surface-card)",
            }}
          >
            {r.studentName}
          </span>
        ))}
      </div>
    </div>
  );
}

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

  // An answer whose stored feedback is an error payload rather than marked-up
  // working. The teacher is told it is unfinished and nothing more: they cannot
  // re-run it, and the ones that genuinely cannot be graded by machine are
  // already with a Gyanverse operator, who will supply a real score. Naming the
  // engine's error here would be both alarming and useless — see
  // docs/api/evaluation-resilience-checklist.md, Phase 8.
  //
  // `alternative` for the neutral blue edge rather than the crimson `mistake`
  // one: the colour is half the message here.
  if ("error" in parsed) {
    return (
      <FeedbackCallout kind="alternative" title="Still being processed" style={{ marginTop: 12 }}>
        This answer is still being marked. The score below is provisional and updates on its own
        once marking finishes — nothing for you to do.
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

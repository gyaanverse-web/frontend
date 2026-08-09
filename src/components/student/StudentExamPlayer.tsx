"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { Card, Badge, Button, Modal } from "@/components/ui";
import { MathText } from "@/components/Math";
import { ImageUpload, makeAnswerUploadSigner } from "@/components/ImageUpload";
import { StudentFocusStrip, FocusPage, type TimerTone } from "./StudentFocusStrip";

// ── Backend contracts ──────────────────────────────────────────────────────────
type QuestionType =
  | "mcq_single" | "mcq_multiple" | "integer" | "numerical"
  | "subjective" | "match" | "assertion_reason" | "fill_blanks";

type Question = {
  id: string;
  order: number;
  type: QuestionType;
  body: string;
  imageUrls: string[] | null;
  payload: Record<string, unknown>;
  marks: number;
  negativeMarks: number;
  languageVariants?: Record<string, string> | null;
};

type ExamInfo = {
  id: string;
  title: string;
  durationMins: number;
  totalMarks: number;
  visibility: "private" | "public_free" | "public_paid";
  questions: Question[];
};

type Session = {
  id: string;
  examId: string;
  status: "in_progress" | "submitted" | "expired";
  attemptNumber: number;
  expiresAt: string;
};

type SavedAnswer = Record<string, unknown> | null;
type AnswerRow = { questionId: string; answer: SavedAnswer; imageUrl: string | null };

// ── Answer inputs (functional, styled to the design tokens) ────────────────────

function McqSingle({ options, value, onChange }: { options: { id: string; text: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {options.map((o, i) => {
        const sel = value === o.id;
        return (
          <label key={o.id} style={optionStyle(sel)}>
            <input type="radio" checked={sel} onChange={() => onChange(o.id)} style={{ accentColor: "var(--accent)", width: 17, height: 17 }} />
            <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-muted)", width: 18 }}>{o.id?.toUpperCase() || String.fromCharCode(65 + i)}</span>
            <span style={{ fontSize: 15, color: "var(--text-heading)" }}><MathText text={o.text} /></span>
          </label>
        );
      })}
    </div>
  );
}

function McqMultiple({ options, values, onChange }: { options: { id: string; text: string }[]; values: string[]; onChange: (v: string[]) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {options.map((o) => {
        const checked = values.includes(o.id);
        return (
          <label key={o.id} style={optionStyle(checked)}>
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onChange(checked ? values.filter((v) => v !== o.id) : [...values, o.id])}
              style={{ accentColor: "var(--accent)", width: 17, height: 17 }}
            />
            <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-muted)", width: 18 }}>{o.id?.toUpperCase()}</span>
            <span style={{ fontSize: 15, color: "var(--text-heading)" }}><MathText text={o.text} /></span>
          </label>
        );
      })}
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)" }}>Select all that apply.</p>
    </div>
  );
}

function optionStyle(active: boolean): React.CSSProperties {
  return {
    display: "flex", alignItems: "center", gap: 12, padding: "14px 16px",
    border: `1px solid ${active ? "var(--accent)" : "var(--border-default)"}`,
    background: active ? "var(--accent-soft)" : "transparent",
    borderRadius: "var(--radius-md)", cursor: "pointer",
  };
}

const AR_OPTIONS = [
  { id: "A", text: "Both A and R are true and R is the correct explanation of A." },
  { id: "B", text: "Both A and R are true but R is not the correct explanation of A." },
  { id: "C", text: "A is true but R is false." },
  { id: "D", text: "A is false but R is true." },
];

// ── Handwritten upload for subjective questions ────────────────────────────────
function HandwrittenUpload({ sessionId, questionId, value, onChange }: { sessionId: string; questionId: string; value: string | null; onChange: (url: string) => void }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-heading)", marginBottom: 8 }}>Upload your handwritten solution</div>
      <ImageUpload
        getSignature={makeAnswerUploadSigner(sessionId, questionId)}
        value={value}
        onChange={onChange}
        label="Take a photo or upload an image — the AI reviews your handwritten working step-by-step."
      />
    </div>
  );
}

// ── Navigator ──────────────────────────────────────────────────────────────────
type ChipState = "answered" | "review" | "empty";

function NavChip({ n, state, current, onClick }: { n: number; state: ChipState; current: boolean; onClick: () => void }) {
  const bg = { answered: "var(--accent)", review: "var(--warning)", empty: "transparent" }[state];
  const color = state === "empty" ? "var(--text-body)" : "#fff";
  const border = state === "empty" ? "1px solid var(--border-default)" : "none";
  return (
    <button
      onClick={onClick}
      style={{
        width: 32, height: 32, borderRadius: 8, background: bg, color, border,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 13,
        boxShadow: current ? "0 0 0 2px var(--accent)" : "none", cursor: "pointer", padding: 0,
      }}
    >
      {n}
    </button>
  );
}

function NavigatorPanel({
  questions, answeredIds, reviewIds, current, onJump, onSubmit, submitting,
}: {
  questions: Question[];
  answeredIds: Set<string>;
  reviewIds: Set<string>;
  current: number;
  onJump: (i: number) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const total = questions.length;
  const answeredCount = answeredIds.size;
  const reviewCount = reviewIds.size;
  return (
    <div style={{ width: 260, flex: "none", display: "flex", flexDirection: "column", gap: 14 }}>
      <Card padding={16}>
        <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>Question navigator</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
          {questions.map((q, i) => {
            const state: ChipState = reviewIds.has(q.id) ? "review" : answeredIds.has(q.id) ? "answered" : "empty";
            return <NavChip key={q.id} n={i + 1} current={i === current} state={state} onClick={() => onJump(i)} />;
          })}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border-default)" }}>
          {([["var(--accent)", "Answered"], ["var(--warning)", "Marked for review"], ["transparent", "Not answered"]] as const).map(([c, l]) => (
            <div key={l} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-body)" }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: c, border: c === "transparent" ? "1px solid var(--border-default)" : "none" }} />
              {l}
            </div>
          ))}
        </div>
      </Card>
      <Card padding={16} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>Answered</span><strong>{answeredCount}</strong></div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>Marked for review</span><strong>{reviewCount}</strong></div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>Unanswered</span><strong>{total - answeredCount}</strong></div>
        <Button variant="app" style={{ marginTop: 8 }} onClick={onSubmit} disabled={submitting}>Submit attempt</Button>
      </Card>
    </div>
  );
}

function QuestionMeta({ n, marks, neg, onReview, onClear, reviewed }: { n: number; marks: number; neg: number; onReview: () => void; onClear: () => void; reviewed: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
      <span style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 17, color: "var(--text-heading)" }}>Q{n}</span>
      <Badge tone="neutral">{marks} marks</Badge>
      {neg > 0 && <Badge tone="danger">−{neg}</Badge>}
      <div style={{ flex: 1 }} />
      <button className="gv-btn gv-btn--ghost gv-btn--sm" onClick={onReview}>{reviewed ? "Unmark review" : "Mark for review"}</button>
      <button className="gv-btn gv-btn--ghost gv-btn--sm" onClick={onClear}>Clear answer</button>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────────
function isAnswered(q: Question, ans: SavedAnswer, imageUrl?: string): boolean {
  if (q.type === "subjective") return !!((ans as { text?: string })?.text || imageUrl);
  if (!ans) return false;
  switch (q.type) {
    case "mcq_single":
    case "assertion_reason": return !!(ans as { optionId?: string }).optionId;
    case "mcq_multiple": return Array.isArray((ans as { optionIds?: string[] }).optionIds) && (ans as { optionIds: string[] }).optionIds.length > 0;
    case "integer":
    case "numerical": { const v = (ans as { value?: unknown }).value; return v !== undefined && v !== null && v !== ""; }
    case "match": return Array.isArray((ans as { pairs?: unknown[] }).pairs) && (ans as { pairs: unknown[] }).pairs.length > 0;
    case "fill_blanks": return Array.isArray((ans as { answers?: unknown[] }).answers) && (ans as { answers: unknown[] }).answers.length > 0;
    default: return false;
  }
}

function formatTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ── Component ────────────────────────────────────────────────────────────────────
export function StudentExamPlayer({ examId }: { examId: string }) {
  const router = useRouter();

  const [exam, setExam] = useState<ExamInfo | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [answers, setAnswers] = useState<Record<string, SavedAnswer>>({});
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [reviewSet, setReviewSet] = useState<Set<string>>(new Set());
  const [current, setCurrent] = useState(0);
  const [savedFlag, setSavedFlag] = useState(false);
  const [saving, setSaving] = useState(false);

  const [remainingSecs, setRemainingSecs] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ── Bootstrap: load exam, then resume or start a session ─────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Resolve exam (public/purchased first, then private assigned)
      let examData: ExamInfo | null = null;
      try {
        examData = (await api.get<{ exam: ExamInfo }>(`/exams/${examId}`)).exam;
      } catch (e) {
        if (e instanceof ApiError && e.status === 403) {
          if (!cancelled) { setPageError("This is a paid mock — please purchase it first."); setLoading(false); }
          return;
        }
        try {
          examData = (await api.get<{ exam: ExamInfo }>(`/tenant/exams/${examId}`)).exam;
        } catch {
          if (!cancelled) { setPageError("Exam not found or you do not have access."); setLoading(false); }
          return;
        }
      }
      if (cancelled || !examData) return;
      setExam(examData);

      if (examData.questions.length === 0) {
        setPageError("This exam has no questions yet.");
        setLoading(false);
        return;
      }

      // Resume an in-progress session, else start a fresh one.
      const stored = localStorage.getItem(`exam_${examId}_sessionId`);
      let live: Session | null = null;
      if (stored) {
        try {
          const res = await api.get<{ session: Session & { answers: AnswerRow[] }; remainingSecs: number }>(`/sessions/${stored}`);
          if (res.session.status === "in_progress") {
            live = res.session;
            const a: Record<string, SavedAnswer> = {};
            const imgs: Record<string, string> = {};
            for (const r of res.session.answers) {
              if (r.answer) a[r.questionId] = r.answer;
              if (r.imageUrl) imgs[r.questionId] = r.imageUrl;
            }
            setAnswers(a);
            setImageUrls(imgs);
            setRemainingSecs(res.remainingSecs);
          } else {
            localStorage.removeItem(`exam_${examId}_sessionId`);
          }
        } catch {
          localStorage.removeItem(`exam_${examId}_sessionId`);
        }
      }
      if (!live) {
        try {
          const res = await api.post<{ session: Session }>(`/exams/${examId}/sessions/start`, {});
          live = res.session;
          localStorage.setItem(`exam_${examId}_sessionId`, res.session.id);
          const secs = Math.max(0, Math.floor((new Date(res.session.expiresAt).getTime() - Date.now()) / 1000));
          setRemainingSecs(secs);
        } catch (e) {
          if (!cancelled) { setPageError(e instanceof Error ? e.message : "Could not start the attempt."); setLoading(false); }
          return;
        }
      }
      if (!cancelled) { setSession(live); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [examId]);

  // ── Countdown → auto-submit on expiry ────────────────────────────────────────
  async function doSubmit() {
    if (!session) return;
    setSubmitting(true);
    setSubmitOpen(false);
    try {
      await api.post(`/sessions/${session.id}/submit`, {});
      if (timerRef.current) clearInterval(timerRef.current);
      localStorage.removeItem(`exam_${examId}_sessionId`);
      router.push(`/student/exams/${examId}/result?session=${session.id}`);
    } catch (e) {
      setPageError(e instanceof Error ? e.message : "Failed to submit");
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (remainingSecs === null || !session || session.status !== "in_progress") return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setRemainingSecs((prev) => {
        if (prev === null || prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          doSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // ── Answer persistence (debounced) ───────────────────────────────────────────
  async function persist(qId: string, ans: SavedAnswer, imageUrl?: string) {
    if (!session) return;
    setSaving(true); setSavedFlag(false);
    try {
      const body: { answer: SavedAnswer; imageUrl?: string } = { answer: ans };
      if (imageUrl) body.imageUrl = imageUrl;
      await api.patch(`/sessions/${session.id}/answers/${qId}`, body);
      setSavedFlag(true);
    } catch {
      /* transient — will retry on next change */
    } finally {
      setSaving(false);
    }
  }

  function changeAnswer(qId: string, ans: SavedAnswer) {
    setAnswers((a) => ({ ...a, [qId]: ans }));
    setReviewSet((r) => { if (!r.has(qId)) return r; const n = new Set(r); n.delete(qId); return n; });
    if (saveTimers.current[qId]) clearTimeout(saveTimers.current[qId]);
    saveTimers.current[qId] = setTimeout(() => {
      delete saveTimers.current[qId];
      persist(qId, ans, imageUrls[qId]);
    }, 600);
  }

  function changeImage(qId: string, url: string) {
    setImageUrls((prev) => { const n = { ...prev }; if (url) n[qId] = url; else delete n[qId]; return n; });
    if (saveTimers.current[qId]) { clearTimeout(saveTimers.current[qId]); delete saveTimers.current[qId]; }
    persist(qId, answers[qId] ?? null, url || undefined);
  }

  function clearAnswer(qId: string) {
    setAnswers((a) => { const n = { ...a }; delete n[qId]; return n; });
    persist(qId, null, imageUrls[qId]);
  }

  function toggleReview(qId: string) {
    setReviewSet((r) => { const n = new Set(r); if (n.has(qId)) n.delete(qId); else n.add(qId); return n; });
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const questions = useMemo(() => exam?.questions ?? [], [exam]);
  const answeredIds = useMemo(() => {
    const s = new Set<string>();
    for (const q of questions) if (isAnswered(q, answers[q.id] ?? null, imageUrls[q.id])) s.add(q.id);
    return s;
  }, [questions, answers, imageUrls]);

  if (loading) {
    return (
      <FocusPage>
        <StudentFocusStrip title="Loading attempt…" onBack={() => router.push("/student/exams")} />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 14 }}>Preparing your exam…</div>
      </FocusPage>
    );
  }

  if (pageError || !exam || !session) {
    return (
      <FocusPage>
        <StudentFocusStrip title="Exam" onBack={() => router.push("/student/exams")} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 40 }}>
          <p style={{ color: "var(--danger)", fontSize: 14.5 }}>{pageError || "Attempt unavailable."}</p>
          <Button variant="app" onClick={() => router.push("/student/exams")}>Back to my exams</Button>
        </div>
      </FocusPage>
    );
  }

  const q = questions[current];
  const savedAns = answers[q.id] ?? null;
  const timerSecs = remainingSecs ?? 0;
  const timerTone: TimerTone = timerSecs < 60 ? "red" : timerSecs < 300 ? "amber" : "normal";

  return (
    <FocusPage>
      <StudentFocusStrip
        title={exam.title}
        meta={`Attempt #${session.attemptNumber}`}
        timer={remainingSecs !== null ? formatTime(timerSecs) : null}
        timerTone={timerTone}
        saved={saving ? "Saving…" : savedFlag ? "Saved" : null}
        backLabel="My Exams"
        onBack={() => router.push("/student/exams")}
      />
      <div style={{ flex: 1, display: "flex", gap: 24, padding: 28, flexWrap: "wrap", alignItems: "flex-start" }}>
        <Card padding={28} style={{ flex: 1, minWidth: 320 }}>
          <QuestionMeta
            n={current + 1}
            marks={q.marks}
            neg={q.negativeMarks}
            reviewed={reviewSet.has(q.id)}
            onReview={() => toggleReview(q.id)}
            onClear={() => clearAnswer(q.id)}
          />

          {q.type === "assertion_reason" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              <div style={{ background: "var(--accent-soft)", padding: "10px 14px", borderRadius: "var(--radius-md)", fontSize: 14 }}>
                <strong>Assertion (A): </strong><MathText text={(q.payload.assertion as string) ?? ""} />
              </div>
              <div style={{ background: "var(--accent-soft)", padding: "10px 14px", borderRadius: "var(--radius-md)", fontSize: 14 }}>
                <strong>Reason (R): </strong><MathText text={(q.payload.reason as string) ?? ""} />
              </div>
            </div>
          )}

          {q.type !== "fill_blanks" && (
            <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--text-heading)", margin: "0 0 20px" }}>
              <MathText text={q.body} />
            </p>
          )}

          {q.imageUrls && q.imageUrls.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {q.imageUrls.map((url, i) => <img key={i} src={url} alt={`Figure ${i + 1}`} style={{ maxWidth: 320, borderRadius: "var(--radius-md)", border: "1px solid var(--border-default)" }} />)}
            </div>
          )}

          <QuestionInput
            q={q}
            saved={savedAns}
            imageUrl={imageUrls[q.id] ?? null}
            sessionId={session.id}
            onAnswer={changeAnswer}
            onImage={changeImage}
          />

          <div style={{ display: "flex", gap: 12, marginTop: 26, paddingTop: 20, borderTop: "1px solid var(--border-default)" }}>
            <Button variant="secondary" disabled={current === 0} onClick={() => setCurrent((c) => Math.max(0, c - 1))}>Previous</Button>
            <div style={{ flex: 1 }} />
            {current === questions.length - 1 ? (
              <Button variant="app" onClick={() => setSubmitOpen(true)}>Review &amp; submit</Button>
            ) : (
              <Button variant="app" arrow onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}>Save &amp; Next</Button>
            )}
          </div>
        </Card>

        <NavigatorPanel
          questions={questions}
          answeredIds={answeredIds}
          reviewIds={reviewSet}
          current={current}
          onJump={setCurrent}
          onSubmit={() => setSubmitOpen(true)}
          submitting={submitting}
        />
      </div>

      <Modal open={submitOpen} onClose={() => setSubmitOpen(false)} title="Submit attempt?" width={440}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ margin: 0, fontSize: 14.5 }}>
            You&apos;ve answered <strong style={{ color: "var(--text-heading)" }}>{answeredIds.size} of {questions.length}</strong>.{" "}
            {questions.length - answeredIds.size > 0 && (
              <strong style={{ color: "var(--danger)" }}>{questions.length - answeredIds.size} unanswered.</strong>
            )}{" "}
            Unanswered questions receive zero marks. Submit anyway?
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", background: "var(--surface-inset)", borderRadius: "var(--radius-md)", fontSize: 13.5 }}>
            <span>Answered: {answeredIds.size}</span>
            <span>Review: {reviewSet.size}</span>
            <span>Unanswered: {questions.length - answeredIds.size}</span>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <Button variant="secondary" style={{ flex: 1 }} onClick={() => setSubmitOpen(false)} disabled={submitting}>Keep reviewing</Button>
            <Button variant="app" style={{ flex: 1 }} onClick={doSubmit} disabled={submitting}>{submitting ? "Submitting…" : "Submit attempt"}</Button>
          </div>
        </div>
      </Modal>
    </FocusPage>
  );
}

// ── Per-type input renderer ──────────────────────────────────────────────────────
function QuestionInput({
  q, saved, imageUrl, sessionId, onAnswer, onImage,
}: {
  q: Question;
  saved: SavedAnswer;
  imageUrl: string | null;
  sessionId: string;
  onAnswer: (qId: string, ans: SavedAnswer) => void;
  onImage: (qId: string, url: string) => void;
}) {
  const s = saved as Record<string, unknown> | null;

  if (q.type === "mcq_single") {
    return <McqSingle options={(q.payload.options as { id: string; text: string }[]) ?? []} value={(s?.optionId as string) ?? ""} onChange={(v) => onAnswer(q.id, { optionId: v })} />;
  }
  if (q.type === "assertion_reason") {
    return <McqSingle options={AR_OPTIONS} value={(s?.optionId as string) ?? ""} onChange={(v) => onAnswer(q.id, { optionId: v })} />;
  }
  if (q.type === "mcq_multiple") {
    return <McqMultiple options={(q.payload.options as { id: string; text: string }[]) ?? []} values={(s?.optionIds as string[]) ?? []} onChange={(v) => onAnswer(q.id, { optionIds: v })} />;
  }
  if (q.type === "integer" || q.type === "numerical") {
    const isInt = q.type === "integer";
    return (
      <div>
        <input
          type="number"
          step={isInt ? "1" : "any"}
          className="gv-input"
          value={(s?.value as number | string) ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            const val = raw === "" ? null : isInt ? parseInt(raw, 10) : parseFloat(raw);
            onAnswer(q.id, { value: val });
          }}
          placeholder={isInt ? "Enter an integer…" : "Enter a value…"}
          style={{ width: 220, fontSize: 16 }}
        />
      </div>
    );
  }
  if (q.type === "subjective") {
    return (
      <>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
          <label className="gv-label">Rough working (optional notes)</label>
          <textarea
            className="gv-input"
            rows={3}
            value={(s?.text as string) ?? ""}
            onChange={(e) => onAnswer(q.id, { ...(s ?? {}), text: e.target.value })}
            placeholder="Type any notes here…"
            style={{ height: "auto", paddingTop: 10, resize: "vertical", fontFamily: "var(--font-body)" }}
          />
        </div>
        <HandwrittenUpload sessionId={sessionId} questionId={q.id} value={imageUrl} onChange={(url) => onImage(q.id, url)} />
      </>
    );
  }
  if (q.type === "match") {
    const left = (q.payload.left as { id: string; text: string }[]) ?? [];
    const right = (q.payload.right as { id: string; text: string }[]) ?? [];
    const pairs = (s?.pairs as { leftId: string; rightId: string }[]) ?? [];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {left.map((l) => {
          const pair = pairs.find((p) => p.leftId === l.id);
          return (
            <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ flex: 1, fontSize: 14 }}>{l.id}. <MathText text={l.text} /></span>
              <select
                className="gv-select"
                value={pair?.rightId ?? ""}
                onChange={(e) => {
                  const updated = pairs.filter((p) => p.leftId !== l.id);
                  if (e.target.value) updated.push({ leftId: l.id, rightId: e.target.value });
                  onAnswer(q.id, { pairs: updated });
                }}
                style={{ width: 200 }}
              >
                <option value="">— select —</option>
                {right.map((r) => <option key={r.id} value={r.id}>{r.id}. {r.text}</option>)}
              </select>
            </div>
          );
        })}
      </div>
    );
  }
  if (q.type === "fill_blanks") {
    const text = (q.payload.text as string) ?? q.body;
    const blanks = (q.payload.blanks as { id: string }[]) ?? [];
    const vals = (s?.answers as { blankId: string; value: string }[]) ?? [];
    return (
      <div>
        <p style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 14, whiteSpace: "pre-wrap" }}><MathText text={text} /></p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {blanks.map((b, i) => {
            const ans = vals.find((a) => a.blankId === b.id);
            return (
              <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)", minWidth: 64 }}>Blank {i + 1}:</span>
                <input
                  className="gv-input"
                  value={ans?.value ?? ""}
                  onChange={(e) => {
                    const updated = vals.filter((a) => a.blankId !== b.id);
                    updated.push({ blankId: b.id, value: e.target.value });
                    onAnswer(q.id, { answers: updated });
                  }}
                  placeholder="Your answer…"
                  style={{ flex: 1 }}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Unsupported question type.</p>;
}

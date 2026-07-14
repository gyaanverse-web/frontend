"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge, Button, Icon, Modal } from "@/components/ui";
import { StudentFocusStrip, FocusPage } from "./StudentFocusStrip";

// ── Placeholder data ──────────────────────────────────────────────────────────
// Mirrors the approved design (S4a MCQ / S4b subjective + handwritten upload).
// TODO: wire to the exam-session endpoint — load questions for the active
// attempt, autosave each answer, and drive the timer from the server clock.

type Question =
  | { type: "mcq"; marks: number; neg: number; body: React.ReactNode; options: string[] }
  | { type: "subjective"; marks: number; neg: number; body: React.ReactNode; note: string };

const QUESTIONS: Question[] = [
  {
    type: "mcq",
    marks: 4,
    neg: 1,
    body: (
      <>
        A ball is thrown vertically upward with an initial speed of 10 m/s. Taking
        <span style={{ fontFamily: "var(--font-mono)", margin: "0 4px" }}>g = 10 m/s²</span>, how long does it take to return
        to the point of projection?
      </>
    ),
    options: ["0.5 s", "1.0 s", "1.5 s", "2.0 s"],
  },
  { type: "mcq", marks: 4, neg: 1, body: "Which of the following has the greatest inertia?", options: ["A feather", "A cricket ball", "A loaded truck", "A tennis ball"] },
  { type: "mcq", marks: 4, neg: 1, body: "The SI unit of impulse is the same as that of…", options: ["Force", "Momentum", "Energy", "Power"] },
  {
    type: "subjective",
    marks: 6,
    neg: 0,
    body: "A projectile is launched at 30° to the horizontal with speed 20 m/s. Derive the maximum height and the horizontal range. Show your complete working.",
    note: "Take g = 10 m/s². Full method required for marks — the AI reviews your working step-by-step.",
  },
  { type: "mcq", marks: 4, neg: 1, body: "A body moving with uniform velocity has…", options: ["Zero acceleration", "Constant acceleration", "Increasing acceleration", "Zero velocity"] },
  { type: "mcq", marks: 4, neg: 1, body: "Newton's first law is also known as the law of…", options: ["Momentum", "Inertia", "Acceleration", "Gravitation"] },
];

const TOTAL = 30; // navigator density matches the design; only QUESTIONS are navigable

type ChipState = "answered" | "review" | "empty";

function NavChip({ n, state, current, onClick }: { n: number; state: ChipState; current: boolean; onClick?: () => void }) {
  const bg = { answered: "var(--accent)", review: "var(--warning)", empty: "transparent" }[state];
  const color = state === "empty" ? "var(--text-body)" : "#fff";
  const border = state === "empty" ? "1px solid var(--border-default)" : "none";
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        background: bg,
        color,
        border,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-body)",
        fontWeight: 600,
        fontSize: 13,
        boxShadow: current ? "0 0 0 2px var(--accent)" : "none",
        cursor: onClick ? "pointer" : "default",
        padding: 0,
      }}
    >
      {n}
    </button>
  );
}

function NavigatorPanel({
  answered,
  review,
  current,
  onJump,
  onSubmit,
}: {
  answered: Set<number>;
  review: Set<number>;
  current: number;
  onJump: (i: number) => void;
  onSubmit: () => void;
}) {
  return (
    <div style={{ width: 260, flex: "none", display: "flex", flexDirection: "column", gap: 14 }}>
      <Card padding={16}>
        <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>Question navigator</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
          {Array.from({ length: TOTAL }, (_, i) => i).map((i) => {
            const navigable = i < QUESTIONS.length;
            const state: ChipState = review.has(i) ? "review" : answered.has(i) ? "answered" : "empty";
            return <NavChip key={i} n={i + 1} current={i === current} state={state} onClick={navigable ? () => onJump(i) : undefined} />;
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
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>Answered</span><strong>{answered.size}</strong></div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>Marked for review</span><strong>{review.size}</strong></div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>Unanswered</span><strong>{TOTAL - answered.size - review.size}</strong></div>
        <Button variant="app" style={{ marginTop: 8 }} onClick={onSubmit}>Submit attempt</Button>
      </Card>
    </div>
  );
}

function QuestionMeta({ n, marks, neg, onReview, onClear }: { n: number; marks: number; neg: number; onReview: () => void; onClear: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
      <span style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 17, color: "var(--text-heading)" }}>Q{n}</span>
      <Badge tone="neutral">{marks} marks</Badge>
      {neg > 0 && <Badge tone="danger">−{neg}</Badge>}
      <div style={{ flex: 1 }} />
      <button className="gv-btn gv-btn--ghost gv-btn--sm" onClick={onReview}>Mark for review</button>
      <button className="gv-btn gv-btn--ghost gv-btn--sm" onClick={onClear}>Clear answer</button>
    </div>
  );
}

/** Handwritten-solution upload block for subjective questions (mocked toggle). */
function HandwrittenUpload() {
  const [uploaded, setUploaded] = useState(true);
  return (
    <>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-heading)", marginBottom: 8 }}>Upload your handwritten solution</div>
      {uploaded ? (
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 14, border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", background: "var(--surface-inset)" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 8,
              flex: "none",
              background: "repeating-linear-gradient(135deg, #dfe4f0 0, #dfe4f0 6px, #eef1f8 6px, #eef1f8 12px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-mono)",
              fontSize: 8,
              color: "var(--text-muted)",
            }}
          >
            photo
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-heading)" }}>handwritten-solution.jpg</div>
            <div style={{ fontSize: 12, color: "var(--success)" }}>Uploaded ✓</div>
          </div>
          <button className="gv-btn gv-btn--ghost gv-btn--sm" onClick={() => setUploaded(false)}>Replace</button>
        </div>
      ) : (
        <div onClick={() => setUploaded(true)} style={{ border: "1px dashed var(--border-default)", borderRadius: "var(--radius-md)", padding: "28px 16px", textAlign: "center", cursor: "pointer" }}>
          <Icon name="upload" size={24} style={{ color: "var(--text-muted)", margin: "0 auto 8px" }} />
          <div style={{ fontSize: 13.5, color: "var(--text-body)" }}>Take a photo or upload an image</div>
        </div>
      )}
    </>
  );
}

export function StudentExamPlayer({ examId }: { examId: string }) {
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({ 0: 1, 1: 2, 2: 0 });
  const [reviewSet, setReviewSet] = useState<Set<number>>(new Set());
  const [submitOpen, setSubmitOpen] = useState(false);

  const answered = useMemo(() => new Set(Object.keys(answers).map(Number)), [answers]);
  const q = QUESTIONS[current];

  function setMcq(i: number, opt: number) {
    setAnswers((a) => ({ ...a, [i]: opt }));
    setReviewSet((r) => { const n = new Set(r); n.delete(i); return n; });
  }
  function clearAnswer(i: number) {
    setAnswers((a) => { const n = { ...a }; delete n[i]; return n; });
  }
  function toggleReview(i: number) {
    setReviewSet((r) => { const n = new Set(r); n.has(i) ? n.delete(i) : n.add(i); return n; });
  }
  function go(delta: number) {
    setCurrent((c) => Math.min(QUESTIONS.length - 1, Math.max(0, c + delta)));
  }

  return (
    <FocusPage>
      <StudentFocusStrip
        title="Weekly Physics Test — Laws of Motion"
        timer="18:42"
        timerTone="normal"
        saved="Saved"
        backLabel="My Exams"
        onBack={() => router.push("/dashboard?screen=Exams")}
      />
      <div style={{ flex: 1, display: "flex", gap: 24, padding: 28, flexWrap: "wrap", alignItems: "flex-start" }}>
        <Card padding={28} style={{ flex: 1, minWidth: 320 }}>
          <QuestionMeta n={current + 1} marks={q.marks} neg={q.neg} onReview={() => toggleReview(current)} onClear={() => clearAnswer(current)} />
          <p style={{ fontSize: 16, lineHeight: 1.7, color: "var(--text-heading)", margin: "0 0 20px" }}>{q.body}</p>

          {q.type === "mcq" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {q.options.map((o, i) => {
                const sel = answers[current] === i;
                return (
                  <label
                    key={o}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "14px 16px",
                      border: `1px solid ${sel ? "var(--accent)" : "var(--border-default)"}`,
                      background: sel ? "var(--accent-soft)" : "transparent",
                      borderRadius: "var(--radius-md)",
                      cursor: "pointer",
                    }}
                  >
                    <input type="radio" checked={sel} onChange={() => setMcq(current, i)} style={{ accentColor: "var(--accent)", width: 17, height: 17 }} />
                    <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-muted)", width: 18 }}>{String.fromCharCode(65 + i)}</span>
                    <span style={{ fontSize: 15, color: "var(--text-heading)" }}>{o}</span>
                  </label>
                );
              })}
            </div>
          ) : (
            <>
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 20px" }}>{q.note}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                <label className="gv-label">Rough working (optional notes)</label>
                <textarea className="gv-input" rows={3} placeholder="Type any notes here…" style={{ height: "auto", paddingTop: 10, resize: "vertical", fontFamily: "var(--font-body)" }} />
              </div>
              <HandwrittenUpload />
            </>
          )}

          <div style={{ display: "flex", gap: 12, marginTop: 26, paddingTop: 20, borderTop: "1px solid var(--border-default)" }}>
            <Button variant="secondary" disabled={current === 0} onClick={() => go(-1)}>Previous</Button>
            <div style={{ flex: 1 }} />
            {current === QUESTIONS.length - 1 ? (
              <Button variant="app" onClick={() => setSubmitOpen(true)}>Review &amp; submit</Button>
            ) : (
              <Button variant="app" arrow onClick={() => go(1)}>Save &amp; Next</Button>
            )}
          </div>
        </Card>

        <NavigatorPanel answered={answered} review={reviewSet} current={current} onJump={setCurrent} onSubmit={() => setSubmitOpen(true)} />
      </div>

      {/* S4c — submit-attempt confirmation */}
      <Modal open={submitOpen} onClose={() => setSubmitOpen(false)} title="Submit attempt?" width={440}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ margin: 0, fontSize: 14.5 }}>
            You&apos;ve answered <strong style={{ color: "var(--text-heading)" }}>{answered.size} of {TOTAL}</strong>.{" "}
            <strong style={{ color: "var(--danger)" }}>{TOTAL - answered.size} unanswered</strong>. Submit anyway?
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", background: "var(--surface-inset)", borderRadius: "var(--radius-md)", fontSize: 13.5 }}>
            <span>Answered: {answered.size}</span>
            <span>Marked for review: {reviewSet.size}</span>
            <span>Unanswered: {TOTAL - answered.size - reviewSet.size}</span>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <Button variant="secondary" style={{ flex: 1 }} onClick={() => setSubmitOpen(false)}>Keep reviewing</Button>
            {/* TODO wire API: POST the attempt, then route to the real session results. */}
            <Button variant="app" style={{ flex: 1 }} onClick={() => router.push(`/exams/${examId}/result?state=evaluating`)}>Submit attempt</Button>
          </div>
        </div>
      </Modal>
    </FocusPage>
  );
}

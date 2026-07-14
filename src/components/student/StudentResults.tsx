"use client";

import { useRouter } from "next/navigation";
import { Card, Badge, Button, Icon, AIEvaluationCard } from "@/components/ui";
import { StudentFocusStrip, FocusPage } from "./StudentFocusStrip";

// ── Placeholder data ──────────────────────────────────────────────────────────
// Mirrors the approved design (S5a "evaluating", S5b fully evaluated with the
// signature AI feedback card). TODO: wire to the report endpoint scoped to the
// submitted session — objective scores are instant, subjective ones stream in
// as the evaluation queue finishes.

type ResultState = "evaluating" | "evaluated";

/** Big circular score dial shown at the top of the results header. */
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

function ResultsHeader({ state }: { state: ResultState }) {
  const router = useRouter();
  const pending = state === "evaluating";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 22, marginBottom: 26, flexWrap: "wrap" }}>
      <BigScoreBadge score={pending ? 180 : 228} total={300} pct={pending ? 60 : 76} />
      <div style={{ flex: 1, minWidth: 240 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: 24 }}>Mid-Term Mock — Mechanics</h2>
          <Badge tone={pending ? "warning" : "success"}>{pending ? "AI review pending" : "Result ready"}</Badge>
        </div>
        <p style={{ margin: 0, fontSize: 13.5 }}>Submitted Jul 6, 2026 · 6:42 PM</p>
        {!pending && <p style={{ margin: "4px 0 0", fontSize: 13.5, color: "var(--success)", fontWeight: 600 }}>▲ +12% vs your last Physics mock</p>}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <Button variant="secondary" onClick={() => router.push("/dashboard?screen=Exams")}>Retake</Button>
        <Button variant="ghost" onClick={() => router.push("/dashboard?screen=Results")}>See all my reports</Button>
      </div>
    </div>
  );
}

function ScoreSplitBar({ aiPending = false }: { aiPending?: boolean }) {
  const objAwarded = 180, objTotal = 200, aiAwarded = 48, aiTotal = 100;
  const objPct = (objAwarded / (objTotal + aiTotal)) * 100;
  const aiPct = aiPending ? 0 : (aiAwarded / (objTotal + aiTotal)) * 100;
  return (
    <Card padding={20} style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", gap: 32, marginBottom: 14, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>Objective (auto-graded)</div>
          <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 20, color: "var(--text-heading)" }}>{objAwarded} / {objTotal}</div>
        </div>
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)" }}>AI-evaluated (subjective)</div>
          <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 20, color: aiPending ? "var(--text-muted)" : "var(--text-heading)" }}>{aiPending ? "Pending…" : `${aiAwarded} / ${aiTotal}`}</div>
        </div>
      </div>
      <div style={{ height: 10, borderRadius: 999, background: "var(--border-default)", overflow: "hidden", display: "flex" }}>
        <div style={{ width: `${objPct}%`, background: "var(--accent)" }} />
        <div style={{ width: `${aiPct}%`, background: "var(--success)" }} />
      </div>
    </Card>
  );
}

type QResult = { n: number; title: string; correct: boolean; your: string; correctAns: string; awarded: number; marks: number };

function QRow({ q }: { q: QResult }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)" }}>
      <Icon name="check-circle" size={18} style={{ color: q.correct ? "var(--success)" : "var(--danger)", flex: "none" }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 14, color: "var(--text-heading)" }}>Q{q.n}. {q.title}</div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Your answer: {q.your} · Correct: {q.correctAns}</div>
      </div>
      <Badge tone={q.correct ? "success" : "danger"}>{q.awarded} / {q.marks}</Badge>
    </div>
  );
}

const OBJECTIVE_ROWS: QResult[] = [
  { n: 1, title: "Time to return to point of projection", correct: true, your: "1.0 s", correctAns: "1.0 s", awarded: 4, marks: 4 },
  { n: 2, title: "Which has greater inertia?", correct: false, your: "Option B", correctAns: "Option C", awarded: -1, marks: 4 },
];

export function StudentResults({ examId, state = "evaluated" }: { examId: string; state?: ResultState }) {
  const router = useRouter();
  const pending = state === "evaluating";
  return (
    <FocusPage>
      <StudentFocusStrip title="Results" backLabel="My Exams" onBack={() => router.push("/dashboard?screen=Exams")} />
      <div style={{ flex: 1, padding: "32px 40px", maxWidth: 1100, width: "100%", margin: "0 auto" }}>
        <ResultsHeader state={state} />
        <ScoreSplitBar aiPending={pending} />

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
          {OBJECTIVE_ROWS.map((q) => <QRow key={q.n} q={q} />)}

          {pending && (
            <Card padding={0} className="theme-dark" style={{ background: "var(--navy-800)", overflow: "hidden" }}>
              <div style={{ padding: 20, display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ width: 52, height: 52, borderRadius: "50%", flex: "none", border: "1px dashed var(--border-default)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontFamily: "var(--font-sans)", fontWeight: 700 }}>…</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 15, color: "var(--text-heading)" }}>Q22 · Projectile motion — max height &amp; range</div>
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Scanned handwritten upload</div>
                </div>
                <Badge tone="warning">Evaluating…</Badge>
              </div>
            </Card>
          )}
        </div>

        {pending ? (
          <Card padding={18} style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid var(--accent)", borderTopColor: "transparent", animation: "gv-spin 0.8s linear infinite", flex: "none" }} />
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-heading)" }}>Evaluating your handwritten answers…</div>
              <p style={{ margin: "2px 0 0", fontSize: 13 }}>This usually takes a minute. We&apos;ll notify you when it&apos;s ready.</p>
            </div>
            <style>{"@keyframes gv-spin{to{transform:rotate(360deg)}}"}</style>
          </Card>
        ) : (
          <>
            <AIEvaluationCard
              student="Aarav Mehta"
              exam="Q22 · Projectile motion — max height & range"
              score={6}
              outOf={10}
              status="evaluated"
              steps={[
                { text: "u = 20 m/s, θ = 30°" },
                { text: "H = u²sin²θ / 2g = 400 × 0.25 / 20 = 5 m" },
                { text: "R = u²sin2θ / g = 400 × sin60° / 10 = 34.6 m", wrong: true },
              ]}
              mistake="You used sin 60° instead of applying the doubled-angle formula cleanly — the range term was computed with the wrong trig value, giving 34.6 m instead of 34.64 m. The setup and height calculation were correct."
              alternative="R = (u² / g) × sin(2θ) — plug in 2θ = 60° directly: R = (400/10) × 0.866 = 34.64 m. Always compute sin(2θ) as one step to avoid rounding twice."
              tip="Round only your final answer, not intermediate trig values."
            />
            <div style={{ display: "flex", gap: 10, marginTop: 26, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <Button variant="secondary" onClick={() => router.push(`/exams/${examId}/intro`)}>Retake</Button>
              <Button variant="ghost" onClick={() => router.push("/dashboard?screen=Results")}>Back to results</Button>
              <Button variant="app" onClick={() => router.push("/dashboard?screen=Results")}>See all my reports</Button>
            </div>
          </>
        )}
      </div>
    </FocusPage>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { Card, Badge, Button, Icon } from "@/components/ui";
import { StudentFocusStrip, FocusPage } from "./StudentFocusStrip";

/** A compact labelled stat used on the intro screen (duration, marks, …). */
function FactTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "12px 16px", background: "var(--surface-inset)", borderRadius: "var(--radius-md)" }}>
      <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 17, color: "var(--text-heading)" }}>{value}</span>
    </div>
  );
}

// ── Placeholder data ──────────────────────────────────────────────────────────
// Mirrors the approved design. TODO: wire to the exam-info endpoint (title,
// instructions, duration/marks, attempts-left, and — for public paid mocks —
// price + purchase status) once the backend surface is confirmed.

/** S3a — intro for a free/assigned exam. */
export function StudentExamIntro({ examId }: { examId: string }) {
  const router = useRouter();
  return (
    <FocusPage>
      <StudentFocusStrip title="Mid-Term Mock — Mechanics" backLabel="My Exams" onBack={() => router.push("/dashboard?screen=Exams")} />
      <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: "48px 24px" }}>
        <div style={{ width: "100%", maxWidth: 640, display: "flex", flexDirection: "column", gap: 22 }}>
          <div>
            <Badge tone="accent">Physics</Badge>
            <h2 style={{ fontSize: 27, margin: "10px 0 0" }}>Mid-Term Mock — Mechanics</h2>
          </div>
          <Card padding={20}>
            <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>Instructions</div>
            <p style={{ fontSize: 14.5, lineHeight: 1.7, margin: 0 }}>
              Attempt all questions. Each correct answer awards the marks shown; an incorrect answer on a scored question
              deducts <em style={{ fontFamily: "var(--font-serif-display)", color: "var(--text-heading)" }}>1 mark</em>. Subjective
              answers should be worked out on paper and uploaded as a clear photo — our AI reviews handwritten working
              step-by-step, so show your full method, not just the final answer.
            </p>
          </Card>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            <FactTile label="Duration" value="45 min" />
            <FactTile label="Questions" value="30" />
            <FactTile label="Total marks" value="100" />
            <FactTile label="Negative marking" value="Yes (−1)" />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "var(--text-body)" }}>
            <Icon name="check-circle" size={16} style={{ color: "var(--success)", flex: "none" }} />
            Your answers autosave. If you lose connection or time runs out, we submit what you have.
          </div>
          <div style={{ fontSize: 13.5, color: "var(--text-body)" }}>
            Attempts left: <strong style={{ color: "var(--text-heading)" }}>2 of 3</strong>
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
            {/* TODO wire API: create/resume an attempt session, then route with the real session id. */}
            <Button variant="app" size="lg" arrow onClick={() => router.push(`/exams/${examId}/attempt`)}>Start attempt</Button>
            <Button variant="ghost" size="lg" onClick={() => router.push("/dashboard?screen=Exams")}>Back to my exams</Button>
          </div>
        </div>
      </div>
    </FocusPage>
  );
}

/** S3b — intro for a public paid mock that has not been purchased yet. */
export function StudentExamIntroPaid({ examId }: { examId: string }) {
  const router = useRouter();
  return (
    <FocusPage>
      <StudentFocusStrip title="JEE Main Full Mock #4 — Full Syllabus" backLabel="Marketplace" onBack={() => router.push("/dashboard?screen=Marketplace")} />
      <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: "48px 24px" }}>
        <div style={{ width: "100%", maxWidth: 640, display: "flex", flexDirection: "column", gap: 22 }}>
          <div>
            <Badge tone="accent">Physics · Chemistry · Maths</Badge>
            <h2 style={{ fontSize: 27, margin: "10px 0 0" }}>JEE Main Full Mock #4 — Full Syllabus</h2>
            <p style={{ margin: "6px 0 0", fontSize: 13.5 }}>Published by Sharma Classes · 1,240 students attempted</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            <FactTile label="Duration" value="180 min" />
            <FactTile label="Questions" value="90" />
            <FactTile label="Total marks" value="300" />
          </div>
          <Card padding={20} className="theme-dark" style={{ display: "flex", alignItems: "center", gap: 18, background: "var(--navy-800)" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}>Paid mock</div>
              <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 24, color: "var(--text-heading)" }}>₹49</div>
              <p style={{ fontSize: 13, margin: "4px 0 0" }}>One-time purchase · unlocks unlimited attempts</p>
            </div>
            {/* TODO wire API: hand off to the payment/checkout flow, then unlock the attempt. */}
            <Button variant="app" size="lg" onClick={() => router.push("/exams/public")}>Buy for ₹49</Button>
          </Card>
          <Button variant="ghost" size="lg" style={{ alignSelf: "flex-start" }} onClick={() => router.push("/dashboard?screen=Marketplace")}>Back to marketplace</Button>
        </div>
      </div>
    </FocusPage>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { Card, Badge, Button, Icon } from "@/components/ui";
import { StudentFocusStrip, FocusPage } from "./StudentFocusStrip";

// ── Backend contract (mirror getExamForStudent / getPublicExamForStudent) ──────
type ExamQuestion = { id: string; type: string; marks: number; negativeMarks: number };

type ExamInfo = {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  durationMins: number;
  totalMarks: number;
  maxAttempts: number;
  gradeLevel: string | null;
  visibility: "private" | "public_free" | "public_paid";
  price: string | null;
  status?: string; // scheduled | live | under_evaluation | results_published | completed
  scheduledAt?: string | null;
  endsAt?: string | null;
  questions?: ExamQuestion[];
};

type Mode = "ready" | "paid-locked";

function fmtWhen(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** A compact labelled stat used on the intro screen (duration, marks, …). */
function FactTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, padding: "12px 16px", background: "var(--surface-inset)", borderRadius: "var(--radius-md)" }}>
      <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 17, color: "var(--text-heading)" }}>{value}</span>
    </div>
  );
}

function IntroShell({ children, title, onBack, backLabel }: { children: React.ReactNode; title: string; onBack: () => void; backLabel: string }) {
  return (
    <FocusPage>
      <StudentFocusStrip title={title} backLabel={backLabel} onBack={onBack} />
      <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: "48px 24px" }}>
        <div style={{ width: "100%", maxWidth: 640, display: "flex", flexDirection: "column", gap: 22 }}>{children}</div>
      </div>
    </FocusPage>
  );
}

/**
 * Exam intro / start screen. Resolves the exam for the signed-in student across
 * both surfaces: public mocks (`/exams/:id`, 403 → paid preview) and private
 * assigned exams (`/tenant/exams/:id`). Renders a paid-purchase wall when the
 * student hasn't bought a public_paid mock yet.
 */
export function StudentExamIntro({ examId }: { examId: string }) {
  const router = useRouter();
  const [exam, setExam] = useState<ExamInfo | null>(null);
  const [mode, setMode] = useState<Mode>("ready");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Public / purchased path first.
        const res = await api.get<{ exam: ExamInfo }>(`/exams/${examId}`);
        if (!cancelled) { setExam(res.exam); setMode("ready"); }
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 403) {
          // public_paid, not purchased yet — load preview metadata for the wall.
          try {
            const preview = await api.get<{ exam: ExamInfo }>(`/exams/${examId}/preview`);
            if (!cancelled) { setExam(preview.exam); setMode("paid-locked"); }
          } catch {
            if (!cancelled) setError("This exam is not available.");
          }
        } else {
          // 404 / not-public — fall back to the private assigned-exam route.
          try {
            const res = await api.get<{ exam: ExamInfo }>(`/tenant/exams/${examId}`);
            if (!cancelled) { setExam(res.exam); setMode("ready"); }
          } catch {
            if (!cancelled) setError("Exam not found or you do not have access.");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [examId]);

  const isPublic = exam?.visibility !== "private";
  const backLabel = isPublic ? "Marketplace" : "My Exams";
  const onBack = () => router.push(isPublic ? "/dashboard?screen=Marketplace" : "/dashboard?screen=Exams");

  if (loading) {
    return (
      <IntroShell title="Loading…" backLabel="Back" onBack={() => router.back()}>
        <p style={{ fontSize: 14.5, color: "var(--text-muted)" }}>Loading exam…</p>
      </IntroShell>
    );
  }

  if (error || !exam) {
    return (
      <IntroShell title="Exam" backLabel="Back" onBack={() => router.push("/dashboard?screen=Exams")}>
        <Card padding={20} style={{ color: "var(--danger)", fontSize: 14.5 }}>{error || "Exam not available."}</Card>
        <Button variant="ghost" style={{ alignSelf: "flex-start" }} onClick={() => router.push("/dashboard?screen=Exams")}>Back to my exams</Button>
      </IntroShell>
    );
  }

  const qCount = exam.questions?.length ?? null;
  const hasNegative = (exam.questions ?? []).some((q) => q.negativeMarks > 0);
  const negMark = Math.max(0, ...(exam.questions ?? []).map((q) => q.negativeMarks));

  // ── Paid mock, not yet purchased ────────────────────────────────────────────
  if (mode === "paid-locked") {
    return (
      <IntroShell title={exam.title} backLabel={backLabel} onBack={onBack}>
        <div>
          {exam.gradeLevel && <Badge tone="accent">Grade {exam.gradeLevel}</Badge>}
          <h2 style={{ fontSize: 27, margin: "10px 0 0" }}>{exam.title}</h2>
          {exam.description && <p style={{ margin: "6px 0 0", fontSize: 13.5 }}>{exam.description}</p>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          <FactTile label="Duration" value={`${exam.durationMins} min`} />
          {qCount !== null && <FactTile label="Questions" value={String(qCount)} />}
          <FactTile label="Total marks" value={String(exam.totalMarks)} />
        </div>
        <Card padding={20} className="theme-dark" style={{ display: "flex", alignItems: "center", gap: 18, background: "var(--navy-800)" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}>Paid mock</div>
            <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 24, color: "var(--text-heading)" }}>₹{exam.price}</div>
            <p style={{ fontSize: 13, margin: "4px 0 0" }}>One-time purchase · up to {exam.maxAttempts} attempt{exam.maxAttempts !== 1 ? "s" : ""}</p>
          </div>
          {/* Hands off to the existing Razorpay checkout wall, which unlocks the attempt. */}
          <Button variant="app" size="lg" onClick={() => router.push(`/exams/${examId}/take`)}>Buy for ₹{exam.price}</Button>
        </Card>
        <Button variant="ghost" size="lg" style={{ alignSelf: "flex-start" }} onClick={onBack}>Back to marketplace</Button>
      </IntroShell>
    );
  }

  // ── Scheduled, not live yet — locked upcoming screen ────────────────────────
  if (exam.status === "scheduled") {
    const starts = fmtWhen(exam.scheduledAt);
    return (
      <IntroShell title={exam.title} backLabel={backLabel} onBack={onBack}>
        <div>
          {exam.gradeLevel && <Badge tone="accent">Grade {exam.gradeLevel}</Badge>}
          <h2 style={{ fontSize: 27, margin: "10px 0 0" }}>{exam.title}</h2>
          {exam.description && <p style={{ margin: "6px 0 0", fontSize: 13.5 }}>{exam.description}</p>}
        </div>
        <Card padding={22} style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <Icon name="clock" size={21} style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 15.5, color: "var(--text-heading)" }}>
              {starts ? `Starts ${starts}` : "Scheduled — starting soon"}
            </div>
            <p style={{ margin: "2px 0 0", fontSize: 13.5 }}>
              Questions unlock when the exam goes live. Come back at the start time — you&apos;ll find it under &ldquo;To do&rdquo;.
            </p>
          </div>
        </Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          <FactTile label="Duration" value={`${exam.durationMins} min`} />
          <FactTile label="Total marks" value={String(exam.totalMarks)} />
        </div>
        <Button variant="ghost" size="lg" style={{ alignSelf: "flex-start" }} onClick={onBack}>Back to my exams</Button>
      </IntroShell>
    );
  }

  // ── Live window already over — attempts closed ──────────────────────────────
  if (exam.status && exam.status !== "live") {
    return (
      <IntroShell title={exam.title} backLabel={backLabel} onBack={onBack}>
        <div>
          {exam.gradeLevel && <Badge tone="accent">Grade {exam.gradeLevel}</Badge>}
          <h2 style={{ fontSize: 27, margin: "10px 0 0" }}>{exam.title}</h2>
        </div>
        <Card padding={22}>
          <p style={{ margin: 0, fontSize: 14.5 }}>
            This exam has ended and can no longer be attempted.
            {exam.status === "under_evaluation"
              ? " If you submitted an attempt, your result will appear once your teacher publishes it."
              : " If you submitted an attempt, check My Exams for your result."}
          </p>
        </Card>
        <Button variant="ghost" size="lg" style={{ alignSelf: "flex-start" }} onClick={onBack}>Back to my exams</Button>
      </IntroShell>
    );
  }

  // ── Free / assigned / purchased — ready to start ────────────────────────────
  return (
    <IntroShell title={exam.title} backLabel={backLabel} onBack={onBack}>
      <div>
        {exam.gradeLevel && <Badge tone="accent">Grade {exam.gradeLevel}</Badge>}
        <h2 style={{ fontSize: 27, margin: "10px 0 0" }}>{exam.title}</h2>
      </div>
      <Card padding={20}>
        <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>Instructions</div>
        <p style={{ fontSize: 14.5, lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>
          {exam.instructions?.trim()
            ? exam.instructions
            : "Attempt all questions. Subjective answers should be worked out on paper and uploaded as a clear photo — our AI reviews handwritten working step-by-step, so show your full method, not just the final answer."}
        </p>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${qCount !== null ? 4 : 3}, 1fr)`, gap: 12 }}>
        <FactTile label="Duration" value={`${exam.durationMins} min`} />
        {qCount !== null && <FactTile label="Questions" value={String(qCount)} />}
        <FactTile label="Total marks" value={String(exam.totalMarks)} />
        <FactTile label="Negative marking" value={hasNegative ? `Yes (−${negMark})` : "No"} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "var(--text-body)" }}>
        <Icon name="check-circle" size={16} style={{ color: "var(--success)", flex: "none" }} />
        Your answers autosave. If you lose connection or time runs out, we submit what you have.
      </div>
      <div style={{ fontSize: 13.5, color: "var(--text-body)" }}>
        Up to <strong style={{ color: "var(--text-heading)" }}>{exam.maxAttempts}</strong> attempt{exam.maxAttempts !== 1 ? "s" : ""}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
        <Button variant="app" size="lg" arrow onClick={() => router.push(`/exams/${examId}/attempt`)}>Start attempt</Button>
        <Button variant="ghost" size="lg" onClick={onBack}>Back</Button>
      </div>
    </IntroShell>
  );
}

/** Back-compat alias — the intro is now fully data-driven and resolves paid vs free itself. */
export const StudentExamIntroPaid = StudentExamIntro;

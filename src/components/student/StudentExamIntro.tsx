"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useTenantSession } from "@/lib/useTenantSession";
import { Card, Badge, Button, Icon } from "@/components/ui";
import { StudentFocusStrip, FocusPage } from "./StudentFocusStrip";
import {
  buildPaperStructure, partRange, partMarksEach, partNegativeEach, fmtMarks,
} from "@/lib/paperStructure";

// ── Backend contract (mirror getExamForStudent / getPublicExamForStudent) ──────
type ExamQuestion = { id: string; type: string; marks: number; negativeMarks: number };

/**
 * Structure summary the API returns in place of `questions` while an exam is
 * still `scheduled` — the front-page facts of a paper (how many questions of
 * each type, for how many marks) without any question content. Absent on older
 * responses, so every read is guarded.
 */
type ExamStructure = { type: string; count: number; marks: number; negativeMarks: number }[];

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
  status?: string; // scheduled | live | under_evaluation | ready_to_publish | completed
  scheduledAt?: string | null;
  endsAt?: string | null;
  questions?: ExamQuestion[];
  structure?: ExamStructure;
};

type Mode = "ready" | "paid-locked";

// ── Razorpay (ported from the retired /take page — this is now the only
//    checkout entry point for paid mocks) ──────────────────────────────────────
type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  handler: (r: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
  theme?: { color: string };
  modal?: { ondismiss?: () => void };
};

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => { open: () => void };
  }
}

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && window.Razorpay) { resolve(); return; }
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Razorpay"));
    document.head.appendChild(s);
  });
}

// ── Formatting ────────────────────────────────────────────────────────────────

function fmtWhen(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString([], {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

/** hh:mm:ss for the waiting-room countdown; drops the hours block under an hour. */
function fmtCountdown(ms: number): string {
  const t = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function fmtDuration(mins: number): string {
  if (mins < 60) return `${mins} minutes`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} hour${h === 1 ? "" : "s"}` : `${h} h ${m} min`;
}

// ── Presentational bits ───────────────────────────────────────────────────────

/** Part numbering on the structure table — there are only 8 question types. */
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

const LABEL: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 700, letterSpacing: "0.1em",
  textTransform: "uppercase", color: "var(--text-muted)",
};

/** Section heading in the formal sheet — a ruled, lettered band. */
function SheetHeading({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 16px", background: "var(--surface-inset)",
      borderTop: "1px solid var(--border-default)", borderBottom: "1px solid var(--border-default)",
    }}>
      <span style={{
        width: 20, height: 20, borderRadius: 4, flex: "none",
        background: "var(--text-heading)", color: "var(--surface-card)",
        fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
      }}>{n}</span>
      <span style={{
        fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 13,
        letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-heading)",
      }}>{children}</span>
    </div>
  );
}

/** One row of the candidate-particulars grid. */
function Particular({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
      <span style={LABEL}>{label}</span>
      <span style={{
        fontSize: 14, fontWeight: 600, color: "var(--text-heading)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{value}</span>
    </div>
  );
}

function IntroShell({
  children, title, onBack, backLabel, timer, timerTone,
}: {
  children: React.ReactNode; title: string; onBack: () => void; backLabel: string;
  timer?: React.ReactNode; timerTone?: "normal" | "amber" | "red";
}) {
  return (
    <FocusPage>
      <StudentFocusStrip title={title} backLabel={backLabel} onBack={onBack} timer={timer} timerTone={timerTone} />
      <div style={{ flex: 1, display: "flex", justifyContent: "center", padding: "36px 24px 64px" }}>
        <div style={{ width: "100%", maxWidth: 780, display: "flex", flexDirection: "column", gap: 20 }}>{children}</div>
      </div>
    </FocusPage>
  );
}

/**
 * Pre-exam instruction sheet — the screen every candidate sees before a single
 * question is revealed, modelled on the printed front page of an offline paper:
 * candidate particulars, general instructions, the paper's structure, the
 * marking scheme, the answer-palette legend, and a declaration that gates the
 * Start button.
 *
 * It doubles as the waiting room for a `scheduled` exam. The candidate may sit
 * here and read while a countdown runs; Start stays locked until the exam is
 * actually live. That lock is a courtesy, not the control — `startSession`
 * rejects anything before `scheduledAt` server-side, so a wrong device clock
 * cannot let anyone in early.
 */
export function StudentExamIntro({ examId }: { examId: string }) {
  const router = useRouter();
  const { user, tenant } = useTenantSession({ requireTenant: false });

  const [exam, setExam] = useState<ExamInfo | null>(null);
  const [mode, setMode] = useState<Mode>("ready");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [payErr, setPayErr] = useState("");

  // Drives the countdown. Ticks only while a scheduled exam is pending.
  const [now, setNow] = useState(() => Date.now());
  const cancelled = useRef(false);

  useEffect(() => {
    cancelled.current = false;
    return () => { cancelled.current = true; };
  }, []);

  /** Resolve the exam across all three surfaces. Re-callable: the waiting room
   *  polls it, and a successful purchase re-runs it. */
  const load = useCallback(async (): Promise<ExamInfo | null> => {
    try {
      // Public / purchased path first.
      const res = await api.get<{ exam: ExamInfo }>(`/exams/${examId}`);
      if (!cancelled.current) { setExam(res.exam); setMode("ready"); }
      return res.exam;
    } catch (e) {
      if (cancelled.current) return null;
      if (e instanceof ApiError && e.status === 403) {
        // public_paid, not purchased yet — load preview metadata for the wall.
        try {
          const preview = await api.get<{ exam: ExamInfo }>(`/exams/${examId}/preview`);
          if (!cancelled.current) { setExam(preview.exam); setMode("paid-locked"); }
          return preview.exam;
        } catch {
          if (!cancelled.current) setError("This exam is not available.");
          return null;
        }
      }
      // 404 / not-public — fall back to the private assigned-exam route.
      try {
        const res = await api.get<{ exam: ExamInfo }>(`/tenant/exams/${examId}`);
        if (!cancelled.current) { setExam(res.exam); setMode("ready"); }
        return res.exam;
      } catch {
        if (!cancelled.current) setError("Exam not found or you do not have access.");
        return null;
      }
    }
  }, [examId]);

  useEffect(() => {
    (async () => {
      await load();
      if (!cancelled.current) setLoading(false);
    })();
  }, [load]);

  const startsAtMs = exam?.scheduledAt ? Date.parse(exam.scheduledAt) : null;
  const isScheduled = exam?.status === "scheduled";
  const msToStart = startsAtMs !== null ? startsAtMs - now : null;
  const countingDown = isScheduled && msToStart !== null && msToStart > 0;
  // Start time has passed but the lifecycle worker (a 60s tick) has not flipped
  // the exam to `live` yet. Poll rather than trust the local clock.
  const awaitingGoLive = isScheduled && (msToStart === null || msToStart <= 0);

  // Second hand for the countdown.
  useEffect(() => {
    if (!countingDown) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [countingDown]);

  // Once the clock runs out, re-fetch until the worker marks the exam live.
  useEffect(() => {
    if (!awaitingGoLive) return;
    const t = setInterval(() => { load(); }, 7000);
    return () => clearInterval(t);
  }, [awaitingGoLive, load]);

  const isPublic = exam?.visibility !== "private";
  const backLabel = isPublic ? "Marketplace" : "My Exams";
  const onBack = useCallback(
    () => router.push(isPublic ? "/student/marketplace" : "/student/exams"),
    [router, isPublic],
  );

  // Prefer real questions; fall back to the scheduled-exam structure summary.
  const structure = useMemo(() => {
    if (exam?.questions?.length) return buildPaperStructure(exam.questions);
    if (exam?.structure?.length) {
      // Expand the summary into one representative row per question so the same
      // aggregation produces the same table.
      const expanded = exam.structure.flatMap((s) =>
        Array.from({ length: s.count }, () => ({
          type: s.type, marks: s.marks, negativeMarks: s.negativeMarks,
        })),
      );
      return buildPaperStructure(expanded);
    }
    return null;
  }, [exam]);

  async function handlePay() {
    if (!exam) return;
    setPayErr(""); setPayLoading(true);
    try {
      await loadRazorpayScript();
      const order = await api.post<{ orderId: string; amount: number; currency: string; keyId: string }>(
        `/exams/${examId}/purchase`, {},
      );
      new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "Gyanverse",
        description: exam.title,
        theme: { color: "#1a4db8" },
        modal: { ondismiss: () => setPayLoading(false) },
        handler: async (response) => {
          try {
            await api.post(`/exams/${examId}/purchase/confirm`, {
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature,
            });
            await load(); // now resolves through the purchased path
            if (!cancelled.current) setPayLoading(false);
          } catch {
            if (cancelled.current) return;
            setPayErr("Payment was received but could not be confirmed. Please contact support.");
            setPayLoading(false);
          }
        },
      }).open();
    } catch (err) {
      setPayErr(err instanceof Error ? err.message : "Payment failed");
      setPayLoading(false);
    }
  }

  // ── Loading / error ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <IntroShell title="Loading…" backLabel="Back" onBack={() => router.back()}>
        <p style={{ fontSize: 14.5, color: "var(--text-muted)" }}>Loading exam…</p>
      </IntroShell>
    );
  }

  if (error || !exam) {
    return (
      <IntroShell title="Exam" backLabel="Back" onBack={() => router.push("/student/exams")}>
        <Card padding={20} style={{ color: "var(--danger)", fontSize: 14.5 }}>{error || "Exam not available."}</Card>
        <Button variant="ghost" style={{ alignSelf: "flex-start" }} onClick={() => router.push("/student/exams")}>Back to my exams</Button>
      </IntroShell>
    );
  }

  // ── Live window already over — attempts closed ──────────────────────────────
  if (exam.status && exam.status !== "live" && exam.status !== "scheduled") {
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

  // ── The instruction sheet ───────────────────────────────────────────────────
  const locked = mode === "paid-locked";
  const startsWhen = fmtWhen(exam.scheduledAt);
  const endsWhen = fmtWhen(exam.endsAt);
  const canStart = !locked && !isScheduled && agreed;

  // General instructions are generated from the exam's real configuration, so
  // the sheet can never promise a rule the engine does not enforce.
  const clauses: React.ReactNode[] = [
    <>The total duration of this examination is <strong>{fmtDuration(exam.durationMins)}</strong>. The countdown begins the moment you select <strong>Start examination</strong> and does not pause thereafter.</>,
    <>The question paper carries <strong>{fmtMarks(exam.totalMarks)} marks</strong>{structure ? <> across <strong>{structure.totalQuestions} questions</strong></> : null}. All questions are compulsory unless stated otherwise below.</>,
    structure?.hasNegative
      ? <>This paper carries <strong>negative marking</strong>. Up to <strong>{fmtMarks(structure.maxNegative)} mark(s)</strong> will be deducted for an incorrect response, as detailed in the marking scheme below. Unattempted questions carry no penalty.</>
      : <>There is <strong>no negative marking</strong> in this paper. An incorrect response carries no penalty, so you are advised to attempt every question.</>,
    <>Your responses are saved automatically as you work. If your connection drops or the allotted time expires, the responses recorded up to that moment are submitted on your behalf.</>,
    <>You may navigate freely between questions and flag any question for review. Flagged questions remain answerable until you submit.</>,
    <>Answers to subjective questions must be worked out on paper and uploaded as a clear photograph. The evaluator assesses your method step by step, so show complete working rather than the final answer alone.</>,
    <>You are permitted <strong>{exam.maxAttempts} attempt{exam.maxAttempts === 1 ? "" : "s"}</strong> at this examination.</>,
    <>Do not refresh, close, or navigate away from the examination window once started. Doing so does not stop the clock.</>,
  ];

  return (
    <IntroShell
      title={exam.title}
      backLabel={backLabel}
      onBack={onBack}
      timer={countingDown && msToStart !== null ? fmtCountdown(msToStart) : undefined}
      timerTone={countingDown && msToStart !== null && msToStart < 5 * 60_000 ? "amber" : "normal"}
    >
      {/* ── Masthead ─────────────────────────────────────────────────────── */}
      <div style={{ textAlign: "center", paddingBottom: 4 }}>
        <div style={{ ...LABEL, marginBottom: 8 }}>{tenant?.name ?? "Gyanverse"}</div>
        <h1 style={{
          fontFamily: "var(--font-sans)", fontSize: 25, fontWeight: 700, lineHeight: 1.25,
          margin: 0, color: "var(--text-heading)",
        }}>{exam.title}</h1>
        <div style={{ ...LABEL, marginTop: 8, letterSpacing: "0.16em" }}>Instructions to candidates</div>
        {exam.description && (
          <p style={{ margin: "12px auto 0", maxWidth: 560, fontSize: 13.5, color: "var(--text-muted)" }}>{exam.description}</p>
        )}
      </div>

      <Card padding={0} style={{ overflow: "hidden" }}>
        {/* ── A · Candidate particulars ──────────────────────────────────── */}
        <SheetHeading n="A">Candidate particulars</SheetHeading>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 18, padding: "16px 18px",
        }}>
          <Particular label="Candidate" value={user?.name ?? "—"} />
          <Particular label="Registered email" value={user?.email ?? "—"} />
          {exam.gradeLevel && <Particular label="Class / grade" value={exam.gradeLevel} />}
          <Particular label="Duration" value={fmtDuration(exam.durationMins)} />
          <Particular label="Maximum marks" value={fmtMarks(exam.totalMarks)} />
          {startsWhen && <Particular label="Opens at" value={startsWhen} />}
          {endsWhen && <Particular label="Closes at" value={endsWhen} />}
        </div>

        {/* ── B · General instructions ───────────────────────────────────── */}
        <SheetHeading n="B">General instructions</SheetHeading>
        <ol style={{ margin: 0, padding: "14px 18px 16px 38px", display: "flex", flexDirection: "column", gap: 9 }}>
          {clauses.map((c, i) => (
            <li key={i} style={{ fontSize: 13.5, lineHeight: 1.65, color: "var(--text-body)" }}>{c}</li>
          ))}
        </ol>

        {/* ── C · Structure of the question paper ────────────────────────── */}
        <SheetHeading n="C">Structure of the question paper</SheetHeading>
        {structure && structure.parts.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 520 }}>
              <thead>
                <tr style={{ background: "var(--surface-inset)" }}>
                  {["Part", "Question type", "Questions", "Marks each", "Negative", "Total"].map((h, i) => (
                    <th key={h} style={{
                      textAlign: i >= 2 ? "right" : "left", padding: "9px 14px",
                      fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                      color: "var(--text-muted)", borderBottom: "1px solid var(--border-default)",
                      whiteSpace: "nowrap",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {structure.parts.map((p, i) => (
                  <tr key={p.type} style={{ borderBottom: "1px solid var(--border-subtle, var(--border-default))" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 700, color: "var(--text-heading)" }}>
                      {ROMAN[i] ?? String(i + 1)}
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--text-heading)" }}>
                      {p.label}
                      <span style={{ display: "block", fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>{partRange(p)}</span>
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>{p.count}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>{partMarksEach(p)}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", color: p.negativeEach ? "var(--danger)" : "var(--text-muted)" }}>{partNegativeEach(p)}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "var(--text-heading)" }}>{fmtMarks(p.totalMarks)}</td>
                  </tr>
                ))}
                <tr style={{ background: "var(--surface-inset)" }}>
                  <td colSpan={2} style={{ padding: "10px 14px", fontWeight: 700, color: "var(--text-heading)" }}>Total</td>
                  <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "var(--text-heading)" }}>{structure.totalQuestions}</td>
                  <td />
                  <td />
                  <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: "var(--text-heading)" }}>{fmtMarks(structure.totalMarks)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ margin: 0, padding: "14px 18px", fontSize: 13.5, color: "var(--text-muted)" }}>
            The detailed structure of this paper will be displayed when the examination opens.
            It carries {fmtMarks(exam.totalMarks)} marks in total and must be completed in {fmtDuration(exam.durationMins)}.
          </p>
        )}

        {/* ── D · Teacher's additional instructions ──────────────────────── */}
        {exam.instructions?.trim() && (
          <>
            <SheetHeading n="D">Additional instructions</SheetHeading>
            <p style={{
              margin: 0, padding: "14px 18px", fontSize: 13.5, lineHeight: 1.7,
              whiteSpace: "pre-wrap", color: "var(--text-body)",
            }}>{exam.instructions}</p>
          </>
        )}

        {/* ── E · Navigating the question palette ────────────────────────── */}
        <SheetHeading n={exam.instructions?.trim() ? "E" : "D"}>Using the question palette</SheetHeading>
        <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.65, color: "var(--text-body)" }}>
            Every question appears as a numbered box in the palette beside the paper. Select a box to jump
            straight to that question. The colour of each box indicates its state:
          </p>
          <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
            {([
              ["var(--accent)", "Answered", "A response has been recorded."],
              ["var(--warning)", "Marked for review", "Answerable — flagged to revisit before submitting."],
              ["transparent", "Not answered", "No response recorded yet."],
            ] as const).map(([c, label, hint]) => (
              <div key={label} style={{ display: "flex", alignItems: "flex-start", gap: 9, minWidth: 190, flex: 1 }}>
                <span style={{
                  width: 26, height: 26, borderRadius: 6, flex: "none", marginTop: 1,
                  background: c, border: "1px solid var(--border-default)",
                }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-heading)" }}>{label}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>{hint}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* ── Paid wall, or declaration + start ──────────────────────────────── */}
      {locked ? (
        <Card padding={20} className="theme-dark" style={{ display: "flex", alignItems: "center", gap: 18, background: "var(--navy-800)", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ ...LABEL, marginBottom: 4 }}>Paid mock</div>
            <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 24, color: "var(--text-heading)" }}>₹{exam.price}</div>
            <p style={{ fontSize: 13, margin: "4px 0 0" }}>
              One-time purchase · up to {exam.maxAttempts} attempt{exam.maxAttempts === 1 ? "" : "s"}
            </p>
            {payErr && <p style={{ fontSize: 13, margin: "8px 0 0", color: "var(--danger)" }}>{payErr}</p>}
          </div>
          <Button variant="app" size="lg" disabled={payLoading} onClick={handlePay}>
            {payLoading ? "Opening checkout…" : `Buy for ₹${exam.price}`}
          </Button>
        </Card>
      ) : (
        <Card padding={20} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <label style={{ display: "flex", alignItems: "flex-start", gap: 11, cursor: isScheduled ? "default" : "pointer" }}>
            <input
              type="checkbox"
              checked={agreed}
              disabled={isScheduled}
              onChange={(e) => setAgreed(e.target.checked)}
              style={{ width: 17, height: 17, marginTop: 2, flex: "none", accentColor: "var(--accent)" }}
            />
            <span style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--text-body)" }}>
              I have read and understood all the instructions given above. I declare that I will not use
              any unfair means during this examination, and I accept that the responses recorded in this
              system are final.
            </span>
          </label>

          {isScheduled && (
            <div style={{
              display: "flex", alignItems: "center", gap: 13, padding: "13px 15px",
              background: "var(--surface-inset)", borderRadius: "var(--radius-md)",
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 11, flex: "none", background: "var(--accent-soft)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon name="clock" size={20} style={{ color: "var(--accent)" }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text-heading)" }}>
                  {countingDown && msToStart !== null
                    ? `Examination opens in ${fmtCountdown(msToStart)}`
                    : "Opening now — please wait"}
                </div>
                <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
                  {countingDown
                    ? "Stay on this page and read the instructions. The paper unlocks here automatically — you do not need to refresh."
                    : "The examination is being opened. This page will unlock on its own within a few seconds."}
                </p>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <Button
              variant="app"
              size="lg"
              arrow={canStart}
              disabled={!canStart}
              onClick={() => router.push(`/student/exams/${examId}/attempt`)}
            >
              {isScheduled
                ? (countingDown && msToStart !== null ? `Starts in ${fmtCountdown(msToStart)}` : "Opening…")
                : "Start examination"}
            </Button>
            <Button variant="ghost" size="lg" onClick={onBack}>Back</Button>
            {!isScheduled && !agreed && (
              <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                Accept the declaration above to begin.
              </span>
            )}
          </div>
        </Card>
      )}
    </IntroShell>
  );
}

/** Back-compat alias — the intro is now fully data-driven and resolves paid vs free itself. */
export const StudentExamIntroPaid = StudentExamIntro;

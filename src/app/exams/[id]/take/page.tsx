"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import type { CSSProperties } from "react";
import { api, ApiError } from "@/lib/api";
import { NavBar } from "@/components/NavBar";
import { ImageUpload, makeAnswerUploadSigner } from "@/components/ImageUpload";
import { MathText } from "@/components/Math";
import { btnPrimary as btnP, btnSecondary as btnS, inputBase as inp } from "@/lib/uiStyles";

// ── Types ─────────────────────────────────────────────────────────────────────

type User = { id: string; name: string; role: string };

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

type QuestionType =
  | "mcq_single" | "mcq_multiple" | "integer" | "numerical"
  | "subjective" | "match" | "assertion_reason" | "fill_blanks";

type ExamInfo = {
  id: string;
  title: string;
  durationMins: number;
  totalMarks: number;
  maxAttempts: number;
  instructions: string | null;
  status: string;
  visibility: "private" | "public_free" | "public_paid";
  price: string | null;
  questions: Question[];
};

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

type Session = {
  id: string;
  examId: string;
  studentId: string;
  status: "in_progress" | "submitted" | "expired";
  attemptNumber: number;
  expiresAt: string;
  totalMarks: number;
};

type SavedAnswer = Record<string, unknown> | null;

// ── Styles ────────────────────────────────────────────────────────────────────




// ── Answer Input Components ───────────────────────────────────────────────────

function McqSingleInput({
  options, value, onChange,
}: {
  options: { id: string; text: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {options.map(opt => (
        <label
          key={opt.id}
          style={{
            display: "flex", gap: "10px", alignItems: "flex-start", cursor: "pointer",
            padding: "8px 12px", border: `1px solid ${value === opt.id ? "#1a4db8" : "#ddd"}`,
            background: value === opt.id ? "#eff6ff" : "#fff", borderRadius: "2px",
          }}
        >
          <input
            type="radio"
            checked={value === opt.id}
            onChange={() => onChange(opt.id)}
            style={{ marginTop: "2px", accentColor: "#1a4db8" }}
          />
          <span style={{ fontSize: "14px" }}><strong>{opt.id.toUpperCase()}.</strong> {opt.text}</span>
        </label>
      ))}
    </div>
  );
}

function McqMultipleInput({
  options, values, onChange,
}: {
  options: { id: string; text: string }[];
  values: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {options.map(opt => {
        const checked = values.includes(opt.id);
        return (
          <label
            key={opt.id}
            style={{
              display: "flex", gap: "10px", alignItems: "flex-start", cursor: "pointer",
              padding: "8px 12px", border: `1px solid ${checked ? "#1a4db8" : "#ddd"}`,
              background: checked ? "#eff6ff" : "#fff", borderRadius: "2px",
            }}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onChange(checked ? values.filter(v => v !== opt.id) : [...values, opt.id])}
              style={{ marginTop: "2px", accentColor: "#1a4db8" }}
            />
            <span style={{ fontSize: "14px" }}><strong>{opt.id.toUpperCase()}.</strong> {opt.text}</span>
          </label>
        );
      })}
      <p style={{ margin: "0", fontSize: "12px", color: "#555" }}>Select all that apply.</p>
    </div>
  );
}

function MatchInput({
  left, right, pairs, onChange,
}: {
  left: { id: string; text: string }[];
  right: { id: string; text: string }[];
  pairs: { leftId: string; rightId: string }[];
  onChange: (v: { leftId: string; rightId: string }[]) => void;
}) {
  return (
    <div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
        <thead>
          <tr style={{ background: "#f0f0f0" }}>
            <th style={{ padding: "6px 10px", textAlign: "left", fontWeight: "bold" }}>Column A</th>
            <th style={{ padding: "6px 10px", textAlign: "left", fontWeight: "bold" }}>Match with</th>
          </tr>
        </thead>
        <tbody>
          {left.map(lItem => {
            const pair = pairs.find(p => p.leftId === lItem.id);
            return (
              <tr key={lItem.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "8px 10px" }}>{lItem.id}. {lItem.text}</td>
                <td style={{ padding: "8px 10px" }}>
                  <select
                    value={pair?.rightId ?? ""}
                    onChange={e => {
                      const updated = pairs.filter(p => p.leftId !== lItem.id);
                      if (e.target.value) updated.push({ leftId: lItem.id, rightId: e.target.value });
                      onChange(updated);
                    }}
                    style={{ ...inp, fontSize: "13px" }}
                  >
                    <option value="">-- select --</option>
                    {right.map(r => <option key={r.id} value={r.id}>{r.id}. {r.text}</option>)}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FillBlanksInput({
  text, blanks, answers, onChange,
}: {
  text: string;
  blanks: { id: string }[];
  answers: { blankId: string; value: string }[];
  onChange: (v: { blankId: string; value: string }[]) => void;
}) {
  return (
    <div>
      <div style={{ fontSize: "14px", marginBottom: "12px", lineHeight: "1.8", whiteSpace: "pre-wrap" }}>
        {text}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {blanks.map((blank, i) => {
          const ans = answers.find(a => a.blankId === blank.id);
          return (
            <div key={blank.id} style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <span style={{ fontSize: "13px", color: "#555", minWidth: "60px" }}>Blank {i + 1}:</span>
              <input
                value={ans?.value ?? ""}
                onChange={e => {
                  const updated = answers.filter(a => a.blankId !== blank.id);
                  updated.push({ blankId: blank.id, value: e.target.value });
                  onChange(updated);
                }}
                placeholder="Your answer…"
                style={{ ...inp, flex: 1 }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function TakeExamPage() {
  const router   = useRouter();
  const params   = useParams();
  const examId   = params.id as string;

  const [user, setUser]       = useState<User | null>(null);
  const [exam, setExam]       = useState<ExamInfo | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  // answer state — map of questionId → answer payload
  const [answers, setAnswers]   = useState<Record<string, SavedAnswer>>({});
  // image URL per question (subjective uploads) — kept separate from the answer
  // object because the backend stores it on a dedicated column and overwrites
  // it whenever the PATCH body omits it.
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [saving, setSaving]     = useState<string | null>(null);  // questionId being saved
  const [savingErr, setSavingErr] = useState("");
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // current question index
  const [currentIdx, setCurrentIdx] = useState(0);
  const [lang, setLang] = useState("en");

  // timer
  const [remainingSecs, setRemainingSecs] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // submit
  const [submitLoading, setSubmitLoading]   = useState(false);
  const [submitErr, setSubmitErr]           = useState("");
  const [confirmSubmit, setConfirmSubmit]   = useState(false);

  // start screen
  const [started, setStarted]   = useState(false);
  const [startLoading, setStartLoading] = useState(false);
  const [startErr, setStartErr] = useState("");

  // payment gate
  const [purchased, setPurchased] = useState<boolean | null>(null);
  const [payLoading, setPayLoading] = useState(false);
  const [payErr, setPayErr] = useState("");

  useEffect(() => {
    Promise.allSettled([
      api.get<{ user: User }>("/api/auth/get-session"),
      api.get<{ tenant: { slug: string } }>("/tenants/me"),
    ]).then(async ([sr, tr]) => {
      if (sr.status === "rejected") {
        const msg = sr.reason instanceof Error ? sr.reason.message : "";
        const isAuthError = msg.includes("401") || msg.includes("403") || msg.toLowerCase().includes("unauthorized");
        if (isAuthError) {
          router.push("/login");
        } else {
          // Rate-limit, 5xx, network error — don't evict the student
          setPageError("Could not verify session. Please refresh the page.");
          setLoading(false);
        }
        return;
      }
      const u = sr.value?.user;
      if (!u) { router.push("/login"); return; }
      if (u.role !== "student") { router.push(`/exams/${examId}`); return; }
      setUser(u);

      const tenantSlug = tr.status === "fulfilled" ? tr.value.tenant.slug : null;

      let examData: ExamInfo;
      try {
        // Works for public_free and for public_paid when already purchased.
        const ed = await api.get<{ exam: ExamInfo }>(`/exams/${examId}`);
        examData = ed.exam;
        setPurchased(true);
      } catch (e) {
        if (e instanceof ApiError && e.status === 403) {
          // public_paid exam — student hasn't purchased yet. Load preview metadata for payment wall.
          try {
            const preview = await api.get<{ exam: Omit<ExamInfo, "questions"> }>(`/exams/${examId}/preview`);
            examData = { ...preview.exam, questions: [] };
            setPurchased(false);
          } catch {
            setPageError("Exam not found or not available.");
            setLoading(false);
            return;
          }
        } else {
          // 404 or other — fall back to tenant route for private exams.
          if (!tenantSlug) {
            setPageError("Exam not found or you do not have access.");
            setLoading(false);
            return;
          }
          try {
            const ed = await api.get<{ exam: ExamInfo }>(`/tenant/exams/${examId}`, { tenant: tenantSlug });
            examData = ed.exam;
            setPurchased(true);
          } catch {
            setPageError("Exam not found or not available.");
            setLoading(false);
            return;
          }
        }
      }
      setExam(examData);

      // Resume an in-progress session stored in localStorage
      const storedSessionId = localStorage.getItem(`exam_${examId}_sessionId`);
      if (storedSessionId) {
        try {
          const sr2 = await api.get<{ session: Session; remainingSecs: number }>(`/sessions/${storedSessionId}`);
          if (sr2.session.status === "in_progress") {
            setSession(sr2.session);
            setRemainingSecs(sr2.remainingSecs);
            setStarted(true);
          } else {
            localStorage.removeItem(`exam_${examId}_sessionId`);
          }
        } catch {
          localStorage.removeItem(`exam_${examId}_sessionId`);
        }
      }

      setLoading(false);
    });
  }, [examId, router]);

  // countdown timer
  useEffect(() => {
    if (remainingSecs === null || !session || session.status !== "in_progress") return;
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setRemainingSecs(prev => {
        if (prev === null || prev <= 0) {
          clearInterval(timerRef.current!);
          localStorage.removeItem(`exam_${examId}_sessionId`);
          router.refresh();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [session, remainingSecs, router]);

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleStart() {
    if (!user || !exam) return;
    setStartErr(""); setStartLoading(true);
    try {
      const res = await api.post<{ session: Session }>(`/exams/${examId}/sessions/start`, {});
      setSession(res.session);
      localStorage.setItem(`exam_${examId}_sessionId`, res.session.id);
      const now = new Date();
      const secs = Math.max(0, Math.floor((new Date(res.session.expiresAt).getTime() - now.getTime()) / 1000));
      setRemainingSecs(secs);
      setStarted(true);
    } catch (err) {
      setStartErr(err instanceof Error ? err.message : "Failed to start exam");
    } finally {
      setStartLoading(false);
    }
  }

  async function handlePay() {
    if (!exam || !user) return;
    setPayErr(""); setPayLoading(true);
    try {
      await loadRazorpayScript();
      const order = await api.post<{ orderId: string; amount: number; currency: string; keyId: string }>(
        `/exams/${examId}/purchase`, {}
      );
      new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "Gyanverse",
        description: exam.title,
        theme: { color: "#1a4db8" },
        modal: {
          ondismiss: () => setPayLoading(false),
        },
        handler: async (response) => {
          try {
            await api.post(`/exams/${examId}/purchase/confirm`, {
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature,
            });
            // Re-fetch full exam with questions now that purchase is recorded.
            const ed = await api.get<{ exam: ExamInfo }>(`/exams/${examId}`);
            setExam(ed.exam);
            setPurchased(true);
            setPayLoading(false);
          } catch {
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

  function getAnswerForQuestion(qId: string): SavedAnswer {
    return answers[qId] ?? null;
  }

  function setLocalAnswer(qId: string, ans: SavedAnswer) {
    setAnswers(prev => ({ ...prev, [qId]: ans }));
  }

  async function saveAnswer(qId: string, ans: SavedAnswer, sid: string, imageUrl?: string) {
    setSaving(qId); setSavingErr("");
    try {
      const body: { answer: SavedAnswer; imageUrl?: string } = { answer: ans };
      if (imageUrl) body.imageUrl = imageUrl;
      await api.patch(`/sessions/${sid}/answers/${qId}`, body);
    } catch (err) {
      setSavingErr(err instanceof Error ? err.message : "Failed to save answer");
    } finally {
      setSaving(null);
    }
  }

  function handleAnswerChange(qId: string, ans: SavedAnswer) {
    setLocalAnswer(qId, ans);
    if (!session) return;
    // Debounce: coalesce rapid keystrokes into a single API call after 600ms idle
    if (saveTimers.current[qId]) clearTimeout(saveTimers.current[qId]);
    saveTimers.current[qId] = setTimeout(() => {
      delete saveTimers.current[qId];
      saveAnswer(qId, ans, session.id, imageUrls[qId]);
    }, 600);
  }

  function handleImageUploaded(qId: string, url: string) {
    setImageUrls(prev => {
      const next = { ...prev };
      if (url) next[qId] = url;
      else delete next[qId];
      return next;
    });
    if (!session) return;
    // Flush any pending text save first so the URL update isn't lost
    if (saveTimers.current[qId]) {
      clearTimeout(saveTimers.current[qId]);
      delete saveTimers.current[qId];
    }
    saveAnswer(qId, answers[qId] ?? null, session.id, url || undefined);
  }

  async function handleSubmit() {
    if (!session) return;
    setSubmitErr(""); setSubmitLoading(true); setConfirmSubmit(false);
    try {
      const res = await api.post<{ session: Session }>(`/sessions/${session.id}/submit`, {});
      setSession(res.session);
      if (timerRef.current) clearInterval(timerRef.current);
      localStorage.removeItem(`exam_${examId}_sessionId`);
      router.push(`/exams/${examId}/results/${session.id}`);
    } catch (err) {
      setSubmitErr(err instanceof Error ? err.message : "Failed to submit");
      setSubmitLoading(false);
    }
  }

  // ── Render helpers ─────────────────────────────────────────────────────────

  function formatTime(secs: number): string {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function isAnswered(q: Question): boolean {
    const ans = answers[q.id];
    if (!ans) return false;
    switch (q.type) {
      case "mcq_single":       return !!(ans as any).optionId;
      case "mcq_multiple":     return Array.isArray((ans as any).optionIds) && (ans as any).optionIds.length > 0;
      case "integer":
      case "numerical":        return (ans as any).value !== undefined && (ans as any).value !== "";
      case "subjective":       return !!((ans as any)?.text || imageUrls[q.id]);
      case "match":            return Array.isArray((ans as any).pairs) && (ans as any).pairs.length > 0;
      case "assertion_reason": return !!(ans as any).optionId;
      case "fill_blanks":      return Array.isArray((ans as any).answers) && (ans as any).answers.length > 0;
      default:                 return false;
    }
  }

  function renderAnswerInput(q: Question) {
    const saved = getAnswerForQuestion(q.id);

    if (q.type === "mcq_single" || q.type === "assertion_reason") {
      let options: { id: string; text: string }[];
      if (q.type === "assertion_reason") {
        const AR = [
          { id: "A", text: "Both A and R are true and R is the correct explanation of A." },
          { id: "B", text: "Both A and R are true but R is not the correct explanation of A." },
          { id: "C", text: "A is true but R is false." },
          { id: "D", text: "A is false but R is true." },
        ];
        options = AR;
      } else {
        options = (q.payload.options as { id: string; text: string }[]) ?? [];
      }
      return (
        <McqSingleInput
          options={options}
          value={(saved as any)?.optionId ?? ""}
          onChange={v => handleAnswerChange(q.id, { optionId: v })}
        />
      );
    }

    if (q.type === "mcq_multiple") {
      const options = (q.payload.options as { id: string; text: string }[]) ?? [];
      return (
        <McqMultipleInput
          options={options}
          values={(saved as any)?.optionIds ?? []}
          onChange={v => handleAnswerChange(q.id, { optionIds: v })}
        />
      );
    }

    if (q.type === "integer") {
      return (
        <div>
          <input
            type="number" step="1"
            value={(saved as any)?.value ?? ""}
            onChange={e => handleAnswerChange(q.id, { value: e.target.value === "" ? null : parseInt(e.target.value, 10) })}
            placeholder="Enter integer…"
            style={{ ...inp, fontSize: "16px", width: "160px" }}
          />
          <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#555" }}>Enter an integer value.</p>
        </div>
      );
    }

    if (q.type === "numerical") {
      const tolerance = (q.payload.tolerance as number) ?? 0;
      return (
        <div>
          <input
            type="number" step="any"
            value={(saved as any)?.value ?? ""}
            onChange={e => handleAnswerChange(q.id, { value: e.target.value === "" ? null : parseFloat(e.target.value) })}
            placeholder="Enter decimal value…"
            style={{ ...inp, fontSize: "16px", width: "200px" }}
          />
          {tolerance > 0 && <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#555" }}>Accepted range: ±{tolerance}</p>}
        </div>
      );
    }

    if (q.type === "subjective") {
      const wordLimit = (q.payload.wordLimit as number) | 0;
      return (
        <div>
          <textarea
            value={(saved as any)?.text ?? ""}
            onChange={e => handleAnswerChange(q.id, { text: e.target.value })}
            rows={5}
            placeholder="Type your answer here — or upload a photo of your handwritten work below."
            style={{ ...inp, display: "block", width: "100%", resize: "vertical", lineHeight: "1.6" }}
          />
          {wordLimit > 0 && (
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#555" }}>
              Word limit: {wordLimit} | Current: {((saved as any)?.text ?? "").split(/\s+/).filter(Boolean).length} words
            </p>
          )}

          {session && (
            <div style={{ marginTop: "12px", padding: "10px", border: "1px dashed #c7d2fe", background: "#f8faff" }}>
              <ImageUpload
                getSignature={makeAnswerUploadSigner(session.id, q.id)}
                value={imageUrls[q.id] ?? null}
                onChange={(url) => handleImageUploaded(q.id, url)}
                label="Or upload a photo of your handwritten answer (AI evaluation will analyse this image)"
              />
            </div>
          )}
        </div>
      );
    }

    if (q.type === "match") {
      const left  = (q.payload.left  as { id: string; text: string }[]) ?? [];
      const right = (q.payload.right as { id: string; text: string }[]) ?? [];
      return (
        <MatchInput
          left={left} right={right}
          pairs={(saved as any)?.pairs ?? []}
          onChange={v => handleAnswerChange(q.id, { pairs: v })}
        />
      );
    }

    if (q.type === "fill_blanks") {
      const text   = (q.payload.text   as string) ?? "";
      const blanks = (q.payload.blanks as { id: string }[]) ?? [];
      return (
        <FillBlanksInput
          text={text} blanks={blanks}
          answers={(saved as any)?.answers ?? []}
          onChange={v => handleAnswerChange(q.id, { answers: v })}
        />
      );
    }

    return <p style={{ color: "#888", fontSize: "13px" }}>Unsupported question type.</p>;
  }

  // ── Loading & error screens ────────────────────────────────────────────────

  if (loading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px" }}>Loading…</div>;
  }

  if (pageError || !exam) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px" }}>
        <p style={{ color: "#c00", fontSize: "13px" }}>{pageError || "Exam not found."}</p>
        <a href="/dashboard" style={{ ...btnP, textDecoration: "none" }}>← Back to Dashboard</a>
      </div>
    );
  }

  // ── Payment wall ──────────────────────────────────────────────────────────

  if (purchased === false) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <NavBar back={{ href: "/exams/public", label: "Browse Exams" }} user={user ? { name: user.name } : null} />
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ maxWidth: "420px", width: "100%", background: "#fff", border: "1px solid #aaa" }}>
            <div style={{ background: "#1a2e4a", color: "#fff", padding: "12px 16px" }}>
              <h1 style={{ margin: 0, fontSize: "16px" }}>{exam.title}</h1>
            </div>
            <div style={{ padding: "20px", textAlign: "center" }}>
              <div style={{ fontSize: "36px", marginBottom: "8px" }}>🔒</div>
              <div style={{ fontSize: "14px", fontWeight: "bold", marginBottom: "4px" }}>This is a paid exam</div>
              <div style={{ fontSize: "13px", color: "#555", marginBottom: "20px" }}>
                Purchase access to unlock this exam.
              </div>
              <div style={{ fontSize: "28px", fontWeight: "bold", color: "#1a4db8", marginBottom: "20px" }}>
                ₹{exam.price}
              </div>
              <div style={{ fontSize: "12px", color: "#777", marginBottom: "20px", display: "flex", justifyContent: "center", gap: "16px" }}>
                <span>{exam.durationMins} min</span>
                <span>{exam.questions.length > 0 ? `${exam.questions.length} questions` : `${exam.totalMarks} marks`}</span>
                <span>Max {exam.maxAttempts} attempt{exam.maxAttempts !== 1 ? "s" : ""}</span>
              </div>
              {payErr && (
                <p style={{ color: "#c00", fontSize: "13px", marginBottom: "12px", padding: "8px", border: "1px solid #c00", background: "#fff5f5" }}>
                  {payErr}
                </p>
              )}
              <button
                onClick={handlePay}
                disabled={payLoading}
                style={{ ...btnP, width: "100%", padding: "10px", fontSize: "14px", opacity: payLoading ? 0.6 : 1 }}
              >
                {payLoading ? "Opening payment…" : `Pay ₹${exam.price} & Unlock`}
              </button>
              <p style={{ margin: "12px 0 0", fontSize: "11px", color: "#888" }}>
                Secure payment via Razorpay. UPI, cards, net banking accepted.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── Start screen ──────────────────────────────────────────────────────────

  if (!started) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <NavBar back={{ href: "/exams/public", label: "Browse Exams" }} user={user ? { name: user.name } : null} activePage="exams" />
        <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div style={{ maxWidth: "480px", width: "100%", background: "#fff", border: "1px solid #aaa" }}>
            <div style={{ background: "#1a2e4a", color: "#fff", padding: "12px 16px" }}>
              <h1 style={{ margin: 0, fontSize: "16px" }}>{exam.title}</h1>
            </div>
            <div style={{ padding: "16px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "14px" }}>
                <tbody>
                  <tr>
                    <td style={{ padding: "6px 0", fontSize: "13px", color: "#555", width: "130px" }}>Duration</td>
                    <td style={{ padding: "6px 0", fontSize: "13px", fontWeight: "bold" }}>{exam.durationMins} minutes</td>
                  </tr>
                  <tr>
                    <td style={{ padding: "6px 0", fontSize: "13px", color: "#555" }}>Questions</td>
                    <td style={{ padding: "6px 0", fontSize: "13px", fontWeight: "bold" }}>{exam.questions.length}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: "6px 0", fontSize: "13px", color: "#555" }}>Total Marks</td>
                    <td style={{ padding: "6px 0", fontSize: "13px", fontWeight: "bold" }}>{exam.totalMarks}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: "6px 0", fontSize: "13px", color: "#555" }}>Max Attempts</td>
                    <td style={{ padding: "6px 0", fontSize: "13px", fontWeight: "bold" }}>{exam.maxAttempts}</td>
                  </tr>
                </tbody>
              </table>

              {exam.instructions && (
                <div style={{ background: "#fffbeb", border: "1px solid #f59e0b", padding: "10px 12px", marginBottom: "14px", fontSize: "13px", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
                  <div style={{ fontWeight: "bold", marginBottom: "4px", color: "#92400e" }}>Instructions</div>
                  {exam.instructions}
                </div>
              )}

              {startErr && <p style={{ color: "#c00", fontSize: "13px", marginBottom: "10px" }}>{startErr}</p>}

              {exam.questions.length === 0 ? (
                <div style={{ background: "#fffbeb", border: "1px solid #f59e0b", padding: "10px 12px", fontSize: "13px", color: "#92400e", textAlign: "center" }}>
                  This exam has no questions yet and cannot be started.
                </div>
              ) : (
                <button
                  onClick={handleStart}
                  disabled={startLoading}
                  style={{ ...btnP, width: "100%", padding: "10px", fontSize: "14px", opacity: startLoading ? 0.6 : 1 }}
                >
                  {startLoading ? "Starting…" : "Start Exam"}
                </button>
              )}
              <p style={{ margin: "10px 0 0", fontSize: "11px", color: "#888", textAlign: "center" }}>
                Once started, the timer cannot be paused. Good luck!
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ── Active exam screen ────────────────────────────────────────────────────

  if (exam.questions.length === 0) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontSize: "13px", color: "#555" }}>This exam has no questions.</p>
      </div>
    );
  }

  const q = exam.questions[currentIdx];
  const answeredCount = exam.questions.filter(isAnswered).length;
  // Union of languages offered by any question's variants (plus default English).
  const availableLangs = ["en", ...Array.from(new Set(exam.questions.flatMap((qq) => Object.keys(qq.languageVariants ?? {}))))];
  const qBody = (lang !== "en" && q.languageVariants?.[lang]) ? q.languageVariants[lang] : q.body;
  const timerSecs = remainingSecs ?? 0;
  const timerWarning = timerSecs < 300; // < 5 mins

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f5f5f5" }}>

      {/* Top bar */}
      <header style={{ background: "#1a2e4a", color: "#fff", padding: "6px 16px", display: "flex", alignItems: "center", gap: "12px", position: "sticky", top: 0, zIndex: 10 }}>
        <span style={{ fontWeight: "bold", fontSize: "14px", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {exam.title}
        </span>
        <span style={{ fontSize: "12px", color: "#aac4e8" }}>
          {answeredCount}/{exam.questions.length} answered
        </span>
        {availableLangs.length > 1 && (
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            title="Question language"
            style={{ fontSize: "12px", padding: "2px 4px", background: "#fff", color: "#111", border: "1px solid #aac4e8" }}
          >
            {availableLangs.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
          </select>
        )}
        {remainingSecs !== null && (
          <span style={{
            fontSize: "14px", fontWeight: "bold", fontFamily: "monospace",
            color: timerWarning ? "#fca5a5" : "#fff",
            background: timerWarning ? "rgba(185,28,28,0.3)" : "transparent",
            padding: timerWarning ? "2px 8px" : "0",
          }}>
            {formatTime(timerSecs)}
          </span>
        )}
        <button
          onClick={() => setConfirmSubmit(true)}
          disabled={submitLoading}
          style={{ background: "#16a34a", color: "#fff", border: "none", padding: "4px 14px", fontWeight: "bold", cursor: "pointer", fontSize: "13px", opacity: submitLoading ? 0.6 : 1 }}
        >
          Submit
        </button>
      </header>

      {/* Submit confirm dialog */}
      {confirmSubmit && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#fff", padding: "20px", maxWidth: "360px", width: "100%", border: "1px solid #aaa" }}>
            <h2 style={{ margin: "0 0 10px", fontSize: "15px" }}>Submit Exam?</h2>
            <p style={{ margin: "0 0 14px", fontSize: "13px", color: "#555" }}>
              You have answered <strong>{answeredCount}</strong> of <strong>{exam.questions.length}</strong> questions.
              Unanswered questions will receive zero marks.
            </p>
            {submitErr && <p style={{ color: "#c00", fontSize: "13px", marginBottom: "8px" }}>{submitErr}</p>}
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={handleSubmit} style={{ ...btnP, background: "#16a34a", borderColor: "#16a34a" }}>Yes, Submit</button>
              <button onClick={() => setConfirmSubmit(false)} style={btnS}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, display: "flex", maxWidth: "1000px", margin: "0 auto", width: "100%", padding: "16px", gap: "16px" }}>

        {/* Question area */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ background: "#fff", border: "1px solid #ddd", padding: "20px" }}>

            {/* Question header */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <span style={{ fontWeight: "bold", fontSize: "13px", color: "#1a4db8" }}>Q{currentIdx + 1}</span>
              <span style={{ fontSize: "11px", background: "#e0e7ff", color: "#3730a3", padding: "1px 8px", fontWeight: "bold" }}>
                {q.type.replace("_", " ").toUpperCase()}
              </span>
              <span style={{ fontSize: "12px", color: "#555", marginLeft: "auto" }}>
                {q.marks} mark{q.marks !== 1 ? "s" : ""}
                {q.negativeMarks > 0 && <span style={{ color: "#c00" }}> | -{q.negativeMarks} neg</span>}
              </span>
            </div>

            {/* Assertion-Reason special display */}
            {q.type === "assertion_reason" && (
              <div style={{ marginBottom: "12px" }}>
                <div style={{ background: "#f0f4ff", border: "1px solid #c7d2fe", padding: "10px 12px", marginBottom: "6px" }}>
                  <span style={{ fontWeight: "bold", fontSize: "12px", color: "#3730a3" }}>Assertion (A): </span>
                  <span style={{ fontSize: "13px" }}>{(q.payload.assertion as string) ?? ""}</span>
                </div>
                <div style={{ background: "#f0f4ff", border: "1px solid #c7d2fe", padding: "10px 12px" }}>
                  <span style={{ fontWeight: "bold", fontSize: "12px", color: "#3730a3" }}>Reason (R): </span>
                  <span style={{ fontSize: "13px" }}>{(q.payload.reason as string) ?? ""}</span>
                </div>
              </div>
            )}

            {/* Question body */}
            {q.type !== "fill_blanks" && (
              <div style={{ fontSize: "15px", lineHeight: "1.7", marginBottom: "16px" }}>
                <MathText text={qBody} />
              </div>
            )}

            {/* Images */}
            {q.imageUrls && q.imageUrls.length > 0 && (
              <div style={{ marginBottom: "12px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {q.imageUrls.map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={url} alt={`Question image ${i + 1}`} style={{ maxWidth: "300px", border: "1px solid #ddd" }} />
                ))}
              </div>
            )}

            {/* Answer input */}
            <div style={{ marginTop: "8px" }}>
              {renderAnswerInput(q)}
            </div>

            {savingErr && <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#c00" }}>{savingErr}</p>}
            {saving === q.id && <p style={{ margin: "8px 0 0", fontSize: "11px", color: "#888" }}>Saving…</p>}

            {/* Navigation */}
            <div style={{ marginTop: "20px", display: "flex", gap: "8px", justifyContent: "space-between", alignItems: "center" }}>
              <button
                onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
                disabled={currentIdx === 0}
                style={{ ...btnS, opacity: currentIdx === 0 ? 0.4 : 1 }}
              >
                ← Prev
              </button>
              <span style={{ fontSize: "12px", color: "#555" }}>{currentIdx + 1} / {exam.questions.length}</span>
              <button
                onClick={() => setCurrentIdx(i => Math.min(exam.questions.length - 1, i + 1))}
                disabled={currentIdx === exam.questions.length - 1}
                style={{ ...btnP, opacity: currentIdx === exam.questions.length - 1 ? 0.4 : 1 }}
              >
                Next →
              </button>
            </div>
          </div>
        </div>

        {/* Question palette */}
        <div style={{ width: "160px", flexShrink: 0 }}>
          <div style={{ background: "#fff", border: "1px solid #ddd", padding: "10px" }}>
            <div style={{ fontSize: "11px", fontWeight: "bold", color: "#555", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Questions
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
              {exam.questions.map((question, i) => {
                const answered = isAnswered(question);
                const isCurrent = i === currentIdx;
                return (
                  <button
                    key={question.id}
                    onClick={() => setCurrentIdx(i)}
                    style={{
                      width: "32px", height: "32px",
                      fontSize: "12px", fontWeight: isCurrent ? "bold" : "normal",
                      cursor: "pointer",
                      border: isCurrent ? "2px solid #1a4db8" : "1px solid #ddd",
                      background: isCurrent ? "#eff6ff" : answered ? "#dcfce7" : "#fff",
                      color: isCurrent ? "#1a4db8" : answered ? "#166534" : "#555",
                    }}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <div style={{ marginTop: "10px", fontSize: "11px", color: "#555" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "3px" }}>
                <span style={{ display: "inline-block", width: "12px", height: "12px", background: "#dcfce7", border: "1px solid #86efac" }}></span>
                Answered
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ display: "inline-block", width: "12px", height: "12px", background: "#fff", border: "1px solid #ddd" }}></span>
                Not answered
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

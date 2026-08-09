"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Logo, Button } from "@/components/ui";

type Step = 1 | 2;

const PAGE_BG =
  "radial-gradient(ellipse 70% 50% at 50% 0%, #eef0fc 0%, var(--paper-50) 60%)";

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next") ?? "";

  const [step, setStep] = useState<Step>(1);
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // `signupIntent` is what makes the Student/Coaching Owner toggle above
      // mean something. Without it this request is byte-identical to /signup's,
      // the account defaults to a student, and after verifying their email the
      // owner is filed into /student with no route to /create-coaching.
      await api.post("/api/auth/sign-up/email", {
        name: ownerName, email, password, signupIntent: "coaching_owner",
      });
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  // Step 3 happens on /create-coaching after the first sign-in, not on this
  // page — it is listed anyway because it is part of the same journey, and
  // hiding it is what made the flow look like it just ended at "verify email".
  // Labels are terse because three of them plus connectors have to fit the
  // 480px card on one line.
  const STEPS: [string, string, string] = ["Account", "Verify email", "Name institute"];

  const stepIndicator = (
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
      {STEPS.map((label, i) => {
        const num = i + 1;
        const done = step > num;
        const current = step === num;
        return (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {i > 0 && <span style={{ width: 16, height: 1, background: "var(--border-light)" }} />}
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontFamily: "var(--font-body)",
                fontSize: 12,
                fontWeight: 600,
                color: current ? "var(--accent)" : done ? "var(--success)" : "var(--text-muted)",
              }}
            >
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  background: current ? "var(--accent)" : done ? "var(--success)" : "var(--paper-100)",
                  color: current || done ? "#fff" : "var(--text-muted)",
                }}
              >
                {done ? "✓" : num}
              </span>
              {label}
            </span>
          </span>
        );
      })}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: PAGE_BG, padding: "48px 24px" }}>
      <Link href="/" style={{ marginBottom: 32 }}>
        <Logo size={24} />
      </Link>

      <div
        style={{
          background: "#fff",
          border: "1px solid var(--border-light)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg)",
          padding: 40,
          width: "100%",
          maxWidth: 480,
        }}
      >
        <h2 style={{ fontSize: 28, marginBottom: 6 }}>Create your account.</h2>
        <p style={{ fontFamily: "var(--font-body)", fontSize: 15, color: "var(--text-muted)", marginBottom: 28 }}>
          Set up your coaching institute on Gyanverse. You&apos;ll name your institute right after signing in.
        </p>

        {/* Role selector — this flow registers a Coaching Owner; students sign up separately */}
        <div style={{ marginBottom: 24 }}>
          <span className="gv-label">I am a</span>
          <div style={{ display: "flex", gap: 10 }}>
            <Link
              href={nextParam ? `/signup?next=${encodeURIComponent(nextParam)}` : "/signup"}
              style={{ flex: 1, textDecoration: "none" }}
            >
              <span
                style={{
                  display: "block",
                  textAlign: "center",
                  height: 44,
                  lineHeight: "44px",
                  border: "1px solid var(--border-light)",
                  borderRadius: "var(--radius-pill)",
                  background: "#fff",
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  color: "var(--text-body)",
                }}
              >
                Student
              </span>
            </Link>
            <span
              style={{
                flex: 1,
                textAlign: "center",
                height: 44,
                lineHeight: "44px",
                border: "2px solid var(--accent)",
                borderRadius: "var(--radius-pill)",
                background: "var(--accent-soft)",
                fontFamily: "var(--font-body)",
                fontSize: 14,
                fontWeight: 600,
                color: "var(--accent)",
              }}
            >
              Coaching Owner
            </span>
          </div>
        </div>

        {stepIndicator}

        {/* ── Step 1: Owner account ─────────────────────────────────── */}
        {step === 1 && (
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <label style={{ display: "block" }}>
              <span className="gv-label">Full name</span>
              <input className="gv-input" type="text" required minLength={2} maxLength={100} placeholder="e.g. Rajesh Sharma" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
            </label>
            <label style={{ display: "block" }}>
              <span className="gv-label">Email</span>
              <input className="gv-input" type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label style={{ display: "block" }}>
              <span className="gv-label">Password</span>
              <input className="gv-input" type="password" required minLength={8} placeholder="Min. 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>

            {error && <ErrorNote>{error}</ErrorNote>}

            <Button type="submit" size="lg" arrow disabled={loading} style={{ width: "100%", marginTop: 4 }}>
              {loading ? "Creating…" : "Create account"}
            </Button>
            <p style={{ textAlign: "center", fontSize: 14, color: "var(--text-muted)", margin: 0 }}>
              Already have an account?{" "}
              <Link href="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>
                Sign in
              </Link>
            </p>
          </form>
        )}

        {/* ── Step 2: Verify email ───────────────────────────────────── */}
        {step === 2 && (
          <div>
            <div style={{ background: "var(--success-soft)", border: "1px solid rgba(16,185,129,0.35)", borderRadius: "var(--radius-md)", padding: "12px 14px", marginBottom: 16, fontSize: 14, color: "#0f7a5a" }}>
              <strong>Account created.</strong> A verification email has been sent to <strong>{email}</strong>.
            </div>

            <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 8px", color: "var(--text-heading)" }}>Next steps</p>
            <ol style={{ fontSize: 14, margin: "0 0 16px", paddingLeft: 18, lineHeight: 1.8, color: "var(--text-body)" }}>
              <li>Open your email and click the verification link. It expires in 1 hour.</li>
              <li>After verifying, sign in and name your coaching institute.</li>
              <li>Can&apos;t find it? Check your spam folder.</li>
              {/* Local-only hint. The inline NODE_ENV check (rather than an
                  imported constant) is what lets the bundler dead-code this
                  out of deployed builds instead of shipping it behind a flag. */}
              {process.env.NODE_ENV !== "production" && (
                <li>
                  <strong style={{ color: "var(--text-heading)" }}>Local dev only:</strong> if no mail server is
                  running, the verification URL is printed to the{" "}
                  <strong style={{ color: "var(--text-heading)" }}>backend console</strong>.
                </li>
              )}
            </ol>

            <Button
              size="lg"
              arrow
              onClick={() => {
                const loginHref = nextParam.startsWith("/")
                  ? `/login?registered=1&next=${encodeURIComponent(nextParam)}`
                  : "/login?registered=1";
                router.push(loginHref);
              }}
              style={{ width: "100%" }}
            >
              Go to sign in
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: 0,
        padding: "10px 14px",
        background: "var(--danger-soft)",
        border: "1px solid rgba(244,63,94,0.35)",
        borderRadius: "var(--radius-md)",
        fontSize: 13,
        color: "var(--danger)",
      }}
    >
      {children}
    </p>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: PAGE_BG, fontSize: 14, color: "var(--text-muted)" }}>
          Loading…
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}

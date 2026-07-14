"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { postAuthRedirect } from "@/lib/tenantUrl";
import { Logo, Button } from "@/components/ui";

type Method = "email" | "phone";
type PhoneStep = "number" | "otp";

const PAGE_BG =
  "radial-gradient(ellipse 70% 50% at 50% 0%, #eef0fc 0%, var(--paper-50) 60%)";

// ── Login content ─────────────────────────────────────────────────────────────

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();

  const [method, setMethod] = useState<Method>("email");

  // Email login
  const [emailForm, setEmailForm] = useState({ email: "", password: "" });
  const [emailError, setEmailError] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  // Phone login
  const [phoneStep, setPhoneStep] = useState<PhoneStep>("number");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [phoneSending, setPhoneSending] = useState(false);
  const [phoneVerifying, setPhoneVerifying] = useState(false);
  const [phoneError, setPhoneError] = useState("");

  const [notice, setNotice] = useState("");
  const [authChecking, setAuthChecking] = useState(true);

  useEffect(() => {
    // Better Auth returns 200 { user: null } when unauthenticated rather than
    // rejecting, so we have to check the body — not just whether it resolved.
    api
      .get<{ user: { id: string } | null }>("/api/auth/get-session")
      .then((res) => {
        if (!res?.user) {
          setAuthChecking(false);
          return;
        }
        void postAuthRedirect(router, { nextParam: params.get("next") });
      })
      .catch(() => setAuthChecking(false));
  }, []);

  useEffect(() => {
    if (params.get("registered") === "1") {
      setNotice("Account created. Verify your email, then sign in below.");
    }
  }, [params]);

  function redirect() {
    void postAuthRedirect(router, { nextParam: params.get("next") });
  }

  function switchMethod(m: Method) {
    setMethod(m);
    setEmailError("");
    setPhoneError("");
    setPhoneStep("number");
    setPhone("");
    setOtp("");
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailError("");
    setEmailLoading(true);
    try {
      await api.post("/api/auth/sign-in/email", emailForm);
      redirect();
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setEmailLoading(false);
    }
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setPhoneError("");
    setPhoneSending(true);
    try {
      await api.post<unknown>("/api/auth/phone-number/send-otp", { phoneNumber: phone });
      setPhoneStep("otp");
    } catch (err) {
      setPhoneError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setPhoneSending(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setPhoneError("");
    setPhoneVerifying(true);
    try {
      await api.post<unknown>("/api/auth/phone-number/verify", { phoneNumber: phone, code: otp });
      redirect();
    } catch (err) {
      setPhoneError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setPhoneVerifying(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (authChecking) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: PAGE_BG, color: "var(--text-muted)", fontSize: 14 }}>
        Checking session…
      </div>
    );
  }

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
          maxWidth: 420,
        }}
      >
        <h2 style={{ fontSize: 28, marginBottom: 6 }}>Sign in.</h2>
        <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--text-muted)", marginBottom: 28 }}>
          Welcome back to Gyanverse.
        </p>

        {/* Method tabs — pill switcher */}
        <div style={{ display: "flex", background: "var(--paper-100)", borderRadius: "var(--radius-pill)", padding: 4, marginBottom: 24, gap: 4 }}>
          {(["email", "phone"] as const).map((m) => {
            const active = method === m;
            return (
              <button
                key={m}
                onClick={() => switchMethod(m)}
                style={{
                  flex: 1,
                  padding: "9px 0",
                  border: "none",
                  borderRadius: "var(--radius-pill)",
                  background: active ? "#fff" : "transparent",
                  boxShadow: active ? "var(--shadow-sm)" : "none",
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  fontWeight: active ? 600 : 400,
                  color: active ? "var(--text-heading)" : "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                {m === "email" ? "Email" : "Phone OTP"}
              </button>
            );
          })}
        </div>

        {notice && (
          <div style={{ marginBottom: 18, padding: "10px 14px", background: "var(--success-soft)", border: "1px solid rgba(16,185,129,0.35)", borderRadius: "var(--radius-md)", fontSize: 13, color: "#0f7a5a" }}>
            {notice}
          </div>
        )}

        {/* ── Email form ─────────────────────────────────────────────── */}
        {method === "email" && (
          <form onSubmit={handleEmailSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <label style={{ display: "block" }}>
              <span className="gv-label">Email</span>
              <input
                type="email"
                required
                placeholder="rahul@gmail.com"
                className="gv-input"
                value={emailForm.email}
                onChange={(e) => setEmailForm({ ...emailForm, email: e.target.value })}
              />
            </label>
            <label style={{ display: "block" }}>
              <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="gv-label" style={{ marginBottom: 0 }}>Password</span>
                <Link href="/login" style={{ fontSize: 12, color: "var(--accent)" }}>Forgot?</Link>
              </span>
              <input
                type="password"
                required
                placeholder="••••••••"
                className="gv-input"
                style={{ marginTop: 6 }}
                value={emailForm.password}
                onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })}
              />
            </label>
            {emailError && <ErrorNote>{emailError}</ErrorNote>}
            <Button type="submit" size="lg" disabled={emailLoading} style={{ width: "100%" }}>
              {emailLoading ? "Signing in…" : "Sign In"}
            </Button>
          </form>
        )}

        {/* ── Phone form ─────────────────────────────────────────────── */}
        {method === "phone" && phoneStep === "number" && (
          <form onSubmit={handleSendOtp} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <label style={{ display: "block" }}>
              <span className="gv-label">Mobile number</span>
              <input
                type="tel"
                required
                placeholder="+91 98765 43210"
                className="gv-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
            {phoneError && <ErrorNote>{phoneError}</ErrorNote>}
            <Button type="submit" size="lg" disabled={phoneSending} style={{ width: "100%" }}>
              {phoneSending ? "Sending…" : "Send OTP"}
            </Button>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
              In dev mode the OTP is printed to the backend console instead of being sent via SMS.
            </p>
          </form>
        )}

        {method === "phone" && phoneStep === "otp" && (
          <form onSubmit={handleVerifyOtp} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ padding: "10px 14px", background: "var(--success-soft)", border: "1px solid rgba(16,185,129,0.35)", borderRadius: "var(--radius-md)", fontSize: 13, color: "#0f7a5a" }}>
              OTP sent to <strong>{phone}</strong>.
            </div>
            <label style={{ display: "block" }}>
              <span className="gv-label">Enter 6-digit OTP</span>
              <input
                type="text"
                required
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="——————"
                className="gv-input"
                style={{ letterSpacing: 8, fontSize: 20, textAlign: "center", fontFamily: "var(--font-sans)" }}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
            </label>
            {phoneError && <ErrorNote>{phoneError}</ErrorNote>}
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <Button type="submit" size="lg" disabled={phoneVerifying} style={{ flex: 1 }}>
                {phoneVerifying ? "Verifying…" : "Verify OTP"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => {
                  setPhoneStep("number");
                  setOtp("");
                  setPhoneError("");
                }}
              >
                Wrong number?
              </Button>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>Code expires in 10 minutes.</p>
          </form>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "22px 0" }}>
          <span style={{ flex: 1, height: 1, background: "var(--border-light)" }} />
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>or</span>
          <span style={{ flex: 1, height: 1, background: "var(--border-light)" }} />
        </div>
        <p style={{ textAlign: "center", fontSize: 14, color: "var(--text-body)", margin: 0 }}>
          New to Gyanverse?{" "}
          <Link href="/register" style={{ color: "var(--accent)", fontWeight: 600 }}>
            Create account
          </Link>
        </p>
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

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: PAGE_BG, fontSize: 14, color: "var(--text-muted)" }}>
          Loading…
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

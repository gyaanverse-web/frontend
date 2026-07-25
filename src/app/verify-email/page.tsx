"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Logo, Button } from "@/components/ui";

const PAGE_BG =
  "radial-gradient(ellipse 70% 50% at 50% 0%, #eef0fc 0%, var(--paper-50) 60%)";

/**
 * Landing page for the link in the verification email.
 *
 * The link itself points at the API (only it can consume the token). Better
 * Auth verifies the token, then 302s the browser here — plain on success, or
 * with `?error=<CODE>` when the token was expired/invalid. So this page never
 * talks to the API to *verify*; by the time it renders, the outcome is decided
 * and encoded in the query string.
 *
 * Note: an already-verified user is redirected here WITHOUT an error, so a
 * double-click on the link shows success rather than a confusing failure.
 */

// Better Auth's BASE_ERROR_CODES, as they appear in the ?error= param.
const ERROR_COPY: Record<string, { title: string; detail: string; canResend: boolean }> = {
  TOKEN_EXPIRED: {
    title: "This link has expired.",
    detail: "Verification links are valid for 1 hour. Enter your email below and we'll send a fresh one.",
    canResend: true,
  },
  INVALID_TOKEN: {
    title: "This link isn't valid.",
    detail: "It may have been copied incompletely or already replaced by a newer email. Request a new link below.",
    canResend: true,
  },
  USER_NOT_FOUND: {
    title: "We couldn't find that account.",
    detail: "The account this link belongs to no longer exists. You can create a new one.",
    canResend: false,
  },
};

const FALLBACK_ERROR = {
  title: "We couldn't verify your email.",
  detail: "Something went wrong while confirming this link. Request a new one below.",
  canResend: true,
};

function VerifyEmailContent() {
  const params = useSearchParams();
  const errorCode = params.get("error");

  const [email, setEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [resendError, setResendError] = useState("");

  async function handleResend(e: React.FormEvent) {
    e.preventDefault();
    setResendError("");
    setResending(true);
    try {
      await api.post("/api/auth/send-verification-email", { email });
      setResent(true);
    } catch (err) {
      setResendError(err instanceof Error ? err.message : "Could not send the email");
    } finally {
      setResending(false);
    }
  }

  const success = !errorCode;
  const copy = success ? null : ERROR_COPY[errorCode] ?? FALLBACK_ERROR;

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
          maxWidth: 440,
          textAlign: "center",
        }}
      >
        <StatusIcon ok={success} />

        {success ? (
          <>
            <h2 style={{ fontSize: 26, margin: "0 0 8px" }}>Email verified.</h2>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 15, color: "var(--text-muted)", margin: "0 0 28px" }}>
              Your address is confirmed. Sign in to finish setting up your account.
            </p>
            <Link href="/login?verified=1" style={{ display: "block", textDecoration: "none" }}>
              <Button size="lg" arrow style={{ width: "100%" }}>
                Continue to sign in
              </Button>
            </Link>
          </>
        ) : (
          <>
            <h2 style={{ fontSize: 26, margin: "0 0 8px" }}>{copy!.title}</h2>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 15, color: "var(--text-muted)", margin: "0 0 24px" }}>
              {copy!.detail}
            </p>

            {copy!.canResend &&
              (resent ? (
                <div style={{ background: "var(--success-soft)", border: "1px solid rgba(16,185,129,0.35)", borderRadius: "var(--radius-md)", padding: "12px 14px", fontSize: 14, color: "#0f7a5a", textAlign: "left" }}>
                  A new verification link is on its way to <strong>{email}</strong>. It expires in 1 hour.
                </div>
              ) : (
                <form onSubmit={handleResend} style={{ display: "flex", flexDirection: "column", gap: 14, textAlign: "left" }}>
                  <label style={{ display: "block" }}>
                    <span className="gv-label">Email</span>
                    <input
                      className="gv-input"
                      type="email"
                      required
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </label>
                  {resendError && (
                    <p style={{ margin: 0, padding: "10px 14px", background: "var(--danger-soft)", border: "1px solid rgba(244,63,94,0.35)", borderRadius: "var(--radius-md)", fontSize: 13, color: "var(--danger)" }}>
                      {resendError}
                    </p>
                  )}
                  <Button type="submit" size="lg" disabled={resending} style={{ width: "100%" }}>
                    {resending ? "Sending…" : "Send a new link"}
                  </Button>
                </form>
              ))}

            <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "20px 0 0" }}>
              {copy!.canResend ? (
                <>
                  Already verified?{" "}
                  <Link href="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>
                    Sign in
                  </Link>
                </>
              ) : (
                <Link href="/register" style={{ color: "var(--accent)", fontWeight: 600 }}>
                  Create an account
                </Link>
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function StatusIcon({ ok }: { ok: boolean }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 52,
        height: 52,
        borderRadius: "50%",
        margin: "0 auto 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 24,
        background: ok ? "var(--success-soft)" : "var(--danger-soft)",
        color: ok ? "var(--success)" : "var(--danger)",
      }}
    >
      {ok ? "✓" : "!"}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: PAGE_BG, fontSize: 14, color: "var(--text-muted)" }}>
          Loading…
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Logo, Button } from "@/components/ui";

const PAGE_BG =
  "radial-gradient(ellipse 70% 50% at 50% 0%, #eef0fc 0%, var(--paper-50) 60%)";

/**
 * Step 1 of password recovery: ask for the address, trigger the reset email.
 *
 * The backend answers with the same generic message whether or not the account
 * exists (and silently skips phone-only accounts, whose email is a synthetic
 * @phone.gyanverse.app placeholder), so this page must not branch on the
 * response — doing so would leak which addresses are registered.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/api/auth/request-password-reset", { email });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the reset email");
    } finally {
      setLoading(false);
    }
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
        {sent ? (
          <>
            <h2 style={{ fontSize: 26, margin: "0 0 8px" }}>Check your email.</h2>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 15, color: "var(--text-muted)", margin: "0 0 20px" }}>
              If an account exists for <strong style={{ color: "var(--text-heading)" }}>{email}</strong>, a reset link
              is on its way. It expires in 1 hour.
            </p>
            <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 24px" }}>
              Can&apos;t find it? Check your spam folder, or{" "}
              <button
                type="button"
                onClick={() => setSent(false)}
                style={{ background: "none", border: "none", padding: 0, font: "inherit", color: "var(--accent)", fontWeight: 600, cursor: "pointer" }}
              >
                try a different address
              </button>
              .
            </p>
            <Link href="/login" style={{ display: "block", textDecoration: "none" }}>
              <Button size="lg" style={{ width: "100%" }}>
                Back to sign in
              </Button>
            </Link>
          </>
        ) : (
          <>
            <h2 style={{ fontSize: 26, margin: "0 0 8px" }}>Reset your password.</h2>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 15, color: "var(--text-muted)", margin: "0 0 24px" }}>
              Enter the email you signed up with and we&apos;ll send you a link to set a new password.
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <label style={{ display: "block" }}>
                <span className="gv-label">Email</span>
                <input
                  className="gv-input"
                  type="email"
                  required
                  autoFocus
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>

              {error && (
                <p style={{ margin: 0, padding: "10px 14px", background: "var(--danger-soft)", border: "1px solid rgba(244,63,94,0.35)", borderRadius: "var(--radius-md)", fontSize: 13, color: "var(--danger)" }}>
                  {error}
                </p>
              )}

              <Button type="submit" size="lg" disabled={loading} style={{ width: "100%" }}>
                {loading ? "Sending…" : "Send reset link"}
              </Button>
            </form>

            <p style={{ textAlign: "center", fontSize: 14, color: "var(--text-muted)", margin: "20px 0 0" }}>
              Remembered it?{" "}
              <Link href="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>
                Sign in
              </Link>
            </p>

            <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-muted)", margin: "10px 0 0" }}>
              Signed up with a phone number? Use{" "}
              <Link href="/login" style={{ color: "var(--accent)" }}>
                Phone OTP
              </Link>{" "}
              to sign in instead.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

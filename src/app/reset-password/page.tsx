"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Logo, Button } from "@/components/ui";

const PAGE_BG =
  "radial-gradient(ellipse 70% 50% at 50% 0%, #eef0fc 0%, var(--paper-50) 60%)";

const MIN_PASSWORD_LENGTH = 8; // mirrors emailAndPassword.minPasswordLength in backend config/auth.ts

/**
 * Step 2 of password recovery: the page the emailed link lands on.
 *
 * The link points at the API, which validates the token and then 302s here:
 *   valid   -> /reset-password?token=<token>
 *   expired -> /reset-password?error=INVALID_TOKEN
 *
 * So we never validate the token ourselves — we either have one to submit, or
 * we show the expired state. Note Better Auth reports both "malformed" and
 * "expired" as INVALID_TOKEN, so the copy has to cover both cases.
 */
function ResetPasswordContent() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const linkError = params.get("error");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/api/auth/reset-password", { newPassword: password, token });
      // Every existing session was revoked server-side, so the only way forward
      // is a fresh sign-in with the new password.
      router.push("/login?reset=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset your password");
      setLoading(false);
    }
  }

  const card: React.CSSProperties = {
    background: "#fff",
    border: "1px solid var(--border-light)",
    borderRadius: "var(--radius-lg)",
    boxShadow: "var(--shadow-lg)",
    padding: 40,
    width: "100%",
    maxWidth: 420,
  };

  // No usable token — either the link expired, was truncated in transit, or
  // someone opened /reset-password directly.
  if (!token || linkError) {
    return (
      <Shell>
        <div style={{ ...card, textAlign: "center" }}>
          <div
            aria-hidden="true"
            style={{ width: 52, height: 52, borderRadius: "50%", margin: "0 auto 20px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, background: "var(--danger-soft)", color: "var(--danger)" }}
          >
            !
          </div>
          <h2 style={{ fontSize: 26, margin: "0 0 8px" }}>This reset link isn&apos;t valid.</h2>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 15, color: "var(--text-muted)", margin: "0 0 24px" }}>
            Reset links expire after 1 hour and can only be used once. Request a new one to continue.
          </p>
          <Link href="/forgot-password" style={{ display: "block", textDecoration: "none" }}>
            <Button size="lg" arrow style={{ width: "100%" }}>
              Request a new link
            </Button>
          </Link>
          <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "20px 0 0" }}>
            <Link href="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>
              Back to sign in
            </Link>
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={card}>
        <h2 style={{ fontSize: 26, margin: "0 0 8px" }}>Set a new password.</h2>
        <p style={{ fontFamily: "var(--font-body)", fontSize: 15, color: "var(--text-muted)", margin: "0 0 24px" }}>
          Choose a password you haven&apos;t used before. You&apos;ll be signed out everywhere else.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <label style={{ display: "block" }}>
            <span className="gv-label">New password</span>
            <input
              className="gv-input"
              type="password"
              required
              autoFocus
              minLength={MIN_PASSWORD_LENGTH}
              placeholder={`Min. ${MIN_PASSWORD_LENGTH} characters`}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          <label style={{ display: "block" }}>
            <span className="gv-label">Confirm new password</span>
            <input
              className="gv-input"
              type="password"
              required
              placeholder="Re-enter your password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </label>

          {error && (
            <p style={{ margin: 0, padding: "10px 14px", background: "var(--danger-soft)", border: "1px solid rgba(244,63,94,0.35)", borderRadius: "var(--radius-md)", fontSize: 13, color: "var(--danger)" }}>
              {error}
            </p>
          )}

          <Button type="submit" size="lg" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Saving…" : "Save new password"}
          </Button>
        </form>

        <p style={{ textAlign: "center", fontSize: 14, color: "var(--text-muted)", margin: "20px 0 0" }}>
          <Link href="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>
            Back to sign in
          </Link>
        </p>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: PAGE_BG, padding: "48px 24px" }}>
      <Link href="/" style={{ marginBottom: 32 }}>
        <Logo size={24} />
      </Link>
      {children}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: PAGE_BG, fontSize: 14, color: "var(--text-muted)" }}>
          Loading…
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}

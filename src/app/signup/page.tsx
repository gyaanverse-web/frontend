"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Logo, Button } from "@/components/ui";

const PAGE_BG =
  "radial-gradient(ellipse 70% 50% at 50% 0%, #eef0fc 0%, var(--paper-50) 60%)";

function SignupContent() {
  const router = useRouter();
  const params = useSearchParams();
  const nextParam = params.get("next") ?? "";

  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [done, setDone]         = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await api.post("/api/auth/sign-up/email", { name, email, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  const loginHref = nextParam.startsWith("/")
    ? `/login?registered=1&next=${encodeURIComponent(nextParam)}`
    : "/login?registered=1";

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
          Set up a personal account to accept your invitation.
        </p>

        {/* Role selector — this flow registers a Student; coaching owners register separately */}
        <div style={{ marginBottom: 24 }}>
          <span className="gv-label">I am a</span>
          <div style={{ display: "flex", gap: 10 }}>
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
              Student
            </span>
            <Link
              href={nextParam ? `/register?next=${encodeURIComponent(nextParam)}` : "/register"}
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
                Coaching Owner
              </span>
            </Link>
          </div>
        </div>

        {!done ? (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <label style={{ display: "block" }}>
              <span className="gv-label">Full name</span>
              <input
                className="gv-input" type="text" required minLength={2} maxLength={100}
                placeholder="e.g. Priya Sharma"
                value={name} onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label style={{ display: "block" }}>
              <span className="gv-label">Email</span>
              <input
                className="gv-input" type="email" required
                placeholder="you@example.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label style={{ display: "block" }}>
              <span className="gv-label">Password</span>
              <input
                className="gv-input" type="password" required minLength={8}
                placeholder="Min. 8 characters"
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            {error && <ErrorNote>{error}</ErrorNote>}

            <Button type="submit" size="lg" arrow disabled={loading} style={{ width: "100%", marginTop: 4 }}>
              {loading ? "Creating…" : "Create account"}
            </Button>
            <p style={{ textAlign: "center", fontSize: 14, color: "var(--text-muted)", margin: 0 }}>
              Already have an account?{" "}
              <Link
                href={`/login${nextParam.startsWith("/") ? `?next=${encodeURIComponent(nextParam)}` : ""}`}
                style={{ color: "var(--accent)", fontWeight: 600 }}
              >
                Sign in
              </Link>
            </p>
          </form>
        ) : (
          <div>
            <div style={{ background: "var(--success-soft)", border: "1px solid rgba(16,185,129,0.35)", borderRadius: "var(--radius-md)", padding: "12px 14px", marginBottom: 16, fontSize: 14, color: "#0f7a5a" }}>
              <strong>Account created.</strong> A verification email has been sent to <strong>{email}</strong>.
            </div>

            <p style={{ fontSize: 14, fontWeight: 600, margin: "0 0 8px", color: "var(--text-heading)" }}>Next steps</p>
            <ol style={{ fontSize: 14, margin: "0 0 16px", paddingLeft: 18, lineHeight: 1.8, color: "var(--text-body)" }}>
              <li>Open your email and click the verification link.</li>
              <li>
                <strong style={{ color: "var(--text-heading)" }}>Dev mode:</strong> email is not sent — check the{" "}
                <strong style={{ color: "var(--text-heading)" }}>backend console</strong> for the verification URL.
              </li>
              <li>After verifying, sign in to accept your invite.</li>
            </ol>

            <Button
              size="lg"
              arrow
              onClick={() => router.push(loginHref)}
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

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: PAGE_BG, fontSize: 14, color: "var(--text-muted)" }}>
          Loading…
        </div>
      }
    >
      <SignupContent />
    </Suspense>
  );
}

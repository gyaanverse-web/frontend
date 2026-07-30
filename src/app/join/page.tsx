"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo, Button } from "@/components/ui";

// Coaching join codes are 8 chars from an unambiguous alphabet (no 0/O/1/I),
// mirroring CODE_CHARS in the backend membership.service.ts.
const CODE_RE = /^[A-HJ-NP-Z2-9]{8}$/;

const PAGE_BG =
  "radial-gradient(ellipse 70% 50% at 50% 0%, #eef0fc 0%, var(--paper-50) 60%)";

export default function JoinCoachingPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const complete = normalized.length === 8;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!CODE_RE.test(normalized)) {
      // Length is enforced by the input; anything left is a disallowed character
      // from the ambiguous set (0/O/1/I), which is worth calling out by name.
      setError(
        normalized.length < 8
          ? "Join codes are 8 characters long."
          : "That code contains characters we don't use. Check for 0/O and 1/I mix-ups.",
      );
      return;
    }
    // Hand off to the preview + confirm screen, which validates the code
    // against the backend and performs the actual join.
    router.push(`/join/${normalized}`);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: PAGE_BG,
        padding: "48px 24px",
      }}
    >
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
        }}
      >
        <p
          style={{
            margin: "0 0 10px",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--accent)",
          }}
        >
          Join a coaching
        </p>
        <h2 style={{ fontSize: 26, marginBottom: 8 }}>Enter your join code.</h2>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 14,
            color: "var(--text-muted)",
            margin: "0 0 26px",
            lineHeight: 1.6,
          }}
        >
          Your coaching institute shares an 8-character code. Entering it enrols you as a student
          so their batches, exams and results appear in your dashboard.
        </p>

        <form onSubmit={handleSubmit}>
          <label style={{ display: "block" }}>
            <span className="gv-label">Join code</span>
            <input
              type="text"
              required
              autoFocus
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))
              }
              placeholder="ABCD2345"
              maxLength={8}
              className="gv-input"
              style={{
                textAlign: "center",
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: 10,
                textIndent: 10,
                fontFamily: "var(--font-mono)",
                height: 62,
              }}
            />
          </label>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              margin: "8px 0 0",
              fontSize: 12,
              color: "var(--text-muted)",
            }}
          >
            <span>Letters and digits only — no 0, O, 1 or I.</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{normalized.length}/8</span>
          </div>

          {error && (
            <p
              style={{
                margin: "14px 0 0",
                padding: "10px 14px",
                background: "var(--danger-soft)",
                border: "1px solid rgba(244,63,94,0.35)",
                borderRadius: "var(--radius-md)",
                fontSize: 13,
                color: "var(--danger)",
              }}
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={!complete}
            style={{ width: "100%", marginTop: 20 }}
          >
            Continue
          </Button>
        </form>

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "22px 0" }}>
          <span style={{ flex: 1, height: 1, background: "var(--border-light)" }} />
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>or</span>
          <span style={{ flex: 1, height: 1, background: "var(--border-light)" }} />
        </div>

        <p style={{ textAlign: "center", fontSize: 13.5, color: "var(--text-body)", margin: 0, lineHeight: 1.6 }}>
          Got a full invite link instead? Just open it — it does this for you.
          <br />
          <Link href="/dashboard" style={{ color: "var(--accent)", fontWeight: 600 }}>
            Back to dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}

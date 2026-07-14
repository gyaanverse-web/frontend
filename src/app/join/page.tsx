"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

// Coaching join codes are 8 chars from an unambiguous alphabet (no 0/O/1/I),
// mirroring CODE_CHARS in the backend membership.service.ts.
const CODE_RE = /^[A-HJ-NP-Z2-9]{8}$/;

export default function JoinCoachingPage() {
  const router = useRouter();
  const [code, setCode]     = useState("");
  const [error, setError]   = useState("");

  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!CODE_RE.test(normalized)) {
      setError("Enter the 8-character join code your coaching gave you.");
      return;
    }
    // Hand off to the preview + confirm screen, which validates the code
    // against the backend and performs the actual join.
    router.push(`/join/${normalized}`);
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      <header style={{ background: "#1a2e4a", color: "#fff", padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontWeight: "bold", fontSize: "15px", letterSpacing: "0.5px" }}>GYANVERSE</span>
        <Link href="/dashboard" style={{ color: "#aac4e8", fontSize: "13px" }}>← Dashboard</Link>
      </header>

      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div style={{ background: "#fff", border: "1px solid #aaa", width: "100%", maxWidth: "400px" }}>

          <div style={{ background: "#1a2e4a", color: "#fff", padding: "5px 10px", fontSize: "12px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Join Coaching Institute
          </div>

          <div style={{ padding: "16px" }}>
            <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#555" }}>
              Enter the join code your coaching owner shared with you.
            </p>
            <form onSubmit={handleSubmit}>
              <input
                type="text"
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
                placeholder="ABC12345"
                maxLength={8}
                style={{ width: "100%", border: "1px solid #666", padding: "8px 10px", background: "#fff", color: "#111", fontFamily: "monospace", fontSize: "20px", fontWeight: "bold", letterSpacing: "4px", textAlign: "center", textTransform: "uppercase" }}
              />
              <span style={{ display: "block", marginTop: "4px", fontSize: "11px", color: "#555" }}>
                Have a full invite link instead? Just open it in your browser.
              </span>

              {error && (
                <p style={{ margin: "8px 0 0 0", color: "#c00", fontSize: "13px", border: "1px solid #c00", padding: "4px 8px", background: "#fff5f5" }}>
                  {error}
                </p>
              )}

              <div style={{ marginTop: "14px", display: "flex", gap: "8px" }}>
                <button
                  type="submit"
                  style={{ background: "#1a4db8", color: "#fff", border: "1px solid #1a4db8", padding: "5px 20px", fontWeight: "bold", cursor: "pointer" }}
                >
                  Continue
                </button>
                <Link
                  href="/dashboard"
                  style={{ background: "#fff", color: "#444", border: "1px solid #aaa", padding: "5px 16px", textDecoration: "none", fontSize: "13px" }}
                >
                  Cancel
                </Link>
              </div>
            </form>
          </div>
        </div>
      </main>

      <footer style={{ background: "#ddd", borderTop: "1px solid #aaa", padding: "6px 16px", fontSize: "12px", color: "#333" }}>
        &copy; {new Date().getFullYear()} Gyanverse &mdash; All rights reserved
      </footer>
    </div>
  );
}

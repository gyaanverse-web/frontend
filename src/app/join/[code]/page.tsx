"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { postAuthRedirect } from "@/lib/tenantUrl";

type CoachingPreview = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
};

export default function JoinByCodePage() {
  const router = useRouter();
  const params = useParams();
  const code = ((params?.code as string) ?? "").toUpperCase();

  const [preview, setPreview]     = useState<CoachingPreview | null>(null);
  const [previewErr, setPreviewErr] = useState("");
  const [loggedIn, setLoggedIn]   = useState<boolean | null>(null);
  const [joining, setJoining]     = useState(false);
  const [joinErr, setJoinErr]     = useState("");
  const [joined, setJoined]       = useState(false);

  useEffect(() => {
    if (!code) return;
    Promise.allSettled([
      api.get<{ tenant: CoachingPreview }>(`/join/${code}`),
      api.get<{ user: unknown }>("/api/auth/get-session"),
    ]).then(([pr, sr]) => {
      if (pr.status === "fulfilled") {
        setPreview(pr.value.tenant);
      } else {
        setPreviewErr(pr.reason instanceof Error ? pr.reason.message : "Invalid or expired code");
      }
      setLoggedIn(sr.status === "fulfilled" && (sr.value as any)?.user != null);
    });
  }, [code]);

  async function handleJoin() {
    setJoinErr(""); setJoining(true);
    try {
      await api.post(`/join/${code}`, {});
      setJoined(true);
      setTimeout(() => { void postAuthRedirect(router); }, 1500);
    } catch (err) {
      setJoinErr(err instanceof Error ? err.message : "Failed to join");
    } finally {
      setJoining(false);
    }
  }

  const isLoading = preview === null && !previewErr && loggedIn === null;

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
            {isLoading && (
              <p style={{ fontSize: "13px", color: "#555", margin: 0 }}>Loading…</p>
            )}

            {previewErr && (
              <div>
                <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#c00", border: "1px solid #c00", padding: "8px", background: "#fff5f5" }}>
                  {previewErr}
                </p>
                <Link href="/dashboard" style={{ fontSize: "13px", color: "#1a4db8" }}>← Back to Dashboard</Link>
              </div>
            )}

            {preview && !previewErr && (
              <>
                {preview.logoUrl && (
                  <div style={{ textAlign: "center", marginBottom: "12px" }}>
                    <img src={preview.logoUrl} alt="Logo" style={{ maxHeight: "64px", maxWidth: "200px", objectFit: "contain" }} />
                  </div>
                )}

                <p style={{ margin: "0 0 4px", fontSize: "12px", color: "#555", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                  You&apos;ve been invited to join
                </p>
                <p style={{ margin: "0 0 12px", fontSize: "18px", fontWeight: "bold", color: "#1a2e4a" }}>
                  {preview.name}
                </p>
                <p style={{ margin: "0 0 16px", fontSize: "12px", color: "#666" }}>
                  Code:{" "}
                  <span style={{ fontFamily: "monospace", fontWeight: "bold", letterSpacing: "2px", color: "#1a2e4a" }}>
                    {code}
                  </span>
                </p>

                {joined ? (
                  <p style={{ margin: 0, fontSize: "13px", color: "#166534", background: "#dcfce7", border: "1px solid #86efac", padding: "10px" }}>
                    Joined successfully! Redirecting to dashboard…
                  </p>
                ) : loggedIn === false ? (
                  <div>
                    <p style={{ margin: "0 0 10px", fontSize: "13px", color: "#555" }}>
                      You need to be logged in to join.
                    </p>
                    <Link
                      href={`/login?next=/join/${code}`}
                      style={{ display: "inline-block", background: "#1a4db8", color: "#fff", border: "1px solid #1a4db8", padding: "6px 20px", fontWeight: "bold", textDecoration: "none", fontSize: "13px" }}
                    >
                      Log in to Join
                    </Link>
                  </div>
                ) : loggedIn === true ? (
                  <div>
                    {joinErr && (
                      <p style={{ margin: "0 0 10px", fontSize: "13px", color: "#c00", border: "1px solid #c00", padding: "6px 8px", background: "#fff5f5" }}>
                        {joinErr}
                      </p>
                    )}
                    <button
                      onClick={handleJoin}
                      disabled={joining}
                      style={{ background: "#1a4db8", color: "#fff", border: "1px solid #1a4db8", padding: "6px 20px", fontWeight: "bold", cursor: joining ? "not-allowed" : "pointer", fontSize: "13px", opacity: joining ? 0.6 : 1 }}
                    >
                      {joining ? "Joining…" : `Join ${preview.name}`}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </main>

      <footer style={{ background: "#ddd", borderTop: "1px solid #aaa", padding: "6px 16px", fontSize: "12px", color: "#333" }}>
        &copy; {new Date().getFullYear()} Gyanverse &mdash; All rights reserved
      </footer>
    </div>
  );
}

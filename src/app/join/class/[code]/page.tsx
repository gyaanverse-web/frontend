"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { getSession, invalidateSession } from "@/lib/sessionStore";
import { postAuthRedirect } from "@/lib/tenantUrl";
import { Logo, Button } from "@/components/ui";

// Mirrors the coaching-join screen at /join/[code].
const PAGE_BG =
  "radial-gradient(ellipse 70% 50% at 50% 0%, #eef0fc 0%, var(--paper-50) 60%)";

type ClassPreview = {
  id: string;
  name: string;
  grade: string | null;
  autoApprove: boolean;
};

/**
 * Redeem a *class* (batch) join code shared as a link. This is distinct from
 * the coaching join page at /join/[code]:
 *   - /join/[code]        → coaching_join_codes  (join the institute)
 *   - /join/class/[code]  → join_codes           (join one batch)
 *
 * Both live under /join rather than in a role area: the person clicking one is
 * not yet in either area, and the link is shared out-of-band.
 *
 * The backend class-join routes derive tenant + class from the code itself
 * (auth only, no tenant middleware), so this page works on any host. The one
 * hard requirement is that the student already be a member of the coaching —
 * the API returns NOT_A_MEMBER (403) otherwise, which we surface with a link
 * to the coaching-join step.
 */
export default function JoinClassByCodePage() {
  const router = useRouter();
  const params = useParams();
  const code = ((params?.code as string) ?? "").toUpperCase();

  const [preview, setPreview]     = useState<ClassPreview | null>(null);
  const [previewErr, setPreviewErr] = useState("");
  const [loggedIn, setLoggedIn]   = useState<boolean | null>(null);
  const [joining, setJoining]     = useState(false);
  const [joinErr, setJoinErr]     = useState("");
  const [notMember, setNotMember] = useState(false);
  const [joinedMsg, setJoinedMsg] = useState("");

  useEffect(() => {
    if (!code) return;
    Promise.allSettled([
      api.get<{ class: ClassPreview }>(`/tenant/classes/join/${code}`),
      getSession(),
    ]).then(([pr, sr]) => {
      if (pr.status === "fulfilled") {
        setPreview(pr.value.class);
      } else {
        setPreviewErr(pr.reason instanceof Error ? pr.reason.message : "Invalid or expired code");
      }
      setLoggedIn(sr.status === "fulfilled" && (sr.value as { user?: unknown })?.user != null);
    });
  }, [code]);

  async function handleJoin() {
    setJoinErr(""); setNotMember(false); setJoining(true);
    try {
      const res = await api.post<{ message?: string; status?: string }>(`/tenant/classes/join/${code}`, {});
      invalidateSession();
      setJoinedMsg(res.message ?? "Joined successfully!");
      // Joining by code is a student action, so land them on their own classes
      // screen — the old target was the staff dashboard's batches section.
      setTimeout(() => { void postAuthRedirect(router, { fallbackPath: "/student/classes" }); }, 1500);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        // NOT_A_MEMBER — student hasn't joined the coaching yet.
        setNotMember(true);
      } else {
        setJoinErr(err instanceof Error ? err.message : "Failed to join class");
      }
    } finally {
      setJoining(false);
    }
  }

  const isLoading = preview === null && !previewErr && loggedIn === null;

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
          maxWidth: 460,
        }}
      >
        {isLoading && (
          <p style={{ fontSize: 14, color: "var(--text-muted)", margin: 0 }}>Loading…</p>
        )}

        {previewErr && (
          <div>
            <p
              style={{
                margin: "0 0 20px",
                padding: "10px 14px",
                background: "var(--danger-soft)",
                border: "1px solid rgba(244,63,94,0.35)",
                borderRadius: "var(--radius-md)",
                fontSize: 13,
                color: "var(--danger)",
              }}
            >
              {previewErr}
            </p>
            <Link href="/coaching/dashboard" className="gv-btn gv-btn--secondary gv-btn--sm" style={{ gap: 6 }}>
              <span aria-hidden="true">←</span>
              <span>Back to Dashboard</span>
            </Link>
          </div>
        )}

        {preview && !previewErr && (
          <>
            <p
              style={{
                margin: "0 0 8px",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-accent)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              You&apos;ve been invited to join the class
            </p>
            <h1 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 700, color: "var(--text-heading)" }}>
              {preview.name}
            </h1>
            {preview.grade && (
              <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--text-muted)" }}>
                Grade {preview.grade}
              </p>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Code</span>
              <span
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  fontWeight: 700,
                  letterSpacing: "0.18em",
                  fontSize: 15,
                  color: "var(--text-heading)",
                  background: "var(--surface-inset)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-sm)",
                  padding: "4px 10px",
                }}
              >
                {code}
              </span>
            </div>

            {!preview.autoApprove && (
              <p
                style={{
                  margin: "0 0 20px",
                  padding: "10px 14px",
                  background: "var(--warning-soft)",
                  border: "1px solid var(--warning)",
                  borderRadius: "var(--radius-md)",
                  fontSize: 13,
                  color: "var(--text-body)",
                }}
              >
                This class needs teacher approval — your request will be reviewed after you join.
              </p>
            )}

            {joinedMsg ? (
              <p
                style={{
                  margin: 0,
                  padding: "10px 14px",
                  background: "var(--success-soft)",
                  border: "1px solid rgba(34,197,94,0.35)",
                  borderRadius: "var(--radius-md)",
                  fontSize: 13,
                  color: "var(--success)",
                }}
              >
                {joinedMsg} Redirecting…
              </p>
            ) : notMember ? (
              <div>
                <p
                  style={{
                    margin: "0 0 16px",
                    padding: "10px 14px",
                    background: "var(--warning-soft)",
                    border: "1px solid var(--warning)",
                    borderRadius: "var(--radius-md)",
                    fontSize: 13,
                    color: "var(--text-body)",
                  }}
                >
                  You need to join the coaching institute before enrolling in one of its classes. Ask your coaching owner for the institute join code, then come back to this link.
                </p>
                <Link href="/join" className="gv-btn gv-btn--app gv-btn--md">
                  Enter coaching code
                </Link>
              </div>
            ) : loggedIn === false ? (
              <div>
                <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--text-body)" }}>
                  You need to be logged in to join.
                </p>
                <Link href={`/login?next=/join/class/${code}`} className="gv-btn gv-btn--app gv-btn--md">
                  Log in to Join
                </Link>
              </div>
            ) : loggedIn === true ? (
              <div>
                {joinErr && (
                  <p
                    style={{
                      margin: "0 0 16px",
                      padding: "10px 14px",
                      background: "var(--danger-soft)",
                      border: "1px solid rgba(244,63,94,0.35)",
                      borderRadius: "var(--radius-md)",
                      fontSize: 13,
                      color: "var(--danger)",
                    }}
                  >
                    {joinErr}
                  </p>
                )}
                <Button variant="app" onClick={handleJoin} disabled={joining}>
                  {joining ? "Joining…" : `Join ${preview.name}`}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { getSession, invalidateSession } from "@/lib/sessionStore";
import { postAuthRedirect } from "@/lib/tenantUrl";
import { Logo, Button, Badge } from "@/components/ui";

type CoachingPreview = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
};

type SessionUser = { id: string; name: string; email: string };

const PAGE_BG =
  "radial-gradient(ellipse 70% 50% at 50% 0%, #eef0fc 0%, var(--paper-50) 60%)";

// ── Presentational helpers (mirrors /accept-invite) ───────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
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
        {children}
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: PAGE_BG,
        fontSize: 14,
        color: "var(--text-muted)",
      }}
    >
      {children}
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

function StatusMark({ tone, glyph }: { tone: "success" | "danger"; glyph: string }) {
  const success = tone === "success";
  return (
    <div
      aria-hidden="true"
      style={{
        width: 52,
        height: 52,
        borderRadius: "50%",
        background: success ? "var(--success-soft)" : "var(--danger-soft)",
        color: success ? "var(--success)" : "var(--danger)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 24,
        marginBottom: 20,
      }}
    >
      {glyph}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function JoinByCodePage() {
  const router = useRouter();
  const params = useParams();
  const code = ((params?.code as string) ?? "").toUpperCase();

  // Seeded from the code rather than set inside the effect: with no code there
  // is nothing to fetch, so the page is never in a loading state to begin with.
  const [loading, setLoading] = useState(Boolean(code));
  const [preview, setPreview] = useState<CoachingPreview | null>(null);
  const [previewErr, setPreviewErr] = useState("");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [joining, setJoining] = useState(false);
  const [joinErr, setJoinErr] = useState("");
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (!code) return;
    // The code preview is public; the session check is best-effort. Better Auth
    // answers 200 { user: null } when signed out, so an empty body is not an error.
    Promise.all([
      api
        .get<{ tenant: CoachingPreview }>(`/join/${encodeURIComponent(code)}`)
        .then((r) => ({ ok: true as const, tenant: r.tenant }))
        .catch((e: unknown) => ({
          ok: false as const,
          message: e instanceof Error ? e.message : "This code is invalid or has expired.",
        })),
      getSession()
        .then((r) => (r?.user as SessionUser | null) ?? null)
        .catch(() => null),
    ])
      .then(([p, sessionUser]) => {
        if (p.ok) setPreview(p.tenant);
        else setPreviewErr(p.message);
        setUser(sessionUser);
      })
      .finally(() => setLoading(false));
  }, [code]);

  async function handleJoin() {
    setJoinErr("");
    setJoining(true);
    try {
      await api.post(`/join/${code}`, {});
      // They now belong to a coaching. postAuthRedirect below reads `/tenants/me`
      // to pick a destination, and the cached answer from this page's load is the
      // 404 that says they belong to none — which would send them to the
      // "create or join a coaching" screen they just came from.
      invalidateSession();
      setJoined(true);
      setTimeout(() => void postAuthRedirect(router), 1800);
    } catch (err) {
      setJoinErr(err instanceof Error ? err.message : "Failed to join");
    } finally {
      setJoining(false);
    }
  }

  // `next` must be encoded so the code survives the round-trip through /login.
  const loginUrl = `/login?next=${encodeURIComponent(`/join/${code}`)}`;
  const signupUrl = `/signup?next=${encodeURIComponent(`/join/${code}`)}`;

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <Centered>Checking this code…</Centered>;

  if (joined) {
    return (
      <Shell>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <StatusMark tone="success" glyph="✓" />
          <h2 style={{ fontSize: 24, marginBottom: 8 }}>You&apos;re in.</h2>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--text-muted)", margin: 0 }}>
            You joined {preview?.name ?? "the coaching"}. Taking you to your dashboard…
          </p>
        </div>
      </Shell>
    );
  }

  if (previewErr || !preview) {
    return (
      <Shell>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <StatusMark tone="danger" glyph="!" />
          <h2 style={{ fontSize: 24, marginBottom: 10 }}>This code didn&apos;t work</h2>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 14,
              color: "var(--text-muted)",
              margin: "0 0 6px",
              lineHeight: 1.6,
            }}
          >
            {previewErr || "We couldn't find a coaching for this code."}
          </p>
          <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 24px" }}>
            Code entered:{" "}
            <strong style={{ fontFamily: "var(--font-mono)", letterSpacing: 2, color: "var(--text-body)" }}>
              {code}
            </strong>
          </p>
          <Link href="/join" className="gv-btn gv-btn--primary gv-btn--lg">
            <span>Try another code</span>
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {preview.logoUrl && (
        <div style={{ marginBottom: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview.logoUrl}
            alt=""
            style={{ maxHeight: 52, maxWidth: 180, objectFit: "contain" }}
          />
        </div>
      )}

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
      <h2 style={{ fontSize: 26, lineHeight: 1.25, marginBottom: 10 }}>Join {preview.name}</h2>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 14,
          color: "var(--text-muted)",
          margin: "0 0 20px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <span>You&apos;ll be enrolled as a</span>
        <Badge role="student" />
      </p>

      <div
        style={{
          background: "var(--paper-100)",
          border: "1px solid var(--border-light)",
          borderRadius: "var(--radius-md)",
          padding: "12px 14px",
          marginBottom: 22,
          fontSize: 13,
          color: "var(--text-body)",
        }}
      >
        Using code{" "}
        <strong style={{ fontFamily: "var(--font-mono)", letterSpacing: 2 }}>{code}</strong>
      </div>

      {user ? (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 14px",
              border: "1px solid var(--border-light)",
              borderRadius: "var(--radius-md)",
              marginBottom: 20,
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-heading)" }}>{user.name}</div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-muted)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {user.email}
              </div>
            </div>
          </div>

          {joinErr && (
            <div style={{ marginBottom: 18 }}>
              <ErrorNote>{joinErr}</ErrorNote>
            </div>
          )}

          <Button size="lg" disabled={joining} onClick={handleJoin} style={{ width: "100%" }}>
            {joining ? "Joining…" : `Join ${preview.name}`}
          </Button>

          <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-muted)", margin: "16px 0 0" }}>
            <Link href="/coaching/dashboard" style={{ color: "var(--text-muted)" }}>
              Not now
            </Link>
          </p>
        </>
      ) : (
        <>
          <p style={{ fontSize: 14, color: "var(--text-body)", margin: "0 0 20px", lineHeight: 1.6 }}>
            Sign in to join — or create an account if you&apos;re new to Gyanverse. We&apos;ll bring
            you straight back here.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Link href={loginUrl} className="gv-btn gv-btn--primary gv-btn--lg" style={{ width: "100%" }}>
              <span>Sign in &amp; join</span>
            </Link>
            <Link href={signupUrl} className="gv-btn gv-btn--secondary gv-btn--lg" style={{ width: "100%" }}>
              <span>Create an account</span>
            </Link>
          </div>
        </>
      )}
    </Shell>
  );
}

"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { getSession, invalidateSession } from "@/lib/sessionStore";
import { postAuthRedirect } from "@/lib/tenantUrl";
import { Logo, Button, Badge } from "@/components/ui";

type SessionUser = { id: string; name: string; email: string; role: string };

type InviteState = "pending" | "accepted" | "revoked" | "expired" | "not_found";

type InvitePreview = {
  state: InviteState;
  coachingName: string | null;
  coachingSlug: string | null;
  role: string | null;
  contactType: "email" | "phone" | null;
  contactMasked: string | null;
  expiresAt: string | null;
};

const PAGE_BG =
  "radial-gradient(ellipse 70% 50% at 50% 0%, #eef0fc 0%, var(--paper-50) 60%)";

// ── Small presentational helpers ──────────────────────────────────────────────

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

/**
 * A link styled as a DS pill button. Reuses the .gv-btn classes rather than
 * wrapping <Button> in <Link>, which would nest a <button> inside an <a>.
 */
function LinkButton({
  href,
  children,
  variant = "primary",
  block = false,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  block?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`gv-btn gv-btn--${variant} gv-btn--lg`}
      style={block ? { width: "100%", justifyContent: "center" } : undefined}
    >
      <span>{children}</span>
    </Link>
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

/** Big status icon used by the terminal states (expired / revoked / invalid / done). */
function StatusMark({ tone, glyph }: { tone: "success" | "danger" | "muted"; glyph: string }) {
  const bg =
    tone === "success" ? "var(--success-soft)"
    : tone === "danger" ? "var(--danger-soft)"
    : "var(--paper-100)";
  const color =
    tone === "success" ? "var(--success)"
    : tone === "danger" ? "var(--danger)"
    : "var(--text-muted)";
  return (
    <div
      aria-hidden="true"
      style={{
        width: 52,
        height: 52,
        borderRadius: "50%",
        background: bg,
        color,
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

/** Header block naming the coaching the invite is for. */
function InviteHeader({ preview }: { preview: InvitePreview }) {
  return (
    <>
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
        Invitation
      </p>
      <h2 style={{ fontSize: 26, lineHeight: 1.25, marginBottom: 10 }}>
        Join {preview.coachingName}
      </h2>
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
        <span>You&apos;ve been invited as a</span>
        <Badge role="teacher" />
      </p>
    </>
  );
}

/** "Sent to ra••••@gmail.com" row + expiry. */
function InviteMeta({ preview }: { preview: InvitePreview }) {
  const expires = preview.expiresAt ? new Date(preview.expiresAt) : null;
  return (
    <div
      style={{
        background: "var(--paper-100)",
        border: "1px solid var(--border-light)",
        borderRadius: "var(--radius-md)",
        padding: "12px 14px",
        marginBottom: 22,
        fontSize: 13,
        color: "var(--text-body)",
        lineHeight: 1.6,
      }}
    >
      <div>
        Sent to <strong>{preview.contactMasked}</strong>
      </div>
      {expires && (
        <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
          Expires{" "}
          {expires.toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </div>
      )}
    </div>
  );
}

// ── Main content ──────────────────────────────────────────────────────────────

function AcceptInviteContent() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  // Seeded from the token rather than set inside the effect: with no token there
  // is nothing to fetch, so the page is never in a loading state to begin with.
  const [loading, setLoading] = useState(Boolean(token));
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [done, setDone] = useState(false);

  // Logged-in accept flow
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState("");

  // Phone OTP flow (only reachable for contactType === "phone")
  const [phoneStep, setPhoneStep] = useState<"number" | "otp">("number");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [phoneSending, setPhoneSending] = useState(false);
  const [phoneVerifying, setPhoneVerifying] = useState(false);
  const [phoneError, setPhoneError] = useState("");

  // ── Load invite + session together ─────────────────────────────────────────

  useEffect(() => {
    if (!token) return;
    // The invite preview is public; the session check is best-effort. Better Auth
    // answers 200 { user: null } when signed out, so an empty body is not an error.
    Promise.all([
      api
        .get<InvitePreview>(`/invites/${encodeURIComponent(token)}`)
        .catch(() => null),
      getSession()
        .then((res) => (res?.user as SessionUser | null) ?? null)
        .catch(() => null),
    ])
      .then(([inv, sessionUser]) => {
        setPreview(inv);
        setUser(sessionUser);
      })
      .finally(() => setLoading(false));
  }, [token]);

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleAccept() {
    setAcceptError("");
    setAccepting(true);
    try {
      await api.post<unknown>("/invites/accept", { token });
      // The membership this page cached — usually a 404 for "no coaching" — is
      // now wrong, and postAuthRedirect is about to read it.
      invalidateSession();
      setDone(true);
      setTimeout(() => void postAuthRedirect(router), 2000);
    } catch (err) {
      setAcceptError(err instanceof Error ? err.message : "Failed to accept invite");
    } finally {
      setAccepting(false);
    }
  }

  async function handleSignOut() {
    try {
      await api.post("/api/auth/sign-out", {});
    } catch {
      /* ignore — we only care that the local session is gone */
    }
    invalidateSession();
    setUser(null);
    setAcceptError("");
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

  async function handleVerifyAndAccept(e: React.FormEvent) {
    e.preventDefault();
    setPhoneError("");
    setPhoneVerifying(true);
    try {
      // Verifying creates the account if new, signs in if existing, and sets the
      // session cookie — so the invite can be accepted in the same submit.
      await api.post<unknown>("/api/auth/phone-number/verify", { phoneNumber: phone, code: otp });
      await api.post<unknown>("/invites/accept", { token });
      // Both halves of the cache are stale now: a new account signed in, and it
      // gained a coaching.
      invalidateSession();
      setDone(true);
      setTimeout(() => void postAuthRedirect(router), 2000);
    } catch (err) {
      setPhoneError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setPhoneVerifying(false);
    }
  }

  // ── Round-trip URLs ────────────────────────────────────────────────────────
  // `next` must be encoded — an unescaped nested "?" would split into a second
  // query param of /login and the token would be lost on the way back.

  const backHere = `/accept-invite?token=${token}`;
  const loginUrl = `/login?next=${encodeURIComponent(backHere)}`;
  const signupUrl = `/signup?next=${encodeURIComponent(backHere)}`;

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <Centered>Checking your invitation…</Centered>;

  // Success — shared by both the signed-in and the OTP paths
  if (done) {
    return (
      <Shell>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <StatusMark tone="success" glyph="✓" />
          <h2 style={{ fontSize: 24, marginBottom: 8 }}>You&apos;re in.</h2>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--text-muted)", margin: 0 }}>
            You joined {preview?.coachingName ?? "the coaching"} as a teacher. Taking you to your
            dashboard…
          </p>
        </div>
      </Shell>
    );
  }

  // Bad or unusable link — one screen per terminal state
  const terminal: Partial<Record<InviteState, { title: string; body: string; glyph: string; tone: "danger" | "muted" }>> = {
    not_found: {
      title: "This link isn't valid",
      body: "We couldn't find an invitation for this link. Make sure you copied the whole URL from your email, or ask the coaching to send a new invite.",
      glyph: "!",
      tone: "danger",
    },
    expired: {
      title: "This invitation expired",
      body: `Invitations are valid for 48 hours. Ask ${preview?.coachingName ?? "the coaching"} to send you a new one.`,
      glyph: "⏱",
      tone: "muted",
    },
    revoked: {
      title: "This invitation was cancelled",
      body: `${preview?.coachingName ?? "The coaching"} withdrew this invitation. Get in touch with them if you think that's a mistake.`,
      glyph: "✕",
      tone: "muted",
    },
    accepted: {
      title: "Already accepted",
      body: `This invitation has already been used to join ${preview?.coachingName ?? "the coaching"}. Sign in to get to your dashboard.`,
      glyph: "✓",
      tone: "muted",
    },
  };

  const state: InviteState = !token || !preview ? "not_found" : preview.state;
  const terminalCopy = terminal[state];

  if (terminalCopy) {
    return (
      <Shell>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          <StatusMark tone={terminalCopy.tone} glyph={terminalCopy.glyph} />
          <h2 style={{ fontSize: 24, marginBottom: 10 }}>{terminalCopy.title}</h2>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 14,
              color: "var(--text-muted)",
              margin: "0 0 24px",
              lineHeight: 1.6,
            }}
          >
            {terminalCopy.body}
          </p>
          <LinkButton href={state === "accepted" ? loginUrl : "/login"}>
            {state === "accepted" ? "Sign in" : "Go to sign in"}
          </LinkButton>
        </div>
      </Shell>
    );
  }

  // ── Pending invite ─────────────────────────────────────────────────────────

  const contactType = preview!.contactType ?? "email";

  // Signed in already — one click to accept.
  if (user) {
    // The API rejects a session whose contact doesn't match the invite. Surface
    // that as an actionable "switch account" step rather than a bare error.
    const mismatch = acceptError.toLowerCase().includes("not issued to your account");
    return (
      <Shell>
        <InviteHeader preview={preview!} />
        <InviteMeta preview={preview!} />

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
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-heading)" }}>
              {user.name}
            </div>
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
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            Not you?
          </Button>
        </div>

        {acceptError && (
          <div style={{ marginBottom: 18 }}>
            <ErrorNote>
              {mismatch
                ? `This invitation was sent to ${preview!.contactMasked}, which isn't the account you're signed in as. Sign out and sign back in with that ${contactType === "email" ? "email" : "number"}.`
                : acceptError}
            </ErrorNote>
          </div>
        )}

        <Button
          size="lg"
          disabled={accepting}
          onClick={handleAccept}
          style={{ width: "100%" }}
        >
          {accepting ? "Joining…" : "Accept invitation"}
        </Button>

        <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-muted)", margin: "16px 0 0" }}>
          <Link href="/coaching/dashboard" style={{ color: "var(--text-muted)" }}>
            Not now
          </Link>
        </p>
      </Shell>
    );
  }

  // Signed out, email invite — send them through the normal auth pages and back.
  if (contactType === "email") {
    return (
      <Shell>
        <InviteHeader preview={preview!} />
        <InviteMeta preview={preview!} />

        <p style={{ fontSize: 14, color: "var(--text-body)", margin: "0 0 20px", lineHeight: 1.6 }}>
          Sign in with that email to accept — or create an account with it if you&apos;re new to
          Gyaanverse. We&apos;ll bring you straight back here.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <LinkButton href={loginUrl} block>
            Sign in &amp; accept
          </LinkButton>
          <LinkButton href={signupUrl} variant="secondary" block>
            Create an account
          </LinkButton>
        </div>

        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "18px 0 0", lineHeight: 1.6 }}>
          Use the exact email this invite was sent to — invitations are tied to that address.
        </p>
      </Shell>
    );
  }

  // Signed out, phone invite — verify the number by OTP and accept in one step.
  return (
    <Shell>
      <InviteHeader preview={preview!} />
      <InviteMeta preview={preview!} />

      {phoneStep === "number" && (
        <form onSubmit={handleSendOtp} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <label style={{ display: "block" }}>
            <span className="gv-label">Your mobile number</span>
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
            {phoneSending ? "Sending…" : "Send code"}
          </Button>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, lineHeight: 1.6 }}>
            Enter the number ending in {preview!.contactMasked?.slice(-4)} — the invitation is tied
            to it.
          </p>
          {/* Local-only hint — inline NODE_ENV so it is dead-coded out of
              deployed builds, where the OTP really is sent via SMS. */}
          {process.env.NODE_ENV !== "production" && (
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
              Local dev: the OTP is printed to the backend console instead of being sent via SMS.
            </p>
          )}
        </form>
      )}

      {phoneStep === "otp" && (
        <form
          onSubmit={handleVerifyAndAccept}
          style={{ display: "flex", flexDirection: "column", gap: 18 }}
        >
          <div
            style={{
              padding: "10px 14px",
              background: "var(--success-soft)",
              border: "1px solid rgba(16,185,129,0.35)",
              borderRadius: "var(--radius-md)",
              fontSize: 13,
              color: "#0f7a5a",
            }}
          >
            Code sent to <strong>{phone}</strong>.
          </div>
          <label style={{ display: "block" }}>
            <span className="gv-label">Enter 6-digit code</span>
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
              {phoneVerifying ? "Joining…" : "Verify & accept"}
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
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>
            Code expires in 10 minutes. Verifying creates your account if you don&apos;t have one
            yet.
          </p>
        </form>
      )}
    </Shell>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<Centered>Loading…</Centered>}>
      <AcceptInviteContent />
    </Suspense>
  );
}

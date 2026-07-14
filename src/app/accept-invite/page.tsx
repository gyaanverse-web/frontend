"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { postAuthRedirect } from "@/lib/tenantUrl";
import {
  btnPrimary as btnP,
  btnSecondary as btnS,
  errorBox,
  inputBase as inp,
  linkButtonBase,
  sectionHeader as sh,
} from "@/lib/uiStyles";

type SessionUser = { id: string; name: string; email: string; role: string };
type AuthMethod = "email" | "phone";

// ── Shared styles ─────────────────────────────────────────────────────────────

const note: React.CSSProperties = {
  margin: "14px 0 0", fontSize: "11px", color: "#888",
  borderLeft: "3px solid #ddd", paddingLeft: "8px",
};

// ── Main content ──────────────────────────────────────────────────────────────

function AcceptInviteContent() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  // Session state
  const [checking, setChecking]   = useState(true);
  const [user, setUser]           = useState<SessionUser | null>(null);
  const [done, setDone]           = useState(false);

  // Logged-in accept flow
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState("");

  // Auth method picker (email / phone) — only shown when not logged in
  const [authMethod, setAuthMethod] = useState<AuthMethod | null>(null);

  // Phone OTP flow
  const [phoneStep, setPhoneStep]     = useState<"number" | "otp">("number");
  const [phone, setPhone]             = useState("");
  const [otp, setOtp]                 = useState("");
  const [phoneSending, setPhoneSending]   = useState(false);
  const [phoneVerifying, setPhoneVerifying] = useState(false);
  const [phoneError, setPhoneError]   = useState("");

  // ── Check session on mount ─────────────────────────────────────────────────

  useEffect(() => {
    if (!token) { setChecking(false); return; }
    api.get<{ user: SessionUser }>("/api/auth/get-session")
      .then(data => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, [token]);

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleAccept() {
    setAcceptError(""); setAccepting(true);
    try {
      await api.post<unknown>("/invites/accept", { token });
      setDone(true);
      setTimeout(() => { void postAuthRedirect(router); }, 2500);
    } catch (err) {
      setAcceptError(err instanceof Error ? err.message : "Failed to accept invite");
    } finally {
      setAccepting(false);
    }
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setPhoneError(""); setPhoneSending(true);
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
    setPhoneError(""); setPhoneVerifying(true);
    try {
      // Verify OTP — creates account if new, signs in if existing, sets session cookie
      await api.post<unknown>("/api/auth/phone-number/verify", { phoneNumber: phone, code: otp });
      // Session cookie is now set — accept the invite
      await api.post<unknown>("/invites/accept", { token });
      setDone(true);
      setTimeout(() => { void postAuthRedirect(router); }, 2500);
    } catch (err) {
      setPhoneError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setPhoneVerifying(false);
    }
  }

  // ── URL helpers ───────────────────────────────────────────────────────────

  const loginUrl  = `/login?next=/accept-invite?token=${token}`;
  const signupUrl = `/signup?next=/accept-invite?token=${token}`;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      <header style={{ background: "#1a2e4a", color: "#fff", padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontWeight: "bold", fontSize: "15px", letterSpacing: "0.5px" }}>GYANVERSE</span>
        <span style={{ fontSize: "12px", color: "#aac4e8" }}>Coaching Institute Management</span>
      </header>

      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div style={{ background: "#fff", border: "1px solid #aaa", width: "100%", maxWidth: "440px" }}>

          <div style={sh}>Teacher Invitation</div>

          <div style={{ padding: "20px" }}>

            {/* Invalid link */}
            {!token && (
              <p style={{ margin: 0, fontSize: "13px", color: "#c00" }}>
                Invalid invite link — no token found. Make sure you copied the full URL.
              </p>
            )}

            {/* Checking session */}
            {token && checking && (
              <p style={{ margin: 0, fontSize: "13px", color: "#555" }}>Checking invite…</p>
            )}

            {/* Success */}
            {done && (
              <div style={{ textAlign: "center", padding: "8px 0" }}>
                <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: "bold", color: "#166534" }}>
                  You joined the coaching as a teacher!
                </p>
                <p style={{ margin: 0, fontSize: "13px", color: "#555" }}>Redirecting to dashboard…</p>
              </div>
            )}

            {/* ── Already logged in ─────────────────────────────────────────── */}
            {token && !checking && !done && user && (
              <>
                <p style={{ margin: "0 0 14px", fontSize: "13px", color: "#333" }}>
                  Signed in as <strong>{user.name}</strong> ({user.email}).
                  Click below to accept the teacher invite and join the coaching institute.
                </p>
                {acceptError && <div style={{ ...errorBox, marginTop: "8px", padding: "6px 10px", border: "1px solid #fca5a5" }}>{acceptError}</div>}
                <div style={{ marginTop: acceptError ? "10px" : 0, display: "flex", gap: "10px", alignItems: "center" }}>
                  <button onClick={handleAccept} disabled={accepting} style={{ ...btnP, padding: "6px 20px", opacity: accepting ? 0.6 : 1 }}>
                    {accepting ? "Accepting…" : "Accept Invite"}
                  </button>
                  <Link href="/dashboard" style={{ fontSize: "13px", color: "#555" }}>Cancel</Link>
                </div>
                <p style={note}>
                  Make sure this account&apos;s email or phone matches the invite. If not, sign out and use the correct account.
                </p>
              </>
            )}

            {/* ── Not logged in — choose path ───────────────────────────────── */}
            {token && !checking && !done && !user && authMethod === null && (
              <>
                <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#333" }}>
                  You have been invited to join a coaching institute as a teacher.
                  How did you receive this invite?
                </p>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button onClick={() => setAuthMethod("email")} style={{ ...btnP, padding: "6px 20px", flex: 1 }}>
                    Via Email
                  </button>
                  <button onClick={() => setAuthMethod("phone")} style={{ ...btnS, padding: "6px 16px", flex: 1 }}>
                    Via Phone / SMS
                  </button>
                </div>
              </>
            )}

            {/* ── Email path ────────────────────────────────────────────────── */}
            {token && !checking && !done && !user && authMethod === "email" && (
              <>
                <p style={{ margin: "0 0 6px", fontSize: "12px", color: "#888" }}>
                  <button onClick={() => setAuthMethod(null)} style={{ background: "none", border: "none", color: "#1a4db8", cursor: "pointer", padding: 0, fontSize: "12px" }}>
                    ← Back
                  </button>
                </p>
                <p style={{ margin: "0 0 14px", fontSize: "13px", color: "#333" }}>
                  Sign in with the email address this invite was sent to, or create a new account using that email.
                </p>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <Link href={loginUrl} style={{ ...btnP, ...linkButtonBase, padding: "6px 20px" }}>Sign In</Link>
                  <Link href={signupUrl} style={{ ...btnS, ...linkButtonBase, padding: "6px 16px" }}>Create Account</Link>
                </div>
                <p style={note}>
                  After signing in you will be brought back here to complete the invite. If creating a new account, use the exact email the invite was sent to, then verify it before signing in.
                </p>
              </>
            )}

            {/* ── Phone path ────────────────────────────────────────────────── */}
            {token && !checking && !done && !user && authMethod === "phone" && (
              <>
                <p style={{ margin: "0 0 6px", fontSize: "12px" }}>
                  <button onClick={() => { setAuthMethod(null); setPhoneStep("number"); setPhone(""); setOtp(""); setPhoneError(""); }} style={{ background: "none", border: "none", color: "#1a4db8", cursor: "pointer", padding: 0, fontSize: "12px" }}>
                    ← Back
                  </button>
                </p>

                {/* Step 1: Enter phone number */}
                {phoneStep === "number" && (
                  <>
                    <p style={{ margin: "0 0 14px", fontSize: "13px", color: "#333" }}>
                      Enter the phone number this invite was sent to. We will send you a one-time code.
                    </p>
                    <form onSubmit={handleSendOtp}>
                      <input
                        type="tel" required
                        placeholder="+91XXXXXXXXXX"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        style={{ ...inp, width: "100%", padding: "6px 8px" }}
                      />
                      {phoneError && <div style={{ ...errorBox, marginTop: "8px", padding: "6px 10px", border: "1px solid #fca5a5" }}>{phoneError}</div>}
                      <div style={{ marginTop: "12px" }}>
                        <button type="submit" disabled={phoneSending} style={{ ...btnP, padding: "6px 20px", opacity: phoneSending ? 0.6 : 1 }}>
                          {phoneSending ? "Sending…" : "Send OTP"}
                        </button>
                      </div>
                    </form>
                    <p style={note}>
                      In dev mode the OTP is printed to the backend console instead of being sent via SMS.
                    </p>
                  </>
                )}

                {/* Step 2: Enter OTP */}
                {phoneStep === "otp" && (
                  <>
                    <div style={{ marginBottom: "14px", padding: "6px 10px", background: "#f0fdf4", border: "1px solid #86efac", fontSize: "13px" }}>
                      OTP sent to <strong>{phone}</strong>. Check the backend console in dev mode.
                    </div>
                    <p style={{ margin: "0 0 14px", fontSize: "13px", color: "#333" }}>
                      Enter the 6-digit code to verify your phone and accept the invite in one step.
                    </p>
                    <form onSubmit={handleVerifyAndAccept}>
                      <input
                        type="text" required
                        inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
                        placeholder="6-digit code"
                        value={otp}
                        onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        style={{ ...inp, letterSpacing: "6px", fontSize: "18px", fontFamily: "monospace", textAlign: "center" }}
                      />
                      {phoneError && <div style={{ ...errorBox, marginTop: "8px", padding: "6px 10px", border: "1px solid #fca5a5" }}>{phoneError}</div>}
                      <div style={{ marginTop: "12px", display: "flex", gap: "10px", alignItems: "center" }}>
                        <button type="submit" disabled={phoneVerifying} style={{ ...btnP, padding: "6px 20px", opacity: phoneVerifying ? 0.6 : 1 }}>
                          {phoneVerifying ? "Verifying…" : "Verify & Accept Invite"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setPhoneStep("number"); setOtp(""); setPhoneError(""); }}
                          style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "13px" }}
                        >
                          Wrong number?
                        </button>
                      </div>
                    </form>
                    <p style={note}>
                      OTP expires in 10 minutes. Verifying creates your account automatically if you don&apos;t have one yet.
                    </p>
                  </>
                )}
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

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px" }}>Loading…</div>}>
      <AcceptInviteContent />
    </Suspense>
  );
}

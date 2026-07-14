"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { PageShell } from "@/components/dashboard/PageShell";
import { Card, Button, Badge } from "@/components/ui";

type UserRow = {
  id: string;
  name: string;
  email: string | null;
  emailVerified: boolean;
  phoneNumber: string | null;
  phoneNumberVerified: boolean;
  role: string;
  tenantId: string | null;
  isProfileComplete: boolean;
  createdAt: string;
};

const PHONE_EMAIL_SUFFIX = "@phone.gyanverse.app";

const lc: CSSProperties = {
  padding: "12px 18px",
  fontFamily: "var(--font-body)",
  fontSize: 14,
  fontWeight: 600,
  whiteSpace: "nowrap",
  width: 150,
  background: "var(--bg-section-alt)",
  color: "var(--text-body)",
  borderBottom: "1px solid var(--border-default)",
  verticalAlign: "middle",
};

const cell: CSSProperties = {
  padding: "12px 18px",
  fontFamily: "var(--font-body)",
  fontSize: 14,
  color: "var(--text-heading)",
  borderBottom: "1px solid var(--border-default)",
  verticalAlign: "middle",
};

export default function AccountPage() {
  const router = useRouter();

  const [user, setUser] = useState<UserRow | null>(null);
  const [pageError, setPageError] = useState("");

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", email: "" });
  const [saveErr, setSaveErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    api
      .get<{ user: UserRow }>("/api/auth/me")
      .then((res) => {
        setUser(res.user);
        setForm({
          name: res.user.name,
          email: res.user.email && res.user.email.endsWith(PHONE_EMAIL_SUFFIX) ? "" : (res.user.email ?? ""),
        });
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Failed to load profile";
        if (msg.includes("401") || msg.includes("Unauthorized")) {
          router.push("/login?next=/account");
          return;
        }
        setPageError(msg);
      });
  }, [router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaveErr("");
    setNotice("");
    setSaving(true);

    const body: { name: string; email?: string } = { name: form.name.trim() };

    // Email only sent when the account isn't email-verified (phone-only account adding
    // a real email) AND they typed something different from what's there.
    const trimmedEmail = form.email.trim();
    if (!user.emailVerified && trimmedEmail && trimmedEmail !== user.email) {
      body.email = trimmedEmail;
    }

    try {
      const res = await api.patch<{ user: UserRow }>("/api/auth/me", body);
      setUser(res.user);
      setForm({
        name: res.user.name,
        email: res.user.email && res.user.email.endsWith(PHONE_EMAIL_SUFFIX) ? "" : (res.user.email ?? ""),
      });
      setEditing(false);
      setNotice(body.email ? `Verification email sent to ${body.email}. Click the link to confirm.` : "Profile updated.");
    } catch (err) {
      setSaveErr(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    if (!user) return;
    setEditing(false);
    setSaveErr("");
    setForm({
      name: user.name,
      email: user.email && user.email.endsWith(PHONE_EMAIL_SUFFIX) ? "" : (user.email ?? ""),
    });
  }

  // Derived UX flags
  const isPhoneOnly = !!user && (!user.email || user.email.endsWith(PHONE_EMAIL_SUFFIX));
  const canEditEmail = !!user && !user.emailVerified;
  const displayEmail = user?.email && user.email.endsWith(PHONE_EMAIL_SUFFIX) ? "—" : (user?.email ?? "—");

  return (
    <PageShell eyebrow="Your profile" title="Account" maxWidth={620}>
      {notice && (
        <div style={{ marginBottom: 16, padding: "10px 14px", background: "var(--success-soft)", border: "1px solid rgba(16,185,129,0.35)", borderRadius: "var(--radius-md)", fontSize: 13, color: "#0f7a5a" }}>
          {notice}
        </div>
      )}
      {pageError && <ErrorNote>{pageError}</ErrorNote>}

      {!user && !pageError && <div style={{ fontSize: 14, color: "var(--text-muted)" }}>Loading profile…</div>}

      {user && (
        <Card padding={0}>
          <div style={{ display: "flex", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid var(--border-default)" }}>
            <h4 style={{ flex: 1, margin: 0, fontSize: 15 }}>Account settings</h4>
            {!editing && (
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
          </div>

          {!editing ? (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td style={lc}>Name</td>
                  <td style={cell}>{user.name}</td>
                </tr>
                <tr>
                  <td style={lc}>Email</td>
                  <td style={cell}>
                    {displayEmail}
                    {user.email && !user.email.endsWith(PHONE_EMAIL_SUFFIX) && (
                      <span style={{ marginLeft: 8 }}>
                        <Badge tone={user.emailVerified ? "success" : "warning"}>
                          {user.emailVerified ? "Verified" : "Unverified"}
                        </Badge>
                      </span>
                    )}
                  </td>
                </tr>
                <tr>
                  <td style={lc}>Phone</td>
                  <td style={cell}>
                    {user.phoneNumber ?? "—"}
                    {user.phoneNumber && (
                      <span style={{ marginLeft: 8 }}>
                        <Badge tone={user.phoneNumberVerified ? "success" : "warning"}>
                          {user.phoneNumberVerified ? "Verified" : "Unverified"}
                        </Badge>
                      </span>
                    )}
                  </td>
                </tr>
                <tr>
                  <td style={lc}>Role</td>
                  <td style={{ ...cell, textTransform: "capitalize" }}>{user.role.replace(/_/g, " ")}</td>
                </tr>
                <tr>
                  <td style={lc}>Member since</td>
                  <td style={cell}>{new Date(user.createdAt).toLocaleDateString()}</td>
                </tr>
                <tr>
                  <td style={{ ...lc, borderBottom: "none" }}>User ID</td>
                  <td style={{ ...cell, borderBottom: "none", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>{user.id}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <form onSubmit={handleSave} style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
              <label style={{ display: "block" }}>
                <span className="gv-label">Name</span>
                <input className="gv-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} maxLength={255} />
              </label>
              <label style={{ display: "block" }}>
                <span className="gv-label">Email</span>
                <input
                  className="gv-input"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder={isPhoneOnly ? "Add a real email address" : "you@example.com"}
                  disabled={!canEditEmail}
                  style={{ opacity: canEditEmail ? 1 : 0.6 }}
                />
                {!canEditEmail && (
                  <div className="gv-help">Email cannot be changed after verification. Contact support if you need to switch addresses.</div>
                )}
                {isPhoneOnly && canEditEmail && (
                  <div className="gv-help">Optional — adding an email lets you sign in without your phone.</div>
                )}
              </label>

              {saveErr && <ErrorNote>{saveErr}</ErrorNote>}

              <div style={{ display: "flex", gap: 10 }}>
                <Button type="submit" variant="app" disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>
                <Button type="button" variant="secondary" onClick={cancelEdit}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </Card>
      )}
    </PageShell>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: "0 0 16px", padding: "10px 14px", background: "var(--danger-soft)", border: "1px solid rgba(244,63,94,0.35)", borderRadius: "var(--radius-md)", fontSize: 13, color: "var(--danger)" }}>
      {children}
    </p>
  );
}

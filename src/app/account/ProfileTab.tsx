"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card, Button, Badge, DetailRows } from "@/components/ui";
import type { DetailRow } from "@/components/ui";

/**
 * The signed-in user's own profile — name, contact details and verification
 * state. Fetches `/api/auth/me` rather than reading `useTenantSession`, because
 * this screen needs columns the session user does not carry (phone, phone
 * verification, account role, created date).
 *
 * Edit is in-place: the same `DetailRows` grid renders in both modes, and Name
 * and Email gain inputs while Phone / Role / Member since / User ID keep showing
 * their values. Previously Edit swapped the whole six-row table out for a
 * two-field stacked form, which read as a different screen — see the note on
 * `DetailRows` itself.
 */

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

const PHONE_EMAIL_SUFFIX = "@phone.gyaanverse.app";

export function ProfileTab() {
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

  // One row list, used by both modes. A row without `edit` is display-only and
  // keeps showing its value while editing rather than vanishing.
  const rows: DetailRow[] = user
    ? [
        {
          label: "Name",
          value: user.name,
          edit: (
            <input
              className="gv-input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              minLength={2}
              maxLength={255}
            />
          ),
        },
        {
          label: "Email",
          value: (
            <>
              {displayEmail}
              {user.email && !user.email.endsWith(PHONE_EMAIL_SUFFIX) && (
                <span style={{ marginLeft: 8 }}>
                  <Badge tone={user.emailVerified ? "success" : "warning"}>
                    {user.emailVerified ? "Verified" : "Unverified"}
                  </Badge>
                </span>
              )}
            </>
          ),
          // A verified email is not editable, so it gets no control — the row
          // then falls back to showing the address and its Verified badge,
          // which explains the absence better than an inert greyed-out input.
          edit: canEditEmail ? (
            <input
              className="gv-input"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder={isPhoneOnly ? "Add a real email address" : "you@example.com"}
            />
          ) : undefined,
          help: !canEditEmail
            ? "Email cannot be changed after verification. Contact support if you need to switch addresses."
            : isPhoneOnly
              ? "Optional — adding an email lets you sign in without your phone."
              : undefined,
        },
        {
          label: "Phone",
          value: (
            <>
              {user.phoneNumber ?? "—"}
              {user.phoneNumber && (
                <span style={{ marginLeft: 8 }}>
                  <Badge tone={user.phoneNumberVerified ? "success" : "warning"}>
                    {user.phoneNumberVerified ? "Verified" : "Unverified"}
                  </Badge>
                </span>
              )}
            </>
          ),
        },
        // The ACCOUNT role, which is what this page is about. It can differ from
        // the role held inside a given coaching — that one comes from
        // `useTenantSession`. Display only; gates nothing.
        {
          label: "Role",
          value: <span style={{ textTransform: "capitalize" }}>{user.role.replace(/_/g, " ")}</span>,
        },
        { label: "Member since", value: new Date(user.createdAt).toLocaleDateString() },
        {
          label: "User ID",
          value: <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>{user.id}</span>,
        },
      ]
    : [];

  return (
    <>
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
            <h4 style={{ flex: 1, margin: 0, fontSize: 15 }}>Your details</h4>
            {!editing && (
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
          </div>

          <form onSubmit={handleSave}>
            <DetailRows rows={rows} editing={editing} />

            {editing && (
              <div style={{ padding: 18, borderTop: "1px solid var(--border-default)" }}>
                {saveErr && <ErrorNote>{saveErr}</ErrorNote>}
                <div style={{ display: "flex", gap: 10 }}>
                  <Button type="submit" variant="app" disabled={saving}>
                    {saving ? "Saving…" : "Save"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </form>
        </Card>
      )}
    </>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: "0 0 16px", padding: "10px 14px", background: "var(--danger-soft)", border: "1px solid rgba(244,63,94,0.35)", borderRadius: "var(--radius-md)", fontSize: 13, color: "var(--danger)" }}>
      {children}
    </p>
  );
}

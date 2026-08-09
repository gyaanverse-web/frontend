"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { invalidateSession } from "@/lib/sessionStore";
import { TENANT_ROOT_DOMAIN } from "@/lib/domain";
import { useTenantSession, type SessionUser } from "@/lib/useTenantSession";
import type { Tenant } from "./types";
import { ROLE_LABEL, sh, cell, lc, inp, btnP, btnS, type DisplayRole } from "./styles";
import { OverviewSection } from "./sections/OverviewSection";
import { MembersSection } from "./sections/MembersSection";
import { PeopleAccessSection } from "./sections/PeopleAccessSection";
import { PlanSection } from "./sections/PlanSection";
import { SettingsSection } from "./sections/SettingsSection";
import { DangerSection } from "./sections/DangerSection";
import { NotificationBell } from "@/components/NotificationBell";
import { Logo, Badge, Avatar, Button, Eyebrow } from "@/components/ui";
import type { BadgeRole } from "@/components/ui";
import { AppSidebar, type AppNavKey } from "@/components/dashboard/AppSidebar";
import { belongsToStudentArea } from "@/components/dashboard/appNav";

const ROLE_TO_BADGE: Record<string, BadgeRole> = {
  super_admin: "superadmin",
  coaching_owner: "owner",
  teacher: "teacher",
  student: "student",
};

// Staff-only page: students live at /student and are redirected out below.
//
// Sections still reachable in-page; the sidebar links here via ?screen=<Name>.
// "Batches" and "Exams" used to be here too, duplicating the real /classes and
// /exams routes the sidebar actually points at — nothing linked to the in-page
// copies, so they and their sections were deleted rather than migrated.
const VALID_SCREENS = ["Overview", "Members", "Invites / Join Codes", "Plan & Billing", "Settings", "Danger Zone"];

const DEFAULT_SCREEN = "Overview";

// Screens only a coaching_owner may open. There is no staff-vs-student split
// left to encode: every role that reaches this render is owner or teacher.
const OWNER_ONLY_SCREENS = new Set(["Invites / Join Codes", "Plan & Billing", "Settings", "Danger Zone"]);

const SCREEN_TO_KEY: Record<string, AppNavKey> = {
  "Overview": "dashboard",
  "Members": "members",
  "Invites / Join Codes": "invites",
  "Plan & Billing": "plan",
  "Settings": "settings",
  "Danger Zone": "danger",
};

function DashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Staff land here, and an owner with no coaching yet gets the "create / join"
  // state rather than a redirect — hence no `allow` and requireTenant: false.
  const { loading, user, tenant, role, isOwner, noTenant, accountRole, signupIntent, displayRole: navRole, refresh } =
    useTenantSession<Tenant>({ requireTenant: false });

  // Students have their own area at /student; this page renders nothing for them.
  //
  // Every input is null while the session loads, so this stays false until it
  // lands — redirecting on an unresolved session would bounce staff too. The
  // same helper gates /student, in `useStudentSession`; the two must agree or a
  // user ping-pongs between them. Note it is the SIGNUP INTENT, not the account
  // role, that keeps a brand-new coaching owner here: they only earn the
  // `coaching_owner` role by creating the coaching this page sends them to.
  const isStudent = !loading && belongsToStudentArea(role, accountRole, signupIntent);

  useEffect(() => {
    if (isStudent) router.replace("/student");
  }, [isStudent, router]);

  const [pageError, setPageError] = useState("");

  const goToScreen = (s: string) => router.push(`/coaching/dashboard?screen=${encodeURIComponent(s)}`);

  // Coaching institute inline edit
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", logoUrl: "" });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  // Seed the form from the coaching at the moment editing starts, rather than
  // mirroring `tenant` into state via an effect — the form is a draft of a
  // pending edit, not a copy of server state.
  function startEditingCoaching() {
    if (!tenant) return;
    setEditForm({ name: tenant.name, logoUrl: tenant.logoUrl ?? "" });
    setEditError("");
    setEditMode(true);
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleLogout() {
    try {
      await api.post("/api/auth/sign-out", {});
      invalidateSession();
      router.push("/login");
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Logout failed");
    }
  }

  async function handleEditSave() {
    if (!tenant) return;
    setEditError("");
    setEditLoading(true);
    try {
      const body: Record<string, string | null> = {};
      if (editForm.name !== tenant.name) body.name = editForm.name;
      const newLogo = editForm.logoUrl || null;
      if (newLogo !== tenant.logoUrl) body.logoUrl = newLogo;
      if (Object.keys(body).length === 0) {
        setEditMode(false);
        return;
      }
      await api.patch<{ tenant: Tenant }>(`/tenants/${tenant.id}`, body);
      refresh();
      setEditMode(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setEditLoading(false);
    }
  }

  // The coaching is gone; re-resolve rather than guessing the new state — the
  // membership went with it, so `/tenants/me` now 404s into `noTenant`.
  function handleCoachingDeleted() {
    refresh();
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

  // `isStudent` holds the frame between the effect firing and the route change,
  // so a student never sees the staff shell flash.
  if (!user || isStudent) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-page)", color: "var(--text-muted)", fontSize: 14 }}>
        Loading…
      </div>
    );
  }

  // Display chrome falls back to the account role only while there is no
  // coaching to take a membership role from — that rule now lives in
  // `useTenantSession.displayRole` so every shell resolves it identically.
  const displayRole = (navRole ?? "student") as DisplayRole;
  const roleLabel = ROLE_LABEL[displayRole] ?? displayRole;
  const badgeRole = ROLE_TO_BADGE[displayRole] ?? "student";

  // ── No tenant ────────────────────────────────────────────────────────────────
  // Only owners and teachers get here at all, and an owner who just registered
  // has no institute until they create one — so "Create / join" *is* their next
  // step. (Students are never blocked this way: the whole public-exam journey is
  // authenticated but tenant-free, so a coaching-less student browses the
  // marketplace and sits mocks from /student. That is handled over there.)
  if (noTenant || !tenant) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "radial-gradient(ellipse 70% 50% at 50% 0%, #eef0fc 0%, var(--paper-50) 60%)", padding: "48px 24px" }}>
        <Link href="/" style={{ marginBottom: 28 }}>
          <Logo size={24} />
        </Link>
        <div style={{ background: "#fff", border: "1px solid var(--border-light)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)", padding: 36, width: "100%", maxWidth: 460 }}>
          <h2 style={{ fontSize: 24, margin: "0 0 8px" }}>No institute yet.</h2>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--text-body)", marginBottom: 20 }}>
            You are not part of any coaching institute. Create your own or join one with a code.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <Button variant="app" arrow onClick={() => router.push("/create-coaching")}>Create coaching</Button>
            <Button variant="secondary" onClick={() => router.push("/join")}>Join coaching</Button>
          </div>
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{user.name} · {user.email}</span>
            <button onClick={handleLogout} style={{ background: "none", border: "none", color: "var(--accent)", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "var(--font-body)" }}>
              Sign out
            </button>
          </div>
          {pageError && <p style={{ marginTop: 12, color: "var(--danger)", fontSize: 13 }}>{pageError}</p>}
        </div>
      </div>
    );
  }

  // ── Active screen derived from URL (sidebar is the shared AppSidebar) ─────────

  const requestedScreen = searchParams.get("screen") ?? DEFAULT_SCREEN;
  let activeScreen = VALID_SCREENS.includes(requestedScreen) ? requestedScreen : DEFAULT_SCREEN;
  // Screen-level authorization — the sidebar hides these, but a direct URL
  // (?screen=…) must not render a section the role can't use. The backend is
  // the real gate (403s), this just avoids a dead screen full of error boxes.
  if (OWNER_ONLY_SCREENS.has(activeScreen) && !isOwner) activeScreen = DEFAULT_SCREEN;
  const activeKey = SCREEN_TO_KEY[activeScreen] ?? "dashboard";

  // ── Screen content ────────────────────────────────────────────────────────────

  function renderScreen() {
    if (!tenant) return null;
    switch (activeScreen) {
      case "Overview":
        return <OverviewSection tenant={tenant} isOwner={isOwner} onNavigate={goToScreen} />;
      case "Members":
        return <ScreenWrap eyebrow={tenant.name} title="Members"><MembersSection tenant={tenant} isOwner={isOwner} /></ScreenWrap>;
      case "Invites / Join Codes":
        return (
          <ScreenWrap eyebrow={tenant.name} title="People & access">
            <PeopleAccessSection tenant={tenant} />
          </ScreenWrap>
        );
      case "Plan & Billing":
        return <ScreenWrap eyebrow={tenant.name} title="Plan & billing"><PlanSection tenant={tenant} onTenantChange={refresh} /></ScreenWrap>;
      case "Settings":
        return (
          <ScreenWrap eyebrow={tenant.name} title="Settings">
            <AccountCard user={user!} roleLabel={roleLabel} badgeRole={badgeRole} />
            <CoachingCard
              tenant={tenant}
              isOwner={isOwner}
              editMode={editMode}
              editForm={editForm}
              editLoading={editLoading}
              editError={editError}
              onEdit={startEditingCoaching}
              onChange={setEditForm}
              onSave={handleEditSave}
              onCancel={() => {
                setEditMode(false);
                setEditError("");
                setEditForm({ name: tenant.name, logoUrl: tenant.logoUrl ?? "" });
              }}
            />
            <SettingsSection tenant={tenant} />
            <div style={{ background: "var(--surface-card)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-sm)", overflow: "hidden", marginBottom: 16 }}>
              <div style={sh}><span>Subject catalog</span></div>
              <div style={{ padding: 16 }}>
                <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--text-body)", fontFamily: "var(--font-body)" }}>
                  Manage subjects and chapters used to tag and organise exams by topic.
                </p>
                <Button variant="secondary" arrow onClick={() => router.push("/coaching/question-bank?manage=hierarchy")}>Manage catalog</Button>
              </div>
            </div>
          </ScreenWrap>
        );
      case "Danger Zone":
        return <ScreenWrap eyebrow={tenant.name} title="Danger zone"><DangerSection tenant={tenant} onDeleted={handleCoachingDeleted} /></ScreenWrap>;
      default:
        return null;
    }
  }

  // ── Shell ─────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-page)" }}>
      {/* Sidebar (shared component — identical on every page) */}
      <AppSidebar role={displayRole} activeKey={activeKey} onLogout={handleLogout} />

      {/* Main column */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top bar */}
        <header className="gv-topbar" style={{ position: "sticky", top: 0, zIndex: 5 }}>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
            <span style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 15, letterSpacing: "-0.01em", color: "var(--text-heading)" }}>
              {tenant.name}
            </span>
            <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--text-muted)" }}>{tenant.slug}.{TENANT_ROOT_DOMAIN}</span>
          </div>
          <div style={{ flex: 1 }} />
          <Link href="/mocks" className="gv-btn gv-btn--ghost gv-btn--sm"><span>Public mocks</span></Link>
          <NotificationBell />
          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 4 }}>
            <Avatar name={user.name} size={28} />
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-heading)" }}>{user.name}</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{roleLabel}</span>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={handleLogout}>Sign out</Button>
        </header>

        <main style={{ flex: 1, overflowY: "auto", padding: 28 }}>
          {renderScreen()}
          {pageError && (
            <p style={{ marginTop: 16, color: "var(--danger)", fontSize: 13, border: "1px solid rgba(244,63,94,0.35)", background: "var(--danger-soft)", borderRadius: "var(--radius-md)", padding: "10px 14px" }}>
              {pageError}
            </p>
          )}
        </main>
      </div>
    </div>
  );
}

// ── Suspense wrapper (required for useSearchParams) ──────────────────────────────

export default function DashboardPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-page)", color: "var(--text-muted)", fontSize: 14 }}>Loading…</div>}>
      <DashboardInner />
    </Suspense>
  );
}

// ── Screen wrapper with page head ───────────────────────────────────────────────

function ScreenWrap({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 22 }}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 style={{ fontSize: 26, margin: 0 }}>{title}</h2>
      </div>
      {children}
    </div>
  );
}

// ── Account card (Settings screen) ──────────────────────────────────────────────

function AccountCard({ user, roleLabel, badgeRole }: { user: SessionUser; roleLabel: string; badgeRole: BadgeRole }) {
  return (
    <div style={{ background: "var(--surface-card)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-sm)", overflow: "hidden", marginBottom: 16 }}>
      <div style={sh}><span>Account</span></div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          <tr><td style={lc}>Name</td><td style={cell}>{user.name}</td></tr>
          <tr>
            <td style={lc}>Email</td>
            <td style={cell}>
              {user.email}
              <span style={{ marginLeft: 8 }}>
                <Badge tone={user.emailVerified ? "success" : "warning"}>{user.emailVerified ? "Verified" : "Unverified"}</Badge>
              </span>
            </td>
          </tr>
          <tr><td style={lc}>Role</td><td style={cell}><Badge role={badgeRole}>{roleLabel}</Badge></td></tr>
          <tr><td style={lc}>User ID</td><td style={{ ...cell, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>{user.id}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Coaching institute card with inline edit (Settings screen) ──────────────────

function CoachingCard({
  tenant,
  isOwner,
  editMode,
  editForm,
  editLoading,
  editError,
  onEdit,
  onChange,
  onSave,
  onCancel,
}: {
  tenant: Tenant;
  isOwner: boolean;
  editMode: boolean;
  editForm: { name: string; logoUrl: string };
  editLoading: boolean;
  editError: string;
  onEdit: () => void;
  onChange: (f: { name: string; logoUrl: string }) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div style={{ background: "var(--surface-card)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-sm)", overflow: "hidden", marginBottom: 16 }}>
      <div style={sh}>
        <span>Coaching institute</span>
        {isOwner && !editMode && (
          <button onClick={onEdit} style={{ ...btnS, padding: "5px 14px", fontSize: 12 }}>Edit</button>
        )}
      </div>

      {!editMode ? (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr><td style={lc}>Name</td><td style={cell}>{tenant.name}</td></tr>
            <tr><td style={lc}>Slug</td><td style={{ ...cell, fontFamily: "var(--font-mono)" }}>{tenant.slug}</td></tr>
            <tr><td style={lc}>Plan</td><td style={cell}>{tenant.plan.charAt(0).toUpperCase() + tenant.plan.slice(1)}</td></tr>
            <tr>
              <td style={lc}>Status</td>
              <td style={cell}><Badge tone={tenant.status === "active" ? "success" : "danger"}>{tenant.status}</Badge></td>
            </tr>
            <tr><td style={lc}>Tenant ID</td><td style={{ ...cell, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>{tenant.id}</td></tr>
          </tbody>
        </table>
      ) : (
        <div style={{ padding: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={{ display: "block" }}>
              <span className="gv-label">Name</span>
              <input value={editForm.name} onChange={(e) => onChange({ ...editForm, name: e.target.value })} style={{ ...inp, width: "100%" }} required minLength={2} maxLength={255} />
            </label>
            <label style={{ display: "block" }}>
              <span className="gv-label">Logo URL</span>
              <input value={editForm.logoUrl} onChange={(e) => onChange({ ...editForm, logoUrl: e.target.value })} placeholder="https://…" style={{ ...inp, width: "100%" }} />
            </label>
          </div>
          {editError && <p style={{ margin: "10px 0 0", color: "var(--danger)", fontSize: 13 }}>{editError}</p>}
          <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
            <button onClick={onSave} disabled={editLoading} style={{ ...btnP, opacity: editLoading ? 0.6 : 1 }}>
              {editLoading ? "Saving…" : "Save"}
            </button>
            <button onClick={onCancel} style={btnS}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

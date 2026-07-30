"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { TENANT_ROOT_DOMAIN } from "@/lib/domain";
import type { User, Tenant } from "./types";
import { ROLE_LABEL, sh, cell, lc, inp, btnP, btnS } from "./styles";
import { OverviewSection } from "./sections/OverviewSection";
import { MembersSection } from "./sections/MembersSection";
import { PeopleAccessSection } from "./sections/PeopleAccessSection";
import { ClassesSection } from "./sections/ClassesSection";
import { ExamsSection } from "./sections/ExamsSection";
import { PlanSection } from "./sections/PlanSection";
import { SettingsSection } from "./sections/SettingsSection";
import { DangerSection } from "./sections/DangerSection";
import { NotificationBell } from "@/components/NotificationBell";
import { Logo, Badge, Avatar, Button, Eyebrow } from "@/components/ui";
import type { BadgeRole } from "@/components/ui";
import { AppSidebar, type AppNavKey } from "@/components/dashboard/AppSidebar";
import { StudentHome } from "@/components/student/StudentHome";
import { StudentMyExams } from "@/components/student/StudentMyExams";
import { StudentReportsHistory } from "@/components/student/StudentReportsHistory";
import { StudentMyClasses } from "@/components/student/StudentMyClasses";
import { StudentMarketplace } from "@/components/student/StudentMarketplace";

const ROLE_TO_BADGE: Record<string, BadgeRole> = {
  super_admin: "superadmin",
  coaching_owner: "owner",
  teacher: "teacher",
  student: "student",
};

// Dashboard sections reachable in-page; the sidebar links here via ?screen=<Name>.
const VALID_SCREENS = ["Overview", "Members", "Batches", "Exams", "Invites / Join Codes", "Plan & Billing", "Settings", "Danger Zone"];

// Screens only a coaching_owner may open, and screens only owner/teacher may open.
const OWNER_ONLY_SCREENS = new Set(["Invites / Join Codes", "Plan & Billing", "Settings", "Danger Zone"]);
const STAFF_ONLY_SCREENS = new Set(["Overview", "Members"]);

const SCREEN_TO_KEY: Record<string, AppNavKey> = {
  "Overview": "dashboard",
  "Members": "members",
  "Batches": "classes",
  "Exams": "exams",
  "Invites / Join Codes": "invites",
  "Plan & Billing": "plan",
  "Settings": "settings",
  "Danger Zone": "danger",
};

function DashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [noTenant, setNoTenant] = useState(false);
  const [pageError, setPageError] = useState("");

  const goToScreen = (s: string) => router.push(`/dashboard?screen=${encodeURIComponent(s)}`);

  // Coaching institute inline edit
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", logoUrl: "" });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.allSettled([
      api.get<{ user: User | null }>("/api/auth/get-session"),
      api.get<{ tenant: Tenant }>("/tenants/me"),
    ]).then(([sr, tr]) => {
      const u = sr.status === "fulfilled" ? sr.value?.user : null;
      if (!u) {
        router.push("/login");
        return;
      }
      setUser(u);

      if (tr.status === "fulfilled") {
        const t = tr.value.tenant;
        setTenant(t);
        setEditForm({ name: t.name, logoUrl: t.logoUrl ?? "" });
      } else {
        setNoTenant(true);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleLogout() {
    try {
      await api.post("/api/auth/sign-out", {});
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
      const res = await api.patch<{ tenant: Tenant }>(`/tenants/${tenant.id}`, body);
      setTenant(res.tenant);
      setEditMode(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setEditLoading(false);
    }
  }

  function handleCoachingDeleted() {
    setTenant(null);
    setNoTenant(true);
    setUser((prev) => (prev ? { ...prev, role: "student", tenantId: null } : prev));
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (!user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-page)", color: "var(--text-muted)", fontSize: 14 }}>
        Loading…
      </div>
    );
  }

  const roleLabel = ROLE_LABEL[user.role] ?? user.role;
  const badgeRole = ROLE_TO_BADGE[user.role] ?? "student";
  const isOwner = user.role === "coaching_owner";
  const canMembers = isOwner || user.role === "teacher";

  // ── No tenant ────────────────────────────────────────────────────────────────
  // Only owners and teachers are blocked here. An owner who just registered has
  // no institute until they create one, so "Create / join" *is* their next step.
  //
  // A student is different: the whole public-exam journey — /exams/public,
  // /exams/:id, session start/submit/results and /reports — is authenticated but
  // tenant-free on the backend, so a student with no coaching can browse the
  // marketplace and sit mocks today. Gating them behind "create a coaching"
  // asked for something they don't need and can't sensibly do. They fall through
  // to their own dashboard with tenant === null and pick up a join code if and
  // when a coaching gives them one.
  const isStudent = user.role === "student";

  if ((noTenant || !tenant) && !isStudent) {
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

  // ── Student home ──────────────────────────────────────────────────────────────
  // Students always render a student screen — this branch is exhaustive. It has
  // to be: the owner/teacher shell below dereferences `tenant`, which is legally
  // null for a student who hasn't joined a coaching. Every student screen takes
  // `tenant` as nullable and degrades to a "join a coaching" state.
  if (isStudent) {
    const screen = searchParams.get("screen");
    if (screen === "Exams") {
      return <StudentMyExams user={user} tenant={tenant} />;
    }
    if (screen === "Results") {
      return <StudentReportsHistory user={user} tenant={tenant} />;
    }
    if (screen === "Classes") {
      return <StudentMyClasses user={user} tenant={tenant} />;
    }
    if (screen === "Marketplace") {
      return <StudentMarketplace user={user} tenant={tenant} />;
    }
    return <StudentHome user={user} tenant={tenant} />;
  }

  // Past this point the user is an owner or teacher, so the gate above
  // guaranteed a tenant. This narrows it for TypeScript.
  if (!tenant) return null;

  // ── Active screen derived from URL (sidebar is the shared AppSidebar) ─────────

  const defaultScreen = canMembers ? "Overview" : "Batches";
  const requestedScreen = searchParams.get("screen") ?? defaultScreen;
  let activeScreen = VALID_SCREENS.includes(requestedScreen) ? requestedScreen : defaultScreen;
  // Screen-level authorization — the sidebar hides these, but a direct URL
  // (?screen=…) must not render a section the role can't use. The backend is
  // the real gate (403s), this just avoids a dead screen full of error boxes.
  if (OWNER_ONLY_SCREENS.has(activeScreen) && !isOwner) activeScreen = defaultScreen;
  if (STAFF_ONLY_SCREENS.has(activeScreen) && !canMembers) activeScreen = defaultScreen;
  const activeKey = SCREEN_TO_KEY[activeScreen] ?? "dashboard";

  // ── Screen content ────────────────────────────────────────────────────────────

  function renderScreen() {
    if (!tenant) return null;
    switch (activeScreen) {
      case "Overview":
        return <OverviewSection tenant={tenant} user={user!} onNavigate={goToScreen} />;
      case "Members":
        return <ScreenWrap eyebrow={tenant.name} title="Members"><MembersSection tenant={tenant} isOwner={isOwner} /></ScreenWrap>;
      case "Batches":
        return <ScreenWrap eyebrow={tenant.name} title="Batches"><ClassesSection tenant={tenant} user={user!} canMembers={canMembers} /></ScreenWrap>;
      case "Exams":
        return <ScreenWrap eyebrow={tenant.name} title="Exams"><ExamsSection tenant={tenant} canMembers={canMembers} /></ScreenWrap>;
      case "Invites / Join Codes":
        return (
          <ScreenWrap eyebrow={tenant.name} title="People & access">
            <PeopleAccessSection tenant={tenant} />
          </ScreenWrap>
        );
      case "Plan & Billing":
        return <ScreenWrap eyebrow={tenant.name} title="Plan & billing"><PlanSection tenant={tenant} onTenantChange={setTenant} /></ScreenWrap>;
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
              onEdit={() => setEditMode(true)}
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
                <Button variant="secondary" arrow onClick={() => router.push("/question-bank?manage=hierarchy")}>Manage catalog</Button>
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
      <AppSidebar role={user.role} activeKey={activeKey} onLogout={handleLogout} />

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
          <Link href="/exams/public" className="gv-btn gv-btn--ghost gv-btn--sm"><span>Public mocks</span></Link>
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

function AccountCard({ user, roleLabel, badgeRole }: { user: User; roleLabel: string; badgeRole: BadgeRole }) {
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

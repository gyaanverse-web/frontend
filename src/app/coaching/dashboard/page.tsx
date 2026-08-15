"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { invalidateSession } from "@/lib/sessionStore";
import { TENANT_ROOT_DOMAIN } from "@/lib/domain";
import { useTenantSession } from "@/lib/useTenantSession";
import type { Tenant } from "./types";
import { sh, btnP, btnS, type DisplayRole } from "./styles";
import { OverviewSection } from "./sections/OverviewSection";
import { MembersSection } from "./sections/MembersSection";
import { PeopleAccessSection } from "./sections/PeopleAccessSection";
import { PlanSection } from "./sections/PlanSection";
import { DangerSection } from "./sections/DangerSection";
import { NotificationBell } from "@/components/NotificationBell";
import { Logo, Badge, Button, Eyebrow, Tabs, DetailRows } from "@/components/ui";
import { AppSidebar, type AppNavKey } from "@/components/dashboard/AppSidebar";
import {
  belongsToStudentArea,
  buildSettingsTabs,
  SETTINGS_TAB_LABEL,
  type SettingsTabKey,
} from "@/components/dashboard/appNav";

// Staff-only page: students live at /student and are redirected out below.
//
// Sections still reachable in-page; the sidebar links here via ?screen=<Name>.
// "Batches" and "Exams" used to be here too, duplicating the real /classes and
// /exams routes the sidebar actually points at — nothing linked to the in-page
// copies, so they and their sections were deleted rather than migrated.
//
// "Plan & Billing" and "Danger Zone" were screens of their own until they became
// TABS on Settings — see `renderSettings`. Neither is a daily destination, and a
// permanent nav row reading "Danger Zone" put "delete this institute" one
// mis-click from "Settings".
const VALID_SCREENS = ["Overview", "Members", "Invites / Join Codes", "Settings"];

const DEFAULT_SCREEN = "Overview";

// Screens only a coaching_owner may open. There is no staff-vs-student split
// left to encode: every role that reaches this render is owner or teacher.
const OWNER_ONLY_SCREENS = new Set(["Invites / Join Codes", "Settings"]);

const SCREEN_TO_KEY: Record<string, AppNavKey> = {
  "Overview": "dashboard",
  "Members": "members",
  "Invites / Join Codes": "invites",
  "Settings": "settings",
};

function DashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Staff land here, and an owner with no coaching yet gets the "create / join"
  // state rather than a redirect — hence no `allow` and requireTenant: false.
  const { loading, user, tenant, role, isOwner, entitlements, noTenant, accountRole, signupIntent, displayRole: navRole, refresh } =
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

  // `s` is a screen name, optionally with a `&tab=…` suffix for the tabbed
  // Settings screen. Split before encoding — running the whole string through
  // encodeURIComponent would escape the `&` into `%26` and produce one screen
  // literally named "Settings&tab=billing", which matches nothing.
  const goToScreen = (s: string) => {
    const [screen, ...rest] = s.split("&");
    const suffix = rest.length ? `&${rest.join("&")}` : "";
    router.push(`/coaching/dashboard?screen=${encodeURIComponent(screen)}${suffix}`);
  };

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

  // ── Settings tab derived from URL, same rules one level down ──────────────────
  //
  // `?tab=` is validated against the tabs this role and this billing state
  // actually have, so a hand-edited or stale value (`?tab=billing` from before
  // the platform switch was turned off, where every call 404s) falls back to
  // General rather than rendering a broken screen.
  const settingsTabs = buildSettingsTabs(displayRole, entitlements);
  const requestedTab = searchParams.get("tab") as SettingsTabKey | null;
  const activeTab: SettingsTabKey =
    requestedTab && settingsTabs.includes(requestedTab) ? requestedTab : "general";

  const goToTab = (label: string) => {
    const key = settingsTabs.find((t) => SETTINGS_TAB_LABEL[t] === label) ?? "general";
    // `replace`, not `push` — switching tabs is not a navigation the Back button
    // should step through one at a time.
    router.replace(`/coaching/dashboard?screen=Settings${key === "general" ? "" : `&tab=${key}`}`, { scroll: false });
  };

  // ── Screen content ────────────────────────────────────────────────────────────

  function renderScreen() {
    if (!tenant) return null;
    switch (activeScreen) {
      case "Overview":
        return <OverviewSection tenant={tenant} isOwner={isOwner} entitlements={entitlements} onNavigate={goToScreen} />;
      case "Members":
        return <ScreenWrap eyebrow={tenant.name} title="Members"><MembersSection tenant={tenant} isOwner={isOwner} /></ScreenWrap>;
      case "Invites / Join Codes":
        return (
          <ScreenWrap eyebrow={tenant.name} title="People & access">
            <PeopleAccessSection tenant={tenant} />
          </ScreenWrap>
        );
      case "Settings":
        return (
          <ScreenWrap eyebrow={tenant.name} title="Settings">
            {/* Billing and the danger zone are TABS here, not sidebar rows.
                Neither is a daily destination, and a permanent "Danger Zone" row
                put "delete this institute" one mis-click from "Settings". */}
            <div style={{ marginBottom: 20 }}>
              <Tabs
                tabs={settingsTabs.map((t) => SETTINGS_TAB_LABEL[t])}
                value={SETTINGS_TAB_LABEL[activeTab]}
                onChange={goToTab}
              />
            </div>
            {renderSettingsTab()}
          </ScreenWrap>
        );
      default:
        return null;
    }
  }

  // Nothing personal on this screen. "Settings" here is the INSTITUTE — its
  // name, its subjects, its plan, its deletion. The signed-in user's own name,
  // email verification and alert preferences are a different subject and live at
  // /account, reachable from the sidebar footer for every role.
  function renderSettingsTab() {
    if (!tenant) return null;
    switch (activeTab) {
      case "billing":
        return <PlanSection tenant={tenant} onTenantChange={refresh} />;
      case "danger":
        return <DangerSection tenant={tenant} onDeleted={handleCoachingDeleted} />;
      case "general":
      default:
        return (
          <>
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
            {/* No "Public mocks" / "Custom domain" card here any more: both wrote
                columns nothing read. Public exams are gated on the PLAN FEATURE
                `public_mocks`, and tenants resolve by slug subdomain, never by a
                custom domain. The form, its route and `tenant_settings` went in
                migration 0022. */}
            <div style={{ background: "var(--surface-card)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-sm)", overflow: "hidden", marginBottom: 16 }}>
              <div style={sh}><span>Subject catalog</span></div>
              <div style={{ padding: 16 }}>
                <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--text-body)", fontFamily: "var(--font-body)" }}>
                  Manage subjects and chapters used to tag and organise exams by topic.
                </p>
                <Button variant="secondary" arrow onClick={() => router.push("/coaching/question-bank?manage=hierarchy")}>Manage catalog</Button>
              </div>
            </div>
          </>
        );
    }
  }

  // ── Shell ─────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-page)" }}>
      {/* Sidebar (shared component — identical on every page) */}
      <AppSidebar role={displayRole} activeKey={activeKey} user={user} onLogout={handleLogout} />

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
          {/* Institute, then the bell. Nothing else — deliberately identical to
              TeacherShell's bar, so the header does not change shape as you move
              between Dashboard and Exams (the drift AppSidebar exists to
              prevent). Everything this used to carry said something the shell
              already said elsewhere: a "Sign out" button beside the sidebar's
              "Log out", the role beside the sidebar's role badge, a "Public
              mocks" link no other staff page had, and the avatar + name that now
              live once, in the sidebar's pinned account footer. */}
          <NotificationBell />
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

// NOTE: the "Account" card that used to head the Settings screen is gone. It
// showed the signed-in user's name, email verification, role and id — personal
// details on a screen about the INSTITUTE, and a duplicate of /account, which is
// now a real destination in every role's sidebar footer.

// ── Coaching institute card with inline edit (Settings › General) ───────────────

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

      {/* Same grid in both modes — Name and Logo URL gain controls, the
          server-owned rows (slug, plan, status, id) stay readable instead of
          disappearing behind an Edit click. See `DetailRows`. */}
      <DetailRows
        editing={editMode}
        rows={[
          {
            label: "Name",
            value: tenant.name,
            edit: (
              <input className="gv-input" value={editForm.name} onChange={(e) => onChange({ ...editForm, name: e.target.value })} required minLength={2} maxLength={255} />
            ),
          },
          {
            label: "Logo URL",
            value: tenant.logoUrl ? (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, wordBreak: "break-all" }}>{tenant.logoUrl}</span>
            ) : (
              "—"
            ),
            edit: (
              <input className="gv-input" value={editForm.logoUrl} onChange={(e) => onChange({ ...editForm, logoUrl: e.target.value })} placeholder="https://…" />
            ),
          },
          { label: "Slug", value: <span style={{ fontFamily: "var(--font-mono)" }}>{tenant.slug}</span> },
          { label: "Plan", value: tenant.plan.charAt(0).toUpperCase() + tenant.plan.slice(1) },
          { label: "Status", value: <Badge tone={tenant.status === "active" ? "success" : "danger"}>{tenant.status}</Badge> },
          {
            label: "Tenant ID",
            value: <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>{tenant.id}</span>,
          },
        ]}
      />

      {editMode && (
        <div style={{ padding: 16, borderTop: "1px solid var(--border-default)" }}>
          {editError && <p style={{ margin: "0 0 10px", color: "var(--danger)", fontSize: 13 }}>{editError}</p>}
          <div style={{ display: "flex", gap: 8 }}>
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

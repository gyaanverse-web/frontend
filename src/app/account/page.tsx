"use client";

import { Suspense } from "react";
import { useTenantSession } from "@/lib/useTenantSession";
import { useUrlState } from "@/lib/useUrlState";
import { TeacherShell } from "@/components/dashboard/TeacherShell";
import { Tabs } from "@/components/ui";
import { ProfileTab } from "./ProfileTab";
import { NotificationsTab } from "./NotificationsTab";

/**
 * The one account screen, for every role.
 *
 * ── Why this page absorbed `/settings` ──────────────────────────────────────
 *
 * There used to be two: `/account` (profile) and `/settings` (notification
 * preferences). `/settings` was real and fully wired, and NOTHING IN ANY SIDEBAR
 * LINKED TO IT — its only entry point in the entire app was a small link in the
 * notification bell's footer. Meanwhile the word "Settings" in the sidebar meant
 * something else entirely (`/coaching/dashboard?screen=Settings`, the owner's
 * institute settings), and teachers had neither entry, so a teacher had no route
 * to their own profile or alerts at all.
 *
 * So: one page, two tabs, one nav entry, present for owner, teacher and student
 * alike. The owner's institute settings stay where they are — a coaching's name,
 * subjects and danger zone are genuinely not the same subject as "my account".
 *
 * ── Why it renders in the app shell ─────────────────────────────────────────
 *
 * It used to render in `PageShell`, which drew no sidebar, offered no sign-out,
 * and hardcoded a back link to `/coaching/dashboard` — so a student who opened
 * their own account page lost their navigation and was offered a button to the
 * staff dashboard, which bounced them straight back. `TeacherShell` is the shared
 * app shell (its name predates students using it), so the nav is identical here
 * to everywhere else.
 */

const TABS = ["Profile", "Notifications"] as const;
const TAB_KEYS = ["profile", "notifications"] as const;
type TabKey = (typeof TAB_KEYS)[number];

function AccountInner() {
  // `requireTenant: false` — this page is valid for someone with no coaching at
  // all (a student who has not joined one yet), which is a supported state.
  const { user, tenant, displayRole, noTenant } = useTenantSession({ requireTenant: false });

  const [tab, setTab] = useUrlState<TabKey>("tab", TAB_KEYS, "profile");

  const label = tab === "notifications" ? "Notifications" : "Profile";
  const setLabel = (l: string) => setTab(l === "Notifications" ? "notifications" : "profile");

  return (
    <TeacherShell
      tenant={tenant}
      user={user}
      role={displayRole}
      active="account"
      eyebrow="Your account"
      title="Account"
      noCoaching={noTenant}
    >
      <div style={{ maxWidth: 720 }}>
        <div style={{ marginBottom: 20 }}>
          <Tabs tabs={[...TABS]} value={label} onChange={setLabel} />
        </div>
        {tab === "notifications" ? <NotificationsTab /> : <ProfileTab />}
      </div>
    </TeacherShell>
  );
}

// `useUrlState` reads `useSearchParams`, which requires a Suspense boundary or
// the production build fails.
export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-page)", color: "var(--text-muted)", fontSize: 14 }}>
          Loading…
        </div>
      }
    >
      <AccountInner />
    </Suspense>
  );
}

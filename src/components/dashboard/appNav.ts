import type { IconName } from "@/components/ui";
import { NO_BILLING, type Entitlements } from "@/lib/entitlements";

/**
 * Pure, framework-free source of truth for the app's left-navigation.
 *
 * Kept out of AppSidebar.tsx (a "use client" React component) so the role-gating
 * logic can be unit-tested in a plain Node environment — no DOM, no React.
 */

export type AppNavKey =
  | "dashboard"
  | "home"
  | "classes"
  | "exams"
  | "approvals"
  | "results"
  | "marketplace"
  | "account"
  | "question-bank"
  | "test-engine"
  | "subjects"
  | "teachers"
  | "members"
  | "invites"
  | "plan"
  | "settings"
  | "danger";

export type NavEntry =
  | { key: AppNavKey; label: string; icon: IconName; href: string }
  | { section: string };

const dash = (screen: string) => `/coaching/dashboard?screen=${encodeURIComponent(screen)}`;

/**
 * Decide which role's navigation to render, given a resolved session.
 *
 * Lives here rather than in `useTenantSession` (a "use client" module) so it is
 * testable in plain Node, same reason as `buildAppNav` below.
 *
 * The rules, in order:
 *  - a membership role always wins — it is what the server authorises on;
 *  - with no coaching there is no membership, so the ACCOUNT role answers
 *    "did they sign up to study or to run a coaching?" (see `accountRole`) —
 *    except the account role of someone who has never had a coaching is the
 *    'student' default, which is a placeholder and not an answer. That case
 *    defers to the signup intent;
 *  - otherwise the session is still loading and the honest answer is `null`.
 *    Returning a guess here is what put students in front of the teacher menu.
 */
export function resolveDisplayRole(
  role: string | null,
  noTenant: boolean,
  accountRole: string | null,
  signupIntent: string | null = null,
): string | null {
  if (role) return role;
  if (!noTenant) return null;
  if (accountRole && accountRole !== "student") return accountRole;
  return signupIntent ?? accountRole;
}

/**
 * Does this person belong in `/student/*` rather than `/coaching/dashboard`?
 *
 * The single answer to a question two shells ask independently — the staff
 * dashboard bounces a yes to /student, `useStudentSession` bounces a no to
 * /coaching/dashboard. When those two disagree the user ping-pongs between them forever,
 * so they must call this and nothing else.
 *
 * Only meaningful once the session has resolved; callers gate on `!loading`.
 *
 *  - membership role present → it decides, because it is what the server
 *    authorises on;
 *  - a non-default account role ('super_admin', or staff whose membership is
 *    still loading elsewhere) is staff;
 *  - otherwise the signup intent decides. This is the pre-tenant case: a
 *    coaching owner between "verified my email" and "named my institute" has no
 *    membership and the default 'student' account role, and without the intent
 *    would be filed as a student with no way back out.
 */
export function belongsToStudentArea(
  role: string | null,
  accountRole: string | null,
  signupIntent: string | null,
): boolean {
  if (role) return role === "student";
  if (accountRole && accountRole !== "student") return false;
  return signupIntent !== "coaching_owner";
}

/**
 * Build the role-aware nav. The list is identical on every page for a given role.
 *
 * Takes no entitlements any more: nothing in the sidebar is gated on billing
 * since "Plan & Billing" stopped being a nav row and became a tab inside
 * Settings. That rule did not disappear — it moved to `buildSettingsTabs` below,
 * which is where it is now tested.
 */
export function buildAppNav(role: string): NavEntry[] {
  const isOwner = role === "coaching_owner";
  const canMembers = isOwner || role === "teacher";

  if (!canMembers) {
    // Student: the full student area, every screen a real route under /student.
    // `/coaching/dashboard` is staff-only and bounces students back to /student — the two
    // areas no longer share a page.
    return [
      { key: "home", label: "Home", icon: "layout-dashboard", href: "/student" },
      { key: "exams", label: "My Exams", icon: "file-text", href: "/student/exams" },
      { key: "results", label: "My Results", icon: "chart-column", href: "/student/results" },
      { key: "classes", label: "My Classes", icon: "graduation-cap", href: "/student/classes" },
      { key: "marketplace", label: "Marketplace", icon: "store", href: "/student/marketplace" },
    ];
  }

  const nav: NavEntry[] = [
    { key: "dashboard", label: "Dashboard", icon: "layout-dashboard", href: "/coaching/dashboard" },
    // Owner sees every teacher's batch, so it's just "Classes"; a teacher sees only their own → "My Classes".
    { key: "classes", label: isOwner ? "Classes" : "My Classes", icon: "graduation-cap", href: "/coaching/classes" },
    { section: "Assessments" },
    { key: "exams", label: "Exams", icon: "file-text", href: "/coaching/exams" },
    // Owner-only approval + live-monitor hub, sits right under Exams.
    ...(isOwner ? [{ key: "approvals" as const, label: "Approvals", icon: "check-circle" as const, href: "/coaching/exams/approvals" }] : []),
    { key: "question-bank", label: "Question Bank", icon: "book-open", href: "/coaching/question-bank" },
    // Authoring is a teacher job. The owner reviews and schedules papers; they
    // never write one, so the generator is not in their navigation at all —
    // every route behind it answers 403 for them (`requireTenantRole('teacher')`).
    ...(isOwner ? [] : [{ key: "test-engine" as const, label: "Test Engine", icon: "sparkles" as const, href: "/coaching/test-engine" }]),
    // No "AI Analysis" entry: exam reports are a STUDENT view — `/student/results`
    // lists the signed-in user's own, so staff only ever saw "You haven't taken any
    // exams yet". Staff analysis is per-exam — the reports panel on
    // /coaching/exams/:id — and is reached by opening the exam, not the sidebar.
    { section: "Manage" },
    { key: "members", label: "Members", icon: "users", href: dash("Members") },
  ];

  if (isOwner) {
    // Owner-only: teachers roster + workload lives at its own route.
    nav.push({ key: "teachers", label: "Teachers", icon: "user-check", href: "/coaching/teachers" });
    nav.push({ key: "invites", label: "Invites & Codes", icon: "plus", href: dash("Invites / Join Codes") });
    nav.push({ section: "Institute" });
    // `building`, not `settings` — this row is the INSTITUTE, and the gear
    // belongs to the personal Account entry in the sidebar footer.
    //
    // ONE row, not three. "Plan & Billing" and "Danger Zone" used to sit beside
    // it as their own destinations; both are now TABS inside this screen. Neither
    // is a daily navigation target, and "delete my whole institute" one mis-click
    // from "Settings" in the permanent menu is a hazard, not a convenience.
    // Billing is still gated on `entitlements.billingEnabled` — the tab simply
    // does not render while the platform billing switch is off — which is why
    // this function no longer needs to branch on it here.
    nav.push({ key: "settings", label: "Settings", icon: "building", href: dash("Settings") });
  }

  return nav;
}

/**
 * Everything below the divider at the bottom of the sidebar.
 *
 * Not part of `buildAppNav` because it is not navigation between areas of the
 * institute — it is the "this is ME" block that every SaaS shell pins to the
 * bottom: who is signed in, their account, and the way out. `AppSidebar` renders
 * it after a spacer, identical for every role.
 *
 * Kept here rather than inline in the component for the same reason as the rest
 * of this module: it is a plain data structure a Node test can assert on.
 */
export const ACCOUNT_ENTRY = {
  key: "account",
  label: "Account",
  icon: "settings",
  href: "/account",
} as const satisfies Extract<NavEntry, { key: AppNavKey }>;

/** The tabs on `?screen=Settings`, in render order. */
export type SettingsTabKey = "general" | "billing" | "danger";

export const SETTINGS_TAB_LABEL: Record<SettingsTabKey, string> = {
  general: "General",
  billing: "Billing",
  danger: "Danger Zone",
};

/**
 * Which tabs the institute Settings screen shows.
 *
 * Two independent conditions gate "billing", both required, and this is the only
 * place either is expressed:
 *
 *  - **Owner only.** Plan pricing is the owner's business; a teacher cannot even
 *    open this screen (`OWNER_ONLY_SCREENS` on the dashboard, and a 403 behind
 *    every call the tab would make).
 *  - **Billing actually live.** Gated on `billingEnabled` rather than on the plan
 *    name, because while the platform switch is off every coaching resolves to an
 *    unmetered plan — so the plan name tells you nothing about whether the
 *    product exists yet. With it off the tab is absent, not disabled: every
 *    request behind it 404s, so it would render as a broken screen rather than an
 *    upsell.
 *
 * `entitlements` is optional so this stays callable from a plain Node test and
 * from a caller whose session has not resolved; omitting it gives the
 * billing-off answer, which is what the server says today.
 */
export function buildSettingsTabs(
  role: string,
  entitlements: Entitlements = NO_BILLING,
): SettingsTabKey[] {
  if (role !== "coaching_owner") return [];
  return entitlements.billingEnabled
    ? ["general", "billing", "danger"]
    : ["general", "danger"];
}

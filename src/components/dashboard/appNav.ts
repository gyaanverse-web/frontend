import type { IconName } from "@/components/ui";

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

/** Build the role-aware nav. The list is identical on every page for a given role. */
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
      { section: "Account" },
      { key: "account", label: "Account", icon: "settings", href: "/account" },
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
    nav.push({ key: "teachers", label: "Teachers", icon: "users", href: "/coaching/teachers" });
    nav.push({ key: "invites", label: "Invites & Codes", icon: "plus", href: dash("Invites / Join Codes") });
    nav.push({ key: "plan", label: "Plan & Billing", icon: "wallet", href: dash("Plan & Billing") });
    nav.push({ section: "Institute" });
    nav.push({ key: "settings", label: "Settings", icon: "settings", href: dash("Settings") });
    nav.push({ key: "danger", label: "Danger Zone", icon: "bell", href: dash("Danger Zone") });
  }

  return nav;
}

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
  | "results"
  | "marketplace"
  | "account"
  | "question-bank"
  | "test-engine"
  | "subjects"
  | "analytics"
  | "teachers"
  | "members"
  | "invites"
  | "plan"
  | "settings"
  | "danger";

export type NavEntry =
  | { key: AppNavKey; label: string; icon: IconName; href: string }
  | { section: string };

const dash = (screen: string) => `/dashboard?screen=${encodeURIComponent(screen)}`;

/** Build the role-aware nav. The list is identical on every page for a given role. */
export function buildAppNav(role: string): NavEntry[] {
  const isOwner = role === "coaching_owner";
  const canMembers = isOwner || role === "teacher";

  if (!canMembers) {
    // Student: the full student area. Home is the landing dashboard; the rest are
    // student-tailored surfaces. (Some still render the legacy sections until their
    // redesign lands — see the routes they point at.)
    return [
      { key: "home", label: "Home", icon: "layout-dashboard", href: "/dashboard" },
      { key: "exams", label: "My Exams", icon: "file-text", href: dash("Exams") },
      { key: "results", label: "My Results", icon: "chart-column", href: dash("Results") },
      { key: "classes", label: "My Classes", icon: "graduation-cap", href: dash("Classes") },
      { key: "marketplace", label: "Marketplace", icon: "store", href: dash("Marketplace") },
      { section: "Account" },
      { key: "account", label: "Account", icon: "settings", href: "/account" },
    ];
  }

  const nav: NavEntry[] = [
    { key: "dashboard", label: "Dashboard", icon: "layout-dashboard", href: "/dashboard" },
    // Owner sees every teacher's batch, so it's just "Classes"; a teacher sees only their own → "My Classes".
    { key: "classes", label: isOwner ? "Classes" : "My Classes", icon: "graduation-cap", href: "/classes" },
    { section: "Assessments" },
    { key: "exams", label: "Exams", icon: "file-text", href: "/exams" },
    { key: "question-bank", label: "Question Bank", icon: "book-open", href: "/question-bank" },
    { key: "test-engine", label: "Test Engine", icon: "sparkles", href: "/test-engine" },
    { section: "Content" },
    { key: "analytics", label: "AI Analysis", icon: "chart-column", href: "/reports" },
    { section: "Manage" },
    { key: "members", label: "Members", icon: "users", href: dash("Members") },
  ];

  if (isOwner) {
    // Owner-only: teachers roster + workload lives at its own route.
    nav.push({ key: "teachers", label: "Teachers", icon: "users", href: "/teachers" });
    nav.push({ key: "invites", label: "Invites & Codes", icon: "plus", href: dash("Invites / Join Codes") });
    nav.push({ key: "plan", label: "Plan & Billing", icon: "wallet", href: dash("Plan & Billing") });
    nav.push({ section: "Institute" });
    nav.push({ key: "settings", label: "Settings", icon: "settings", href: dash("Settings") });
    nav.push({ key: "danger", label: "Danger Zone", icon: "bell", href: dash("Danger Zone") });
  }

  return nav;
}

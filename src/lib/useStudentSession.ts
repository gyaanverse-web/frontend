"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTenantSession, type TenantBase, type TenantSession } from "./useTenantSession";
import { belongsToStudentArea } from "@/components/dashboard/appNav";

export interface StudentSession<T extends TenantBase> extends TenantSession<T> {
  /**
   * Session resolved AND the caller really is a student. Screens render their
   * skeleton until this is true — before then `user` may be null, and a
   * non-student is mid-redirect to their own dashboard.
   */
  ready: boolean;
}

/**
 * The session gate for every `/student/*` route.
 *
 * Deliberately NOT `useTenantSession({ allow: ["student"] })`. That option gates
 * on the **membership** role, and a student who hasn't joined a coaching has no
 * membership at all — `allow` would bounce them off the very screens that work
 * without one (Marketplace, and the "join a coaching" state of the others).
 *
 * So the test is `belongsToStudentArea`, shared verbatim with the staff
 * dashboard's outbound redirect — the two gates point at each other, and any
 * disagreement is an infinite bounce. `requireTenant: false` keeps a
 * coaching-less student on the page instead of redirecting them away.
 */
export function useStudentSession<T extends TenantBase = TenantBase>(): StudentSession<T> {
  const router = useRouter();
  const session = useTenantSession<T>({ requireTenant: false });
  const { loading, role, accountRole, signupIntent } = session;

  // Every input is null while loading, so gate on `!loading` — never redirect
  // on an unresolved session.
  const isStudent = !loading && belongsToStudentArea(role, accountRole, signupIntent);

  useEffect(() => {
    if (!loading && !isStudent) router.replace("/coaching/dashboard");
  }, [loading, isStudent, router]);

  return { ...session, ready: isStudent && session.user !== null };
}

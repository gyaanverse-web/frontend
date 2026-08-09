"use client";

import { TeacherShell } from "@/components/dashboard/TeacherShell";
import type { AppNavKey } from "@/components/dashboard/appNav";

/**
 * The frame a `/student/*` route renders while its session resolves.
 *
 * `role={null}` is load-bearing: it makes AppSidebar draw its skeleton instead
 * of a menu. Passing "student" here would be a guess — and guessing a role in
 * the shell is exactly what once put students in front of the teacher nav.
 */
export function StudentScreenSkeleton({ active }: { active: AppNavKey }) {
  return (
    <TeacherShell tenant={null} user={null} role={null} active={active}>
      <div style={{ padding: "60px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
        Loading…
      </div>
    </TeacherShell>
  );
}

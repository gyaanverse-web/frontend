"use client";

import { useStudentSession } from "@/lib/useStudentSession";
import { StudentFees } from "@/components/student/StudentFees";
import { StudentScreenSkeleton } from "@/components/student/StudentScreenSkeleton";

export default function FeesScreen() {
  const { user, tenant, ready } = useStudentSession();
  if (!ready || !user) return <StudentScreenSkeleton active="fees" />;
  return <StudentFees user={user} tenant={tenant} />;
}

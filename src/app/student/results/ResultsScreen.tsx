"use client";

import { useStudentSession } from "@/lib/useStudentSession";
import { StudentReportsHistory } from "@/components/student/StudentReportsHistory";
import { StudentScreenSkeleton } from "@/components/student/StudentScreenSkeleton";

export default function ResultsScreen() {
  const { user, tenant, ready } = useStudentSession();
  if (!ready || !user) return <StudentScreenSkeleton active="results" />;
  return <StudentReportsHistory user={user} tenant={tenant} />;
}

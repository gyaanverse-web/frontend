"use client";

import { useStudentSession } from "@/lib/useStudentSession";
import { StudentMyBatches } from "@/components/student/StudentMyBatches";
import { StudentScreenSkeleton } from "@/components/student/StudentScreenSkeleton";

export default function BatchesScreen() {
  const { user, tenant, ready } = useStudentSession();
  if (!ready || !user) return <StudentScreenSkeleton active="batches" />;
  return <StudentMyBatches user={user} tenant={tenant} />;
}

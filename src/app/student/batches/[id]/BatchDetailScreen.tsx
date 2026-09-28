"use client";

import { useParams } from "next/navigation";
import { useStudentSession } from "@/lib/useStudentSession";
import { StudentBatchDetail } from "@/components/student/StudentBatchDetail";
import { StudentScreenSkeleton } from "@/components/student/StudentScreenSkeleton";

export default function BatchDetailScreen() {
  const params = useParams();
  const batchId = (params?.id as string) ?? "";
  const { user, tenant, ready } = useStudentSession();
  if (!ready || !user) return <StudentScreenSkeleton active="batches" />;
  return <StudentBatchDetail batchId={batchId} user={user} tenant={tenant} />;
}

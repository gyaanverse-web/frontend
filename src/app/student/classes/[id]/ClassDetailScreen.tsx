"use client";

import { useParams } from "next/navigation";
import { useStudentSession } from "@/lib/useStudentSession";
import { StudentClassDetail } from "@/components/student/StudentClassDetail";
import { StudentScreenSkeleton } from "@/components/student/StudentScreenSkeleton";

export default function ClassDetailScreen() {
  const params = useParams();
  const classId = (params?.id as string) ?? "";
  const { user, tenant, ready } = useStudentSession();
  if (!ready || !user) return <StudentScreenSkeleton active="classes" />;
  return <StudentClassDetail classId={classId} user={user} tenant={tenant} />;
}

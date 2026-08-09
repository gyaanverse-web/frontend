"use client";

import { useStudentSession } from "@/lib/useStudentSession";
import { StudentMyExams } from "@/components/student/StudentMyExams";
import { StudentScreenSkeleton } from "@/components/student/StudentScreenSkeleton";

export default function ExamsScreen() {
  const { user, tenant, ready } = useStudentSession();
  if (!ready || !user) return <StudentScreenSkeleton active="exams" />;
  return <StudentMyExams user={user} tenant={tenant} />;
}

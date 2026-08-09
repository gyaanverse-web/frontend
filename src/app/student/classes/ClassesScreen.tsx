"use client";

import { useStudentSession } from "@/lib/useStudentSession";
import { StudentMyClasses } from "@/components/student/StudentMyClasses";
import { StudentScreenSkeleton } from "@/components/student/StudentScreenSkeleton";

export default function ClassesScreen() {
  const { user, tenant, ready } = useStudentSession();
  if (!ready || !user) return <StudentScreenSkeleton active="classes" />;
  return <StudentMyClasses user={user} tenant={tenant} />;
}

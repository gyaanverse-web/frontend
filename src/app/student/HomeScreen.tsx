"use client";

import { useStudentSession } from "@/lib/useStudentSession";
import { StudentHome } from "@/components/student/StudentHome";
import { StudentScreenSkeleton } from "@/components/student/StudentScreenSkeleton";

export default function HomeScreen() {
  const { user, tenant, ready } = useStudentSession();
  if (!ready || !user) return <StudentScreenSkeleton active="home" />;
  return <StudentHome user={user} tenant={tenant} />;
}

"use client";

import { useStudentSession } from "@/lib/useStudentSession";
import { StudentMarketplace } from "@/components/student/StudentMarketplace";
import { StudentScreenSkeleton } from "@/components/student/StudentScreenSkeleton";

export default function MarketplaceScreen() {
  const { user, tenant, ready } = useStudentSession();
  if (!ready || !user) return <StudentScreenSkeleton active="marketplace" />;
  return <StudentMarketplace user={user} tenant={tenant} />;
}

import { StudentScreenSkeleton } from "@/components/student/StudentScreenSkeleton";

/**
 * Segment-level fallback: covers every `/student/*` route that doesn't ship its
 * own `loading.tsx`. The nav key is deliberately "home" — the sidebar renders
 * its skeleton at this point anyway, so nothing is highlighted either way.
 */
export default function StudentLoading() {
  return <StudentScreenSkeleton active="home" />;
}

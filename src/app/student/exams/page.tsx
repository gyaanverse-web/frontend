import type { Metadata } from "next";
import { Suspense } from "react";
import { StudentScreenSkeleton } from "@/components/student/StudentScreenSkeleton";
import ExamsScreen from "./ExamsScreen";

export const metadata: Metadata = {
  title: "My Exams",
  description: "Exams assigned to your batches — upcoming, open now, and done.",
};

export default function StudentExamsPage() {
  // The screen keeps its active tab in `?tab=`, and `useSearchParams` needs a
  // Suspense boundary or the production build fails.
  return (
    <Suspense fallback={<StudentScreenSkeleton active="exams" />}>
      <ExamsScreen />
    </Suspense>
  );
}

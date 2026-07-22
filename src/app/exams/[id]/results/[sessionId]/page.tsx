"use client";

import { useParams } from "next/navigation";
import { StudentResults } from "@/components/student/StudentResults";

// This legacy route (linked from /reports and the old /take submit) now renders
// the same design-faithful results screen as /exams/:id/result?session=… so the
// results UI is identical everywhere. StudentResults fetches its own data from
// /sessions/:id/results + /sessions/:id/evaluation.
export default function ResultsPage() {
  const { id, sessionId } = useParams<{ id: string; sessionId: string }>();
  return <StudentResults examId={id} sessionId={sessionId} />;
}

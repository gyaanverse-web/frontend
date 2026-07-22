"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { StudentResults } from "@/components/student/StudentResults";

function ResultContent() {
  const { id } = useParams<{ id: string }>();
  const sessionId = useSearchParams().get("session") ?? "";
  return <StudentResults examId={id} sessionId={sessionId} />;
}

export default function ExamResultPage() {
  return (
    <Suspense fallback={null}>
      <ResultContent />
    </Suspense>
  );
}

"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { StudentResults } from "@/components/student/StudentResults";

function ResultContent() {
  const { id } = useParams<{ id: string }>();
  const state = useSearchParams().get("state") === "evaluating" ? "evaluating" : "evaluated";
  return <StudentResults examId={id} state={state} />;
}

export default function ExamResultPage() {
  return (
    <Suspense fallback={null}>
      <ResultContent />
    </Suspense>
  );
}

"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { StudentExamIntro, StudentExamIntroPaid } from "@/components/student/StudentExamIntro";

function IntroContent() {
  const { id } = useParams<{ id: string }>();
  const variant = useSearchParams().get("variant");
  return variant === "paid" ? <StudentExamIntroPaid examId={id} /> : <StudentExamIntro examId={id} />;
}

export default function ExamIntroPage() {
  return (
    <Suspense fallback={null}>
      <IntroContent />
    </Suspense>
  );
}

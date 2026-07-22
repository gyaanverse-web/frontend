"use client";

import { useParams } from "next/navigation";
import { StudentExamIntro } from "@/components/student/StudentExamIntro";

export default function ExamIntroPage() {
  const { id } = useParams<{ id: string }>();
  return <StudentExamIntro examId={id} />;
}

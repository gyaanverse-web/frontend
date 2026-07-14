"use client";

import { useParams } from "next/navigation";
import { StudentExamPlayer } from "@/components/student/StudentExamPlayer";

export default function ExamAttemptPage() {
  const { id } = useParams<{ id: string }>();
  return <StudentExamPlayer examId={id} />;
}

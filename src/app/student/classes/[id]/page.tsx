import type { Metadata } from "next";
import ClassDetailScreen from "./ClassDetailScreen";

export const metadata: Metadata = {
  title: "Batch",
  description: "Your teacher, classmates and exams for this batch.",
};

export default function StudentClassDetailPage() {
  return <ClassDetailScreen />;
}

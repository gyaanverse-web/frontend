import type { Metadata } from "next";
import BatchDetailScreen from "./BatchDetailScreen";

export const metadata: Metadata = {
  title: "Batch",
  description: "Your teacher, batchmates and exams for this batch.",
};

export default function StudentBatchDetailPage() {
  return <BatchDetailScreen />;
}

import type { Metadata } from "next";
import BatchesScreen from "./BatchesScreen";

export const metadata: Metadata = {
  title: "My Batches",
  description: "The batches you're enrolled in at your coaching institute.",
};

export default function StudentBatchesPage() {
  return <BatchesScreen />;
}

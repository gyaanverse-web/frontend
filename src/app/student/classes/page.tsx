import type { Metadata } from "next";
import ClassesScreen from "./ClassesScreen";

export const metadata: Metadata = {
  title: "My Classes",
  description: "The batches you're enrolled in at your coaching institute.",
};

export default function StudentClassesPage() {
  return <ClassesScreen />;
}

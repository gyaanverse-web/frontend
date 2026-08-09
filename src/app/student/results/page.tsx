import type { Metadata } from "next";
import ResultsScreen from "./ResultsScreen";

export const metadata: Metadata = {
  title: "My Results",
  description: "Your published exam reports and score trend.",
};

export default function StudentResultsPage() {
  return <ResultsScreen />;
}

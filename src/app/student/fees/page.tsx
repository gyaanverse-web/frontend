import type { Metadata } from "next";
import FeesScreen from "./FeesScreen";

export const metadata: Metadata = {
  title: "My Fees",
  description: "Your fee installments, dues and payment history.",
};

export default function StudentFeesPage() {
  return <FeesScreen />;
}

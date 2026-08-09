import type { Metadata } from "next";
import HomeScreen from "./HomeScreen";

export const metadata: Metadata = {
  title: "Home",
  description: "Your exams, results and progress at a glance.",
};

export default function StudentHomePage() {
  return <HomeScreen />;
}

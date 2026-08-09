import type { Metadata } from "next";
import { Suspense } from "react";
import { StudentScreenSkeleton } from "@/components/student/StudentScreenSkeleton";
import MarketplaceScreen from "./MarketplaceScreen";

export const metadata: Metadata = {
  title: "Marketplace",
  description: "Public mock tests from coaching institutes across India.",
};

export default function StudentMarketplacePage() {
  // Search box and filters live in the query string, and `useSearchParams` needs
  // a Suspense boundary or the production build fails.
  return (
    <Suspense fallback={<StudentScreenSkeleton active="marketplace" />}>
      <MarketplaceScreen />
    </Suspense>
  );
}

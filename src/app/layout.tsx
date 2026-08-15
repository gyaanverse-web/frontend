import type { Metadata } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";
import { BuildStamp } from "@/components/BuildStamp";
import { BUILD_INFO } from "@/lib/buildInfo";

export const metadata: Metadata = {
  title: "Gyaanverse",
  description: "Coaching institute management platform",
  // Visible in "View Source" on any page, invisible to anyone who isn't
  // looking for it — the cheapest way to confirm a deploy landed.
  other: { "x-build": BUILD_INFO.line },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {children}
        <BuildStamp />
      </body>
    </html>
  );
}

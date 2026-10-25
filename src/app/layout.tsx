import type { Metadata } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";
import { BuildStamp } from "@/components/BuildStamp";
import { BUILD_INFO } from "@/lib/buildInfo";
import { SITE_ORIGIN } from "@/lib/seo";

export const metadata: Metadata = {
  // Required for the social-card URLs to come out absolute. Without it Next
  // emits a relative `og:image`, which every scraper rejects, and warns at
  // build time. Always the marketing origin, never the current host: a card
  // scraped from a tenant subdomain should still point at the public site.
  metadataBase: new URL(SITE_ORIGIN),
  title: "Gyaanverse",
  description: "Coaching institute management platform",
  // `src/app/opengraph-image.png` is picked up by file convention and applies
  // to every route under this layout, so there is no `images` key here.
  openGraph: {
    type: "website",
    siteName: "Gyaanverse",
    locale: "en_IN",
    url: "/",
    title: "Gyaanverse — The all-in-one EdTech OS",
    description:
      "Host batches, automate fees, run AI-powered exams, and analyze performance. Built for Indian coaching institutes.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Gyaanverse — The all-in-one EdTech OS",
    description:
      "Host batches, automate fees, run AI-powered exams, and analyze performance. Built for Indian coaching institutes.",
  },
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

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the Next.js dev server (HMR, dev assets) to serve requests from
  // every *.lvh.me host so tenant subdomains work in development.
  allowedDevOrigins: ["app.lvh.me", "*.lvh.me"],
};

export default nextConfig;

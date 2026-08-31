import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import path from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// Build stamp.
//
// Answers one question with no dashboard visit: "is the site I'm looking at
// actually the commit I just pushed?" Vercel hands the commit to the build, so
// on Vercel this is free; the `git` fallback only ever runs on a laptop.
//
// These are read at BUILD time and inlined into the bundle, which is the whole
// point — the number is baked into the artifact, so it cannot drift from the
// code around it the way a runtime lookup could.
// ─────────────────────────────────────────────────────────────────────────────

function fromGit(args: string, fallback = "unknown"): string {
  try {
    return execSync(`git ${args}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    // No git in the build container, or not a repo. Not worth failing a build.
    return fallback;
  }
}

const commitSha =
  process.env.VERCEL_GIT_COMMIT_SHA || fromGit("rev-parse HEAD");

const commitRef =
  process.env.VERCEL_GIT_COMMIT_REF || fromGit("rev-parse --abbrev-ref HEAD");

const nextConfig: NextConfig = {
  // Pin the workspace root to this directory. Without this, Turbopack scans
  // upward for lockfiles and can lock onto an unrelated one sitting in a
  // parent folder (e.g. sibling scratch projects), which throws off HMR/file
  // watching in dev.
  turbopack: {
    root: path.join(__dirname),
  },

  // Allow the Next.js dev server (HMR, dev assets) to serve requests from
  // every *.lvh.me host so tenant subdomains work in development.
  allowedDevOrigins: ["app.lvh.me", "*.lvh.me"],

  env: {
    NEXT_PUBLIC_BUILD_SHA: commitSha,
    NEXT_PUBLIC_BUILD_REF: commitRef,
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
    NEXT_PUBLIC_BUILD_ENV:
      process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
  },
};

export default nextConfig;

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

// ─────────────────────────────────────────────────────────────────────────────
// Deployed-build environment guard.
//
// `lib/api.ts` falls back to `http://localhost:8000` when NEXT_PUBLIC_API_URL
// is unset. That is correct on a laptop and catastrophic in a deployed build,
// because NEXT_PUBLIC_* values are INLINED at build time: the artifact would
// ship telling every visitor's browser to call port 8000 on their own machine.
// Nothing about that fails loudly — the site renders, and every API call dies
// in the network tab — so it has to be caught here, at build time, where the
// mistake is still cheap.
//
// Vercel sets VERCEL_ENV on any deployed build. A local `next build` has it
// unset and keeps the localhost fallback, so this never gets in the way of
// building on a laptop.
// ─────────────────────────────────────────────────────────────────────────────
const deployedEnv = process.env.VERCEL_ENV;
const isDeployedBuild = deployedEnv === "production" || deployedEnv === "preview";

if (!process.env.NEXT_PUBLIC_API_URL) {
  if (isDeployedBuild) {
    throw new Error(
      `NEXT_PUBLIC_API_URL is not set for this ${deployedEnv} build. ` +
        "The bundle would be built with the http://localhost:8000 dev fallback " +
        "baked in and every API call from the browser would fail. Set it in the " +
        "Vercel project's environment variables for this environment, then redeploy.",
    );
  }
  console.warn(
    "  next.config.ts: NEXT_PUBLIC_API_URL is unset — using the " +
      "http://localhost:8000 dev fallback. Fine locally; this would throw on Vercel.",
  );
}

// The tenant model depends on these two just as hard (see lib/domain.ts: with
// no root domain configured, `staging` would be parsed as a tenant slug). They
// only warn rather than throw because, unlike the API URL, a wrong value here
// degrades instead of breaking outright — promote to a throw once the Vercel
// project is confirmed to set both.
for (const key of ["NEXT_PUBLIC_APP_ROOT_DOMAIN", "NEXT_PUBLIC_APP_HOST"]) {
  if (isDeployedBuild && !process.env[key]) {
    console.warn(
      `  next.config.ts: ${key} is unset for this ${deployedEnv} build — ` +
        "tenant subdomain resolution will fall back to dev behaviour.",
    );
  }
}

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

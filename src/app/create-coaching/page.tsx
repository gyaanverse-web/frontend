"use client";

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { buildTenantUrl } from "@/lib/tenantUrl";
import { TENANT_ROOT_DOMAIN } from "@/lib/domain";
import { Logo, Button } from "@/components/ui";

const PAGE_BG =
  "radial-gradient(ellipse 70% 50% at 50% 0%, #eef0fc 0%, var(--paper-50) 60%)";

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

function CreateCoachingContent() {
  const router = useRouter();

  const [name, setName]       = useState("");
  const [slug, setSlug]       = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  function handleNameChange(value: string) {
    setName(value);
    setSlug(toSlug(value));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/tenants", { name, slug });
      // Hard cross-origin nav onto the new tenant's subdomain. router.push
      // would stay on the current origin; the auth cookie is set on the
      // registrable domain so the session survives the hop.
      window.location.href = buildTenantUrl(slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create coaching");
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: PAGE_BG, padding: "48px 24px" }}>
      <Link href="/" style={{ marginBottom: 32 }}>
        <Logo size={24} />
      </Link>

      <div
        style={{
          background: "#fff",
          border: "1px solid var(--border-light)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg)",
          padding: 40,
          width: "100%",
          maxWidth: 480,
        }}
      >
        <h2 style={{ fontSize: 28, marginBottom: 6 }}>Create your coaching.</h2>
        <p style={{ fontFamily: "var(--font-body)", fontSize: 15, color: "var(--text-muted)", marginBottom: 28 }}>
          You become the owner of this institute. Students and teachers can join after setup.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <label style={{ display: "block" }}>
            <span className="gv-label">Institute name</span>
            <input
              className="gv-input" type="text" required minLength={2} maxLength={255}
              placeholder="e.g. Sharma Classes"
              value={name} onChange={(e) => handleNameChange(e.target.value)}
            />
          </label>

          <label style={{ display: "block" }}>
            <span className="gv-label">URL slug</span>
            <input
              className="gv-input" type="text" required minLength={3} maxLength={63}
              pattern="^[a-z0-9-]+$" style={{ fontFamily: "var(--font-mono)" }}
              placeholder="sharma-classes"
              value={slug} onChange={(e) => setSlug(e.target.value)}
            />
            <div className="gv-help">
              Lowercase letters, numbers, hyphens only. Becomes{" "}
              <strong style={{ color: "var(--text-body)" }}>{slug || "yourname"}.{TENANT_ROOT_DOMAIN}</strong>.
            </div>
          </label>

          {error && (
            <p
              style={{
                margin: 0,
                padding: "10px 14px",
                background: "var(--danger-soft)",
                border: "1px solid rgba(244,63,94,0.35)",
                borderRadius: "var(--radius-md)",
                fontSize: 13,
                color: "var(--danger)",
              }}
            >
              {error}
            </p>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <Button type="button" variant="secondary" size="lg" onClick={() => router.push("/dashboard")}>
              Cancel
            </Button>
            <Button type="submit" size="lg" arrow disabled={loading} style={{ flex: 1 }}>
              {loading ? "Creating…" : "Create institute"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CreateCoachingPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: PAGE_BG, fontSize: 14, color: "var(--text-muted)" }}>
          Loading…
        </div>
      }
    >
      <CreateCoachingContent />
    </Suspense>
  );
}

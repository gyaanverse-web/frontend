"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { buildTenantUrl } from "@/lib/tenantUrl";

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

function CreateCoachingContent() {
  const params = useSearchParams();

  const [form, setForm]       = useState({ name: "", slug: "" });
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  // Pre-fill from URL params (set by dashboard when pendingCoaching exists)
  useEffect(() => {
    const name = params.get("name") ?? "";
    const slug = params.get("slug") ?? "";
    if (name || slug) {
      setForm({ name, slug });
    }
  }, [params]);

  function handleNameChange(value: string) {
    setForm({ name: value, slug: toSlug(value) });
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header style={{ background: "#1a2e4a", color: "#fff", padding: "8px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontWeight: "bold", fontSize: "15px", letterSpacing: "0.5px" }}>GYANVERSE</span>
        <Link href="/dashboard" style={{ color: "#aac4e8", fontSize: "13px" }}>← Dashboard</Link>
      </header>

      {/* ── Main ───────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div style={{ background: "#fff", border: "1px solid #aaa", width: "100%", maxWidth: "420px" }}>

          <div style={{ background: "#1a2e4a", color: "#fff", padding: "5px 10px", fontSize: "12px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Create Coaching Institute
          </div>

          <div style={{ padding: "16px" }}>
            <p style={{ margin: "0 0 12px 0", fontSize: "13px", borderLeft: "3px solid #1a4db8", paddingLeft: "8px", color: "#111" }}>
              You will become the owner of this coaching institute. Students and teachers can join after setup.
            </p>

            <form onSubmit={async (e) => {
              e.preventDefault();
              setError("");
              setLoading(true);
              try {
                await api.post("/tenants", form);
                sessionStorage.removeItem("pendingCoaching");
                // Hard cross-origin nav onto the new tenant's subdomain. router.push
                // would stay on the current origin; the auth cookie is set on the
                // registrable domain so the session survives the hop.
                window.location.href = buildTenantUrl(form.slug);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to create coaching");
              } finally {
                setLoading(false);
              }
            }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td style={{ padding: "5px 10px 5px 0", fontWeight: "bold", fontSize: "13px", whiteSpace: "nowrap", width: "110px", verticalAlign: "top", paddingTop: "9px" }}>
                      <label htmlFor="name">Institute Name</label>
                    </td>
                    <td style={{ padding: "5px 0" }}>
                      <input
                        id="name"
                        type="text"
                        required
                        minLength={2}
                        maxLength={255}
                        value={form.name}
                        onChange={(e) => handleNameChange(e.target.value)}
                        placeholder="e.g. Sharma Classes"
                        style={{ width: "100%", border: "1px solid #666", padding: "4px 6px", background: "#fff", color: "#111" }}
                      />
                    </td>
                  </tr>
                  <tr>
                    <td style={{ padding: "5px 10px 5px 0", fontWeight: "bold", fontSize: "13px", whiteSpace: "nowrap", verticalAlign: "top", paddingTop: "9px" }}>
                      <label htmlFor="slug">URL Slug</label>
                    </td>
                    <td style={{ padding: "5px 0" }}>
                      <input
                        id="slug"
                        type="text"
                        required
                        minLength={3}
                        maxLength={63}
                        pattern="^[a-z0-9-]+$"
                        value={form.slug}
                        onChange={(e) => setForm({ ...form, slug: e.target.value })}
                        placeholder="sharma-classes"
                        style={{ width: "100%", border: "1px solid #666", padding: "4px 6px", background: "#fff", color: "#111", fontFamily: "monospace" }}
                      />
                      <span style={{ fontSize: "11px", color: "#444" }}>
                        Lowercase, numbers, hyphens. Used as subdomain: <em>slug.gyanverse.app</em>
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>

              {error && (
                <p style={{ margin: "8px 0 0 0", color: "#c00", fontSize: "13px", border: "1px solid #c00", padding: "4px 8px", background: "#fff5f5" }}>
                  {error}
                </p>
              )}

              <div style={{ marginTop: "14px", display: "flex", gap: "8px" }}>
                <button
                  type="submit"
                  disabled={loading}
                  style={{ background: loading ? "#888" : "#1a4db8", color: "#fff", border: "1px solid #1a4db8", padding: "5px 20px", fontWeight: "bold", cursor: loading ? "not-allowed" : "pointer" }}
                >
                  {loading ? "Creating…" : "Create Institute"}
                </button>
                <Link
                  href="/dashboard"
                  style={{ background: "#fff", color: "#444", border: "1px solid #aaa", padding: "5px 16px", textDecoration: "none", fontSize: "13px" }}
                >
                  Cancel
                </Link>
              </div>
            </form>
          </div>
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer style={{ background: "#ddd", borderTop: "1px solid #aaa", padding: "6px 16px", fontSize: "12px", color: "#333" }}>
        &copy; {new Date().getFullYear()} Gyanverse &mdash; All rights reserved
      </footer>
    </div>
  );
}

export default function CreateCoachingPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px" }}>Loading…</div>}>
      <CreateCoachingContent />
    </Suspense>
  );
}

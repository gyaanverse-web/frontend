"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { buildTenantUrl } from "@/lib/tenantUrl";
import type { CoachingJoinCode, Tenant } from "../types";
import { fmtLimit } from "../types";
import { sh, cell, inp, btnP, btnS, btnD } from "../styles";

type Props = { tenant: Tenant };

export function JoinCodesSection({ tenant }: Props) {
  const [codes, setCodes]         = useState<CoachingJoinCode[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  const [showForm, setShowForm]           = useState(false);
  const [form, setForm]                   = useState({ expiresAt: "", maxUses: "" });
  const [createLoading, setCreateLoading] = useState(false);
  const [createMsg, setCreateMsg]         = useState("");
  const [createErr, setCreateErr]         = useState("");

  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [copiedId, setCopiedId]               = useState<string | null>(null);

  async function load() {
    setLoading(true); setError("");
    try {
      const data = await api.get<{ joinCodes: CoachingJoinCode[] }>("/tenant/join-code", { tenant: tenant.slug });
      setCodes(data.joinCodes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load join codes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateErr(""); setCreateMsg(""); setCreateLoading(true);
    try {
      const body: Record<string, unknown> = {};
      if (form.expiresAt) {
        const d = new Date(form.expiresAt);
        d.setHours(23, 59, 59, 999);
        body.expiresAt = d.toISOString();
      }
      if (form.maxUses)   body.maxUses   = parseInt(form.maxUses, 10);
      const res = await api.post<{ joinCode: CoachingJoinCode }>("/tenant/join-code", body, { tenant: tenant.slug });
      setCreateMsg(`Code ${res.joinCode.code} created.`);
      setForm({ expiresAt: "", maxUses: "" });
      setCodes(prev => [res.joinCode, ...prev]);
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : "Failed to create code");
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleRevoke(id: string) {
    setConfirmRevokeId(null); setError("");
    try {
      await api.delete(`/tenant/join-code/${id}`, { tenant: tenant.slug });
      setCodes(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke code");
    }
  }

  async function copyLink(jc: CoachingJoinCode) {
    const url = buildTenantUrl(tenant.slug, `/join/${jc.code}`);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback for non-secure contexts (e.g. http://niazi.lvh.me in dev)
        const el = document.createElement("textarea");
        el.value = url;
        el.style.cssText = "position:fixed;opacity:0";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setCopiedId(jc.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      setError("Failed to copy link");
    }
  }

  return (
    <div style={{ background: "var(--surface-card)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-sm)", marginBottom: "16px", overflow: "hidden" }}>
      <div style={sh}>
        <span>Student join codes</span>
        <button
          type="button"
          onClick={() => { setShowForm(v => !v); setCreateErr(""); setCreateMsg(""); }}
          style={{ ...(showForm ? btnS : btnP), padding: "6px 14px", fontSize: 12 }}
        >
          {showForm ? "Cancel" : "+ Create join code"}
        </button>
      </div>

        <>
          {/* Create code form (collapsed by default) */}
          {showForm && (
          <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-default)", background: "var(--bg-section-alt)" }}>
            <form onSubmit={handleCreate} style={{ display: "flex", gap: "8px", alignItems: "flex-end", flexWrap: "wrap" }}>
              <span style={{ fontSize: "13px", fontWeight: "bold", whiteSpace: "nowrap", alignSelf: "center" }}>New Code</span>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <label style={{ fontSize: "11px", color: "var(--text-muted)" }}>Expires (optional)</label>
                <input type="date" value={form.expiresAt} onChange={e => setForm({ ...form, expiresAt: e.target.value })} style={inp} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <label style={{ fontSize: "11px", color: "var(--text-muted)" }}>Max uses (optional)</label>
                <input type="number" min={1} max={99999} placeholder="1000" value={form.maxUses} onChange={e => setForm({ ...form, maxUses: e.target.value })} style={{ ...inp, width: "90px" }} />
              </div>
              <button type="submit" disabled={createLoading} style={{ ...btnP, opacity: createLoading ? 0.6 : 1, alignSelf: "flex-end" }}>
                {createLoading ? "Creating…" : "Generate Code"}
              </button>
            </form>
            {createErr && <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--danger)" }}>{createErr}</p>}
            {createMsg && <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--success)" }}>{createMsg}</p>}
          </div>
          )}

          {/* Toolbar */}
          <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-default)", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{codes.length} active code{codes.length !== 1 ? "s" : ""}</span>
            <button onClick={load} disabled={loading} style={{ ...btnS, marginLeft: "auto", fontSize: "11px", padding: "2px 8px", opacity: loading ? 0.5 : 1 }}>
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>

          {/* Codes table */}
          {error ? (
            <div style={{ padding: "12px", fontSize: "13px", color: "var(--danger)" }}>{error}</div>
          ) : loading ? (
            <div style={{ padding: "12px", fontSize: "13px", color: "var(--text-muted)" }}>Loading…</div>
          ) : codes.length === 0 ? (
            <div style={{ padding: "12px", fontSize: "13px", color: "var(--text-muted)" }}>No active join codes. Use “Create join code” to generate one.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg-section-alt)" }}>
                  <th style={{ ...cell, fontWeight: "bold", textAlign: "left" }}>Code</th>
                  <th style={{ ...cell, fontWeight: "bold", textAlign: "left" }}>Share Link</th>
                  <th style={{ ...cell, fontWeight: "bold", textAlign: "right" }}>Uses</th>
                  <th style={{ ...cell, fontWeight: "bold", textAlign: "left" }}>Expires</th>
                  <th style={{ ...cell, fontWeight: "bold", textAlign: "left" }}>Created</th>
                  <th style={{ ...cell, fontWeight: "bold", width: "80px" }}></th>
                </tr>
              </thead>
              <tbody>
                {codes.map(jc => {
                  const isExpired = jc.expiresAt !== null && new Date() > new Date(jc.expiresAt);
                  return (
                    <tr key={jc.id}>
                      <td style={{ ...cell, fontFamily: "monospace", fontWeight: "bold", letterSpacing: "1px", fontSize: "14px" }}>{jc.code}</td>
                      <td style={cell}>
                        <button onClick={() => copyLink(jc)} style={{ ...btnS, fontSize: "11px", padding: "2px 8px" }}>
                          {copiedId === jc.id ? "Copied!" : "Copy Link"}
                        </button>
                      </td>
                      <td style={{ ...cell, textAlign: "right", fontSize: "12px", color: "var(--text-muted)" }}>{jc.usedCount} / {fmtLimit(jc.maxUses)}</td>
                      <td style={{ ...cell, fontSize: "12px", color: isExpired ? "var(--danger)" : "#555" }}>
                        {jc.expiresAt ? new Date(jc.expiresAt).toLocaleDateString() : "Never"}
                      </td>
                      <td style={{ ...cell, fontSize: "12px", color: "var(--text-muted)" }}>{new Date(jc.createdAt).toLocaleDateString()}</td>
                      <td style={{ ...cell, whiteSpace: "nowrap" }}>
                        {confirmRevokeId === jc.id ? (
                          <span style={{ display: "inline-flex", gap: "4px" }}>
                            <button onClick={() => handleRevoke(jc.id)} style={{ ...btnD, padding: "2px 8px", fontSize: "11px" }}>Confirm</button>
                            <button onClick={() => setConfirmRevokeId(null)} style={{ ...btnS, padding: "2px 6px", fontSize: "11px" }}>✕</button>
                          </span>
                        ) : (
                          <button onClick={() => setConfirmRevokeId(jc.id)} style={{ background: "transparent", color: "var(--danger)", border: "1px solid var(--danger)", padding: "3px 12px", cursor: "pointer", borderRadius: "var(--radius-pill)", fontSize: "12px" }}>
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
    </div>
  );
}
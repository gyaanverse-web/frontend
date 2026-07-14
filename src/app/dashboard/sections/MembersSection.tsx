"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Member, Tenant } from "../types";
import { sh, cell, btnS, btnD, memberRoleBadge } from "../styles";

type Props = { tenant: Tenant; isOwner: boolean };

export function MembersSection({ tenant, isOwner }: Props) {
  const [members, setMembers]     = useState<Member[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [confirmRemove, setConfirmRemove] = useState<{ userId: string; name: string } | null>(null);

  async function load() {
    setLoading(true); setError("");
    try {
      const data = await api.get<{ members: Member[] }>("/tenant/members", { tenant: tenant.slug });
      setMembers(data.members);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load members");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRemove(userId: string) {
    setConfirmRemove(null); setError("");
    try {
      await api.delete(`/tenant/members/${userId}`, { tenant: tenant.slug });
      setMembers(prev => prev.filter(m => m.userId !== userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    }
  }

  const visible = roleFilter === "all" ? members : members.filter(m => m.role === roleFilter);

  return (
    <div style={{ background: "var(--surface-card)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-sm)", marginBottom: "16px", overflow: "hidden" }}>
      <div style={sh}>
        <span>Members</span>
      </div>

        <>
          {/* Role filter tabs */}
          <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-default)", display: "flex", gap: "4px", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)", marginRight: "4px" }}>Filter:</span>
            {["all", "coaching_owner", "teacher", "student"].map(f => (
              <button key={f} onClick={() => setRoleFilter(f)} style={{ fontSize: "12px", fontWeight: 600, padding: "5px 14px", cursor: "pointer", borderRadius: "var(--radius-pill)", border: roleFilter === f ? "1px solid var(--accent)" : "1px solid var(--border-default)", background: roleFilter === f ? "var(--accent)" : "var(--surface-card)", color: roleFilter === f ? "#fff" : "var(--text-body)" }}>
                {f === "all" ? "All" : f === "coaching_owner" ? "Owners" : f.charAt(0).toUpperCase() + f.slice(1) + "s"}
              </button>
            ))}
            <span style={{ marginLeft: "auto", fontSize: "12px", color: "var(--text-muted)" }}>{visible.length} of {members.length}</span>
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ padding: "12px", fontSize: "13px", color: "var(--text-muted)" }}>Loading members…</div>
          ) : error ? (
            <div style={{ padding: "12px", fontSize: "13px", color: "var(--danger)" }}>{error}</div>
          ) : visible.length === 0 ? (
            <div style={{ padding: "12px", fontSize: "13px", color: "var(--text-muted)" }}>No members found.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg-section-alt)" }}>
                  <th style={{ ...cell, fontWeight: "bold", textAlign: "left" }}>Name</th>
                  <th style={{ ...cell, fontWeight: "bold", textAlign: "left" }}>Role</th>
                  <th style={{ ...cell, fontWeight: "bold", textAlign: "left" }}>Contact</th>
                  <th style={{ ...cell, fontWeight: "bold", textAlign: "left" }}>Joined</th>
                  {isOwner && <th style={{ ...cell, fontWeight: "bold", textAlign: "left", width: "60px" }}></th>}
                </tr>
              </thead>
              <tbody>
                {visible.map(m => (
                  <tr key={m.userId}>
                    <td style={cell}>{m.name}</td>
                    <td style={cell}>
                      <span style={{ ...memberRoleBadge(m.role), padding: "3px 10px", fontSize: "11px", fontWeight: "bold", borderRadius: "var(--radius-pill)" }}>
                        {m.role === "coaching_owner" ? "Owner" : m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                      </span>
                    </td>
                    <td style={{ ...cell, fontFamily: "monospace", fontSize: "12px" }}>{m.email ?? m.phone ?? "—"}</td>
                    <td style={{ ...cell, fontSize: "12px", color: "var(--text-muted)" }}>{new Date(m.joinedAt).toLocaleDateString()}</td>
                    {isOwner && (
                      <td style={{ ...cell, whiteSpace: "nowrap" }}>
                        {m.role !== "coaching_owner" && (
                          confirmRemove?.userId === m.userId ? (
                            <span style={{ display: "inline-flex", gap: "4px" }}>
                              <button onClick={() => handleRemove(m.userId)} style={{ ...btnD, padding: "2px 8px", fontSize: "11px" }}>Confirm</button>
                              <button onClick={() => setConfirmRemove(null)} style={{ ...btnS, padding: "2px 6px", fontSize: "11px" }}>✕</button>
                            </span>
                          ) : (
                            <button onClick={() => setConfirmRemove({ userId: m.userId, name: m.name })} style={{ background: "transparent", color: "var(--danger)", border: "1px solid var(--danger)", padding: "3px 12px", cursor: "pointer", borderRadius: "var(--radius-pill)", fontSize: "12px" }}>
                              Remove
                            </button>
                          )
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
    </div>
  );
}
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Class, Tenant, User } from "../types";
import { sh, cell, inp, btnP, btnS, btnD } from "../styles";

type Props = { tenant: Tenant; user: User; canMembers: boolean };

export function ClassesSection({ tenant, user, canMembers }: Props) {
  const [classes, setClasses]     = useState<Class[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  const [form, setForm]                   = useState({ name: "", grade: "", autoApprove: true });
  const [createLoading, setCreateLoading] = useState(false);
  const [createMsg, setCreateMsg]         = useState("");
  const [createErr, setCreateErr]         = useState("");

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [joinCode, setJoinCode]       = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinMsg, setJoinMsg]         = useState("");
  const [joinErr, setJoinErr]         = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const data = await api.get<{ classes: Class[] }>("/tenant/classes", { tenant: tenant.slug });
      setClasses(data.classes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load classes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateErr(""); setCreateMsg(""); setCreateLoading(true);
    try {
      const body: Record<string, unknown> = { name: form.name, autoApprove: form.autoApprove };
      if (form.grade) body.grade = form.grade;
      const res = await api.post<{ class: Class }>("/tenant/classes", body, { tenant: tenant.slug });
      setCreateMsg(`Class "${res.class.name}" created.`);
      setForm({ name: "", grade: "", autoApprove: true });
      setClasses(prev => [res.class, ...prev]);
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : "Failed to create class");
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleDelete(id: string) {
    setConfirmDeleteId(null); setError("");
    try {
      await api.delete(`/tenant/classes/${id}`, { tenant: tenant.slug });
      setClasses(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete class");
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoinErr(""); setJoinMsg(""); setJoinLoading(true);
    try {
      const code = joinCode.trim().toUpperCase();
      const res = await api.post<{ success: boolean; status: string; message: string }>(
        `/tenant/classes/join/${code}`, {}, { tenant: tenant.slug },
      );
      setJoinMsg(res.message);
      setJoinCode("");
      load();
    } catch (err) {
      setJoinErr(err instanceof Error ? err.message : "Failed to join class");
    } finally {
      setJoinLoading(false);
    }
  }

  return (
    <div style={{ background: "var(--surface-card)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-sm)", marginBottom: "16px", overflow: "hidden" }}>
      <div style={sh}>
        <span>Classes</span>
      </div>

        <>
          {/* Create class form — owner + teacher */}
          {canMembers && (
            <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-default)", background: "var(--bg-section-alt)" }}>
              <form onSubmit={handleCreate} style={{ display: "flex", gap: "8px", alignItems: "flex-end", flexWrap: "wrap" }}>
                <span style={{ fontSize: "13px", fontWeight: "bold", whiteSpace: "nowrap", alignSelf: "center" }}>New Class</span>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1, minWidth: "140px" }}>
                  <label style={{ fontSize: "11px", color: "var(--text-muted)" }}>Name *</label>
                  <input required minLength={2} maxLength={255} placeholder="e.g. Physics Batch A" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={{ ...inp, width: "100%" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", width: "80px" }}>
                  <label style={{ fontSize: "11px", color: "var(--text-muted)" }}>Grade</label>
                  <input maxLength={50} placeholder="e.g. 10" value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })} style={{ ...inp, width: "100%" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", alignSelf: "flex-end" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", cursor: "pointer" }}>
                    <input type="checkbox" checked={form.autoApprove} onChange={e => setForm({ ...form, autoApprove: e.target.checked })} />
                    Auto-approve
                  </label>
                </div>
                <button type="submit" disabled={createLoading} style={{ ...btnP, opacity: createLoading ? 0.6 : 1, alignSelf: "flex-end" }}>
                  {createLoading ? "Creating…" : "Create Class"}
                </button>
              </form>
              {createErr && <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--danger)" }}>{createErr}</p>}
              {createMsg && <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--success)" }}>{createMsg}</p>}
            </div>
          )}

          {/* Join by code — student */}
          {user.role === "student" && (
            <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-default)", background: "var(--bg-section-alt)" }}>
              <form onSubmit={handleJoin} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <span style={{ fontSize: "13px", fontWeight: "bold", whiteSpace: "nowrap" }}>Join a Class</span>
                <input
                  required placeholder="Enter class code"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  style={{ ...inp, flex: 1, fontFamily: "monospace", letterSpacing: "1px", textTransform: "uppercase" }}
                  maxLength={10}
                />
                <button type="submit" disabled={joinLoading} style={{ ...btnP, opacity: joinLoading ? 0.6 : 1, whiteSpace: "nowrap" }}>
                  {joinLoading ? "Joining…" : "Join"}
                </button>
              </form>
              {joinErr && <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--danger)" }}>{joinErr}</p>}
              {joinMsg && <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--success)" }}>{joinMsg}</p>}
            </div>
          )}

          {/* Toolbar */}
          <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-default)", display: "flex", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {user.role === "student"
                ? `${classes.length} enrolled class${classes.length !== 1 ? "es" : ""}`
                : `${classes.length} class${classes.length !== 1 ? "es" : ""}`}
            </span>
            <button onClick={load} disabled={loading} style={{ ...btnS, marginLeft: "auto", fontSize: "11px", padding: "2px 8px", opacity: loading ? 0.5 : 1 }}>
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>

          {/* Class list */}
          {error ? (
            <div style={{ padding: "12px", fontSize: "13px", color: "var(--danger)" }}>{error}</div>
          ) : loading ? (
            <div style={{ padding: "12px", fontSize: "13px", color: "var(--text-muted)" }}>Loading…</div>
          ) : classes.length === 0 ? (
            <div style={{ padding: "12px", fontSize: "13px", color: "var(--text-muted)" }}>
              {user.role === "student" ? "No enrolled classes. Use a class code above to join." : "No classes yet. Create one above."}
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg-section-alt)" }}>
                  <th style={{ ...cell, fontWeight: "bold", textAlign: "left" }}>Name</th>
                  <th style={{ ...cell, fontWeight: "bold", textAlign: "left" }}>Grade</th>
                  {canMembers && <th style={{ ...cell, fontWeight: "bold", textAlign: "center" }}>Auto-approve</th>}
                  <th style={{ ...cell, fontWeight: "bold", textAlign: "left", width: "80px" }}></th>
                </tr>
              </thead>
              <tbody>
                {classes.map(cls => (
                  <tr key={cls.id}>
                    <td style={{ ...cell, fontWeight: "500" }}>{cls.name}</td>
                    <td style={{ ...cell, fontSize: "12px", color: "var(--text-muted)" }}>{cls.grade ?? "—"}</td>
                    {canMembers && (
                      <td style={{ ...cell, textAlign: "center" }}>
                        <span style={{ padding: "3px 10px", fontSize: "11px", fontWeight: "bold", borderRadius: "var(--radius-pill)", background: cls.autoApprove ? "#dcfce7" : "#fef9c3", color: cls.autoApprove ? "var(--success)" : "#713f12", border: `1px solid ${cls.autoApprove ? "#86efac" : "#fde068"}` }}>
                          {cls.autoApprove ? "Auto" : "Manual"}
                        </span>
                      </td>
                    )}
                    <td style={{ ...cell, whiteSpace: "nowrap" }}>
                      <span style={{ display: "inline-flex", gap: "4px", alignItems: "center" }}>
                        <a href={`/classes/${cls.id}`} style={{ ...btnP, textDecoration: "none", padding: "2px 10px", fontSize: "11px" }}>
                          {canMembers ? "Manage" : "View"} →
                        </a>
                        {canMembers && (
                          confirmDeleteId === cls.id ? (
                            <>
                              <button onClick={() => handleDelete(cls.id)} style={{ ...btnD, padding: "2px 8px", fontSize: "11px" }}>Confirm</button>
                              <button onClick={() => setConfirmDeleteId(null)} style={{ ...btnS, padding: "2px 6px", fontSize: "11px" }}>✕</button>
                            </>
                          ) : (
                            <button onClick={() => setConfirmDeleteId(cls.id)} style={{ background: "transparent", color: "var(--danger)", border: "1px solid var(--danger)", padding: "3px 12px", cursor: "pointer", borderRadius: "var(--radius-pill)", fontSize: "11px" }}>
                              Delete
                            </button>
                          )
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
    </div>
  );
}
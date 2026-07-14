"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import type { Exam, Tenant } from "../types";
import { sh, cell, inp } from "../styles";
import { Button } from "@/components/ui";

type Props = { tenant: Tenant; canMembers: boolean };

export function ExamsSection({ tenant, canMembers }: Props) {
  const [exams, setExams]         = useState<Exam[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  const [form, setForm]                   = useState({ title: "", durationMins: "60", visibility: "private" as Exam["visibility"] });
  const [createLoading, setCreateLoading] = useState(false);
  const [createMsg, setCreateMsg]         = useState("");
  const [createErr, setCreateErr]         = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const data = await api.get<{ exams: Exam[] }>("/tenant/exams", { tenant: tenant.slug });
      setExams(data.exams);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load exams");
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
      const body = { title: form.title, durationMins: parseInt(form.durationMins, 10), visibility: form.visibility };
      const res = await api.post<{ exam: Exam }>("/tenant/exams", body, { tenant: tenant.slug });
      setCreateMsg(`Exam "${res.exam.title}" created.`);
      setForm({ title: "", durationMins: "60", visibility: "private" });
      setExams(prev => [res.exam, ...prev]);
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : "Failed to create exam");
    } finally {
      setCreateLoading(false);
    }
  }

  return (
    <div style={{ background: "var(--surface-card)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-sm)", marginBottom: "16px", overflow: "hidden" }}>
      <div style={sh}>
        <span>Exams</span>
      </div>

        <>
          {/* Create exam form — owner + teacher */}
          {canMembers && (
            <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-default)", background: "var(--bg-section-alt)" }}>
              <form onSubmit={handleCreate} style={{ display: "flex", gap: "8px", alignItems: "flex-end", flexWrap: "wrap" }}>
                <span style={{ fontSize: "13px", fontWeight: "bold", whiteSpace: "nowrap", alignSelf: "center" }}>New Exam</span>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1, minWidth: "160px" }}>
                  <label style={{ fontSize: "11px", color: "var(--text-muted)" }}>Title *</label>
                  <input required minLength={2} maxLength={255} placeholder="e.g. Physics Mock Test 1" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={{ ...inp, width: "100%" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", width: "70px" }}>
                  <label style={{ fontSize: "11px", color: "var(--text-muted)" }}>Mins *</label>
                  <input required type="number" min={1} max={600} value={form.durationMins} onChange={e => setForm({ ...form, durationMins: e.target.value })} style={{ ...inp, width: "100%" }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <label style={{ fontSize: "11px", color: "var(--text-muted)" }}>Visibility</label>
                  <select value={form.visibility} onChange={e => setForm({ ...form, visibility: e.target.value as Exam["visibility"] })} style={inp}>
                    <option value="private">Private</option>
                    <option value="public_free">Public Free</option>
                    <option value="public_paid">Public Paid</option>
                  </select>
                </div>
                <Button type="submit" variant="app" disabled={createLoading} style={{ alignSelf: "flex-end" }}>
                  {createLoading ? "Creating…" : "Create"}
                </Button>
              </form>
              {createErr && <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--danger)" }}>{createErr}</p>}
              {createMsg && <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--success)" }}>{createMsg}</p>}
            </div>
          )}

          {/* Toolbar */}
          <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-default)", display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{exams.length} exam{exams.length !== 1 ? "s" : ""}</span>
            <div style={{ flex: 1 }} />
            {canMembers && (
              <Link href="/exams" className="gv-btn gv-btn--app gv-btn--sm" style={{ textDecoration: "none" }}>
                <span>Exams &amp; generator</span>
                <span aria-hidden="true">→</span>
              </Link>
            )}
            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>{loading ? "Loading…" : "Refresh"}</Button>
          </div>

          {/* Exam list */}
          {error ? (
            <div style={{ padding: "12px", fontSize: "13px", color: "var(--danger)" }}>{error}</div>
          ) : loading ? (
            <div style={{ padding: "12px", fontSize: "13px", color: "var(--text-muted)" }}>Loading…</div>
          ) : exams.length === 0 ? (
            <div style={{ padding: "12px", fontSize: "13px", color: "var(--text-muted)" }}>
              {canMembers ? "No exams yet. Create one above." : "No exams available."}
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg-section-alt)" }}>
                  <th style={{ ...cell, fontWeight: "bold", textAlign: "left" }}>Title</th>
                  <th style={{ ...cell, fontWeight: "bold", textAlign: "center" }}>Status</th>
                  <th style={{ ...cell, fontWeight: "bold", textAlign: "right" }}>Mins</th>
                  <th style={{ ...cell, fontWeight: "bold", textAlign: "right" }}>Marks</th>
                  <th style={{ ...cell, fontWeight: "bold", textAlign: "left", width: "80px" }}></th>
                </tr>
              </thead>
              <tbody>
                {exams.map(exam => {
                  const sc =
                    exam.status === "published" ? { bg: "#dcfce7", color: "var(--success)", border: "#86efac" } :
                    exam.status === "archived"  ? { bg: "#f3f4f6", color: "#374151", border: "#d1d5db" } :
                                                  { bg: "#fef9c3", color: "#713f12", border: "#fde068" };
                  return (
                    <tr key={exam.id}>
                      <td style={{ ...cell, fontWeight: "500" }}>{exam.title}</td>
                      <td style={{ ...cell, textAlign: "center" }}>
                        <span style={{ padding: "3px 10px", fontSize: "11px", fontWeight: "bold", borderRadius: "var(--radius-pill)", background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                          {exam.status}
                        </span>
                      </td>
                      <td style={{ ...cell, textAlign: "right", fontSize: "12px", color: "var(--text-muted)" }}>{exam.durationMins}</td>
                      <td style={{ ...cell, textAlign: "right", fontSize: "12px", color: "var(--text-muted)" }}>{exam.totalMarks}</td>
                      <td style={{ ...cell, whiteSpace: "nowrap" }}>
                        {canMembers ? (
                          <Link href={`/exams/${exam.id}`} className="gv-btn gv-btn--secondary gv-btn--sm" style={{ textDecoration: "none" }}>Manage →</Link>
                        ) : (
                          exam.status === "published" && (
                            <Link href={`/exams/${exam.id}/take`} className="gv-btn gv-btn--app gv-btn--sm" style={{ textDecoration: "none" }}>Start →</Link>
                          )
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
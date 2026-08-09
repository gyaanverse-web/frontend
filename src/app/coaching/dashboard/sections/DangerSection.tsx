"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { Tenant } from "../types";
import { btnS, btnD } from "../styles";

type Props = { tenant: Tenant; onDeleted: () => void };

export function DangerSection({ tenant, onDeleted }: Props) {
  const [confirm, setConfirm]     = useState(false);
  const [err, setErr]             = useState("");

  const sh = {
    background: "var(--danger)", color: "#fff",
    padding: "5px 10px", fontSize: "12px",
    fontWeight: "bold", textTransform: "uppercase" as const, letterSpacing: "0.5px",
    display: "flex", alignItems: "center", justifyContent: "space-between",
  };

  async function handleDelete() {
    setErr("");
    try {
      await api.delete(`/tenants/${tenant.id}`);
      onDeleted();
    } catch (e) {
      setConfirm(false);
      setErr(e instanceof Error ? e.message : "Failed to delete coaching");
    }
  }

  return (
    <div style={{ background: "var(--surface-card)", border: "1px solid var(--danger)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-sm)", overflow: "hidden", marginBottom: "16px" }}>
      <div style={sh}>
        <span>Danger Zone</span>
      </div>

        <div style={{ padding: "14px" }}>
          <p style={{ margin: "0 0 10px 0", fontSize: "13px" }}>
            <strong>Delete Coaching Institute</strong> — permanently removes all members, classes, exams, and data.
            This action cannot be undone.
          </p>
          {err && <p style={{ margin: "0 0 8px 0", fontSize: "13px", color: "var(--danger)" }}>{err}</p>}
          {confirm ? (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "13px" }}>Delete <strong>{tenant.name}</strong>? This cannot be undone.</span>
              <button onClick={handleDelete} style={btnD}>Yes, Delete</button>
              <button onClick={() => setConfirm(false)} style={btnS}>Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirm(true)} style={btnD}>Delete {tenant.name}</button>
          )}
        </div>
    </div>
  );
}
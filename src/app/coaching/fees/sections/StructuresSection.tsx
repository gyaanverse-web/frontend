"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Badge, Button, DataTable, Icon, Input, Modal } from "@/components/ui";
import type { Column } from "@/components/ui";
import { STRUCTURE_STATUS_TONE, fmtDate, type FeeStructure } from "@/lib/fee";

type Props = { tenantSlug: string };

const CURRENT_AY = (() => {
  const now = new Date();
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1; // FY starts ~April
  return `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
})();

export function StructuresSection({ tenantSlug }: Props) {
  const router = useRouter();
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", academicYear: CURRENT_AY });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api.get<{ items: FeeStructure[] }>("/tenant/fees/structures?limit=200", { tenant: tenantSlug })
      .then((data) => { if (!cancelled) setStructures(data.items); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load fee structures"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tenantSlug]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true); setCreateError("");
    try {
      const { structure } = await api.post<{ structure: FeeStructure }>(
        "/tenant/fees/structures", form, { tenant: tenantSlug },
      );
      setShowCreate(false);
      setForm({ name: "", academicYear: CURRENT_AY });
      router.push(`/coaching/fees/structures/${structure.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create structure");
    } finally {
      setCreating(false);
    }
  }

  const columns: Column<FeeStructure>[] = [
    {
      key: "name", label: "Structure", width: "34%",
      render: (s) => (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-heading)" }}>{s.name}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>Version {s.version}{s.supersededById ? " · superseded" : ""}</div>
        </div>
      ),
    },
    { key: "academicYear", label: "Academic year", width: "18%", render: (s) => <span style={{ fontSize: 13 }}>{s.academicYear}</span> },
    { key: "status", label: "Status", width: "18%", render: (s) => <Badge tone={STRUCTURE_STATUS_TONE[s.status]}>{s.status}</Badge> },
    { key: "created", label: "Created", width: "22%", render: (s) => <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{fmtDate(s.createdAt)}</span> },
    {
      key: "act", label: "", width: "8%",
      render: () => <div style={{ display: "flex", justifyContent: "flex-end" }} aria-hidden="true"><Icon name="arrow-right" size={16} className="gv-row-chevron" /></div>,
    },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16, color: "var(--text-heading)" }}>Fee structures</h3>
        <Badge tone="neutral">{structures.length}</Badge>
        <div style={{ flex: 1 }} />
        <Button variant="app" size="sm" icon={<Icon name="plus" size={15} />} onClick={() => setShowCreate(true)}>
          New structure
        </Button>
      </div>

      {error && (
        <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 16, padding: "10px 14px", border: "1px solid rgba(244,63,94,0.35)", background: "var(--danger-soft)", borderRadius: "var(--radius-md)" }}>{error}</p>
      )}

      {loading ? (
        <div className="gv-card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading structures…</div>
      ) : structures.length === 0 ? (
        <div className="gv-card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
          No fee structures yet. Create one, add its fee heads and installment schedule, then publish it and assign it to a batch.
        </div>
      ) : (
        <DataTable columns={columns} rows={structures} fixed onRowClick={(s) => router.push(`/coaching/fees/structures/${s.id}`)} />
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New fee structure">
        <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input
            label="Name" required minLength={2} maxLength={160}
            placeholder="e.g. Physics Batch for 11th — 2026-27"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            label="Academic year" required
            placeholder="2026-27"
            pattern="\d{4}-\d{2}"
            value={form.academicYear}
            onChange={(e) => setForm((f) => ({ ...f, academicYear: e.target.value }))}
            help='Format: "2026-27"'
          />
          {createError && <p style={{ margin: 0, color: "var(--danger)", fontSize: 13 }}>{createError}</p>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" variant="app" disabled={creating}>{creating ? "Creating…" : "Create draft"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

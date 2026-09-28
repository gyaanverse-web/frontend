"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge, Button, DataTable, Icon, Input, Modal, Select, Switch } from "@/components/ui";
import type { Column } from "@/components/ui";
import { FEE_HEAD_CATEGORIES, type FeeHead, type FeeHeadCategory } from "@/lib/fee";

type Props = { tenantSlug: string };

const EMPTY_FORM = { name: "", code: "", category: "tuition" as FeeHeadCategory, isRefundable: false, taxRatePct: "", sacCode: "" };

export function FeeHeadsSection({ tenantSlug }: Props) {
  const [heads, setHeads] = useState<FeeHead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api.get<{ items: FeeHead[] }>("/tenant/fees/heads?limit=200", { tenant: tenantSlug })
      .then((data) => { if (!cancelled) setHeads(data.items); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load fee heads"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tenantSlug]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setFormError("");
    try {
      const body = {
        name: form.name,
        code: form.code,
        category: form.category,
        isRefundable: form.isRefundable,
        taxRatePct: form.taxRatePct ? Number(form.taxRatePct) : null,
        sacCode: form.sacCode || null,
      };
      const { head } = await api.post<{ head: FeeHead }>("/tenant/fees/heads", body, { tenant: tenantSlug });
      setHeads((prev) => [head, ...prev]);
      setShowCreate(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create fee head");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(head: FeeHead) {
    const nextStatus = head.status === "active" ? "archived" : "active";
    try {
      const { head: updated } = await api.patch<{ head: FeeHead }>(
        `/tenant/fees/heads/${head.id}`, { status: nextStatus }, { tenant: tenantSlug },
      );
      setHeads((prev) => prev.map((h) => (h.id === updated.id ? updated : h)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update fee head");
    }
  }

  const columns: Column<FeeHead>[] = [
    { key: "name", label: "Head", width: "26%", render: (h) => <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-heading)" }}>{h.name}</span> },
    { key: "code", label: "Code", width: "16%", render: (h) => <span style={{ fontSize: 13, fontFamily: "var(--font-mono)", color: "var(--text-body)" }}>{h.code}</span> },
    { key: "category", label: "Category", width: "16%", render: (h) => <Badge tone="accent">{h.category}</Badge> },
    { key: "refundable", label: "Refundable", width: "12%", render: (h) => <span style={{ fontSize: 13 }}>{h.isRefundable ? "Yes" : "No"}</span> },
    { key: "tax", label: "Tax %", width: "10%", render: (h) => <span style={{ fontSize: 13 }}>{h.taxRatePct ?? "—"}</span> },
    { key: "status", label: "Status", width: "12%", render: (h) => <Badge tone={h.status === "active" ? "success" : "neutral"}>{h.status}</Badge> },
    {
      key: "act", label: "", width: "8%",
      render: (h) => (
        <Button variant="ghost" size="sm" onClick={() => toggleStatus(h)}>
          {h.status === "active" ? "Archive" : "Reactivate"}
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16, color: "var(--text-heading)" }}>Fee heads</h3>
        <Badge tone="neutral">{heads.length}</Badge>
        <div style={{ flex: 1 }} />
        <Button variant="app" size="sm" icon={<Icon name="plus" size={15} />} onClick={() => setShowCreate(true)}>
          New head
        </Button>
      </div>

      {error && (
        <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 16, padding: "10px 14px", border: "1px solid rgba(244,63,94,0.35)", background: "var(--danger-soft)", borderRadius: "var(--radius-md)" }}>{error}</p>
      )}

      {loading ? (
        <div className="gv-card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading fee heads…</div>
      ) : heads.length === 0 ? (
        <div className="gv-card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
          No fee heads yet. Heads are the catalogue line items (Tuition, Admission, Transport…) that structures are built from.
        </div>
      ) : (
        <DataTable columns={columns} rows={heads} fixed />
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New fee head">
        <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="Name" required minLength={2} maxLength={120} placeholder="e.g. Tuition Fee"
            value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="Code" required minLength={1} maxLength={32} placeholder="e.g. TUITION"
            value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            help="Unique per institute — a stable key used in reports." />
          <Select label="Category" options={FEE_HEAD_CATEGORIES} value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as FeeHeadCategory }))} />
          <Input label="Tax rate % (optional)" type="number" min={0} max={100} step="0.01"
            value={form.taxRatePct} onChange={(e) => setForm((f) => ({ ...f, taxRatePct: e.target.value }))} />
          <Input label="SAC code (optional)" maxLength={10}
            value={form.sacCode} onChange={(e) => setForm((f) => ({ ...f, sacCode: e.target.value }))} />
          <Switch label="Refundable" checked={form.isRefundable}
            onChange={(e) => setForm((f) => ({ ...f, isRefundable: e.target.checked }))} />
          {formError && <p style={{ margin: 0, color: "var(--danger)", fontSize: 13 }}>{formError}</p>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" variant="app" disabled={saving}>{saving ? "Saving…" : "Create"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

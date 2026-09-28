"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useTenantSession } from "@/lib/useTenantSession";
import type { Batch } from "../../../dashboard/types";
import { TeacherShell } from "@/components/dashboard/TeacherShell";
import { Badge, Button, DataTable, Icon, Input, Modal, Select } from "@/components/ui";
import type { Column } from "@/components/ui";
import {
  STRUCTURE_STATUS_TONE, formatPaise, fmtDate,
  type FeeHead, type FeeStructure, type FeeStructureInstallment, type FeeStructureItem,
} from "@/lib/fee";

type Tenant = { id: string; slug: string; name: string };
type Detail = { structure: FeeStructure; items: FeeStructureItem[]; installments: FeeStructureInstallment[] };

export default function StructureDetailPage() {
  const params = useParams();
  const router = useRouter();
  const structureId = params?.id as string;
  const { loading, user, tenant, role } = useTenantSession<Tenant>({ allow: ["coaching_owner"] });

  const [detail, setDetail] = useState<Detail | null>(null);
  const [heads, setHeads] = useState<FeeHead[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [detailLoading, setDetailLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);

  const [showAddItem, setShowAddItem] = useState(false);
  const [itemForm, setItemForm] = useState({ headId: "", amount: "" });

  const [showAddInstallment, setShowAddInstallment] = useState(false);
  const [instForm, setInstForm] = useState({ seq: "1", label: "", dueDate: "", sharePct: "" });

  const [showAssign, setShowAssign] = useState(false);
  const [assignBatchId, setAssignBatchId] = useState("");
  // The fan-out runs on a queue (LLD §7b) — the assign route returns 202
  // before a single invoice exists, so count this structure's assignments in
  // the batch a few times to show progress.
  const [assigned, setAssigned] = useState<{ batchId: string; batchName: string; count: number | null } | null>(null);

  // Mount / structure-change load — a plain promise chain (not a call into an
  // async helper) so no setState happens synchronously within the effect body.
  useEffect(() => {
    if (!tenant) return;
    const slug = tenant.slug;
    let cancelled = false;
    Promise.all([
      api.get<Detail>(`/tenant/fees/structures/${structureId}`, { tenant: slug }),
      api.get<{ items: FeeHead[] }>("/tenant/fees/heads?limit=200", { tenant: slug }),
      api.get<{ classes: Batch[] }>("/tenant/classes", { tenant: slug }),
    ])
      .then(([d, headsRes, batchesRes]) => {
        if (cancelled) return;
        setDetail(d);
        setHeads(headsRes.items);
        setBatches(batchesRes.classes);
      })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load structure"); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [tenant, structureId]);

  // Re-fetch after a mutation. Only ever called from event handlers below —
  // never from an effect — so its synchronous setDetailLoading(true) is fine.
  const refresh = useCallback(async () => {
    if (!tenant) return;
    setDetailLoading(true); setError("");
    try {
      const [d, headsRes, batchesRes] = await Promise.all([
        api.get<Detail>(`/tenant/fees/structures/${structureId}`, { tenant: tenant.slug }),
        api.get<{ items: FeeHead[] }>("/tenant/fees/heads?limit=200", { tenant: tenant.slug }),
        api.get<{ classes: Batch[] }>("/tenant/classes", { tenant: tenant.slug }),
      ]);
      setDetail(d);
      setHeads(headsRes.items);
      setBatches(batchesRes.classes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load structure");
    } finally {
      setDetailLoading(false);
    }
  }, [tenant, structureId]);

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant) return;
    setBusy(true); setActionError("");
    try {
      await api.post(`/tenant/fees/structures/${structureId}/items`, {
        headId: itemForm.headId,
        amount: Number(itemForm.amount),
      }, { tenant: tenant.slug });
      setShowAddItem(false);
      setItemForm({ headId: "", amount: "" });
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to add fee item");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddInstallment(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant) return;
    setBusy(true); setActionError("");
    try {
      await api.post(`/tenant/fees/structures/${structureId}/installments`, {
        seq: Number(instForm.seq),
        label: instForm.label,
        dueDate: instForm.dueDate,
        sharePct: Number(instForm.sharePct),
      }, { tenant: tenant.slug });
      setShowAddInstallment(false);
      setInstForm({ seq: String(Number(instForm.seq) + 1), label: "", dueDate: "", sharePct: "" });
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to add installment");
    } finally {
      setBusy(false);
    }
  }

  async function handlePublish() {
    if (!tenant) return;
    setBusy(true); setActionError("");
    try {
      await api.post(`/tenant/fees/structures/${structureId}/publish`, {}, { tenant: tenant.slug });
      await refresh();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to publish structure");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevise() {
    if (!tenant) return;
    setBusy(true); setActionError("");
    try {
      const { structure } = await api.post<{ structure: FeeStructure }>(
        `/tenant/fees/structures/${structureId}/revise`, {}, { tenant: tenant.slug },
      );
      router.push(`/coaching/fees/structures/${structure.id}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to revise structure");
      setBusy(false);
    }
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant || !assignBatchId) return;
    setBusy(true); setActionError("");
    try {
      await api.post(`/tenant/fees/structures/${structureId}/assign`, { classId: assignBatchId }, { tenant: tenant.slug });
      setShowAssign(false);
      setAssigned({ batchId: assignBatchId, batchName: batches.find((c) => c.id === assignBatchId)?.name ?? "this batch", count: null });
      setAssignBatchId("");
      void pollAssigned(assignBatchId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to assign structure");
    } finally {
      setBusy(false);
    }
  }

  async function pollAssigned(batchId: string) {
    if (!tenant) return;
    let last = -1;
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, i === 0 ? 1000 : 2500));
      try {
        const res = await api.get<{ items: { structureId: string }[] }>(
          `/tenant/fees/assignments?classId=${batchId}&limit=200`, { tenant: tenant.slug },
        );
        const count = res.items.filter((a) => a.structureId === structureId).length;
        setAssigned((a) => (a && a.batchId === batchId ? { ...a, count } : a));
        if (count > 0 && count === last) return; // settled
        last = count;
      } catch {
        return; // progress is a nicety; the Assignments tab is the source of truth
      }
    }
  }

  if (loading || !user || !tenant) return <PageLoading />;

  const headById = new Map(heads.map((h) => [h.id, h]));

  const itemColumns: Column<FeeStructureItem>[] = [
    { key: "head", label: "Head", width: "35%", render: (i) => <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-heading)" }}>{headById.get(i.headId)?.name ?? "—"}</span> },
    { key: "category", label: "Category", width: "20%", render: (i) => <Badge tone="accent">{headById.get(i.headId)?.category ?? "—"}</Badge> },
    { key: "refundable", label: "Refundable", width: "20%", render: (i) => <span style={{ fontSize: 13 }}>{headById.get(i.headId)?.isRefundable ? "Yes" : "No"}</span> },
    { key: "amount", label: "Amount", width: "25%", render: (i) => <span style={{ fontSize: 14, fontWeight: 700 }}>{formatPaise(i.amount)}</span> },
  ];

  const instColumns: Column<FeeStructureInstallment>[] = [
    { key: "seq", label: "#", width: "8%", render: (i) => <span style={{ fontSize: 13 }}>{i.seq}</span> },
    { key: "label", label: "Installment", width: "32%", render: (i) => <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-heading)" }}>{i.label}</span> },
    { key: "dueDate", label: "Due date", width: "30%", render: (i) => <span style={{ fontSize: 13 }}>{fmtDate(i.dueDate)}</span> },
    { key: "share", label: "Share", width: "30%", render: (i) => <span style={{ fontSize: 13 }}>{Number(i.sharePct)}%</span> },
  ];

  const fullFee = detail ? detail.items.reduce((s, i) => s + i.amount, 0) : 0;

  return (
    <TeacherShell
      tenant={tenant} user={user} role={role} active="fees" eyebrow="Fees"
      title={detail ? detail.structure.name : "…"}
      action={
        detail && (
          <div style={{ display: "flex", gap: 8 }}>
            {detail.structure.status === "published" && !detail.structure.supersededById && (
              <>
                <Button variant="secondary" onClick={handleRevise} disabled={busy}>Revise → v{detail.structure.version + 1}</Button>
                <Button variant="app" icon={<Icon name="arrow-right" size={16} />} onClick={() => setShowAssign(true)} disabled={busy}>Assign to a batch</Button>
              </>
            )}
            {detail.structure.status === "draft" && (
              <Button variant="app" icon={<Icon name="check-circle" size={16} />} onClick={handlePublish} disabled={busy}>Publish</Button>
            )}
          </div>
        )
      }
    >
      {error && <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 16 }}>{error}</p>}

      {detailLoading || !detail ? (
        <div className="gv-card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading…</div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <Badge tone={STRUCTURE_STATUS_TONE[detail.structure.status]}>{detail.structure.status}</Badge>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{detail.structure.academicYear} · version {detail.structure.version}</span>
            {detail.structure.supersededById && <Badge tone="neutral">Superseded</Badge>}
          </div>

          {detail.structure.status !== "draft" && (
            <div className="gv-card" style={{ padding: "14px 18px", marginBottom: 20, background: "var(--warning-soft)", border: "1px solid var(--warning)", fontSize: 13, color: "var(--text-body)" }}>
              A published structure is immutable. Use &ldquo;Revise&rdquo; to create the next version for students enrolling from now on — everyone already billed keeps this one.
            </div>
          )}

          {actionError && <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 16 }}>{actionError}</p>}

          {assigned && (
            <div className="gv-card" style={{ padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "var(--success-soft)", border: "1px solid var(--success)" }}>
              <Icon name="check-circle" size={18} style={{ color: "var(--success)" }} />
              <span style={{ flex: 1, fontSize: 13.5, color: "var(--text-heading)" }}>
                Billing {assigned.batchName} on this structure
                {assigned.count === null ? " — generating invoices…" : ` — ${assigned.count} student${assigned.count === 1 ? "" : "s"} billed so far.`}
              </span>
              <Button variant="secondary" size="sm" onClick={() => router.push("/coaching/fees?tab=assignments")}>View assignments</Button>
              <Button variant="ghost" size="sm" onClick={() => setAssigned(null)}>Dismiss</Button>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: "var(--text-heading)" }}>Fee heads</h3>
            {detail.structure.status === "draft" && (
              <Button variant="ghost" size="sm" icon={<Icon name="plus" size={14} />} onClick={() => setShowAddItem(true)}>Add item</Button>
            )}
          </div>
          {detail.items.length === 0 ? (
            <div className="gv-card" style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13.5, marginBottom: 24 }}>No fee items yet.</div>
          ) : (
            <div style={{ marginBottom: 12 }}>
              <DataTable columns={itemColumns} rows={detail.items} fixed />
            </div>
          )}
          {detail.items.length > 0 && (
            <div style={{ textAlign: "right", fontSize: 14, fontWeight: 700, color: "var(--text-heading)", marginBottom: 28 }}>
              Full fee for this course: {formatPaise(fullFee)}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: "var(--text-heading)" }}>Installment schedule</h3>
            {detail.structure.status === "draft" && (
              <Button variant="ghost" size="sm" icon={<Icon name="plus" size={14} />} onClick={() => setShowAddInstallment(true)}>Add installment</Button>
            )}
          </div>
          {detail.installments.length === 0 ? (
            <div className="gv-card" style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13.5 }}>No installments yet.</div>
          ) : (
            <DataTable columns={instColumns} rows={detail.installments} fixed />
          )}
        </>
      )}

      {/* ── Add item ─────────────────────────────────────────────────────── */}
      <Modal open={showAddItem} onClose={() => setShowAddItem(false)} title="Add fee item">
        <form onSubmit={handleAddItem} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Select label="Fee head" required
            options={[{ value: "", label: "Select a head…" }, ...heads.filter((h) => h.status === "active").map((h) => ({ value: h.id, label: h.name }))]}
            value={itemForm.headId} onChange={(e) => setItemForm((f) => ({ ...f, headId: e.target.value }))} />
          <Input label="Amount (₹)" type="number" min={1} step="0.01" required
            value={itemForm.amount} onChange={(e) => setItemForm((f) => ({ ...f, amount: e.target.value }))} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button type="button" variant="ghost" onClick={() => setShowAddItem(false)}>Cancel</Button>
            <Button type="submit" variant="app" disabled={busy || !itemForm.headId}>Add</Button>
          </div>
        </form>
      </Modal>

      {/* ── Add installment ──────────────────────────────────────────────── */}
      <Modal open={showAddInstallment} onClose={() => setShowAddInstallment(false)} title="Add installment">
        <form onSubmit={handleAddInstallment} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="Sequence #" type="number" min={1} required
            value={instForm.seq} onChange={(e) => setInstForm((f) => ({ ...f, seq: e.target.value }))} />
          <Input label="Label" required maxLength={80} placeholder="e.g. Installment 1"
            value={instForm.label} onChange={(e) => setInstForm((f) => ({ ...f, label: e.target.value }))} />
          <Input label="Due date" type="date" required
            value={instForm.dueDate} onChange={(e) => setInstForm((f) => ({ ...f, dueDate: e.target.value }))} />
          <Input label="Share of the fee (%)" type="number" min={1} max={100} step="0.01" required
            value={instForm.sharePct} onChange={(e) => setInstForm((f) => ({ ...f, sharePct: e.target.value }))}
            help="All installments on a structure must sum to exactly 100% before it can be published." />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button type="button" variant="ghost" onClick={() => setShowAddInstallment(false)}>Cancel</Button>
            <Button type="submit" variant="app" disabled={busy}>Add</Button>
          </div>
        </form>
      </Modal>

      {/* ── Assign to batch ──────────────────────────────────────────────── */}
      <Modal open={showAssign} onClose={() => setShowAssign(false)} title="Assign to a batch">
        <form onSubmit={handleAssign} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Select label="Batch" required
            options={[{ value: "", label: "Select a batch…" }, ...batches.map((c) => ({ value: c.id, label: c.name }))]}
            value={assignBatchId} onChange={(e) => setAssignBatchId(e.target.value)} />
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)" }}>
            Enqueues invoice generation for every approved student in the batch. Re-running only assigns newly-joined students.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button type="button" variant="ghost" onClick={() => setShowAssign(false)}>Cancel</Button>
            <Button type="submit" variant="app" disabled={busy || !assignBatchId}>Assign</Button>
          </div>
        </form>
      </Modal>
    </TeacherShell>
  );
}

function PageLoading() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "var(--text-muted)" }}>
      Loading…
    </div>
  );
}

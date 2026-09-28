"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Batch } from "../../dashboard/types";
import { Badge, Button, DataTable, Icon, Input, KebabMenu, Modal, Select } from "@/components/ui";
import type { Column } from "@/components/ui";
import { ReceiptModal } from "@/components/fees/ReceiptModal";
import {
  FEE_PAYMENT_MODES, PAYMENT_MODE_LABEL,
  errorMessage, fmtDateTime, formatPaise, paymentBadge,
  type FeePaymentMode, type PaymentListItem,
} from "@/lib/fee";

type Props = { tenantSlug: string };
type BatchStudent = { studentId: string; name: string; status: string };
type Filters = { from: string; to: string; mode: "" | FeePaymentMode };

function query(f: Filters, cursor?: string | null): string {
  const q = new URLSearchParams({ limit: "50" });
  if (f.from) q.set("from", f.from);
  if (f.to) q.set("to", f.to);
  if (f.mode) q.set("mode", f.mode);
  if (cursor) q.set("cursor", cursor);
  return `/tenant/fees/payments?${q}`;
}

export function PaymentsSection({ tenantSlug }: Props) {
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>({ from: "", to: "", mode: "" });
  const [rows, setRows] = useState<PaymentListItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [receiptPath, setReceiptPath] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get<{ items: PaymentListItem[]; nextCursor: string | null }>(query({ from: "", to: "", mode: "" }), { tenant: tenantSlug })
      .then((d) => { if (!cancelled) { setRows(d.items); setCursor(d.nextCursor); } })
      .catch((err) => { if (!cancelled) setError(errorMessage(err, "Failed to load payments")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tenantSlug]);

  // Event-handler only (filter changes, "Load more") — never called from an effect.
  const load = useCallback(async (f: Filters, after: string | null) => {
    if (after) setLoadingMore(true); else setLoading(true);
    setError("");
    try {
      const d = await api.get<{ items: PaymentListItem[]; nextCursor: string | null }>(query(f, after), { tenant: tenantSlug });
      setRows((prev) => (after ? [...prev, ...d.items] : d.items));
      setCursor(d.nextCursor);
    } catch (err) {
      setError(errorMessage(err, "Failed to load payments"));
    } finally {
      setLoading(false); setLoadingMore(false);
    }
  }, [tenantSlug]);

  function changeFilter(patch: Partial<Filters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    void load(next, null);
  }

  const openLedger = (r: PaymentListItem) =>
    router.push(`/coaching/fees/students/${r.studentId}?name=${encodeURIComponent(r.studentName)}&from=payments`);

  const columns: Column<PaymentListItem>[] = [
    {
      key: "receipt", label: "Receipt", width: "17%",
      render: (r) => (
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, fontFamily: "var(--font-mono)", color: r.status === "reversed" ? "var(--text-muted)" : "var(--text-heading)", textDecoration: r.status === "reversed" ? "line-through" : undefined }}>{r.receiptNo}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{fmtDateTime(r.receivedAt)}</div>
        </div>
      ),
    },
    { key: "student", label: "Student", width: "25%", render: (r) => <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-heading)" }}>{r.studentName}</span> },
    {
      key: "mode", label: "Mode", width: "18%",
      render: (r) => (
        <div>
          <div style={{ fontSize: 13 }}>{PAYMENT_MODE_LABEL[r.mode]}</div>
          {r.reference && <div style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.reference}</div>}
        </div>
      ),
    },
    { key: "amount", label: "Amount", width: "15%", render: (r) => <span style={{ fontSize: 14, fontWeight: 700 }}>{formatPaise(r.amount)}</span> },
    { key: "status", label: "Status", width: "18%", render: (r) => { const b = paymentBadge(r); return <Badge tone={b.tone}>{b.label}</Badge>; } },
    {
      key: "act", label: "", width: "7%",
      render: (r) => (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <KebabMenu items={[
            { label: "View receipt", icon: "file-text", onClick: () => setReceiptPath(`/tenant/fees/payments/${r.id}/receipt`) },
            { label: "Open student ledger", icon: "arrow-right", onClick: () => openLedger(r) },
          ]} />
        </div>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <h3 style={{ margin: "0 auto 8px 0", fontSize: 16, color: "var(--text-heading)" }}>Payments</h3>
        <Input label="From" type="date" value={filters.from} onChange={(e) => changeFilter({ from: e.target.value })} wrapperStyle={{ width: 160 }} />
        <Input label="To" type="date" value={filters.to} onChange={(e) => changeFilter({ to: e.target.value })} wrapperStyle={{ width: 160 }} />
        <Select label="Mode" options={[{ value: "", label: "All modes" }, ...FEE_PAYMENT_MODES.map((m) => ({ value: m, label: PAYMENT_MODE_LABEL[m] }))]}
          value={filters.mode} onChange={(e) => changeFilter({ mode: e.target.value as Filters["mode"] })} wrapperStyle={{ width: 160 }} />
        <Button variant="app" icon={<Icon name="plus" size={15} />} onClick={() => setShowPicker(true)}>Record payment</Button>
      </div>

      {error && (
        <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 16, padding: "10px 14px", border: "1px solid rgba(244,63,94,0.35)", background: "var(--danger-soft)", borderRadius: "var(--radius-md)" }}>{error}</p>
      )}

      {loading ? (
        <div className="gv-card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading payments…</div>
      ) : rows.length === 0 ? (
        <div className="gv-card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
          {filters.from || filters.to || filters.mode ? "No payments match these filters." : "No payments recorded yet. Use “Record payment” when a student pays at the front desk."}
        </div>
      ) : (
        <>
          <DataTable columns={columns} rows={rows} fixed onRowClick={openLedger} />
          {cursor && (
            <div style={{ textAlign: "center", marginTop: 14 }}>
              <Button variant="secondary" size="sm" onClick={() => load(filters, cursor)} disabled={loadingMore}>{loadingMore ? "Loading…" : "Load more"}</Button>
            </div>
          )}
        </>
      )}

      <ReceiptModal path={receiptPath} tenant={tenantSlug} onClose={() => setReceiptPath(null)} />
      {showPicker && <StudentPicker tenantSlug={tenantSlug} onClose={() => setShowPicker(false)} />}
    </div>
  );
}

/** Batch → student, then straight into that student's ledger with the payment dialog open. */
function StudentPicker({ tenantSlug, onClose }: { tenantSlug: string; onClose: () => void }) {
  const router = useRouter();
  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [batchId, setBatchId] = useState("");
  const [students, setStudents] = useState<BatchStudent[] | null>(null);
  const [studentId, setStudentId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api.get<{ classes: Batch[] }>("/tenant/classes", { tenant: tenantSlug })
      .then((d) => { if (!cancelled) setBatches(d.classes); })
      .catch((err) => { if (!cancelled) setError(errorMessage(err, "Failed to load batches")); });
    return () => { cancelled = true; };
  }, [tenantSlug]);

  async function pickBatch(cid: string) {
    setBatchId(cid); setStudentId(""); setStudents(null); setError("");
    if (!cid) return;
    try {
      const d = await api.get<{ students: BatchStudent[] }>(`/tenant/classes/${cid}/students`, { tenant: tenantSlug });
      setStudents(d.students.filter((s) => s.status === "approved"));
    } catch (err) {
      setError(errorMessage(err, "Failed to load students"));
    }
  }

  function go(e: React.FormEvent) {
    e.preventDefault();
    const s = students?.find((x) => x.studentId === studentId);
    if (!s) return;
    router.push(`/coaching/fees/students/${s.studentId}?name=${encodeURIComponent(s.name)}&from=payments&action=pay`);
  }

  return (
    <Modal open onClose={onClose} title="Record payment — choose student">
      <form onSubmit={go} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Select label="Batch" required
          options={[{ value: "", label: batches ? "Select a batch…" : "Loading…" }, ...(batches ?? []).map((c) => ({ value: c.id, label: c.name }))]}
          value={batchId} onChange={(e) => void pickBatch(e.target.value)} />
        {batchId && (
          <Select label="Student" required
            options={[{ value: "", label: students ? (students.length ? "Select a student…" : "No approved students in this batch") : "Loading…" }, ...(students ?? []).map((s) => ({ value: s.studentId, label: s.name }))]}
            value={studentId} onChange={(e) => setStudentId(e.target.value)} />
        )}
        {error && <p style={{ margin: 0, color: "var(--danger)", fontSize: 13 }}>{error}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="app" disabled={!studentId}>Continue</Button>
        </div>
      </form>
    </Modal>
  );
}

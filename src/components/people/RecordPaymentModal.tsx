"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Button, Input, Modal, Select } from "@/components/ui";
import {
  CLEARABLE_MODES, FEE_PAYMENT_MODES, PAYMENT_MODE_LABEL,
  errorMessage, fmtDate, formatPaise, newIdempotencyKey, paiseToRupees,
  type FeeInvoice, type FeePayment, type FeePaymentMode,
} from "@/lib/fee";

type Props = {
  tenantSlug: string;
  studentId: string;
  studentName: string;
  /** Open invoices only, oldest due first. */
  openInvoices: FeeInvoice[];
  /** Start in "choose installments" mode with this invoice's balance filled in. */
  preselectInvoiceId?: string;
  onClose: () => void;
  onRecorded: (payment: FeePayment, replayed: boolean) => void;
};

/** A `datetime-local` value for now, in the browser's timezone. */
function nowLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/**
 * Record money received (LLD §7c). Mount this fresh per opening — the
 * Idempotency-Key is minted once per mount and deliberately survives a failed
 * submit, so "Save" clicked twice, or retried after a timeout that actually
 * committed, replays the original receipt instead of issuing a second one (§10).
 */
export function RecordPaymentModal({ tenantSlug, studentId, studentName, openInvoices, preselectInvoiceId, onClose, onRecorded }: Props) {
  const [idempotencyKey] = useState(newIdempotencyKey);
  const preselected = openInvoices.find((i) => i.id === preselectInvoiceId);

  const [amount, setAmount] = useState(preselected ? String(paiseToRupees(preselected.outstanding)) : "");
  const [mode, setMode] = useState<FeePaymentMode>("cash");
  const [reference, setReference] = useState("");
  const [bankName, setBankName] = useState("");
  const [instrumentDate, setInstrumentDate] = useState("");
  const [receivedAt, setReceivedAt] = useState(nowLocal);
  const [receivedAtTouched, setReceivedAtTouched] = useState(false);
  const [allocMode, setAllocMode] = useState<"auto" | "manual">(preselected ? "manual" : "auto");
  const [manual, setManual] = useState<Record<string, string>>(
    preselected ? { [preselected.id]: String(paiseToRupees(preselected.outstanding)) } : {},
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const amountRupees = Number(amount) || 0;
  const totalOutstanding = openInvoices.reduce((s, i) => s + i.outstanding, 0);
  const manualRows = openInvoices
    .map((i) => ({ invoice: i, rupees: Number(manual[i.id]) || 0 }))
    .filter((r) => r.rupees > 0);
  const manualSum = manualRows.reduce((s, r) => s + r.rupees, 0);
  const allocatedRupees = allocMode === "manual" ? manualSum : Math.min(amountRupees, paiseToRupees(totalOutstanding));
  const creditRupees = Math.max(0, Math.round((amountRupees - allocatedRupees) * 100) / 100);
  const overAllocated = allocMode === "manual" && manualSum > amountRupees + 1e-9;
  const overInvoice = allocMode === "manual" && manualRows.some((r) => Math.round(r.rupees * 100) > r.invoice.outstanding);
  const clearable = CLEARABLE_MODES.includes(mode);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (overAllocated || overInvoice) return;
    setBusy(true); setError("");
    try {
      const res = await api.post<{ payment: FeePayment; replayed: boolean }>("/tenant/fees/payments", {
        studentId,
        amount: amountRupees,
        mode,
        reference: reference.trim() || null,
        bankName: clearable ? bankName.trim() || null : null,
        instrumentDate: clearable && instrumentDate ? instrumentDate : null,
        receivedAt: receivedAtTouched ? new Date(receivedAt).toISOString() : undefined,
        allocations: allocMode === "manual"
          ? manualRows.map((r) => ({ invoiceId: r.invoice.id, amount: r.rupees }))
          : undefined,
      }, { tenant: tenantSlug, headers: { "Idempotency-Key": idempotencyKey } });
      onRecorded(res.payment, res.replayed);
    } catch (err) {
      setError(errorMessage(err, "Failed to record the payment"));
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`Record payment — ${studentName}`} width={560}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Input label="Amount received (₹)" type="number" min={0.01} step="0.01" required autoFocus
            value={amount} onChange={(e) => setAmount(e.target.value)}
            help={totalOutstanding > 0 ? `Outstanding: ${formatPaise(totalOutstanding)}` : "Nothing outstanding — this will be held as credit."} />
          <Select label="Mode" options={FEE_PAYMENT_MODES.map((m) => ({ value: m, label: PAYMENT_MODE_LABEL[m] }))}
            value={mode} onChange={(e) => setMode(e.target.value as FeePaymentMode)} />
        </div>

        <Input
          label={clearable ? `${PAYMENT_MODE_LABEL[mode]} number` : mode === "upi" ? "UPI reference (optional)" : mode === "bank_transfer" ? "UTR (optional)" : "Reference (optional)"}
          required={clearable} maxLength={120}
          value={reference} onChange={(e) => setReference(e.target.value)} />

        {clearable && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Input label="Bank (optional)" maxLength={120} value={bankName} onChange={(e) => setBankName(e.target.value)} />
            <Input label="Instrument date (optional)" type="date" value={instrumentDate} onChange={(e) => setInstrumentDate(e.target.value)} />
          </div>
        )}
        {clearable && (
          <p style={{ margin: "-4px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>
            Recorded as <strong>pending clearance</strong>. It counts towards the dues now; if the bank returns it,
            mark it bounced and the balance comes back.
          </p>
        )}

        <Input label="Received on" type="datetime-local" max={nowLocal()} required
          value={receivedAt} onChange={(e) => { setReceivedAt(e.target.value); setReceivedAtTouched(true); }}
          help="When the money changed hands. Back-date it if you're entering yesterday's collections." />

        {openInvoices.length > 0 && (
          <div>
            <span className="gv-label">Apply to</span>
            <div className="gv-tabs" role="tablist" style={{ marginBottom: 10 }}>
              <button type="button" role="tab" className="gv-tab" aria-selected={allocMode === "auto"} onClick={() => setAllocMode("auto")}>Oldest due first</button>
              <button type="button" role="tab" className="gv-tab" aria-selected={allocMode === "manual"} onClick={() => setAllocMode("manual")}>Choose installments</button>
            </div>
            {allocMode === "manual" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {openInvoices.map((inv) => (
                  <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-heading)" }}>{inv.label}</div>
                      <div style={{ fontSize: 12, color: inv.overdue ? "var(--danger)" : "var(--text-muted)" }}>
                        Due {fmtDate(inv.dueDate)} · {formatPaise(inv.outstanding)} outstanding
                      </div>
                    </div>
                    <Input type="number" min={0} step="0.01" placeholder="0" aria-label={`Amount towards ${inv.label}`}
                      max={paiseToRupees(inv.outstanding)} wrapperStyle={{ width: 140 }}
                      value={manual[inv.id] ?? ""} onChange={(e) => setManual((m) => ({ ...m, [inv.id]: e.target.value }))} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {amountRupees > 0 && !overAllocated && creditRupees > 0 && (
          <p style={{ margin: 0, fontSize: 13, color: "var(--accent)" }}>
            {formatPaise(Math.round(creditRupees * 100))} will be held as credit — spend it later with &ldquo;Apply credit&rdquo;.
          </p>
        )}
        {overAllocated && <p style={{ margin: 0, color: "var(--danger)", fontSize: 13 }}>The installments add up to more than the amount received.</p>}
        {overInvoice && <p style={{ margin: 0, color: "var(--danger)", fontSize: 13 }}>An installment can&rsquo;t take more than its outstanding balance.</p>}
        {error && <p style={{ margin: 0, color: "var(--danger)", fontSize: 13 }}>{error}</p>}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="app" disabled={busy || amountRupees <= 0 || overAllocated || overInvoice}>
            {busy ? "Recording…" : "Record & issue receipt"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

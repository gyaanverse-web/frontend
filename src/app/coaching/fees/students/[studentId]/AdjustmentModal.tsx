"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Button, Input, Modal, Select } from "@/components/ui";
import {
  ADJUSTMENT_TYPE_LABEL, RELIEF_ADJUSTMENT_TYPES,
  errorMessage, fmtDate, formatPaise, isOpenInvoice, paiseToRupees, todayIST,
  type FeeInvoice, type ManualAdjustmentType,
} from "@/lib/fee";

type Props = {
  tenantSlug: string;
  studentId: string;
  invoices: FeeInvoice[];
  preset?: { type: ManualAdjustmentType; invoiceId?: string };
  onClose: () => void;
  onSaved: () => void;
};

const TYPES: ManualAdjustmentType[] = ["waiver", "write_off", "credit_note", "late_fee", "opening_balance"];

const HELP: Record<ManualAdjustmentType, string> = {
  waiver: "Forgive part or all of one installment's balance. It closes as Waived, not Paid.",
  write_off: "Give up on money you don't expect to collect. Reported separately from a waiver.",
  credit_note: "Reduce an installment after the fact — e.g. a service that wasn't delivered.",
  late_fee: "Charge a late fee on an overdue installment. Raises a new charge the student owes. Only one late fee per installment.",
  opening_balance: "Money owed from before you used Gyaanverse. Raises a new charge the student owes.",
};

/**
 * Non-cash ledger entries (LLD §4 fee_adjustments, §15 deviation 3). Relief
 * types reduce one open invoice; charge types raise a new `charge` invoice so
 * every rupee owed is something a payment can be allocated against.
 * Amounts go up in rupees and are always positive — the type decides the sign.
 */
export function AdjustmentModal({ tenantSlug, studentId, invoices, preset, onClose, onSaved }: Props) {
  const [type, setType] = useState<ManualAdjustmentType>(preset?.type ?? "waiver");
  const [invoiceId, setInvoiceId] = useState(preset?.invoiceId ?? "");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(todayIST);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const relief = RELIEF_ADJUSTMENT_TYPES.includes(type);
  const needsInvoice = relief || type === "late_fee";
  // A late fee is levied on an installment, never on another charge.
  const candidates = invoices.filter((i) => isOpenInvoice(i) && (type !== "late_fee" || i.kind === "installment"));
  const selected = candidates.find((i) => i.id === invoiceId);
  const tooMuch = relief && selected && Math.round(Number(amount) * 100) > selected.outstanding;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await api.post("/tenant/fees/adjustments", {
        studentId,
        type,
        amount: Number(amount),
        invoiceId: needsInvoice ? invoiceId : undefined,
        dueDate: relief ? undefined : dueDate,
        reason: reason.trim(),
      }, { tenant: tenantSlug });
      onSaved();
    } catch (err) {
      setError(errorMessage(err, "Failed to save the adjustment"));
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Add adjustment" width={520}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Select label="Type" options={TYPES.map((t) => ({ value: t, label: ADJUSTMENT_TYPE_LABEL[t] }))}
          value={type} onChange={(e) => { setType(e.target.value as ManualAdjustmentType); setInvoiceId(""); }} />
        <p style={{ margin: "-6px 0 0", fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5 }}>{HELP[type]}</p>

        {needsInvoice && (
          candidates.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>There are no open installments to apply this to.</p>
          ) : (
            <Select label={type === "late_fee" ? "Overdue installment" : "Installment"} required
              options={[{ value: "", label: "Select…" }, ...candidates.map((i) => ({
                value: i.id,
                label: `${i.label} — due ${fmtDate(i.dueDate)} · ${formatPaise(i.outstanding)} outstanding`,
              }))]}
              value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} />
          )
        )}

        <Input label="Amount (₹)" type="number" min={0.01} step="0.01" required
          max={relief && selected ? paiseToRupees(selected.outstanding) : undefined}
          value={amount} onChange={(e) => setAmount(e.target.value)} />
        {!relief && (
          <Input label="Due date" type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        )}
        <Input label="Reason" required maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />

        {tooMuch && <p style={{ margin: 0, color: "var(--danger)", fontSize: 13 }}>That&rsquo;s more than the installment&rsquo;s outstanding balance.</p>}
        {error && <p style={{ margin: 0, color: "var(--danger)", fontSize: 13 }}>{error}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="app"
            disabled={busy || !reason.trim() || Number(amount) <= 0 || (needsInvoice && !invoiceId) || Boolean(tooMuch)}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

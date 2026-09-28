"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useTenantSession } from "@/lib/useTenantSession";
import { TeacherShell } from "@/components/dashboard/TeacherShell";
import { Badge, Button, Card, DataTable, Icon, Input, KebabMenu, Modal, Select, StatCard } from "@/components/ui";
import type { Column, KebabItem } from "@/components/ui";
import { ReceiptModal } from "@/components/fees/ReceiptModal";
import { TaxInvoiceModal } from "@/components/fees/TaxInvoiceModal";
import { ReasonModal, type ReasonPrompt } from "@/components/fees/ReasonModal";
import {
  ADJUSTMENT_TYPE_LABEL, ASSIGNMENT_STATUS_TONE, CONCESSION_TYPE_LABEL, FEE_CONCESSION_TYPES,
  INVOICE_STATUS_LABEL, INVOICE_STATUS_TONE, PAYMENT_MODE_LABEL,
  errorMessage, formatPaise, fmtDate, fmtDateTime, isOpenInvoice, paymentBadge,
  type FeeAdjustment, type FeeConcession, type FeeConcessionMode, type FeeConcessionType, type FeeInvoice,
  type FeePayment, type FeeStructure, type LedgerPayment, type ManualAdjustmentType, type StudentLedger,
} from "@/lib/fee";
import { RecordPaymentModal } from "./RecordPaymentModal";
import { AdjustmentModal } from "./AdjustmentModal";
import { GuardiansPanel } from "./GuardiansPanel";

type Tenant = { id: string; slug: string; name: string };

function StudentLedgerInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const studentId = params?.studentId as string;
  const studentName = searchParams.get("name") ?? "Student";
  const from = searchParams.get("from");

  const { loading, user, tenant, role } = useTenantSession<Tenant>({ allow: ["coaching_owner"] });

  const [ledger, setLedger] = useState<StudentLedger | null>(null);
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{ text: string; paymentId?: string } | null>(null);

  // Dialogs. The payment and adjustment modals are mounted fresh per opening
  // (see RecordPaymentModal on why the idempotency key depends on that).
  const [payFor, setPayFor] = useState<{ invoiceId?: string } | null>(searchParams.get("action") === "pay" ? {} : null);
  const [adjustPreset, setAdjustPreset] = useState<{ type: ManualAdjustmentType; invoiceId?: string } | null>(null);
  const [showConcession, setShowConcession] = useState(false);
  const [reasonPrompt, setReasonPrompt] = useState<ReasonPrompt | null>(null);
  const [receiptPath, setReceiptPath] = useState<string | null>(null);
  const [taxInvoicePath, setTaxInvoicePath] = useState<string | null>(null);
  const [applyingCredit, setApplyingCredit] = useState(false);

  // Mount / student-change load — a plain promise chain, not a call into an
  // async helper, so nothing sets state synchronously within the effect body.
  useEffect(() => {
    if (!tenant) return;
    const slug = tenant.slug;
    let cancelled = false;
    Promise.all([
      api.get<StudentLedger>(`/tenant/fees/students/${studentId}/ledger`, { tenant: slug }),
      api.get<{ items: FeeStructure[] }>("/tenant/fees/structures?limit=200", { tenant: slug }),
    ])
      .then(([l, s]) => {
        if (cancelled) return;
        setLedger(l);
        setStructures(s.items);
      })
      .catch((err) => { if (!cancelled) setError(errorMessage(err, "Failed to load ledger")); });
    return () => { cancelled = true; };
  }, [tenant, studentId]);

  // Re-fetch after a write. Only ever called from event handlers — never from
  // an effect. Keeps the current ledger on screen while it loads.
  const refresh = useCallback(async () => {
    if (!tenant) return;
    try {
      setLedger(await api.get<StudentLedger>(`/tenant/fees/students/${studentId}/ledger`, { tenant: tenant.slug }));
      setError("");
    } catch (err) {
      setError(errorMessage(err, "Failed to reload ledger"));
    }
  }, [tenant, studentId]);

  if (loading || !user || !tenant) return <PageLoading />;
  const slug = tenant.slug;

  const structureById = new Map(structures.map((s) => [s.id, s]));
  const invoiceById = new Map((ledger?.invoices ?? []).map((i) => [i.id, i]));
  const billed = (ledger?.invoices ?? []).filter((i) => i.status !== "cancelled" && i.status !== "draft");
  const openInvoices = billed.filter(isOpenInvoice);
  const totals = {
    billed: billed.reduce((s, i) => s + i.totalAmount, 0),
    paid: billed.reduce((s, i) => s + i.paidAmount, 0),
    waived: billed.reduce((s, i) => s + i.waivedAmount, 0),
    outstanding: openInvoices.reduce((s, i) => s + i.outstanding, 0),
    overdue: openInvoices.filter((i) => i.overdue).reduce((s, i) => s + i.outstanding, 0),
  };
  const credit = ledger?.creditBalance ?? 0;
  const reversedAdjustmentIds = new Set((ledger?.adjustments ?? []).map((a) => a.reversesId).filter(Boolean));

  // ── Actions ───────────────────────────────────────────────────────────────

  function onPaymentRecorded(payment: FeePayment, replayed: boolean) {
    setPayFor(null);
    setNotice({
      text: replayed
        ? `This payment was already recorded as receipt ${payment.receiptNo} — no second receipt was issued.`
        : `Recorded ${formatPaise(payment.amount)} — receipt ${payment.receiptNo}.`,
      paymentId: payment.id,
    });
    void refresh();
  }

  async function handleApplyCredit() {
    setApplyingCredit(true); setError(""); setNotice(null);
    try {
      const res = await api.post<{ allocated: number }>(`/tenant/fees/students/${studentId}/apply-credit`, {}, { tenant: slug });
      setNotice({ text: res.allocated > 0 ? `Applied ${formatPaise(res.allocated)} of credit to open installments.` : "Nothing to apply — no open installment could take the credit." });
      await refresh();
    } catch (err) {
      setError(errorMessage(err, "Failed to apply credit"));
    } finally {
      setApplyingCredit(false);
    }
  }

  async function setClearance(p: LedgerPayment, outcome: "cleared" | "bounced", reason?: string) {
    await api.post(`/tenant/fees/payments/${p.id}/clearance`, { outcome, reason }, { tenant: slug });
    setNotice({ text: outcome === "cleared" ? `${p.receiptNo} marked cleared.` : `${p.receiptNo} marked bounced — the amount is due again.` });
    await refresh();
  }

  function paymentActions(p: LedgerPayment): KebabItem[] {
    const items: KebabItem[] = [
      { label: "View receipt", icon: "file-text", onClick: () => setReceiptPath(`/tenant/fees/payments/${p.id}/receipt`) },
    ];
    if (p.status === "recorded" && p.clearanceStatus === "pending") {
      items.push(
        { label: "Mark cleared", icon: "check-circle", onClick: () => { setError(""); setClearance(p, "cleared").catch((err) => setError(errorMessage(err, "Failed to mark cleared"))); } },
        {
          label: "Mark bounced", icon: "alert-triangle", danger: true,
          onClick: () => setReasonPrompt({
            title: `Bounce ${p.receiptNo}`,
            body: `The ${formatPaise(p.amount)} comes back off every installment it paid, a paid installment goes back to partly paid, and any bounce charge in Settings is levied once. The receipt keeps its number and prints stamped BOUNCED.`,
            confirmLabel: "Mark bounced", danger: true,
            onConfirm: (reason) => setClearance(p, "bounced", reason),
          }),
        },
      );
    }
    if (p.status === "recorded") {
      items.push({
        label: "Reverse (mis-keyed)", icon: "alert-triangle", danger: true,
        onClick: () => setReasonPrompt({
          title: `Reverse ${p.receiptNo}`,
          body: `For an entry keyed in by mistake — wrong student, wrong amount. The ${formatPaise(p.amount)} comes back off its installments. Receipt ${p.receiptNo} is never reused; it reprints stamped REVERSED. Record the correct payment separately.`,
          confirmLabel: "Reverse payment", danger: true,
          onConfirm: async (reason) => {
            await api.post(`/tenant/fees/payments/${p.id}/reverse`, { reason }, { tenant: slug });
            setNotice({ text: `${p.receiptNo} reversed.` });
            await refresh();
          },
        }),
      });
    }
    return items;
  }

  function invoiceActions(i: FeeInvoice): KebabItem[] {
    const items: KebabItem[] = [];
    if (isOpenInvoice(i)) {
      items.push(
        { label: "Record payment towards this", icon: "wallet", onClick: () => setPayFor({ invoiceId: i.id }) },
        { label: "Waive / write off…", icon: "check-circle", onClick: () => setAdjustPreset({ type: "waiver", invoiceId: i.id }) },
      );
      if (i.kind === "installment" && i.overdue) {
        items.push({ label: "Levy late fee…", icon: "clock", onClick: () => setAdjustPreset({ type: "late_fee", invoiceId: i.id }) });
      }
    }
    if (i.invoiceNo) items.push({ label: "GST tax invoice", icon: "file-text", onClick: () => setTaxInvoicePath(`/tenant/fees/invoices/${i.id}/tax-invoice`) });
    return items;
  }

  function reverseAdjustment(a: FeeAdjustment) {
    const charge = a.amount > 0;
    setReasonPrompt({
      title: `Reverse ${ADJUSTMENT_TYPE_LABEL[a.type].toLowerCase()}`,
      body: charge
        ? `Cancels the ${formatPaise(a.amount)} charge. Refused if any money has already been paid or waived against it — reverse that first.`
        : `Puts the ${formatPaise(-a.amount)} back on the installment as owed.`,
      confirmLabel: "Reverse", danger: true,
      onConfirm: async (reason) => {
        await api.post(`/tenant/fees/adjustments/${a.id}/reverse`, { reason }, { tenant: slug });
        await refresh();
      },
    });
  }

  function reverseConcession(c: FeeConcession) {
    setReasonPrompt({
      title: "Reverse concession",
      body: `Removes the ${formatPaise(c.computedAmount)} ${CONCESSION_TYPE_LABEL[c.type].toLowerCase()} concession and re-splits the fee across the installments. Only possible while nothing has been paid or waived on this fee plan.`,
      confirmLabel: "Reverse concession", danger: true,
      onConfirm: async (reason) => {
        await api.deleteWithBody(`/tenant/fees/concessions/${c.id}`, { reason }, { tenant: slug });
        await refresh();
      },
    });
  }

  // ── Columns ───────────────────────────────────────────────────────────────

  const invoiceColumns: Column<FeeInvoice>[] = [
    {
      key: "label", label: "Installment", width: "24%",
      render: (i) => (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-heading)" }}>{i.label}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {i.kind === "charge" ? "Charge" : `Installment ${i.installmentSeq ?? ""}`}{i.invoiceNo ? ` · ${i.invoiceNo}` : ""}
          </div>
        </div>
      ),
    },
    { key: "dueDate", label: "Due", width: "13%", render: (i) => <span style={{ fontSize: 13, color: i.overdue ? "var(--danger)" : undefined }}>{fmtDate(i.dueDate)}</span> },
    {
      key: "total", label: "Amount", width: "14%",
      render: (i) => (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{formatPaise(i.totalAmount)}</div>
          {i.concessionAmount > 0 && <div style={{ fontSize: 11.5, color: "var(--accent)" }}>− {formatPaise(i.concessionAmount)} concession</div>}
          {i.taxAmount > 0 && <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>incl. {formatPaise(i.taxAmount)} GST</div>}
        </div>
      ),
    },
    {
      key: "paid", label: "Paid", width: "14%",
      render: (i) => (
        <div style={{ fontSize: 13 }}>
          {i.paidAmount > 0 ? formatPaise(i.paidAmount) : <span style={{ color: "var(--text-muted)" }}>—</span>}
          {i.waivedAmount > 0 && <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{formatPaise(i.waivedAmount)} waived</div>}
        </div>
      ),
    },
    { key: "outstanding", label: "Outstanding", width: "14%", render: (i) => <span style={{ fontSize: 13, fontWeight: 700, color: i.outstanding > 0 ? "var(--text-heading)" : "var(--text-muted)" }}>{isOpenInvoice(i) ? formatPaise(i.outstanding) : "—"}</span> },
    { key: "status", label: "Status", width: "15%", render: (i) => <Badge tone={i.overdue ? "danger" : INVOICE_STATUS_TONE[i.status]}>{i.overdue ? "Overdue" : INVOICE_STATUS_LABEL[i.status]}</Badge> },
    {
      key: "act", label: "", width: "6%",
      render: (i) => {
        const items = invoiceActions(i);
        return items.length ? <div style={{ display: "flex", justifyContent: "flex-end" }}><KebabMenu items={items} /></div> : null;
      },
    },
  ];

  const paymentColumns: Column<LedgerPayment>[] = [
    {
      key: "receipt", label: "Receipt", width: "18%",
      render: (p) => (
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, fontFamily: "var(--font-mono)", color: p.status === "reversed" ? "var(--text-muted)" : "var(--text-heading)", textDecoration: p.status === "reversed" ? "line-through" : undefined }}>{p.receiptNo}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{fmtDateTime(p.receivedAt)}</div>
        </div>
      ),
    },
    {
      key: "mode", label: "Mode", width: "18%",
      render: (p) => (
        <div>
          <div style={{ fontSize: 13 }}>{PAYMENT_MODE_LABEL[p.mode]}</div>
          {p.reference && <div style={{ fontSize: 12, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.reference}</div>}
        </div>
      ),
    },
    { key: "amount", label: "Amount", width: "13%", render: (p) => <span style={{ fontSize: 13.5, fontWeight: 700 }}>{formatPaise(p.amount)}</span> },
    {
      key: "towards", label: "Towards", width: "29%",
      render: (p) => {
        const allocated = p.allocations.reduce((s, a) => s + a.amount, 0);
        return (
          <div style={{ fontSize: 12.5, color: "var(--text-body)", lineHeight: 1.45 }}>
            {p.allocations.map((a) => (
              <div key={a.id}>{invoiceById.get(a.invoiceId)?.label ?? "Installment"} · {formatPaise(a.amount)}</div>
            ))}
            {p.amount - allocated > 0 && p.status === "recorded" && p.clearanceStatus !== "bounced" && (
              <div style={{ color: "var(--accent)" }}>Credit · {formatPaise(p.amount - allocated)}</div>
            )}
          </div>
        );
      },
    },
    {
      key: "status", label: "Status", width: "16%",
      render: (p) => {
        const b = paymentBadge(p);
        const why = p.status === "reversed" ? p.reversalReason : p.clearanceStatus === "bounced" ? p.bounceReason : null;
        return (
          <div>
            <Badge tone={b.tone}>{b.label}</Badge>
            {why && <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>{why}</div>}
          </div>
        );
      },
    },
    { key: "act", label: "", width: "6%", render: (p) => <div style={{ display: "flex", justifyContent: "flex-end" }}><KebabMenu items={paymentActions(p)} /></div> },
  ];

  const adjustmentColumns: Column<FeeAdjustment>[] = [
    { key: "date", label: "Date", width: "14%", render: (a) => <span style={{ fontSize: 12.5 }}>{fmtDate(a.createdAt)}</span> },
    {
      key: "type", label: "Type", width: "18%",
      render: (a) => (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-heading)" }}>{ADJUSTMENT_TYPE_LABEL[a.type]}</div>
          {a.reversesId && <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>Reversal</div>}
        </div>
      ),
    },
    { key: "amount", label: "Amount", width: "14%", render: (a) => <span style={{ fontSize: 13, fontWeight: 600, color: a.amount < 0 ? "var(--success)" : "var(--text-heading)" }}>{a.amount < 0 ? "− " : "+ "}{formatPaise(Math.abs(a.amount))}</span> },
    { key: "against", label: "Against", width: "20%", render: (a) => <span style={{ fontSize: 12.5 }}>{a.invoiceId ? invoiceById.get(a.invoiceId)?.label ?? "—" : "—"}</span> },
    { key: "reason", label: "Reason", width: "22%", render: (a) => <span style={{ fontSize: 12.5, color: "var(--text-body)" }}>{a.reason ?? "—"}</span> },
    {
      key: "act", label: "", width: "12%",
      render: (a) => (
        a.reversesId ? null
          : reversedAdjustmentIds.has(a.id) ? <Badge tone="neutral">Reversed</Badge>
          : <Button variant="ghost" size="sm" onClick={() => reverseAdjustment(a)}>Reverse</Button>
      ),
    },
  ];

  return (
    <TeacherShell
      tenant={tenant} user={user} role={role} active="fees" eyebrow="Fees · Student ledger"
      title={studentName}
      action={
        ledger && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="secondary" onClick={() => setAdjustPreset({ type: "waiver" })}>Add adjustment</Button>
            <Button variant="app" icon={<Icon name="wallet" size={16} />} onClick={() => { setNotice(null); setPayFor({}); }}>Record payment</Button>
          </div>
        )
      }
    >
      <Button variant="ghost" size="sm" onClick={() => router.push(from === "defaulters" ? "/coaching/fees?tab=reports" : from === "payments" ? "/coaching/fees?tab=payments" : "/coaching/fees?tab=assignments")} style={{ marginBottom: 16 }}>
        ← Back
      </Button>

      {error && <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 16 }}>{error}</p>}
      {notice && (
        <div className="gv-card" style={{ padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "var(--success-soft, var(--accent-soft))", border: "1px solid var(--success)" }}>
          <Icon name="check-circle" size={18} style={{ color: "var(--success)" }} />
          <span style={{ flex: 1, fontSize: 13.5, color: "var(--text-heading)" }}>{notice.text}</span>
          {notice.paymentId && <Button variant="secondary" size="sm" onClick={() => setReceiptPath(`/tenant/fees/payments/${notice.paymentId}/receipt`)}>View & print receipt</Button>}
          <Button variant="ghost" size="sm" onClick={() => setNotice(null)}>Dismiss</Button>
        </div>
      )}

      {!ledger ? (
        !error && <div className="gv-card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading ledger…</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 24 }}>
            <StatCard label="Billed" value={formatPaise(totals.billed)} sub={totals.waived > 0 ? `${formatPaise(totals.waived)} waived` : undefined} />
            <StatCard label="Paid" value={formatPaise(totals.paid)} />
            <StatCard label="Outstanding" value={formatPaise(totals.outstanding)}
              sub={totals.overdue > 0 ? <span style={{ color: "var(--danger)" }}>{formatPaise(totals.overdue)} overdue</span> : "Nothing overdue"} />
            <StatCard label="Credit" value={formatPaise(credit)}
              sub={credit > 0 && openInvoices.length > 0
                ? <Button variant="ghost" size="sm" onClick={handleApplyCredit} disabled={applyingCredit} style={{ marginLeft: -10 }}>{applyingCredit ? "Applying…" : "Apply to open installments"}</Button>
                : "Advance paid, not yet applied"} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(260px, 320px)", gap: 20, alignItems: "start" }} className="gv-fee-ledger-grid">
            <div style={{ minWidth: 0 }}>
              <SectionHead title="Installments & charges" />
              {billed.length === 0 && ledger.invoices.length === 0 ? (
                <Empty text="Nothing billed yet. Assign a published fee structure to this student's batch." />
              ) : (
                <DataTable columns={invoiceColumns} rows={ledger.invoices} fixed style={{ marginBottom: 28 }} />
              )}

              <SectionHead title="Payments" count={ledger.payments.length} />
              {ledger.payments.length === 0 ? (
                <Empty text="No payments recorded yet." />
              ) : (
                <DataTable columns={paymentColumns} rows={[...ledger.payments].reverse()} fixed style={{ marginBottom: 28 }} />
              )}

              {ledger.adjustments.length > 0 && (
                <>
                  <SectionHead title="Adjustments" count={ledger.adjustments.length} />
                  <DataTable columns={adjustmentColumns} rows={[...ledger.adjustments].reverse()} fixed />
                </>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Card padding={18}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <h3 style={{ margin: 0, fontSize: 15, color: "var(--text-heading)" }}>Fee plans</h3>
                  <div style={{ flex: 1 }} />
                  {ledger.assignments.length > 0 && (
                    <Button variant="ghost" size="sm" icon={<Icon name="plus" size={14} />} onClick={() => setShowConcession(true)}>Concession</Button>
                  )}
                </div>
                {ledger.assignments.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>Not on any fee plan yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {ledger.assignments.map((a) => {
                      const concessions = ledger.concessions.filter((c) => c.assignmentId === a.id && !c.isReversal);
                      return (
                        <div key={a.id}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "var(--text-heading)" }}>{structureById.get(a.structureId)?.name ?? "Fee plan"}</span>
                            <Badge tone={ASSIGNMENT_STATUS_TONE[a.status]}>{a.status}</Badge>
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{a.academicYear} · since {fmtDate(a.effectiveFrom)}</div>
                          <div style={{ fontSize: 12.5, color: "var(--text-body)", marginTop: 6, display: "grid", gridTemplateColumns: "1fr auto", rowGap: 2 }}>
                            <span>Gross</span><span>{formatPaise(a.grossAmount)}</span>
                            <span>Concession</span><span>{a.concessionAmount > 0 ? `− ${formatPaise(a.concessionAmount)}` : "—"}</span>
                            <span style={{ fontWeight: 700, color: "var(--text-heading)" }}>Net</span><span style={{ fontWeight: 700, color: "var(--text-heading)" }}>{formatPaise(a.netAmount)}</span>
                          </div>
                          {concessions.map((c) => (
                            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, padding: "8px 10px", borderRadius: "var(--radius-md)", background: "var(--surface-inset)", opacity: c.reversed ? 0.6 : 1 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-heading)", textDecoration: c.reversed ? "line-through" : undefined }}>
                                  {CONCESSION_TYPE_LABEL[c.type]} · {c.mode === "percent" ? `${Number(c.value)}%` : formatPaise(Math.round(Number(c.value) * 100))} = {formatPaise(c.computedAmount)}
                                </div>
                                {c.reason && <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{c.reason}</div>}
                              </div>
                              {c.reversed ? <Badge tone="neutral">Reversed</Badge> : <Button variant="ghost" size="sm" onClick={() => reverseConcession(c)}>Reverse</Button>}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              <GuardiansPanel tenantSlug={slug} studentId={studentId} guardians={ledger.guardians} onChanged={() => void refresh()} />
            </div>
          </div>
        </>
      )}

      {payFor && ledger && (
        <RecordPaymentModal
          tenantSlug={slug} studentId={studentId} studentName={studentName}
          openInvoices={[...openInvoices].sort((a, b) => a.dueDate.localeCompare(b.dueDate))}
          preselectInvoiceId={payFor.invoiceId}
          onClose={() => setPayFor(null)}
          onRecorded={onPaymentRecorded}
        />
      )}
      {adjustPreset && ledger && (
        <AdjustmentModal
          tenantSlug={slug} studentId={studentId} invoices={ledger.invoices} preset={adjustPreset}
          onClose={() => setAdjustPreset(null)}
          onSaved={() => { setAdjustPreset(null); void refresh(); }}
        />
      )}
      {showConcession && ledger && (
        <ConcessionModal
          tenantSlug={slug} ledger={ledger} structureById={structureById}
          onClose={() => setShowConcession(false)}
          onSaved={() => { setShowConcession(false); void refresh(); }}
        />
      )}
      <ReasonModal prompt={reasonPrompt} onClose={() => setReasonPrompt(null)} />
      <ReceiptModal path={receiptPath} tenant={slug} onClose={() => setReceiptPath(null)} />
      <TaxInvoiceModal path={taxInvoicePath} tenant={slug} onClose={() => setTaxInvoicePath(null)} />
    </TeacherShell>
  );
}

function ConcessionModal({ tenantSlug, ledger, structureById, onClose, onSaved }: {
  tenantSlug: string;
  ledger: StudentLedger;
  structureById: Map<string, FeeStructure>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    assignmentId: ledger.assignments[0]?.id ?? "",
    type: "scholarship" as FeeConcessionType,
    mode: "percent" as FeeConcessionMode,
    value: "",
    reason: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await api.post(`/tenant/fees/assignments/${form.assignmentId}/concessions`, {
        type: form.type,
        mode: form.mode,
        value: Number(form.value),
        reason: form.reason.trim() || undefined,
      }, { tenant: tenantSlug });
      onSaved();
    } catch (err) {
      setError(errorMessage(err, "Failed to grant concession"));
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Grant concession">
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {ledger.assignments.length > 1 && (
          <Select label="Fee plan" required
            options={ledger.assignments.map((a) => ({ value: a.id, label: `${structureById.get(a.structureId)?.name ?? "Fee plan"} (${a.academicYear})` }))}
            value={form.assignmentId} onChange={(e) => setForm((f) => ({ ...f, assignmentId: e.target.value }))} />
        )}
        <Select label="Type" options={FEE_CONCESSION_TYPES.map((t) => ({ value: t, label: CONCESSION_TYPE_LABEL[t] }))} value={form.type}
          onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as FeeConcessionType }))} />
        <Select label="Mode"
          options={[{ value: "percent", label: "Percent of gross" }, { value: "amount", label: "Fixed amount (₹)" }]}
          value={form.mode} onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value as FeeConcessionMode }))} />
        <Input label={form.mode === "percent" ? "Value (%)" : "Value (₹)"} type="number" min={0.01} max={form.mode === "percent" ? 100 : undefined} step="0.01" required
          value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} />
        <Input label="Reason (optional)" maxLength={500}
          value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
          Spread proportionally across every installment on the plan. Concessions can only change until money moves on the
          plan — after the first payment or waiver, use a waiver adjustment instead.
        </p>
        {error && <p style={{ margin: 0, color: "var(--danger)", fontSize: 13 }}>{error}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="app" disabled={busy || !form.assignmentId}>Grant</Button>
        </div>
      </form>
    </Modal>
  );
}

function SectionHead({ title, count }: { title: string; count?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 12px" }}>
      <h3 style={{ margin: 0, fontSize: 16, color: "var(--text-heading)" }}>{title}</h3>
      {count !== undefined && <Badge tone="neutral">{count}</Badge>}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="gv-card" style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", fontSize: 13.5, marginBottom: 28 }}>{text}</div>;
}

export default function StudentLedgerPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <StudentLedgerInner />
    </Suspense>
  );
}

function PageLoading() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "var(--text-muted)" }}>
      Loading…
    </div>
  );
}

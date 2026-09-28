"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { TeacherShell } from "@/components/dashboard/TeacherShell";
import { Card, Badge, Button, Icon } from "@/components/ui";
import { ReceiptModal } from "@/components/fees/ReceiptModal";
import { TaxInvoiceModal } from "@/components/fees/TaxInvoiceModal";
import {
  INVOICE_STATUS_LABEL, INVOICE_STATUS_TONE, PAYMENT_MODE_LABEL, isFeesDisabledError, isOpenInvoice,
  errorMessage, formatPaise, fmtDate, type FeesSummary, type StudentReceiptItem,
} from "@/lib/fee";
import { NoCoachingPanel } from "./StudentBits";

type ShellUser = { name: string; role?: string };
type ShellTenant = { name: string; slug: string } | null;

/**
 * The student's own fees (LLD §7g). No internal state: reversed payments never
 * appear, cancelled invoices aren't billed, and a bounced cheque shows only as
 * the balance being due again.
 */
export function StudentFees({ user, tenant }: { user: ShellUser; tenant: ShellTenant }) {
  const [summary, setSummary] = useState<FeesSummary | null>(null);
  const [receipts, setReceipts] = useState<StudentReceiptItem[]>([]);
  const [loading, setLoading] = useState(Boolean(tenant));
  const [disabled, setDisabled] = useState(false);
  const [error, setError] = useState("");
  const [receiptPath, setReceiptPath] = useState<string | null>(null);
  const [taxInvoicePath, setTaxInvoicePath] = useState<string | null>(null);

  useEffect(() => {
    if (!tenant) return;
    let cancelled = false;
    Promise.all([
      api.get<FeesSummary>("/fees/summary"),
      api.get<{ items: StudentReceiptItem[] }>("/fees/receipts?limit=200"),
    ])
      .then(([s, r]) => {
        if (cancelled) return;
        setSummary(s);
        setReceipts(r.items);
      })
      .catch((err) => {
        if (cancelled) return;
        if (isFeesDisabledError(err)) setDisabled(true);
        else setError(errorMessage(err, "Could not load your fees."));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tenant]);

  const invoices = summary?.invoices ?? [];
  const pct = summary && summary.totalBilled > 0
    ? Math.min(100, Math.round(((summary.totalPaid + summary.totalWaived) / summary.totalBilled) * 100))
    : 0;

  return (
    <TeacherShell tenant={tenant} user={user} role="student" active="fees" noCoaching={!tenant}
      eyebrow={tenant?.name} title="My Fees">
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {!tenant ? (
          <NoCoachingPanel body="Fees are set by your coaching institute. Once you join one, any installments billed to you show up here." />
        ) : disabled ? (
          <Card padding={40} style={{ textAlign: "center" }}>
            <Icon name="wallet" size={26} style={{ color: "var(--text-muted)" }} />
            <h3 style={{ margin: "12px 0 6px", fontSize: 16, color: "var(--text-heading)" }}>Fees isn&rsquo;t enabled here yet</h3>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-body)" }}>Your institute hasn&rsquo;t turned on fee management yet.</p>
          </Card>
        ) : error ? (
          <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>
        ) : loading || !summary ? (
          <Card padding={40} style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading your fees…</Card>
        ) : invoices.length === 0 && receipts.length === 0 ? (
          <Card padding={40} style={{ textAlign: "center" }}>
            <Icon name="wallet" size={26} style={{ color: "var(--accent)" }} />
            <h3 style={{ margin: "12px 0 6px", fontSize: 16, color: "var(--text-heading)" }}>No fees billed yet</h3>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-body)" }}>Nothing has been invoiced to you yet — check back once your batch is billed.</p>
          </Card>
        ) : (
          <>
            {summary.nextDue && (
              <Card dark padding={24} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.7, marginBottom: 6 }}>
                  {summary.overdueAmount > 0 ? "Overdue — please pay" : "Next payment due"}
                </div>
                <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: "-0.02em" }}>
                  {formatPaise(summary.overdueAmount > 0 ? summary.overdueAmount : summary.nextDue.amount)}
                </div>
                <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>
                  {summary.overdueAmount > 0 ? "Past its due date" : `${summary.nextDue.label} · by ${fmtDate(summary.nextDue.dueDate)}`}
                </div>
              </Card>
            )}

            <Card padding={22} style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10, gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-heading)" }}>Your fee so far</span>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{formatPaise(summary.totalPaid)} of {formatPaise(summary.totalBilled)} paid</span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: "var(--border-default)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: "var(--success)", borderRadius: 999 }} />
              </div>
              <div style={{ display: "flex", gap: 20, marginTop: 14, fontSize: 12.5, color: "var(--text-muted)", flexWrap: "wrap" }}>
                <span>Balance: <strong style={{ color: "var(--text-heading)" }}>{formatPaise(summary.balance)}</strong></span>
                {summary.totalWaived > 0 && <span>Waived: <strong style={{ color: "var(--text-heading)" }}>{formatPaise(summary.totalWaived)}</strong></span>}
                {summary.creditBalance > 0 && <span>Advance paid: <strong style={{ color: "var(--accent)" }}>{formatPaise(summary.creditBalance)}</strong></span>}
              </div>
            </Card>

            {invoices.length > 0 && (
              <>
                <h3 style={{ margin: "0 0 12px", fontSize: 16, color: "var(--text-heading)" }}>Installments</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
                  {invoices.map((inv) => (
                    <Card key={inv.id} padding={18} style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-heading)" }}>{inv.label}</div>
                        <div style={{ fontSize: 12.5, color: inv.overdue ? "var(--danger)" : "var(--text-muted)", marginTop: 2 }}>Due {fmtDate(inv.dueDate)}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-heading)" }}>{formatPaise(inv.totalAmount)}</div>
                        {inv.paidAmount > 0 && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{formatPaise(inv.paidAmount)} paid</div>}
                        {inv.waivedAmount > 0 && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{formatPaise(inv.waivedAmount)} waived</div>}
                        {isOpenInvoice(inv) && inv.paidAmount > 0 && <div style={{ fontSize: 12, color: "var(--text-heading)" }}>{formatPaise(inv.outstanding)} left</div>}
                      </div>
                      <Badge tone={inv.overdue ? "danger" : INVOICE_STATUS_TONE[inv.status]}>{inv.overdue ? "Overdue" : INVOICE_STATUS_LABEL[inv.status]}</Badge>
                      {inv.invoiceNo && (
                        <Button variant="ghost" size="sm" onClick={() => setTaxInvoicePath(`/fees/invoices/${inv.id}/tax-invoice`)}>Tax invoice</Button>
                      )}
                    </Card>
                  ))}
                </div>
              </>
            )}

            <h3 style={{ margin: "0 0 12px", fontSize: 16, color: "var(--text-heading)" }}>Receipts</h3>
            {receipts.length === 0 ? (
              <Card padding={24} style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13.5 }}>No payments recorded yet.</Card>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {receipts.map((r) => (
                  <Card key={r.paymentId} padding={16} style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--text-heading)" }}>{r.receiptNo}</div>
                      <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{fmtDate(r.receivedAt)} · {PAYMENT_MODE_LABEL[r.mode]}</div>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-heading)" }}>{formatPaise(r.amount)}</div>
                    {r.stamp && <Badge tone={r.stamp === "BOUNCED" ? "danger" : "warning"}>{r.stamp === "BOUNCED" ? "Bounced" : "Pending clearance"}</Badge>}
                    <Button variant="secondary" size="sm" onClick={() => setReceiptPath(`/fees/receipts/${r.paymentId}`)}>View receipt</Button>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <ReceiptModal path={receiptPath} onClose={() => setReceiptPath(null)} />
      <TaxInvoiceModal path={taxInvoicePath} onClose={() => setTaxInvoicePath(null)} />
    </TeacherShell>
  );
}

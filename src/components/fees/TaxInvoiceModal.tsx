"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Modal } from "@/components/ui";
import { errorMessage, fmtDate, formatPaise, type TaxInvoice } from "@/lib/fee";

/**
 * The GST tax-invoice document for one invoice (LLD Phase 5). Only exists for
 * invoices issued while the institute was GST-registered — the caller only
 * offers it when `invoice.invoiceNo` is set.
 *
 * `path` is `/tenant/fees/invoices/:id/tax-invoice` (owner) or
 * `/fees/invoices/:id/tax-invoice` (student). null = closed.
 */
export function TaxInvoiceModal({ path, tenant, onClose }: { path: string | null; tenant?: string; onClose: () => void }) {
  const [doc, setDoc] = useState<TaxInvoice | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    api.get<TaxInvoice>(path, { tenant })
      .then((d) => { if (!cancelled) setDoc(d); })
      .catch((err) => { if (!cancelled) setError(errorMessage(err, "Could not load the tax invoice")); });
    return () => { cancelled = true; setDoc(null); setError(""); };
  }, [path, tenant]);

  const intra = doc?.supplyType === "intra_state";

  return (
    <Modal open={path !== null} onClose={onClose} title="Tax invoice" width={760}>
      {error ? (
        <p style={{ margin: 0, color: "var(--danger)", fontSize: 13 }}>{error}</p>
      ) : !doc ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading…</div>
      ) : (
        <div style={{ fontSize: 13, color: "var(--text-body)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-heading)" }}>{doc.supplier.name}</div>
              {doc.supplier.gstin && <div>GSTIN {doc.supplier.gstin}</div>}
              <div>Place of supply: {doc.placeOfSupplyCode ?? "—"} · {intra ? "Intra-state" : "Inter-state"}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-heading)" }}>Tax invoice {doc.invoiceNo}</div>
              <div>Issued {fmtDate(doc.issueDate)} · due {fmtDate(doc.dueDate)}</div>
              <div>{doc.label}</div>
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            Billed to <strong style={{ color: "var(--text-heading)" }}>{doc.recipient.name}</strong>
            {doc.recipient.email ? ` · ${doc.recipient.email}` : ""}
          </div>
          <div className="gv-table-wrap">
            <table className="gv-table">
              <thead>
                <tr>
                  <th>Description</th><th>SAC</th><th style={{ textAlign: "right" }}>Taxable</th><th style={{ textAlign: "right" }}>Rate</th>
                  {intra ? <><th style={{ textAlign: "right" }}>CGST</th><th style={{ textAlign: "right" }}>SGST</th></> : <th style={{ textAlign: "right" }}>IGST</th>}
                  <th style={{ textAlign: "right" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {doc.lines.map((l, i) => (
                  <tr key={i}>
                    <td>
                      {l.description}
                      {l.concessionAmount > 0 && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{formatPaise(l.grossAmount)} less {formatPaise(l.concessionAmount)} concession</div>}
                    </td>
                    <td>{l.sacCode ?? "—"}</td>
                    <td style={{ textAlign: "right" }}>{formatPaise(l.taxableAmount)}</td>
                    <td style={{ textAlign: "right" }}>{l.taxRatePct}%</td>
                    {intra ? <><td style={{ textAlign: "right" }}>{formatPaise(l.cgst)}</td><td style={{ textAlign: "right" }}>{formatPaise(l.sgst)}</td></> : <td style={{ textAlign: "right" }}>{formatPaise(l.igst)}</td>}
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{formatPaise(l.totalAmount)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={2} style={{ fontWeight: 700 }}>Total</td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>{formatPaise(doc.totals.taxableAmount)}</td>
                  <td />
                  {intra ? <><td style={{ textAlign: "right", fontWeight: 700 }}>{formatPaise(doc.totals.cgst)}</td><td style={{ textAlign: "right", fontWeight: 700 }}>{formatPaise(doc.totals.sgst)}</td></> : <td style={{ textAlign: "right", fontWeight: 700 }}>{formatPaise(doc.totals.igst)}</td>}
                  <td style={{ textAlign: "right", fontWeight: 700 }}>{formatPaise(doc.totals.totalAmount)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}

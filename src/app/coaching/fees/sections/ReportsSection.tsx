"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Batch } from "../../dashboard/types";
import { Badge, Button, DataTable, Icon, Input, Select, StatCard } from "@/components/ui";
import type { Column } from "@/components/ui";
import { useUrlState } from "@/lib/useUrlState";
import {
  PAYMENT_MODE_LABEL,
  currentAcademicYear, errorMessage, fmtDate, fmtDateTime, formatPaise, paymentBadge, todayIST,
  type Daybook, type DaybookRow, type DefaulterRow, type DefaultersReport, type FeePaymentMode,
  type FeeSettings, type HeadWiseReport, type HeadWiseRow,
} from "@/lib/fee";

type Props = { tenantSlug: string };

const REPORT_KEYS = ["daybook", "defaulters", "head-wise"] as const;
type ReportKey = (typeof REPORT_KEYS)[number];
const REPORT_LABEL: Record<ReportKey, string> = { daybook: "Daybook", defaulters: "Defaulters", "head-wise": "Head-wise collection" };

export function ReportsSection({ tenantSlug }: Props) {
  const [report, setReport] = useUrlState<ReportKey>("report", REPORT_KEYS, "daybook");
  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
        {REPORT_KEYS.map((k) => (
          <Button key={k} size="sm" variant={report === k ? "app" : "secondary"} onClick={() => setReport(k)}>{REPORT_LABEL[k]}</Button>
        ))}
      </div>
      {report === "daybook" ? <DaybookReport tenantSlug={tenantSlug} />
        : report === "defaulters" ? <DefaultersReportView tenantSlug={tenantSlug} />
        : <HeadWiseReportView tenantSlug={tenantSlug} />}
    </div>
  );
}

const Loading = ({ what }: { what: string }) => (
  <div className="gv-card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading {what}…</div>
);
const ErrorLine = ({ text }: { text: string }) => <p style={{ color: "var(--danger)", fontSize: 13, margin: "0 0 16px" }}>{text}</p>;

// ── Daybook ─────────────────────────────────────────────────────────────────

/** The front desk's cash closing for one day (LLD §8 reports/daybook). */
function DaybookReport({ tenantSlug }: Props) {
  const [date, setDate] = useState(todayIST);
  const [data, setData] = useState<Daybook | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api.get<Daybook>(`/tenant/fees/reports/daybook?date=${date}`, { tenant: tenantSlug })
      .then((d) => { if (!cancelled) { setData(d); setError(""); } })
      .catch((err) => { if (!cancelled) setError(errorMessage(err, "Failed to load the daybook")); });
    return () => { cancelled = true; };
  }, [tenantSlug, date]);

  const columns: Column<DaybookRow>[] = [
    { key: "receipt", label: "Receipt", width: "18%", render: (r) => <span style={{ fontSize: 13, fontFamily: "var(--font-mono)", fontWeight: 600 }}>{r.receiptNo}</span> },
    { key: "time", label: "Time", width: "16%", render: (r) => <span style={{ fontSize: 12.5 }}>{fmtDateTime(r.receivedAt).split(", ").pop()}</span> },
    { key: "student", label: "Student", width: "24%", render: (r) => <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-heading)" }}>{r.studentName}</span> },
    { key: "mode", label: "Mode", width: "16%", render: (r) => <span style={{ fontSize: 13 }}>{PAYMENT_MODE_LABEL[r.mode]}{r.reference ? ` · ${r.reference}` : ""}</span> },
    { key: "amount", label: "Amount", width: "12%", render: (r) => <span style={{ fontSize: 13.5, fontWeight: 700 }}>{formatPaise(r.amount)}</span> },
    { key: "status", label: "Status", width: "14%", render: (r) => { const b = paymentBadge(r); return <Badge tone={b.tone}>{b.label}</Badge>; } },
  ];

  const modes = data ? (Object.entries(data.totalsByMode) as [FeePaymentMode, number][]) : [];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 16 }}>
        <Input label="Day" type="date" max={todayIST()} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} wrapperStyle={{ width: 180 }} />
        {date !== todayIST() && <Button variant="ghost" size="sm" onClick={() => setDate(todayIST())} style={{ marginBottom: 4 }}>Today</Button>}
      </div>
      {error && <ErrorLine text={error} />}
      {!data ? (!error && <Loading what="the daybook" />) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 20 }}>
            <StatCard label="Collected" value={formatPaise(data.totalCollected)} sub={`${data.collections.length} receipt${data.collections.length === 1 ? "" : "s"} on ${fmtDate(data.date)}`} />
            {modes.map(([m, amt]) => <StatCard key={m} label={PAYMENT_MODE_LABEL[m]} value={formatPaise(amt)} />)}
            {data.pendingClearance > 0 && <StatCard label="Pending clearance" value={formatPaise(data.pendingClearance)} sub="Cheques / DDs not yet cleared — included above" />}
          </div>
          {data.collections.length === 0 ? (
            <div className="gv-card" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13.5, marginBottom: 20 }}>No money received on this day.</div>
          ) : (
            <DataTable columns={columns} rows={data.collections} fixed style={{ marginBottom: 20 }} />
          )}
          {(data.reversals.length > 0 || data.bounces.length > 0) && (
            <div className="gv-card" style={{ padding: 18 }}>
              <h4 style={{ margin: "0 0 10px", fontSize: 14, color: "var(--text-heading)" }}>Corrections made this day</h4>
              {[...data.reversals.map((r) => ({ r, kind: "Reversed", why: r.reversalReason })), ...data.bounces.map((r) => ({ r, kind: "Bounced", why: r.bounceReason }))].map(({ r, kind, why }) => (
                <div key={`${kind}-${r.id}`} style={{ fontSize: 13, color: "var(--text-body)", padding: "6px 0", borderTop: "1px solid var(--border-light)" }}>
                  <strong>{kind}</strong> · {r.receiptNo} · {r.studentName} · {formatPaise(r.amount)}{why ? ` — ${why}` : ""}
                  {fmtDate(r.receivedAt) !== fmtDate(data.date) && <span style={{ color: "var(--text-muted)" }}> (received {fmtDate(r.receivedAt)})</span>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Defaulters ──────────────────────────────────────────────────────────────

function DefaultersReportView({ tenantSlug }: Props) {
  const router = useRouter();
  const [asOf, setAsOf] = useState(todayIST);
  const [batchId, setBatchId] = useState("");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [data, setData] = useState<DefaultersReport | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const url = useCallback((cursor?: string | null) => {
    const q = new URLSearchParams({ asOf, limit: "50" });
    if (batchId) q.set("classId", batchId);
    if (cursor) q.set("cursor", cursor);
    return `/tenant/fees/reports/defaulters?${q}`;
  }, [asOf, batchId]);

  useEffect(() => {
    let cancelled = false;
    api.get<{ classes: Batch[] }>("/tenant/classes", { tenant: tenantSlug })
      .then((d) => { if (!cancelled) setBatches(d.classes); })
      .catch(() => { /* the batch filter is optional; the report still works */ });
    return () => { cancelled = true; };
  }, [tenantSlug]);

  useEffect(() => {
    let cancelled = false;
    api.get<DefaultersReport>(url(), { tenant: tenantSlug })
      .then((d) => { if (!cancelled) { setData(d); setError(""); } })
      .catch((err) => { if (!cancelled) setError(errorMessage(err, "Failed to load defaulters")); });
    return () => { cancelled = true; };
  }, [tenantSlug, url]);

  async function loadMore() {
    if (!data?.nextCursor) return;
    setLoadingMore(true);
    try {
      const d = await api.get<DefaultersReport>(url(data.nextCursor), { tenant: tenantSlug });
      setData((prev) => (prev ? { ...d, items: [...prev.items, ...d.items] } : d));
    } catch (err) {
      setError(errorMessage(err, "Failed to load more"));
    } finally {
      setLoadingMore(false);
    }
  }

  const columns: Column<DefaulterRow>[] = [
    {
      key: "student", label: "Student", width: "26%",
      render: (r) => (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-heading)" }}>{r.name}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{r.invoiceCount} overdue installment{r.invoiceCount === 1 ? "" : "s"}</div>
        </div>
      ),
    },
    { key: "amount", label: "Overdue", width: "15%", render: (r) => <span style={{ fontSize: 14, fontWeight: 700, color: "var(--danger)" }}>{formatPaise(r.overdueAmount)}</span> },
    {
      key: "since", label: "Oldest due", width: "17%",
      render: (r) => (
        <div>
          <div style={{ fontSize: 13 }}>{fmtDate(r.oldestDueDate)}</div>
          <div style={{ fontSize: 12, color: r.daysOverdue > 30 ? "var(--danger)" : "var(--text-muted)" }}>{r.daysOverdue} day{r.daysOverdue === 1 ? "" : "s"} late</div>
        </div>
      ),
    },
    {
      key: "contact", label: "Contact", width: "36%",
      render: (r) => (
        <div style={{ fontSize: 12.5, color: "var(--text-body)", lineHeight: 1.45 }}>
          {r.guardian
            ? <div>{r.guardian.relation}: {r.guardian.name}{r.guardian.phone ? ` · ${r.guardian.phone}` : ""}</div>
            : <div style={{ color: "var(--text-muted)" }}>No guardian on file</div>}
          {(r.phone || r.email) && <div style={{ color: "var(--text-muted)" }}>Student: {r.phone ?? r.email}</div>}
        </div>
      ),
    },
    { key: "act", label: "", width: "6%", render: () => <div style={{ display: "flex", justifyContent: "flex-end" }} aria-hidden="true"><Icon name="arrow-right" size={16} className="gv-row-chevron" /></div> },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <Input label="As of" type="date" value={asOf} onChange={(e) => e.target.value && setAsOf(e.target.value)} wrapperStyle={{ width: 180 }} />
        <Select label="Batch" options={[{ value: "", label: "All batches" }, ...batches.map((c) => ({ value: c.id, label: c.name }))]}
          value={batchId} onChange={(e) => setBatchId(e.target.value)} wrapperStyle={{ minWidth: 200 }} />
      </div>
      {error && <ErrorLine text={error} />}
      {!data ? (!error && <Loading what="defaulters" />) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 20 }}>
            <StatCard label="Students overdue" value={String(data.totalStudents)} />
            <StatCard label="Total overdue" value={formatPaise(data.totalOverdue)} sub={`as of ${fmtDate(data.asOf)}`} />
          </div>
          <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
            Built from what has been recorded. A student who paid at the desk but whose payment wasn&rsquo;t entered shows up here — check before chasing.
          </p>
          {data.items.length === 0 ? (
            <div className="gv-card" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13.5 }}>Nobody is overdue. 🎉</div>
          ) : (
            <>
              <DataTable columns={columns} rows={data.items.map((r) => ({ ...r, id: r.studentId }))} fixed
                onRowClick={(r) => router.push(`/coaching/fees/students/${r.studentId}?name=${encodeURIComponent(r.name)}&from=defaulters`)} />
              {data.nextCursor && (
                <div style={{ textAlign: "center", marginTop: 14 }}>
                  <Button variant="secondary" size="sm" onClick={loadMore} disabled={loadingMore}>{loadingMore ? "Loading…" : "Load more"}</Button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── Head-wise collection ────────────────────────────────────────────────────

function HeadWiseReportView({ tenantSlug }: Props) {
  const [academicYear, setAcademicYear] = useState("");
  const [draftYear, setDraftYear] = useState("");
  const [data, setData] = useState<HeadWiseReport | null>(null);
  const [error, setError] = useState("");

  // The default year depends on the institute's financial-year start month.
  useEffect(() => {
    let cancelled = false;
    api.get<{ settings: FeeSettings }>("/tenant/fees/settings", { tenant: tenantSlug })
      .then(({ settings }) => { if (!cancelled) { const y = currentAcademicYear(settings.financialYearStartMonth); setAcademicYear(y); setDraftYear(y); } })
      .catch(() => { if (!cancelled) { const y = currentAcademicYear(); setAcademicYear(y); setDraftYear(y); } });
    return () => { cancelled = true; };
  }, [tenantSlug]);

  useEffect(() => {
    if (!academicYear) return;
    let cancelled = false;
    api.get<HeadWiseReport>(`/tenant/fees/reports/head-wise?academicYear=${encodeURIComponent(academicYear)}`, { tenant: tenantSlug })
      .then((d) => { if (!cancelled) { setData(d); setError(""); } })
      .catch((err) => { if (!cancelled) setError(errorMessage(err, "Failed to load head-wise collection")); });
    return () => { cancelled = true; };
  }, [tenantSlug, academicYear]);

  const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

  const columns: Column<HeadWiseRow>[] = [
    {
      key: "head", label: "Fee head", width: "24%",
      render: (h) => (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-heading)" }}>{h.name}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{h.code}</div>
        </div>
      ),
    },
    {
      key: "billed", label: "Billed", width: "15%",
      render: (h) => (
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{formatPaise(h.billed)}</div>
          {h.concessionAmount > 0 && <div style={{ fontSize: 11.5, color: "var(--accent)" }}>after {formatPaise(h.concessionAmount)} concession</div>}
        </div>
      ),
    },
    { key: "collected", label: "Collected", width: "14%", render: (h) => <span style={{ fontSize: 13, color: "var(--success)", fontWeight: 600 }}>{formatPaise(h.collected)}</span> },
    { key: "waived", label: "Waived", width: "12%", render: (h) => <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{h.waived > 0 ? formatPaise(h.waived) : "—"}</span> },
    { key: "outstanding", label: "Outstanding", width: "14%", render: (h) => <span style={{ fontSize: 13, fontWeight: 700 }}>{formatPaise(h.outstanding)}</span> },
    {
      key: "rate", label: "Collected %", width: "21%",
      render: (h) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, height: 6, borderRadius: 999, background: "var(--border-default)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct(h.collected, h.billed)}%`, background: "var(--success)" }} />
          </div>
          <span style={{ fontSize: 12.5, width: 36, textAlign: "right" }}>{pct(h.collected, h.billed)}%</span>
        </div>
      ),
    },
  ];

  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); if (/^\d{4}(-\d{2})?$/.test(draftYear)) setAcademicYear(draftYear); }}
        style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 16 }}>
        <Input label="Academic year" placeholder="2026-27" pattern="\d{4}(-\d{2})?" value={draftYear}
          onChange={(e) => setDraftYear(e.target.value)} wrapperStyle={{ width: 160 }} />
        <Button type="submit" variant="secondary" size="sm" style={{ marginBottom: 4 }} disabled={draftYear === academicYear}>Show</Button>
      </form>
      {error && <ErrorLine text={error} />}
      {!data ? (!error && <Loading what="collection by head" />) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 20 }}>
            <StatCard label="Billed" value={formatPaise(data.totals.billed)} sub={data.totals.taxAmount > 0 ? `incl. ${formatPaise(data.totals.taxAmount)} GST` : undefined} />
            <StatCard label="Collected" value={formatPaise(data.totals.collected)} sub={`${pct(data.totals.collected, data.totals.billed)}% of billed`} />
            <StatCard label="Waived" value={formatPaise(data.totals.waived)} />
            <StatCard label="Outstanding" value={formatPaise(data.totals.outstanding)} />
          </div>
          {data.heads.length === 0 ? (
            <div className="gv-card" style={{ padding: 32, textAlign: "center", color: "var(--text-muted)", fontSize: 13.5 }}>Nothing billed in {data.academicYear}.</div>
          ) : (
            <>
              <DataTable columns={columns} rows={data.heads.map((h) => ({ ...h, id: h.headId }))} fixed />
              <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                Payments are recorded per installment, so each head&rsquo;s collection is its pro-rata share of what was paid on the installments it appears in.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}

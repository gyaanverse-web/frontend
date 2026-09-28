"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button, Card, Input, Select, Switch } from "@/components/ui";
import { errorMessage, paiseToRupees, type FeeSettings, type GstMode } from "@/lib/fee";

type Props = { tenantSlug: string };

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type Form = {
  gstMode: GstMode;
  gstin: string;
  placeOfSupplyCode: string;
  receiptPrefix: string;
  financialYearStartMonth: number;
  // Money fields hold RUPEES as typed — the API takes rupees and stores paise.
  bounceCharge: string;
  lateEnabled: boolean;
  lateGraceDays: string;
  lateMode: "percent" | "amount";
  lateValue: string;
  lateCap: string;
  remindEnabled: boolean;
  remindOffsets: string;
  remindEmail: boolean;
  remindSms: boolean;
};

function toForm(s: FeeSettings): Form {
  const late = s.lateFeePolicy;
  const remind = s.reminderPolicy;
  return {
    gstMode: s.gstMode,
    gstin: s.gstin ?? "",
    placeOfSupplyCode: s.placeOfSupplyCode ?? "",
    receiptPrefix: s.receiptPrefix,
    financialYearStartMonth: s.financialYearStartMonth,
    bounceCharge: s.bounceChargeAmount ? String(paiseToRupees(s.bounceChargeAmount)) : "",
    lateEnabled: late.enabled,
    lateGraceDays: String(late.graceDays),
    lateMode: late.mode,
    // Stored as paise in amount mode, a plain percentage otherwise.
    lateValue: late.value ? String(late.mode === "amount" ? paiseToRupees(late.value) : late.value) : "",
    lateCap: late.capAmount != null ? String(paiseToRupees(late.capAmount)) : "",
    remindEnabled: remind.enabled,
    remindOffsets: remind.offsetsDays.join(", "),
    remindEmail: remind.channels.includes("email"),
    remindSms: remind.channels.includes("sms"),
  };
}

/** "-7, -1, 0, 3, 7" → [-7, -1, 0, 3, 7], or null if any part isn't a whole number. */
function parseOffsets(text: string): number[] | null {
  const parts = text.split(/[,\s]+/).map((p) => p.replace("−", "-")).filter(Boolean);
  if (parts.length === 0) return null;
  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isInteger(n))) return null;
  return [...new Set(nums)].sort((a, b) => a - b);
}

export function SettingsSection({ tenantSlug }: Props) {
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get<{ settings: FeeSettings }>("/tenant/fees/settings", { tenant: tenantSlug })
      .then(({ settings }) => { if (!cancelled) setForm(toForm(settings)); })
      .catch((err) => { if (!cancelled) setError(errorMessage(err, "Failed to load fee settings")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tenantSlug]);

  const set = (patch: Partial<Form>) => { setForm((f) => (f ? { ...f, ...patch } : f)); setSaved(false); };

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const offsets = parseOffsets(form.remindOffsets);
    if (form.remindEnabled && !offsets) { setSaveError("Reminder days must be whole numbers separated by commas, e.g. -7, -1, 0, 3, 7"); return; }
    setSaving(true); setSaveError(""); setSaved(false);
    try {
      const body = {
        gstMode: form.gstMode,
        gstin: form.gstMode === "registered" ? (form.gstin || null) : null,
        placeOfSupplyCode: form.gstMode === "registered" ? (form.placeOfSupplyCode || null) : null,
        receiptPrefix: form.receiptPrefix,
        financialYearStartMonth: form.financialYearStartMonth,
        bounceCharge: Number(form.bounceCharge) || 0,
        lateFeePolicy: {
          enabled: form.lateEnabled,
          graceDays: Number(form.lateGraceDays) || 0,
          mode: form.lateMode,
          value: Number(form.lateValue) || 0,
          capAmount: Number(form.lateCap) > 0 ? Number(form.lateCap) : null,
        },
        reminderPolicy: {
          enabled: form.remindEnabled,
          offsetsDays: offsets ?? [-7, -1, 0, 3, 7],
          channels: [...(form.remindEmail ? ["email"] : []), ...(form.remindSms ? ["sms"] : [])],
        },
      };
      const { settings } = await api.put<{ settings: FeeSettings }>("/tenant/fees/settings", body, { tenant: tenantSlug });
      setForm(toForm(settings));
      setSaved(true);
    } catch (err) {
      setSaveError(errorMessage(err, "Failed to save settings"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="gv-card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading settings…</div>;
  if (error) return <p style={{ color: "var(--danger)", fontSize: 13 }}>{error}</p>;
  if (!form) return null;

  const sectionHead = (title: string, sub: string) => (
    <div style={{ marginBottom: 14 }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--text-heading)" }}>{title}</h3>
      <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>{sub}</p>
    </div>
  );

  return (
    <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 620 }}>
      <Card>
        {sectionHead("Receipts & tax", "Tax posture, receipt numbering and the financial-year start for this institute.")}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Select
            label="GST mode"
            options={[{ value: "none", label: "Not registered" }, { value: "registered", label: "Registered" }]}
            value={form.gstMode}
            onChange={(e) => set({ gstMode: e.target.value as GstMode })}
          />
          {form.gstMode === "registered" && (
            <>
              <Input label="GSTIN" required maxLength={15} minLength={15}
                value={form.gstin} onChange={(e) => set({ gstin: e.target.value.toUpperCase() })} />
              <Input label="Place of supply code" maxLength={2} minLength={2} pattern="\d{2}"
                placeholder="e.g. 27"
                value={form.placeOfSupplyCode} onChange={(e) => set({ placeOfSupplyCode: e.target.value })}
                help="Two-digit state code. When it matches your GSTIN's state, invoices split CGST + SGST; otherwise IGST." />
            </>
          )}
          <Input label="Receipt prefix" required minLength={1} maxLength={12} pattern="[A-Za-z0-9\-]+"
            value={form.receiptPrefix} onChange={(e) => set({ receiptPrefix: e.target.value.toUpperCase() })}
            help='Letters, digits and hyphens. Receipts read like "SHARMA/2026-27/00001". A new prefix applies from the next financial year.' />
          <Select
            label="Financial year starts"
            options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
            value={String(form.financialYearStartMonth)}
            onChange={(e) => set({ financialYearStartMonth: Number(e.target.value) })}
          />
        </div>
      </Card>

      <Card>
        {sectionHead("Cheque bounce charge", "Levied once, automatically, when you mark a cheque or DD bounced. Leave empty for none.")}
        <Input label="Bounce charge (₹)" type="number" min={0} step="0.01" placeholder="0"
          value={form.bounceCharge} onChange={(e) => set({ bounceCharge: e.target.value })} wrapperStyle={{ maxWidth: 220 }} />
      </Card>

      <Card>
        {sectionHead("Late fee", "Charged automatically by the daily run, once per overdue installment, after the grace period.")}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Switch label="Charge late fees automatically" checked={form.lateEnabled} onChange={(e) => set({ lateEnabled: e.target.checked })} />
          {form.lateEnabled && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Select label="Charge as"
                  options={[{ value: "amount", label: "Flat amount (₹)" }, { value: "percent", label: "% of the overdue balance" }]}
                  value={form.lateMode} onChange={(e) => set({ lateMode: e.target.value as Form["lateMode"] })} />
                <Input label={form.lateMode === "percent" ? "Rate (%)" : "Amount (₹)"} type="number" min={0} max={form.lateMode === "percent" ? 100 : undefined} step="0.01" required
                  value={form.lateValue} onChange={(e) => set({ lateValue: e.target.value })} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Input label="Grace days" type="number" min={0} max={365} step={1} required
                  value={form.lateGraceDays} onChange={(e) => set({ lateGraceDays: e.target.value })}
                  help="Days after the due date before it's charged." />
                <Input label="Cap (₹, optional)" type="number" min={0} step="0.01"
                  value={form.lateCap} onChange={(e) => set({ lateCap: e.target.value })}
                  help="Upper limit on one late fee." />
              </div>
            </>
          )}
        </div>
      </Card>

      <Card>
        {sectionHead("Reminders", "Sent by the daily run to the student and the primary guardian. Students always get their usual notification channels; the channels below apply to the guardian.")}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Switch label="Send fee reminders" checked={form.remindEnabled} onChange={(e) => set({ remindEnabled: e.target.checked })} />
          {form.remindEnabled && (
            <>
              <Input label="Send on these days" value={form.remindOffsets} onChange={(e) => set({ remindOffsets: e.target.value })}
                help="Relative to the due date: -7 is a week before, 0 is the day itself, 3 is three days overdue." />
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                <Switch label="Guardian email" checked={form.remindEmail} onChange={(e) => set({ remindEmail: e.target.checked })} />
                <Switch label="Guardian SMS" checked={form.remindSms} onChange={(e) => set({ remindSms: e.target.checked })} />
              </div>
            </>
          )}
        </div>
      </Card>

      {saveError && <p style={{ margin: 0, color: "var(--danger)", fontSize: 13 }}>{saveError}</p>}
      {saved && <p style={{ margin: 0, color: "var(--success)", fontSize: 13 }}>Saved.</p>}
      <div>
        <Button type="submit" variant="app" disabled={saving}>{saving ? "Saving…" : "Save settings"}</Button>
      </div>
    </form>
  );
}

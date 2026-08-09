"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { PLANS, PLAN_ORDER, fmtLimit } from "../types";
import type { PlanName, Tenant } from "../types";
import { sh, cell, lc, btnP, btnS } from "../styles";

/** `onTenantChange` signals that the coaching changed server-side; the owner of
 *  the tenant state re-fetches it. */
type Props = { tenant: Tenant; onTenantChange: () => void };

export function PlanSection({ tenant, onTenantChange }: Props) {

  const [upgrading, setUpgrading]   = useState<PlanName | null>(null);
  const [confirmPlan, setConfirmPlan] = useState<PlanName | null>(null);
  const [msg, setMsg]               = useState("");
  const [err, setErr]               = useState("");

  async function handleChangePlan(plan: PlanName) {
    setErr(""); setMsg(""); setUpgrading(plan); setConfirmPlan(null);
    try {
      await api.patch<{ tenant: Tenant }>(`/tenants/${tenant.id}/plan`, { plan });
      onTenantChange();
      setMsg(`Switched to ${PLANS[plan].label}.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to change plan");
    } finally {
      setUpgrading(null);
    }
  }

  const cur    = PLANS[tenant.plan as PlanName] ?? PLANS.free;
  const curIdx = PLAN_ORDER.indexOf(tenant.plan as PlanName);

  return (
    <div style={{ background: "var(--surface-card)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-sm)", marginBottom: "16px", overflow: "hidden" }}>
      <div style={sh}>
        <span>Plan &amp; Billing</span>
      </div>

        <div style={{ padding: "12px" }}>
          {/* Current plan summary */}
          <div style={{ marginBottom: "10px", display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontWeight: "bold", fontSize: "13px" }}>Current plan:</span>
            <span style={{ background: "var(--blue-700)", color: "#fff", padding: "3px 12px", fontWeight: "bold", fontSize: "12px", borderRadius: "var(--radius-pill)" }}>{cur.label}</span>
            <span style={{ fontSize: "13px", color: "var(--text-body)" }}>{cur.price === 0 ? "Free" : `₹${cur.price.toLocaleString("en-IN")}/month`}</span>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "14px" }}>
            <tbody>
              <tr>
                <td style={lc}>Limits</td>
                <td style={{ ...cell, fontSize: "12px" }}>
                  Students: <strong>{fmtLimit(cur.limits.students)}</strong>
                  &ensp;Teachers: <strong>{fmtLimit(cur.limits.teachers)}</strong>
                  &ensp;Classes: <strong>{fmtLimit(cur.limits.classes)}</strong>
                  &ensp;Mocks/month: <strong>{fmtLimit(cur.limits.mocks_per_month)}</strong>
                  &ensp;AI Evals/month: <strong>{fmtLimit(cur.limits.ai_evaluations)}</strong>
                </td>
              </tr>
              <tr>
                <td style={lc}>Features</td>
                <td style={{ ...cell, fontSize: "12px" }}>
                  {([ ["Analytics", cur.features.analytics], ["Public Mocks", cur.features.public_mocks], ["Custom Branding", cur.features.custom_branding], ["API Access", cur.features.api_access] ] as [string, boolean][]).map(([label, on]) => (
                    <span key={label} style={{ marginRight: "14px" }}>
                      <span style={{ color: on ? "var(--success)" : "#999" }}>{on ? "✓" : "✗"}</span>{" "}{label}
                    </span>
                  ))}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Plan comparison table */}
          <div style={{ fontSize: "12px", fontWeight: "bold", color: "var(--text-muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.4px" }}>
            Available Plans
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ background: "var(--bg-section-alt)" }}>
                <th style={{ ...cell, textAlign: "left",   fontWeight: "bold" }}>Plan</th>
                <th style={{ ...cell, textAlign: "right",  fontWeight: "bold" }}>Price</th>
                <th style={{ ...cell, textAlign: "right",  fontWeight: "bold" }}>Students</th>
                <th style={{ ...cell, textAlign: "right",  fontWeight: "bold" }}>Teachers</th>
                <th style={{ ...cell, textAlign: "right",  fontWeight: "bold" }}>Mocks/mo</th>
                <th style={{ ...cell, textAlign: "right",  fontWeight: "bold" }}>AI Evals</th>
                <th style={{ ...cell, textAlign: "center", fontWeight: "bold" }}>Features</th>
                <th style={{ ...cell, textAlign: "center", fontWeight: "bold", width: "90px" }}></th>
              </tr>
            </thead>
            <tbody>
              {PLAN_ORDER.map((pname, idx) => {
                const p         = PLANS[pname];
                const isCurrent = tenant.plan === pname;
                const isUpgrade = idx > curIdx;
                const featureIcons = [
                  p.features.analytics       && "Analytics",
                  p.features.public_mocks    && "Pub.Mocks",
                  p.features.custom_branding && "Branding",
                  p.features.api_access      && "API",
                ].filter(Boolean).join(", ") || "—";
                return (
                  <tr key={pname} style={{ background: isCurrent ? "var(--accent-soft)" : "transparent" }}>
                    <td style={{ ...cell, fontWeight: isCurrent ? "bold" : "normal" }}>{p.label}</td>
                    <td style={{ ...cell, textAlign: "right" }}>{p.price === 0 ? "Free" : `₹${p.price.toLocaleString("en-IN")}/mo`}</td>
                    <td style={{ ...cell, textAlign: "right" }}>{fmtLimit(p.limits.students)}</td>
                    <td style={{ ...cell, textAlign: "right" }}>{fmtLimit(p.limits.teachers)}</td>
                    <td style={{ ...cell, textAlign: "right" }}>{fmtLimit(p.limits.mocks_per_month)}</td>
                    <td style={{ ...cell, textAlign: "right" }}>{fmtLimit(p.limits.ai_evaluations)}</td>
                    <td style={{ ...cell, textAlign: "center", color: "var(--text-muted)" }}>{featureIcons}</td>
                    <td style={{ ...cell, textAlign: "center" }}>
                      {isCurrent ? (
                        <span style={{ fontSize: "11px", color: "var(--blue-700)", fontWeight: "bold" }}>Current</span>
                      ) : (
                        <button
                          onClick={() => setConfirmPlan(confirmPlan === pname ? null : pname)}
                          disabled={upgrading !== null}
                          style={{ ...btnP, background: isUpgrade ? "var(--blue-700)" : "var(--text-muted)", borderColor: isUpgrade ? "var(--blue-700)" : "var(--text-muted)", opacity: upgrading !== null ? 0.6 : 1, padding: "2px 10px", fontSize: "11px" }}
                        >
                          {upgrading === pname ? "…" : confirmPlan === pname ? "Cancel" : isUpgrade ? "Upgrade" : "Downgrade"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Confirm banner */}
          {confirmPlan && (
            <div style={{ marginTop: "8px", background: "var(--warning-soft)", border: "1px solid var(--warning)", borderRadius: "var(--radius-md)", padding: "8px 12px", display: "flex", alignItems: "center", gap: "10px", fontSize: "13px" }}>
              <span>Switch to <strong>{PLANS[confirmPlan].label}</strong>{PLANS[confirmPlan].price > 0 ? ` — ₹${PLANS[confirmPlan].price.toLocaleString("en-IN")}/mo` : " (Free)"}?</span>
              <button onClick={() => handleChangePlan(confirmPlan)} disabled={upgrading !== null} style={{ ...btnP, padding: "3px 12px", opacity: upgrading !== null ? 0.6 : 1 }}>Confirm</button>
              <button onClick={() => setConfirmPlan(null)} style={{ ...btnS, padding: "3px 10px" }}>Cancel</button>
            </div>
          )}

          {err && <p style={{ margin: "6px 0 0", fontSize: "13px", color: "var(--danger)" }}>{err}</p>}
          {msg && <p style={{ margin: "6px 0 0", fontSize: "13px", color: "var(--success)" }}>{msg}</p>}
          <p style={{ margin: "10px 0 0", fontSize: "11px", color: "var(--text-muted)", borderLeft: "3px solid var(--border-default)", paddingLeft: "8px" }}>
            Payment not yet integrated — changes take effect immediately for testing.
          </p>
        </div>
    </div>
  );
}
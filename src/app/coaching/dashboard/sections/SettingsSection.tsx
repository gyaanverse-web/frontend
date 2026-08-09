"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { Tenant } from "../types";
import { sh, lc, inp, btnP } from "../styles";

type Props = { tenant: Tenant };

export function SettingsSection({ tenant }: Props) {

  const [settings, setSettings]     = useState({ allowPublicMocks: false, customDomain: "" });
  const [loading, setLoading]       = useState(false);
  const [msg, setMsg]               = useState("");
  const [err, setErr]               = useState("");

  async function handleSave() {
    setErr(""); setMsg(""); setLoading(true);
    try {
      const body: Record<string, unknown> = { allowPublicMocks: settings.allowPublicMocks };
      if (settings.customDomain) body.customDomain = settings.customDomain;
      await api.patch("/tenant/settings", body, { tenant: tenant.slug });
      setMsg("Settings saved.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save settings");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ background: "var(--surface-card)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-sm)", marginBottom: "16px", overflow: "hidden" }}>
      <div style={sh}>
        <span>Settings</span>
      </div>

        <div style={{ padding: "14px" }}>
          <p style={{ margin: "0 0 10px 0", fontSize: "12px", color: "var(--text-muted)", borderLeft: "3px solid var(--border-default)", paddingLeft: "8px" }}>
            Current values are not fetched — changes you save here take effect immediately.
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              <tr>
                <td style={{ ...lc, background: "transparent", width: "150px" }}>Public Mocks</td>
                <td style={{ padding: "6px 0" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                    <input type="checkbox" checked={settings.allowPublicMocks} onChange={e => setSettings({ ...settings, allowPublicMocks: e.target.checked })} />
                    Allow public mock exams (requires Starter plan or above)
                  </label>
                </td>
              </tr>
              <tr>
                <td style={{ ...lc, background: "transparent" }}>Custom Domain</td>
                <td style={{ padding: "6px 0" }}>
                  <input
                    value={settings.customDomain}
                    onChange={e => setSettings({ ...settings, customDomain: e.target.value })}
                    placeholder="yourdomain.com (Pro plan only)"
                    style={{ ...inp, width: "100%" }}
                  />
                </td>
              </tr>
            </tbody>
          </table>
          {err && <p style={{ margin: "6px 0", fontSize: "13px", color: "var(--danger)" }}>{err}</p>}
          {msg && <p style={{ margin: "6px 0", fontSize: "13px", color: "var(--success)" }}>{msg}</p>}
          <div style={{ marginTop: "10px" }}>
            <button onClick={handleSave} disabled={loading} style={{ ...btnP, opacity: loading ? 0.6 : 1 }}>
              {loading ? "Saving…" : "Save Settings"}
            </button>
          </div>
        </div>
    </div>
  );
}
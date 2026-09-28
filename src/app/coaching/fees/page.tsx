"use client";

import { Suspense, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useTenantSession } from "@/lib/useTenantSession";
import { useUrlState } from "@/lib/useUrlState";
import { TeacherShell } from "@/components/dashboard/TeacherShell";
import { Icon } from "@/components/ui";
import { isFeesDisabledError } from "@/lib/fee";
import { StructuresSection } from "./sections/StructuresSection";
import { AssignmentsSection } from "./sections/AssignmentsSection";
import { FeeHeadsSection } from "./sections/FeeHeadsSection";
import { SettingsSection } from "./sections/SettingsSection";
import { PaymentsSection } from "./sections/PaymentsSection";
import { ReportsSection } from "./sections/ReportsSection";

type Tenant = { id: string; slug: string; name: string };

const TAB_KEYS = ["payments", "reports", "assignments", "structures", "heads", "settings"] as const;
type TabKey = (typeof TAB_KEYS)[number];
const TAB_LABEL: Record<TabKey, string> = {
  payments: "Payments", reports: "Reports", assignments: "Assignments", structures: "Structures", heads: "Fee heads", settings: "Settings",
};

function FeesHubInner() {
  const { loading, user, tenant, role } = useTenantSession<Tenant>({ allow: ["coaching_owner"] });
  const [tab, setTab] = useUrlState<TabKey>("tab", TAB_KEYS, "payments");

  // One check for the whole hub rather than one per section: `fees_enabled` is
  // a platform kill-switch (ops panel, off by default) — while it's off every
  // /tenant/fees/* route 404s, and that reads much better as one empty state
  // than a red error banner in every section.
  const [feesEnabled, setFeesEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    if (!tenant) return;
    let cancelled = false;
    api.get("/tenant/fees/settings", { tenant: tenant.slug })
      .then(() => { if (!cancelled) setFeesEnabled(true); })
      .catch((err) => { if (!cancelled) setFeesEnabled(!isFeesDisabledError(err)); });
    return () => { cancelled = true; };
  }, [tenant]);

  if (loading || !user || !tenant) return <PageLoading />;

  return (
    <TeacherShell tenant={tenant} user={user} role={role} active="fees" eyebrow="Finance" title="Fees">
      {feesEnabled === false ? (
        <div className="gv-card" style={{ padding: 48, textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Icon name="wallet" size={26} style={{ color: "var(--accent)" }} />
          </div>
          <h3 style={{ margin: "0 0 8px", fontSize: 17, color: "var(--text-heading)" }}>Fees isn&rsquo;t enabled for this platform yet</h3>
          <p style={{ margin: "0 auto", maxWidth: 420, fontSize: 13.5, color: "var(--text-body)", lineHeight: 1.6 }}>
            Fee management is switched off from the ops panel (it defaults to off).
            Ask a platform operator to enable it, then reload this page.
          </p>
        </div>
      ) : (
        <>
          <div className="gv-tabs" role="tablist" style={{ marginBottom: 20 }}>
            {TAB_KEYS.map((k) => (
              <button key={k} role="tab" aria-selected={tab === k} className="gv-tab" onClick={() => setTab(k)}>
                {TAB_LABEL[k]}
              </button>
            ))}
          </div>

          {feesEnabled === null ? (
            <div className="gv-card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading…</div>
          ) : tab === "payments" ? (
            <PaymentsSection tenantSlug={tenant.slug} />
          ) : tab === "reports" ? (
            <ReportsSection tenantSlug={tenant.slug} />
          ) : tab === "structures" ? (
            <StructuresSection tenantSlug={tenant.slug} />
          ) : tab === "assignments" ? (
            <AssignmentsSection tenantSlug={tenant.slug} />
          ) : tab === "heads" ? (
            <FeeHeadsSection tenantSlug={tenant.slug} />
          ) : (
            <SettingsSection tenantSlug={tenant.slug} />
          )}
        </>
      )}
    </TeacherShell>
  );
}

export default function FeesHubPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <FeesHubInner />
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

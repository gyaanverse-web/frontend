"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo, Icon } from "@/components/ui";
import { roleLabel } from "@/lib/roleLabel";
import { buildTenantUrl, TENANT_ROOT_DOMAIN } from "@/lib/domain";
import { useMemberships } from "@/lib/useTenantSession";
import { landingPathForRole } from "@/components/dashboard/appNav";
import { postAuthRedirect } from "@/lib/tenantUrl";

const PAGE_BG =
  "radial-gradient(ellipse 70% 50% at 50% 0%, #eef0fc 0%, var(--paper-50) 60%)";

// Mirrors the shell in /login, /join, /accept-invite.
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: PAGE_BG, padding: "48px 24px" }}>
      <Link href="/" style={{ marginBottom: 32 }}>
        <Logo size={24} />
      </Link>
      <div
        style={{
          background: "#fff",
          border: "1px solid var(--border-light)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg)",
          padding: 40,
          width: "100%",
          maxWidth: 440,
        }}
      >
        {children}
      </div>
    </div>
  );
}

const ROLE_TINT: Record<string, string> = {
  coaching_owner: "var(--role-owner)",
  teacher: "var(--role-teacher)",
  student: "var(--role-student)",
};

/**
 * "Pick your hat" — shown after sign-in only to someone who belongs to more
 * than one coaching, reached exclusively through `postAuthRedirect`'s
 * `offerChooser` branch. Direct or stale visits (one membership, none, or an
 * unauthenticated session) fall back to the ordinary single-tenant redirect
 * instead of stranding the visitor on an empty list.
 */
export default function ChooseCoachingPage() {
  const router = useRouter();
  const { memberships, loading } = useMemberships();
  const hasChoice = memberships.length > 1;

  useEffect(() => {
    if (!loading && !hasChoice) void postAuthRedirect(router);
  }, [loading, hasChoice, router]);

  if (loading || !hasChoice) {
    return (
      <Shell>
        <p style={{ textAlign: "center", fontSize: 14, color: "var(--text-muted)", margin: 0 }}>
          Loading…
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h2 style={{ fontSize: 24, marginBottom: 6 }}>Choose a coaching.</h2>
      <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--text-muted)", marginBottom: 24 }}>
        You belong to more than one — pick one to continue.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {memberships.map((m) => (
          <button
            key={m.tenant.id}
            type="button"
            onClick={() => {
              window.location.href = buildTenantUrl(m.tenant.slug, landingPathForRole(m.membershipRole));
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              width: "100%",
              textAlign: "left",
              padding: "14px 16px",
              border: "1px solid var(--border-light)",
              borderRadius: "var(--radius-md)",
              background: "var(--paper-50)",
              cursor: "pointer",
              transition: "background 0.12s, border-color 0.12s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#fff";
              e.currentTarget.style.borderColor = "var(--accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "var(--paper-50)";
              e.currentTarget.style.borderColor = "var(--border-light)";
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 34,
                height: 34,
                borderRadius: "var(--radius-md)",
                background: "#fff",
                color: ROLE_TINT[m.membershipRole] ?? "var(--text-muted)",
                flexShrink: 0,
              }}
            >
              <Icon name="building" size={17} />
            </span>
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--text-heading)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {m.tenant.name}
              </span>
              <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--text-muted)" }}>
                {roleLabel(m.membershipRole)} · {m.tenant.slug}.{TENANT_ROOT_DOMAIN}
              </span>
            </div>
            <Icon name="arrow-right" size={16} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          </button>
        ))}
      </div>
    </Shell>
  );
}

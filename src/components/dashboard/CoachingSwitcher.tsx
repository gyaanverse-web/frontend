"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui";
import { roleLabel } from "@/lib/roleLabel";
import { buildTenantUrl, currentTenantSlug, TENANT_ROOT_DOMAIN } from "@/lib/domain";
import { useMemberships } from "@/lib/useTenantSession";
import { landingPathForRole } from "./appNav";

export interface CoachingSwitcherProps {
  /** The coaching this page is showing — the same value passed to `TeacherShell`. */
  tenant?: { name: string; slug: string } | null;
  /** Signed-in user belongs to no coaching yet — swaps in the "no institute" copy. */
  noCoaching?: boolean;
}

/**
 * Replaces the static "which coaching am I in" block in `TeacherShell`'s top
 * bar with a dropdown whenever the signed-in user belongs to more than one
 * coaching, or is a `coaching_owner` who can start another one. Renders
 * identically to the old static text otherwise, so a single-coaching
 * teacher/student sees no change.
 *
 * Switching coachings is a hard navigation (`buildTenantUrl` + a full page
 * load), not client-side routing — each coaching lives on its own subdomain,
 * same as every other cross-tenant hop in the app (`postAuthRedirect`,
 * `leaveForeignCoaching`). "Create another coaching" is a same-origin
 * client-side push instead, since `/create-coaching` isn't tenant-scoped.
 */
export function CoachingSwitcher({ tenant, noCoaching = false }: CoachingSwitcherProps) {
  const router = useRouter();
  const { memberships } = useMemberships();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const hasChoice = memberships.length > 1;
  // Only an existing owner is offered a second institute — a teacher/student
  // membership elsewhere shouldn't surface "create a coaching" as if it were
  // a normal switcher option. `POST /tenants` itself has no such gate (any
  // authenticated user may call it — see D-1, multi-tenancy audit F-9); this
  // only scopes what the menu *offers*.
  const canCreateAnother = memberships.some((m) => m.membershipRole === "coaching_owner");
  const canOpen = hasChoice || canCreateAnother;

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setCoords({ top: r.bottom + 6, left: r.left, width: Math.max(r.width, 240) });
  };

  useLayoutEffect(() => {
    if (open) place();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onScrollOrResize = () => setOpen(false);
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open]);

  const nameLine = noCoaching ? "Gyaanverse" : tenant?.name ?? "Loading…";
  const subLine = noCoaching
    ? "Not in a coaching yet"
    : tenant?.slug
      ? `${tenant.slug}.${TENANT_ROOT_DOMAIN}`
      : null;
  const activeSlug = tenant?.slug ?? currentTenantSlug();

  return (
    <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => canOpen && setOpen((v) => !v)}
        aria-haspopup={canOpen ? "menu" : undefined}
        aria-expanded={canOpen ? open : undefined}
        disabled={!canOpen}
        style={{
          display: "flex", alignItems: "center", gap: 6, border: "none", background: "none",
          padding: 0, cursor: canOpen ? "pointer" : "default", textAlign: "left",
        }}
      >
        <span style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 15, letterSpacing: "-0.01em", color: "var(--text-heading)" }}>
          {nameLine}
        </span>
        {canOpen && <Icon name="chevron-down" size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
      </button>
      {subLine && (
        <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--text-muted)" }}>
          {subLine}
        </span>
      )}

      {open && coords && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{
            position: "fixed", top: coords.top, left: coords.left, minWidth: coords.width, zIndex: 200,
            padding: 5, background: "var(--surface-card)", border: "1px solid var(--border-light)",
            borderRadius: 10, boxShadow: "0 12px 34px rgba(0,0,0,.18)", display: "flex", flexDirection: "column", gap: 1,
          }}
        >
          <div style={{ padding: "6px 10px 4px", fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)" }}>
            Your coachings
          </div>
          {memberships.map((m) => {
            const active = m.tenant.slug === activeSlug;
            return (
              <button
                key={m.tenant.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  if (m.tenant.slug === currentTenantSlug()) return;
                  window.location.href = buildTenantUrl(m.tenant.slug, landingPathForRole(m.membershipRole));
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left",
                  padding: "8px 10px", border: "none", borderRadius: 6,
                  background: active ? "var(--surface-inset)" : "none", cursor: "pointer",
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "var(--surface-inset)"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "none"; }}
              >
                <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-heading)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {m.tenant.name}
                  </span>
                  <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{roleLabel(m.membershipRole)}</span>
                </div>
                {active && <Icon name="check-circle" size={15} style={{ color: "var(--accent)", flexShrink: 0 }} />}
              </button>
            );
          })}

          {canCreateAnother && (
            <>
              <div style={{ height: 1, background: "var(--border-light)", margin: "4px 2px" }} />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  router.push("/create-coaching");
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left",
                  padding: "8px 10px", border: "none", borderRadius: 6, background: "none", cursor: "pointer",
                  color: "var(--accent)", fontSize: 13.5, fontWeight: 600,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface-inset)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
              >
                <Icon name="plus" size={15} style={{ flexShrink: 0 }} />
                Create another coaching
              </button>
            </>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}

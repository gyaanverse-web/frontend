"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "./Icon";

export interface KebabItem {
  label: string;
  onClick: () => void;
  icon?: IconName;
  danger?: boolean;
  disabled?: boolean;
}

/**
 * Three-dot (kebab) action menu. The dropdown is rendered in a portal with
 * fixed positioning so it is never clipped by scrollable/overflow containers
 * such as a data table. Closes on outside click, Escape, scroll, or resize.
 */
export function KebabMenu({ items, ariaLabel = "Row actions" }: { items: KebabItem[]; ariaLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setCoords({ top: r.bottom + 4, right: window.innerWidth - r.right });
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
    // capture: close when any ancestor scrolls, not just the window
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        style={{
          width: 30, height: 30, border: "1px solid transparent", borderRadius: 7,
          background: open ? "var(--surface-inset)" : "transparent", cursor: "pointer",
          color: "var(--text-muted)", display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <Icon name="more-vertical" size={18} />
      </button>

      {open && coords && createPortal(
        <div
          ref={menuRef}
          role="menu"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed", top: coords.top, right: coords.right, zIndex: 200,
            minWidth: 168, padding: 5, background: "var(--surface-card)",
            border: "1px solid var(--border-light)", borderRadius: 10,
            boxShadow: "0 12px 34px rgba(0,0,0,.18)", display: "flex", flexDirection: "column", gap: 1,
          }}
        >
          {items.map((it, i) => (
            <button
              key={i}
              role="menuitem"
              disabled={it.disabled}
              onClick={() => { if (it.disabled) return; setOpen(false); it.onClick(); }}
              style={{
                display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left",
                padding: "8px 10px", border: "none", borderRadius: 6, background: "none",
                cursor: it.disabled ? "not-allowed" : "pointer", opacity: it.disabled ? 0.5 : 1,
                fontSize: 13.5, fontWeight: 500,
                color: it.danger ? "var(--danger)" : "var(--text-body)",
              }}
              onMouseEnter={(e) => { if (!it.disabled) e.currentTarget.style.background = "var(--surface-inset)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
            >
              {it.icon && <Icon name={it.icon} size={15} style={{ flexShrink: 0 }} />}
              <span>{it.label}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

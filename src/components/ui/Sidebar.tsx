"use client";

import type { HTMLAttributes } from "react";
import { Logo } from "./Logo";
import { Badge, type BadgeRole } from "./Badge";
import { Icon, type IconName } from "./Icon";

export interface SidebarItem {
  label?: string;
  icon?: IconName | string;
  active?: boolean;
  /** Renders a section heading instead of a nav item. */
  section?: string;
}

export interface SidebarProps extends Omit<HTMLAttributes<HTMLElement>, "role"> {
  items?: SidebarItem[];
  role?: BadgeRole | null;
  footer?: boolean;
  activeLabel?: string | null;
  onNavigate?: (label: string) => void;
}

/** Dashboard left sidebar. items: [{label, icon, active?, section?}]. Shows logo, role badge, nav, log-out. */
export function Sidebar({
  items = [],
  role = null,
  footer = true,
  activeLabel = null,
  onNavigate = () => {},
  ...rest
}: SidebarProps) {
  return (
    <nav className="gv-sidebar" {...rest}>
      <div style={{ padding: "8px 12px 14px", display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
        <Logo size={18} />
        {role && <Badge role={role} />}
      </div>
      {items.map((it, i) =>
        it.section ? (
          <div key={i} className="gv-sidebar-section">
            {it.section}
          </div>
        ) : (
          <button
            key={i}
            className="gv-sidebar-item"
            aria-current={(activeLabel ?? "") === it.label || it.active ? "page" : undefined}
            onClick={() => it.label && onNavigate(it.label)}
          >
            {it.icon && <Icon name={it.icon} size={17} />}
            {it.label}
          </button>
        )
      )}
      {footer && (
        <>
          <div style={{ flex: 1 }} />
          <button className="gv-sidebar-item">
            <Icon name="log-out" size={17} />
            Log out
          </button>
        </>
      )}
    </nav>
  );
}

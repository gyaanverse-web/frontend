import type { HTMLAttributes, ReactNode } from "react";
import { Icon } from "./Icon";
import { Avatar } from "./Avatar";

export interface TopBarProps extends HTMLAttributes<HTMLElement> {
  institute?: string;
  subtitle?: ReactNode;
  search?: boolean;
  userName?: string;
  notifications?: number;
}

/** Dashboard top bar: institute name, optional search, notification bell, user menu. */
export function TopBar({
  institute = "Sharma Classes",
  subtitle = null,
  search = false,
  userName = "User",
  notifications = 0,
  children,
  ...rest
}: TopBarProps) {
  return (
    <header className="gv-topbar" {...rest}>
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 700,
            fontSize: 15,
            letterSpacing: "-0.01em",
            color: "var(--text-heading)",
          }}
        >
          {institute}
        </span>
        {subtitle && (
          <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--text-muted)" }}>
            {subtitle}
          </span>
        )}
      </div>
      <div style={{ flex: 1 }} />
      {search && (
        <div style={{ position: "relative", width: 260 }}>
          <Icon name="search" size={15} style={{ position: "absolute", left: 12, top: 12, color: "var(--text-muted)" }} />
          <input className="gv-input" placeholder="Search…" style={{ height: 38, paddingLeft: 34, fontSize: 13 }} />
        </div>
      )}
      {children}
      <button className="gv-btn gv-btn--ghost gv-btn--sm" style={{ position: "relative", width: 36, padding: 0 }} aria-label="Notifications">
        <Icon name="bell" size={18} />
        {notifications > 0 && (
          <span
            style={{
              position: "absolute",
              top: 3,
              right: 3,
              minWidth: 15,
              height: 15,
              borderRadius: 99,
              background: "var(--danger)",
              color: "#fff",
              fontSize: 9.5,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 3px",
            }}
          >
            {notifications}
          </span>
        )}
      </button>
      <button className="gv-btn gv-btn--ghost gv-btn--sm" style={{ gap: 8, paddingLeft: 6, paddingRight: 10 }}>
        <Avatar name={userName} size={26} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>{userName}</span>
        <Icon name="chevron-down" size={14} style={{ color: "var(--text-muted)" }} />
      </button>
    </header>
  );
}

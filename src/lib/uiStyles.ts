import type { CSSProperties } from "react";

export const colors = {
  headerBg: "#1a2e4a",
  primary: "#1a4db8",
  primaryText: "#fff",
  secondaryText: "#444",
  secondaryBorder: "#aaa",
  danger: "#b91c1c",
  mutedLink: "#aac4e8",
  divider: "#4a6a8a",
  inputBorder: "#666",
  panelBorder: "#ddd",
  labelBg: "#f5f5f5",
  text: "#111",
  pageBg: "#f0f0f0",
} as const;

export const btnPrimary: CSSProperties = {
  background: colors.primary,
  color: colors.primaryText,
  border: `1px solid ${colors.primary}`,
  padding: "4px 14px",
  fontWeight: "bold",
  cursor: "pointer",
  fontSize: "13px",
};

export const btnSecondary: CSSProperties = {
  background: "#fff",
  color: colors.secondaryText,
  border: `1px solid ${colors.secondaryBorder}`,
  padding: "4px 12px",
  cursor: "pointer",
  fontSize: "13px",
};

export const btnDanger: CSSProperties = {
  background: colors.danger,
  color: colors.primaryText,
  border: `1px solid ${colors.danger}`,
  padding: "4px 14px",
  fontWeight: "bold",
  cursor: "pointer",
  fontSize: "13px",
};

export const linkButtonBase: CSSProperties = {
  textDecoration: "none",
  display: "inline-block",
};

export const inputBase: CSSProperties = {
  border: `1px solid ${colors.inputBorder}`,
  padding: "4px 6px",
  background: "#fff",
  color: colors.text,
  fontSize: "13px",
};

export const sectionHeader: CSSProperties = {
  background: colors.headerBg,
  color: colors.primaryText,
  padding: "5px 10px",
  fontSize: "12px",
  fontWeight: "bold",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

export const tableCell: CSSProperties = {
  padding: "6px 10px",
  borderBottom: `1px solid ${colors.panelBorder}`,
  fontSize: "13px",
  verticalAlign: "middle",
};

export const labelCell: CSSProperties = {
  ...tableCell,
  fontWeight: "bold",
  whiteSpace: "nowrap",
  width: "100px",
  background: colors.labelBg,
  color: colors.text,
};

export const topBar: CSSProperties = {
  background: colors.headerBg,
  color: colors.primaryText,
  padding: "8px 16px",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  flexShrink: 0,
};

export const topBarLogo: CSSProperties = {
  fontWeight: "bold",
  fontSize: "15px",
  color: colors.primaryText,
  textDecoration: "none",
  letterSpacing: "0.3px",
  whiteSpace: "nowrap",
};

export const topBarDivider: CSSProperties = {
  color: colors.divider,
  fontSize: "12px",
  userSelect: "none",
};

export const topBarLink: CSSProperties = {
  color: colors.mutedLink,
  fontSize: "12px",
  textDecoration: "none",
  whiteSpace: "nowrap",
};

export const topBarPrimaryAction: CSSProperties = {
  ...btnPrimary,
  ...linkButtonBase,
  border: "none",
  padding: "3px 12px",
  fontSize: "12px",
};

export const topBarGhostAction: CSSProperties = {
  background: "transparent",
  color: colors.mutedLink,
  border: `1px solid ${colors.divider}`,
  padding: "2px 10px",
  fontSize: "12px",
  cursor: "pointer",
};

export const errorBox: CSSProperties = {
  color: "#c00",
  fontSize: "13px",
  border: "1px solid #c00",
  padding: "4px 8px",
  background: "#fff5f5",
};

"use client";

import type { CSSProperties } from "react";
import { useUrlState } from "@/lib/useUrlState";
import type { Tenant } from "../types";
import { InvitesSection } from "./InvitesSection";
import { JoinCodesSection } from "./JoinCodesSection";

type Props = { tenant: Tenant };

type Tab = "teachers" | "students";
const TABS: readonly Tab[] = ["teachers", "students"];

const TAB_COPY: Record<Tab, { label: string; blurb: string }> = {
  teachers: {
    label: "Teachers",
    blurb: "Invite specific teachers by email or phone. Each invite is personal and expires.",
  },
  students: {
    label: "Students",
    blurb: "Share one code or link that students use to enrol themselves. Cap the uses or set an expiry.",
  },
};

export function PeopleAccessSection({ tenant }: Props) {
  // `?audience=students`, alongside the dashboard's own `?screen=`. Named for
  // what it selects rather than "tab", so it stays unambiguous next to the other
  // params this URL already carries.
  const [tab, setTab] = useUrlState("audience", TABS, "teachers");

  return (
    <div>
      {/* Segmented control — one audience at a time */}
      <div
        role="tablist"
        aria-label="People & access"
        style={{
          display: "inline-flex",
          gap: 4,
          padding: 4,
          marginBottom: 12,
          background: "var(--bg-section-alt)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-pill)",
        }}
      >
        {TABS.map((t) => {
          const active = tab === t;
          const style: CSSProperties = {
            fontFamily: "var(--font-body)",
            fontSize: 13,
            fontWeight: 600,
            padding: "7px 20px",
            cursor: "pointer",
            borderRadius: "var(--radius-pill)",
            border: "1px solid transparent",
            background: active ? "var(--surface-card)" : "transparent",
            color: active ? "var(--text-heading)" : "var(--text-muted)",
            boxShadow: active ? "var(--shadow-sm)" : "none",
          };
          return (
            <button
              key={t}
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t)}
              style={style}
            >
              {TAB_COPY[t].label}
            </button>
          );
        })}
      </div>

      {/* Explainer for the active mechanism */}
      <p
        style={{
          margin: "0 0 16px",
          fontFamily: "var(--font-body)",
          fontSize: 13,
          color: "var(--text-muted)",
          maxWidth: 620,
        }}
      >
        {TAB_COPY[tab].blurb}
      </p>

      {tab === "teachers" ? <InvitesSection tenant={tenant} /> : <JoinCodesSection tenant={tenant} />}
    </div>
  );
}

"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Icon } from "@/components/ui";

// Expandable Subject → Module → Chapter → Section → Concept tree for the
// question-bank sidebar. Each node lazy-loads its children when expanded and,
// when clicked, reports itself to the parent so the question list can be
// filtered to that exact hierarchy level.

export type HLevel = "subject" | "module" | "chapter" | "section" | "concept";
export type HNode = { level: HLevel; id: string; name: string };

type Item = { id: string; name: string };

// How to fetch the children of a given level (concepts are leaves — absent here).
const CHILD: Partial<Record<HLevel, { path: (id: string) => string; key: string; level: HLevel }>> = {
  subject: { path: (id) => `/tenant/subjects/${id}/modules`, key: "modules", level: "module" },
  module: { path: (id) => `/tenant/modules/${id}/chapters`, key: "chapters", level: "chapter" },
  chapter: { path: (id) => `/tenant/chapters/${id}/sections`, key: "sections", level: "section" },
  section: { path: (id) => `/tenant/sections/${id}/concepts`, key: "concepts", level: "concept" },
};

const LEVEL_LABEL: Record<HLevel, string> = {
  subject: "modules",
  module: "chapters",
  chapter: "sections",
  section: "concepts",
  concept: "",
};

const keyOf = (level: HLevel, id: string) => `${level}:${id}`;

export function HierarchyTree({
  tenantSlug,
  subjects,
  counts,
  totalCount,
  selected,
  onSelect,
}: {
  tenantSlug: string;
  subjects: { id: string; name: string; gradeLevel?: string | null }[];
  counts: Record<string, number>;
  totalCount: number;
  selected: HNode | null;
  onSelect: (n: HNode | null) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [childrenOf, setChildrenOf] = useState<Record<string, Item[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  async function loadChildren(level: HLevel, id: string) {
    const cfg = CHILD[level];
    if (!cfg) return;
    const k = keyOf(level, id);
    setLoading((m) => ({ ...m, [k]: true }));
    try {
      const d = await api.get<Record<string, Item[]>>(cfg.path(id), { tenant: tenantSlug });
      setChildrenOf((m) => ({ ...m, [k]: d[cfg.key] ?? [] }));
    } catch {
      setChildrenOf((m) => ({ ...m, [k]: [] }));
    } finally {
      setLoading((m) => ({ ...m, [k]: false }));
    }
  }

  function toggle(level: HLevel, id: string) {
    const k = keyOf(level, id);
    const willOpen = !expanded[k];
    setExpanded((m) => ({ ...m, [k]: willOpen }));
    if (willOpen && childrenOf[k] === undefined) loadChildren(level, id);
  }

  function selectNode(node: HNode) {
    onSelect(node);
    // Clicking a collapsible node also opens it, so drilling down is one click.
    const k = keyOf(node.level, node.id);
    if (CHILD[node.level] && !expanded[k]) {
      setExpanded((m) => ({ ...m, [k]: true }));
      if (childrenOf[k] === undefined) loadChildren(node.level, node.id);
    }
  }

  function renderNode(item: Item, level: HLevel, depth: number) {
    const k = keyOf(level, item.id);
    const isSelected = selected?.level === level && selected.id === item.id;
    const collapsible = !!CHILD[level];
    const isOpen = !!expanded[k];
    const kids = childrenOf[k];
    const childLevel = CHILD[level]?.level;

    return (
      <div key={k}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={{ width: depth * 14, flexShrink: 0 }} />
          {collapsible ? (
            <button
              onClick={(e) => { e.stopPropagation(); toggle(level, item.id); }}
              aria-label={isOpen ? "Collapse" : "Expand"}
              style={{
                width: 20, height: 28, flexShrink: 0, border: "none", background: "none",
                cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Icon name="chevron-down" size={14} style={{ transform: isOpen ? "none" : "rotate(-90deg)", transition: "transform var(--duration-fast) var(--ease-out)" }} />
            </button>
          ) : (
            <span style={{ width: 20, flexShrink: 0, textAlign: "center", color: "var(--text-muted)", fontSize: 14, lineHeight: "28px" }}>·</span>
          )}
          <button
            onClick={() => selectNode({ level, id: item.id, name: item.name })}
            className="gv-sidebar-item"
            aria-current={isSelected ? "page" : undefined}
            style={{ padding: "6px 10px", fontSize: level === "subject" ? 14 : 13 }}
          >
            {level === "subject" && <Icon name="book-open" size={16} />}
            <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</span>
            {level === "subject" && (counts[item.id] ?? 0) > 0 && <span style={countPill}>{counts[item.id]}</span>}
          </button>
        </div>
        {isOpen && (
          <div>
            {loading[k] ? (
              <div style={{ ...leafHint, paddingLeft: (depth + 1) * 14 + 20 }}>Loading…</div>
            ) : kids && kids.length > 0 ? (
              kids.map((c) => renderNode(c, childLevel!, depth + 1))
            ) : (
              <div style={{ ...leafHint, paddingLeft: (depth + 1) * 14 + 20 }}>No {LEVEL_LABEL[level]}</div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center" }}>
        <span style={{ width: 20, flexShrink: 0 }} />
        <button
          onClick={() => onSelect(null)}
          className="gv-sidebar-item"
          aria-current={selected === null ? "page" : undefined}
          style={{ padding: "6px 10px", justifyContent: "space-between" }}
        >
          <span>All subjects</span>
          <span style={countPill}>{totalCount}</span>
        </button>
      </div>
      {subjects.map((s) => (
        <div key={s.id}>
          {s.gradeLevel && (
            <div style={{ paddingLeft: 20, fontSize: 9.5, color: "var(--text-muted)", marginTop: 2 }}>Grade {s.gradeLevel}</div>
          )}
          {renderNode({ id: s.id, name: s.name }, "subject", 0)}
        </div>
      ))}
    </div>
  );
}

const countPill: React.CSSProperties = {
  fontSize: 10.5,
  color: "var(--text-muted)",
  background: "var(--surface-inset)",
  borderRadius: 999,
  padding: "1px 7px",
  minWidth: 18,
  textAlign: "center",
};

const leafHint: React.CSSProperties = {
  fontSize: 12,
  color: "var(--text-muted)",
  padding: "4px 0",
};

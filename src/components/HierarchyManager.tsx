"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button, Badge, Icon, Input } from "@/components/ui";

// ── Types ─────────────────────────────────────────────────────────────────────

type NodeKind = "subject" | "module" | "chapter" | "section" | "concept";

type TreeItem = {
  id: string;
  name: string;
  order?: number | null;
  gradeLevel?: string | null;
  code?: string | null;
  description?: string | null;
};

const KIND_CFG: Record<
  NodeKind,
  {
    label: string;
    childKind: NodeKind | null;
    childPath?: (id: string) => string;
    childListKey?: string;
    childItemKey?: string;
  }
> = {
  subject: { label: "Subject", childKind: "module", childPath: (id) => `/tenant/subjects/${id}/modules`, childListKey: "modules", childItemKey: "module" },
  module: { label: "Module", childKind: "chapter", childPath: (id) => `/tenant/modules/${id}/chapters`, childListKey: "chapters", childItemKey: "chapter" },
  chapter: { label: "Chapter", childKind: "section", childPath: (id) => `/tenant/chapters/${id}/sections`, childListKey: "sections", childItemKey: "section" },
  section: { label: "Section", childKind: "concept", childPath: (id) => `/tenant/sections/${id}/concepts`, childListKey: "concepts", childItemKey: "concept" },
  concept: { label: "Concept", childKind: null },
};

// ── Add-child form ──────────────────────────────────────────────────────────

function AddChildForm({
  childKind,
  onCreate,
  onCancel,
}: {
  childKind: NodeKind;
  onCreate: (body: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [extra, setExtra] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const isConcept = childKind === "concept";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!name.trim()) return;
    setErr(""); setLoading(true);
    try {
      const body: Record<string, unknown> = { name: name.trim() };
      if (isConcept) { if (extra.trim()) body.description = extra.trim(); }
      else if (extra.trim()) body.order = parseInt(extra, 10);
      await onCreate(body);
      setName(""); setExtra("");
      onCancel();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : "Failed to create");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <input required minLength={1} maxLength={255} value={name} onChange={(e) => setName(e.target.value)} autoFocus
        placeholder={`${KIND_CFG[childKind].label} name`} className="gv-input" style={{ flex: 1, minWidth: 160, height: 34, fontSize: 13 }} />
      <input type={isConcept ? "text" : "number"} min={isConcept ? undefined : 0} placeholder={isConcept ? "description" : "order"}
        value={extra} onChange={(e) => setExtra(e.target.value)} className="gv-input" style={{ width: isConcept ? 180 : 80, height: 34, fontSize: 13 }} />
      <Button type="submit" variant="app" size="sm" disabled={loading || !name.trim()}>{loading ? "Adding…" : "Add"}</Button>
      <Button type="button" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onCancel(); }}>Cancel</Button>
      {err && <p style={{ width: "100%", margin: "2px 0 0", fontSize: 12, color: "var(--danger)" }}>{err}</p>}
    </form>
  );
}

// ── Recursive tree node ───────────────────────────────────────────────────────

function TreeNode({
  kind,
  item,
  tenantSlug,
  canEdit,
  depth,
  onDeleted,
}: {
  kind: NodeKind;
  item: TreeItem;
  tenantSlug: string;
  canEdit: boolean;
  depth: number;
  onDeleted: (id: string) => void;
}) {
  const cfg = KIND_CFG[kind];
  const isLeaf = !cfg.childKind;

  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<TreeItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [err, setErr] = useState("");

  const [nodeName, setNodeName] = useState(item.name);
  const [nodeDesc, setNodeDesc] = useState<string | null>(item.description ?? null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editOrder, setEditOrder] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [actErr, setActErr] = useState("");

  const ordered = kind !== "subject" && kind !== "concept";

  async function saveRename() {
    if (!editName.trim()) return;
    setSaving(true); setActErr("");
    try {
      const body: Record<string, unknown> = { name: editName.trim() };
      if (ordered && editOrder.trim() !== "") body.order = parseInt(editOrder, 10);
      if (kind === "concept") body.description = editDesc.trim() || null;
      const res = await api.patch<Record<string, TreeItem>>(`/tenant/${kind}s/${item.id}`, body, { tenant: tenantSlug });
      setNodeName(res[kind].name);
      if (kind === "concept") setNodeDesc(res[kind].description ?? null);
      setEditing(false);
    } catch (e) {
      setActErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete ${kind} "${nodeName}"? Everything under it is removed too.`)) return;
    setSaving(true); setActErr("");
    try {
      await api.delete(`/tenant/${kind}s/${item.id}`, { tenant: tenantSlug });
      onDeleted(item.id);
    } catch (e) {
      setActErr(e instanceof Error ? e.message : "Failed to delete");
      setSaving(false);
    }
  }

  async function loadChildren() {
    if (!cfg.childPath || !cfg.childListKey) return;
    setLoading(true); setErr("");
    try {
      const data = await api.get<Record<string, TreeItem[]>>(cfg.childPath(item.id), { tenant: tenantSlug });
      setChildren(data[cfg.childListKey] ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
      setChildren([]);
    } finally {
      setLoading(false);
    }
  }

  function toggle() {
    if (isLeaf) return;
    if (!expanded && children === null) loadChildren();
    setExpanded((v) => !v);
  }

  async function addChild(body: Record<string, unknown>) {
    if (!cfg.childPath || !cfg.childItemKey) return;
    const res = await api.post<Record<string, TreeItem>>(cfg.childPath(item.id), body, { tenant: tenantSlug });
    setChildren((prev) => [...(prev ?? []), res[cfg.childItemKey!]]);
  }

  const indent = 12 + depth * 18;
  const childLabelPlural = cfg.childKind ? KIND_CFG[cfg.childKind].label.toLowerCase() + "s" : "";

  return (
    <div style={{ borderBottom: "1px solid var(--border-light)" }}>
      <div
        onClick={toggle}
        style={{
          padding: "9px 14px", paddingLeft: indent,
          display: "flex", alignItems: "center", gap: 8,
          cursor: isLeaf ? "default" : "pointer",
          background: expanded ? "var(--accent-soft)" : depth === 0 ? "var(--surface-card)" : "var(--paper-50)",
        }}
      >
        <span style={{ width: 14, flexShrink: 0, display: "inline-flex", justifyContent: "center" }}>
          {isLeaf ? (
            <span style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--text-muted)" }} />
          ) : (
            <Icon name="chevron-down" size={13} style={{ color: "var(--text-muted)", transform: expanded ? "none" : "rotate(-90deg)", transition: "transform 140ms" }} />
          )}
        </span>

        {editing ? (
          <form onSubmit={(e) => { e.preventDefault(); e.stopPropagation(); saveRename(); }} onClick={(e) => e.stopPropagation()} style={{ flex: 1, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <input value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus className="gv-input" style={{ flex: 1, minWidth: 140, height: 32, fontSize: 13 }} />
            {ordered && <input type="number" min={0} value={editOrder} onChange={(e) => setEditOrder(e.target.value)} placeholder="order" className="gv-input" style={{ width: 70, height: 32, fontSize: 13 }} />}
            {kind === "concept" && <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="description" className="gv-input" style={{ width: 180, height: 32, fontSize: 13 }} />}
            <Button type="submit" variant="app" size="sm" disabled={saving}>Save</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
          </form>
        ) : (
          <>
            <span style={{ fontWeight: depth === 0 ? 700 : 500, fontSize: 13.5, flex: 1, color: "var(--text-heading)" }}>{nodeName}</span>

            {kind === "subject" && item.gradeLevel && <Badge tone="accent">Grade {item.gradeLevel}</Badge>}
            {kind === "concept" && nodeDesc && (
              <span style={{ fontSize: 11.5, color: "var(--text-muted)", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nodeDesc}</span>
            )}
            {!isLeaf && (
              <span style={{ fontSize: 11.5, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                {children !== null ? `${children.length} ${childLabelPlural}` : "expand"}
              </span>
            )}
            {canEdit && (
              <span onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex", gap: 4 }}>
                <Button variant="ghost" size="sm" onClick={() => { setEditing(true); setEditName(nodeName); setEditOrder(item.order != null ? String(item.order) : ""); setEditDesc(nodeDesc ?? ""); setActErr(""); }}>Edit</Button>
                <Button variant="ghost" size="sm" style={{ color: "var(--danger)" }} disabled={saving} onClick={handleDelete}>Delete</Button>
              </span>
            )}
          </>
        )}
      </div>
      {actErr && <div style={{ padding: "2px 14px", paddingLeft: indent + 22, fontSize: 12, color: "var(--danger)" }}>{actErr}</div>}

      {expanded && !isLeaf && (
        <div>
          {loading ? (
            <div style={{ padding: "8px 14px", paddingLeft: indent + 22, fontSize: 13, color: "var(--text-muted)" }}>Loading…</div>
          ) : (
            <>
              {err && <div style={{ padding: "8px 14px", paddingLeft: indent + 22, fontSize: 12, color: "var(--danger)" }}>{err}</div>}
              {(children ?? []).length === 0 && !err && (
                <div style={{ padding: "8px 14px", paddingLeft: indent + 22, fontSize: 13, color: "var(--text-muted)" }}>
                  No {childLabelPlural} yet.{canEdit ? " Add one below." : ""}
                </div>
              )}
              {(children ?? [])
                .slice()
                .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999))
                .map((child) => (
                  <TreeNode
                    key={child.id}
                    kind={cfg.childKind!}
                    item={child}
                    tenantSlug={tenantSlug}
                    canEdit={canEdit}
                    depth={depth + 1}
                    onDeleted={(cid) => setChildren((prev) => (prev ?? []).filter((c) => c.id !== cid))}
                  />
                ))}

              {canEdit && cfg.childKind && (
                <div style={{ padding: "8px 14px", paddingLeft: indent + 22 }} onClick={(e) => e.stopPropagation()}>
                  {showAdd ? (
                    <AddChildForm childKind={cfg.childKind} onCreate={addChild} onCancel={() => setShowAdd(false)} />
                  ) : (
                    <button onClick={() => setShowAdd(true)} style={{ border: "none", background: "none", color: "var(--accent)", fontSize: 12.5, cursor: "pointer", fontFamily: "var(--font-body)", fontWeight: 600, padding: 0 }}>
                      + Add {KIND_CFG[cfg.childKind].label}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export interface HierarchyManagerProps {
  tenantSlug: string;
  canEdit: boolean;
  /** Called whenever the top-level subject list changes (create / delete). */
  onSubjectsChange?: () => void;
}

/**
 * Curriculum tree editor for the Subject → Module → Chapter → Section → Concept
 * hierarchy. Used inside the Question Bank "Manage hierarchy" drawer. Manages the
 * taxonomy only — questions live in the Question Bank table, tagged to these nodes.
 */
export function HierarchyManager({ tenantSlug, canEdit, onSubjectsChange }: HierarchyManagerProps) {
  const [subjects, setSubjects] = useState<TreeItem[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGrade, setNewGrade] = useState("");
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");

  useEffect(() => {
    loadSubjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantSlug]);

  async function loadSubjects() {
    setSubjectsLoading(true);
    try {
      const data = await api.get<{ subjects: TreeItem[] }>("/tenant/subjects", { tenant: tenantSlug });
      setSubjects(data.subjects);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Failed to load subjects");
    } finally {
      setSubjectsLoading(false);
    }
  }

  async function handleCreateSubject(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreateErr(""); setCreating(true);
    try {
      const body: Record<string, unknown> = { name: newName.trim() };
      if (newGrade.trim()) body.gradeLevel = newGrade.trim();
      const res = await api.post<{ subject: TreeItem }>("/tenant/subjects", body, { tenant: tenantSlug });
      setSubjects((prev) => [res.subject, ...prev]);
      setShowCreate(false);
      setNewName(""); setNewGrade("");
      onSubjectsChange?.();
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : "Failed to create subject");
    } finally {
      setCreating(false);
    }
  }

  function handleDeletedSubject(id: string) {
    setSubjects((prev) => prev.filter((x) => x.id !== id));
    onSubjectsChange?.();
  }

  return (
    <div>
      {pageError && (
        <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 12, padding: "10px 14px", border: "1px solid rgba(244,63,94,0.35)", background: "var(--danger-soft)", borderRadius: "var(--radius-md)" }}>{pageError}</p>
      )}

      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16, fontFamily: "var(--font-body)" }}>
        Hierarchy: <strong style={{ color: "var(--text-heading)" }}>Subject → Module → Chapter → Section → Concept</strong>. Expand a row to manage the level beneath it. Questions are tagged to these nodes in the Question Bank.
      </p>

      <div className="gv-card" style={{ overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-light)", display: "flex", alignItems: "center", gap: 8 }}>
          <h4 style={{ margin: 0, flex: 1, fontSize: 15 }}>Subjects ({subjects.length})</h4>
          {canEdit && <Button variant="app" size="sm" onClick={() => setShowCreate(true)}><Icon name="plus" size={14} /> Add subject</Button>}
          <Button variant="ghost" size="sm" disabled={subjectsLoading} onClick={loadSubjects}>{subjectsLoading ? "Loading…" : "Refresh"}</Button>
        </div>
        {subjectsLoading ? (
          <div style={{ padding: 20, fontSize: 13, color: "var(--text-muted)" }}>Loading…</div>
        ) : subjects.length === 0 ? (
          <div style={{ padding: 28, fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>No subjects yet.{canEdit ? " Add one to get started." : ""}</div>
        ) : (
          subjects.map((s) => (
            <TreeNode key={s.id} kind="subject" item={s} tenantSlug={tenantSlug} canEdit={canEdit} depth={0}
              onDeleted={handleDeletedSubject} />
          ))
        )}
      </div>

      {showCreate && (
        <div style={{ position: "fixed", inset: 0, zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={() => setShowCreate(false)} style={{ position: "absolute", inset: 0, background: "rgba(11,16,32,.55)" }} />
          <form onSubmit={handleCreateSubject} style={{ position: "relative", zIndex: 1, width: 440, maxWidth: "90vw", background: "var(--surface-card)", borderRadius: 16, boxShadow: "0 24px 80px rgba(0,0,0,.32)", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <h4 style={{ margin: 0, flex: 1, fontSize: 17, color: "var(--text-heading)" }}>New subject</h4>
              <button type="button" onClick={() => setShowCreate(false)} style={{ width: 30, height: 30, border: "1px solid var(--border-light)", borderRadius: 6, background: "var(--surface-card)", cursor: "pointer", fontSize: 18, color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>×</button>
            </div>
            <Input label="Name" placeholder="e.g. Physics" value={newName} onChange={(e) => setNewName(e.target.value)} required minLength={1} maxLength={255} autoFocus />
            <Input label="Grade level (optional)" placeholder="e.g. 11" value={newGrade} onChange={(e) => setNewGrade(e.target.value)} maxLength={50} />
            {createErr && <p style={{ margin: 0, color: "var(--danger)", fontSize: 13 }}>{createErr}</p>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit" variant="app" disabled={creating || !newName.trim()}>{creating ? "Creating…" : "Create subject"}</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

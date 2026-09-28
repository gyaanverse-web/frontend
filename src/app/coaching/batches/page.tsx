"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useTenantSession } from "@/lib/useTenantSession";
import type { Batch, Tenant } from "../dashboard/types";
import { TeacherShell } from "@/components/dashboard/TeacherShell";
import { Badge, Button, Switch, Icon, Input, Modal } from "@/components/ui";
import { TeacherPicker, teacherNames, type TeacherOption } from "./TeacherPicker";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function BatchesPage() {
  const { loading, user, tenant, role, isOwner } = useTenantSession<Tenant>({
    allow: ["coaching_owner", "teacher"],
  });

  const [pageError, setPageError] = useState("");

  const [batches, setBatches] = useState<Batch[]>([]);
  const [listLoading, setListLoading] = useState(true);

  // Create-batch modal
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", grade: "", autoApprove: true, teacherIds: [] as string[] });
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");
  // The owner assigns teachers while creating; teachers never see the create flow.
  const [teacherOptions, setTeacherOptions] = useState<TeacherOption[]>([]);

  // ── Bootstrap ───────────────────────────────────────────────────────────────

  // Initial load. State is only touched in the async continuation — `listLoading`
  // starts true so the first render already shows the loading state.
  useEffect(() => {
    if (!tenant) return;
    let cancelled = false;
    api.get<{ classes: Batch[] }>("/tenant/classes", { tenant: tenant.slug })
      .then((data) => { if (!cancelled) setBatches(data.classes); })
      .catch((err) => {
        if (!cancelled) setPageError(err instanceof Error ? err.message : "Failed to load batches");
      })
      .finally(() => { if (!cancelled) setListLoading(false); });
    return () => { cancelled = true; };
  }, [tenant]);

  useEffect(() => {
    if (!tenant || !isOwner) return;
    let cancelled = false;
    api.get<{ teachers: TeacherOption[] }>("/tenant/teachers", { tenant: tenant.slug })
      .then((d) => { if (!cancelled) setTeacherOptions(d.teachers); })
      .catch(() => { /* non-fatal: the batch can be created now and assigned later */ });
    return () => { cancelled = true; };
  }, [tenant, isOwner]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant) return;
    setCreateErr(""); setCreating(true);
    try {
      const body: Record<string, unknown> = { name: form.name.trim(), autoApprove: form.autoApprove };
      if (form.grade.trim()) body.grade = form.grade.trim();
      if (form.teacherIds.length) body.teacherIds = form.teacherIds;
      const res = await api.post<{ class: Batch }>("/tenant/classes", body, { tenant: tenant.slug });
      setBatches((prev) => [res.class, ...prev]);
      setShowCreate(false);
      setForm({ name: "", grade: "", autoApprove: true, teacherIds: [] });
    } catch (err) {
      setCreateErr(err instanceof Error ? err.message : "Failed to create batch");
    } finally {
      setCreating(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────────

  if (loading || !user || !tenant) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 14 }}>
        Loading…
      </div>
    );
  }

  // Pending join requests across all batches — drives the attention banner.
  const totalPending = batches.reduce((sum, c) => sum + (c.pendingCount ?? 0), 0);
  const pendingBatches = batches.filter((c) => (c.pendingCount ?? 0) > 0);

  // The owner runs every batch ("Batches"); a teacher sees only the batches the
  // owner assigned them to ("My Batches"), read-only.
  return (
    <TeacherShell
      tenant={tenant}
      user={user}
      role={role}
      active="batches"
      eyebrow={isOwner ? "Institute" : "Teaching"}
      title={isOwner ? "Batches" : "My Batches"}
      action={
        isOwner ? (
          <Button variant="app" icon={<Icon name="plus" size={16} />} onClick={() => setShowCreate(true)}>
            New batch
          </Button>
        ) : undefined
      }
    >
      {pageError && (
        <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 16, padding: "10px 14px", border: "1px solid rgba(244,63,94,0.35)", background: "var(--danger-soft)", borderRadius: "var(--radius-md)" }}>
          {pageError}
        </p>
      )}

      {/* Attention banner — only the owner approves, so only the owner is prompted */}
      {isOwner && totalPending > 0 && (
        <div
          style={{
            display: "flex", alignItems: "center", gap: 12, marginBottom: 20,
            padding: "14px 18px", borderRadius: "var(--radius-md)",
            background: "var(--warning-soft)", border: "1px solid var(--warning)", color: "var(--text-body)",
          }}
        >
          <Icon name="alert-triangle" size={20} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, fontFamily: "var(--font-sans)" }}>
              {totalPending} student{totalPending !== 1 ? "s" : ""} waiting for approval
            </div>
            <div style={{ fontSize: 12.5, fontFamily: "var(--font-body)" }}>
              Across {pendingBatches.length} batch{pendingBatches.length !== 1 ? "es" : ""} — review and approve to enrol them.
            </div>
          </div>
          <Link
            href={`/coaching/batches/${pendingBatches[0].id}`}
            className="gv-btn gv-btn--app gv-btn--sm"
            style={{ textDecoration: "none", whiteSpace: "nowrap" }}
          >
            Review <Icon name="arrow-right" size={14} />
          </Link>
        </div>
      )}

      {/* Batch grid */}
      {listLoading ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading batches…</div>
      ) : batches.length === 0 ? (
        <div className="gv-card" style={{ padding: 40, textAlign: "center" }}>
          {isOwner ? (
            <>
              <p style={{ margin: "0 0 14px", fontSize: 15, color: "var(--text-body)", fontFamily: "var(--font-body)" }}>
                No batches yet. Create your first batch and assign its teachers.
              </p>
              <Button variant="app" icon={<Icon name="plus" size={16} />} onClick={() => setShowCreate(true)}>
                New batch
              </Button>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 15, color: "var(--text-body)", fontFamily: "var(--font-body)" }}>
              You haven&apos;t been assigned to any batches yet. Your coaching owner assigns batches to teachers.
            </p>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {batches.map((batch) => (
            <Link
              key={batch.id}
              href={`/coaching/batches/${batch.id}`}
              className="gv-card"
              style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14, minHeight: 210, textDecoration: "none", color: "inherit", cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ width: 46, height: 46, borderRadius: 11, background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 15, fontWeight: 700, fontFamily: "var(--font-sans)", color: "var(--accent)" }}>
                  {initials(batch.name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-heading)", marginBottom: 5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {batch.name}
                  </div>
                  {/* Who teaches this batch. The owner is flagged when nobody does yet. */}
                  {teacherNames(batch.teachers) ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: "var(--text-muted)", fontFamily: "var(--font-body)", marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      <Icon name="graduation-cap" size={13} />
                      {teacherNames(batch.teachers)}
                    </div>
                  ) : isOwner ? (
                    <div style={{ marginBottom: 6 }}><Badge tone="warning">No teacher assigned</Badge></div>
                  ) : null}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {batch.grade && <Badge tone="accent">{batch.grade}</Badge>}
                    <Badge tone={batch.autoApprove ? "success" : "warning"}>{batch.autoApprove ? "Auto-approve" : "Manual"}</Badge>
                  </div>
                </div>
                <Icon name="arrow-right" size={16} />
              </div>

              {/* Description slot — reserved height so every card lines up */}
              <p style={{ margin: 0, minHeight: 38, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", fontStyle: batch.description ? "normal" : "italic", opacity: batch.description ? 1 : 0.6 }}>
                {batch.description || "No description"}
              </p>

              {/* Enrollment counts — pinned to the bottom for uniform layout */}
              <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", paddingTop: 12, borderTop: "1px solid var(--border-light)" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-body)", fontFamily: "var(--font-body)", fontWeight: 600 }}>
                  <Icon name="users" size={15} />
                  {batch.studentCount ?? 0} student{(batch.studentCount ?? 0) !== 1 ? "s" : ""}
                </span>
                {isOwner && (batch.pendingCount ?? 0) > 0 && (
                  <Badge tone="warning">{batch.pendingCount} pending</Badge>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create-batch modal */}
      <Modal open={isOwner && showCreate} onClose={() => setShowCreate(false)} title="New batch" width={480}>
        <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input label="Batch name" placeholder="e.g. Fast Forward Batch" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} maxLength={255} autoFocus />
          <Input label="Grade (optional)" placeholder="e.g. 11th" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} maxLength={50} />
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "var(--text-heading)", cursor: "pointer" }}>
            <Switch checked={form.autoApprove} onChange={(e) => setForm({ ...form, autoApprove: e.target.checked })} />
            Auto-approve new students
          </label>
          <div>
            <span className="gv-label">Teachers (optional)</span>
            <TeacherPicker options={teacherOptions} value={form.teacherIds} onChange={(teacherIds) => setForm({ ...form, teacherIds })} />
          </div>
          {createErr && <p style={{ margin: 0, color: "var(--danger)", fontSize: 13 }}>{createErr}</p>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" variant="app" disabled={creating || !form.name.trim()}>{creating ? "Creating…" : "Create batch"}</Button>
          </div>
        </form>
      </Modal>
    </TeacherShell>
  );
}

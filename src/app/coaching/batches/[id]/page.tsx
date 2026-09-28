"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/lib/api";
import { buildTenantUrl } from "@/lib/tenantUrl";
import { useTenantSession } from "@/lib/useTenantSession";
import { useUrlState } from "@/lib/useUrlState";
import { TeacherShell } from "@/components/dashboard/TeacherShell";
import { Badge, Button, DataTable, Tabs, Avatar, Switch, Input, Modal } from "@/components/ui";
import type { Column, BadgeTone } from "@/components/ui";
import { TeacherPicker, type TeacherOption } from "../TeacherPicker";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tenant = { id: string; slug: string; name: string };

type Batch = {
  id: string;
  tenantId: string;
  name: string;
  grade: string | null;
  description: string | null;
  autoApprove: boolean;
  createdAt: string;
  updatedAt: string;
  teachers: { id: string; name: string }[];
};

type BatchJoinCode = {
  id: string;
  code: string;
  /** The batch this code enrols into. Wire name from the API. */
  classId: string;
  tenantId: string;
  createdBy: string;
  expiresAt: string | null;
  maxUses: number;
  usedCount: number;
  revoked: boolean;
  createdAt: string;
};

type BatchStudent = {
  id: string;
  studentId: string;
  status: "pending" | "approved" | "rejected";
  enrolledAt: string;
  name: string;
  email: string | null;
  phoneNumber: string | null;
};

type RosterTab = "Approved" | "Pending" | "Rejected";
const ROSTER_TABS: RosterTab[] = ["Approved", "Pending", "Rejected"];
// The enrollment status each tab lists — also the `?roster=` slug, so the URL
// names the same value the row filter and the backend do.
type RosterStatus = "approved" | "pending" | "rejected";
const ROSTER_STATUSES: readonly RosterStatus[] = ["approved", "pending", "rejected"];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── Component ─────────────────────────────────────────────────────────────────

function BatchDetailInner() {
  const router = useRouter();
  const params = useParams();
  const batchId = params?.id as string;

  // The owner manages everything here. An assigned teacher sees the batch and
  // its roster read-only. A student sees the description only.
  const { user, tenant, role } = useTenantSession<Tenant>();
  const [pageError, setPageError] = useState("");

  const [batch, setBatch] = useState<Batch | null>(null);
  const [batchLoading, setBatchLoading] = useState(true);

  // edit (settings modal)
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", grade: "", description: "", autoApprove: true });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // assigned teachers (owner edits)
  const [teacherOptions, setTeacherOptions] = useState<TeacherOption[]>([]);
  const [teachersOpen, setTeachersOpen] = useState(false);
  const [teacherDraft, setTeacherDraft] = useState<string[]>([]);
  const [savingTeachers, setSavingTeachers] = useState(false);
  const [teachersErr, setTeachersErr] = useState("");

  // join codes
  const [joinCodes, setJoinCodes] = useState<BatchJoinCode[]>([]);
  const [jcError, setJcError] = useState("");
  const [showJcForm, setShowJcForm] = useState(false);
  const [createJcForm, setCreateJcForm] = useState({ expiresAt: "", maxUses: "" });
  const [createJcLoading, setCreateJcLoading] = useState(false);
  const [createJcErr, setCreateJcErr] = useState("");
  const [confirmRevokeJcId, setConfirmRevokeJcId] = useState<string | null>(null);
  const [copiedJcId, setCopiedJcId] = useState<string | null>(null);

  // students
  const [students, setStudents] = useState<BatchStudent[]>([]);
  const [studentsError, setStudentsError] = useState("");
  // `?roster=pending` — approving joiners is a repeated task, so the tab that
  // holds them has to still be there after the page reloads.
  const [rosterStatus, setRosterStatus] = useUrlState("roster", ROSTER_STATUSES, "approved");
  const rosterTab = (rosterStatus.charAt(0).toUpperCase() + rosterStatus.slice(1)) as RosterTab;
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [enrollmentActing, setEnrollmentActing] = useState<string | null>(null);

  // ── Load on mount ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!tenant || !role) return;
    const slug = tenant.slug;

    api.get<{ class: Batch }>(`/tenant/classes/${batchId}`, { tenant: slug })
      .then((data) => {
        setBatch(data.class);
        setEditForm({
          name: data.class.name,
          grade: data.class.grade ?? "",
          description: data.class.description ?? "",
          autoApprove: data.class.autoApprove,
        });
        if (role === "coaching_owner" || role === "teacher") loadStudents(slug, batchId);
        // Join codes and teacher assignment are owner-only.
        if (role === "coaching_owner") {
          loadJoinCodes(slug, batchId);
          api.get<{ teachers: TeacherOption[] }>("/tenant/teachers", { tenant: slug })
            .then((d) => setTeacherOptions(d.teachers))
            .catch(() => { /* non-fatal: the picker just shows no options */ });
        }
      })
      .catch((err) => setPageError(err instanceof Error ? err.message : "Failed to load batch"))
      .finally(() => setBatchLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId, tenant, role]);

  // ── API actions ───────────────────────────────────────────────────────────

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant || !batch) return;
    setEditError(""); setEditLoading(true);
    try {
      const body: Record<string, unknown> = {};
      if (editForm.name !== batch.name) body.name = editForm.name;
      const newGrade = editForm.grade || null;
      if (newGrade !== batch.grade) body.grade = newGrade;
      const newDesc = editForm.description || null;
      if (newDesc !== batch.description) body.description = newDesc;
      if (editForm.autoApprove !== batch.autoApprove) body.autoApprove = editForm.autoApprove;
      if (Object.keys(body).length === 0) { setEditOpen(false); return; }
      const res = await api.patch<{ class: Batch }>(`/tenant/classes/${batchId}`, body, { tenant: tenant.slug });
      setBatch(res.class);
      setEditOpen(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update batch");
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDeleteBatch() {
    if (!tenant) return;
    setPageError(""); setDeleting(true);
    try {
      await api.delete(`/tenant/classes/${batchId}`, { tenant: tenant.slug });
      router.push("/coaching/batches");
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Failed to delete batch");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  function openTeachers() {
    if (!batch) return;
    setTeacherDraft(batch.teachers.map((t) => t.id));
    setTeachersErr("");
    setTeachersOpen(true);
  }

  async function handleSaveTeachers() {
    if (!tenant || !batch) return;
    setTeachersErr(""); setSavingTeachers(true);
    try {
      const res = await api.put<{ class: Batch }>(`/tenant/classes/${batchId}/teachers`, { teacherIds: teacherDraft }, { tenant: tenant.slug });
      setBatch(res.class);
      setTeachersOpen(false);
    } catch (err) {
      setTeachersErr(err instanceof Error ? err.message : "Failed to update teachers");
    } finally {
      setSavingTeachers(false);
    }
  }

  async function loadJoinCodes(slug: string, id: string) {
    setJcError("");
    try {
      const data = await api.get<{ joinCodes: BatchJoinCode[] }>(`/tenant/classes/${id}/join-codes`, { tenant: slug });
      setJoinCodes(data.joinCodes);
    } catch (err) {
      setJcError(err instanceof Error ? err.message : "Failed to load join codes");
    }
  }

  async function handleCreateJoinCode(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant) return;
    setCreateJcErr(""); setCreateJcLoading(true);
    try {
      const body: Record<string, unknown> = {};
      if (createJcForm.expiresAt) body.expiresAt = new Date(createJcForm.expiresAt + "T23:59:59.999Z").toISOString();
      if (createJcForm.maxUses) body.maxUses = parseInt(createJcForm.maxUses, 10);
      const res = await api.post<{ joinCode: BatchJoinCode }>(`/tenant/classes/${batchId}/join-codes`, body, { tenant: tenant.slug });
      setCreateJcForm({ expiresAt: "", maxUses: "" });
      setShowJcForm(false);
      setJoinCodes((prev) => [res.joinCode, ...prev]);
    } catch (err) {
      setCreateJcErr(err instanceof Error ? err.message : "Failed to create join code");
    } finally {
      setCreateJcLoading(false);
    }
  }

  async function handleRevokeJoinCode(codeId: string) {
    if (!tenant) return;
    setConfirmRevokeJcId(null); setJcError("");
    try {
      await api.delete(`/tenant/classes/${batchId}/join-codes/${codeId}`, { tenant: tenant.slug });
      setJoinCodes((prev) => prev.filter((jc) => jc.id !== codeId));
    } catch (err) {
      setJcError(err instanceof Error ? err.message : "Failed to revoke code");
    }
  }

  async function copyJoinLink(jc: BatchJoinCode) {
    // Batch codes redeem at /join/batch/:code (join_codes table), NOT the
    // coaching /join/:code page (coaching_join_codes) — that only knows about
    // institute-wide codes and would report "Join code not found".
    if (!tenant) return;
    const url = buildTenantUrl(tenant.slug, `/join/batch/${jc.code}`);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback for non-secure contexts (e.g. http://niazi.lvh.me in dev)
        const el = document.createElement("textarea");
        el.value = url;
        el.style.cssText = "position:fixed;opacity:0";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setCopiedJcId(jc.id);
      setTimeout(() => setCopiedJcId(null), 2000);
    } catch (err) {
      setJcError(err instanceof Error ? err.message : "Failed to copy link");
    }
  }

  async function loadStudents(slug: string, id: string) {
    setStudentsError("");
    try {
      const data = await api.get<{ students: BatchStudent[] }>(`/tenant/classes/${id}/students`, { tenant: slug });
      setStudents(data.students);
    } catch (err) {
      setStudentsError(err instanceof Error ? err.message : "Failed to load students");
    }
  }

  async function handleEnrollmentAction(studentId: string, action: "approve" | "reject") {
    if (!tenant) return;
    setEnrollmentActing(studentId);
    try {
      await api.patch(`/tenant/classes/${batchId}/students/${studentId}`, { action }, { tenant: tenant.slug });
      await loadStudents(tenant.slug, batchId);
    } catch (err) {
      setStudentsError(err instanceof Error ? err.message : "Failed to update enrollment");
    } finally {
      setEnrollmentActing(null);
    }
  }

  async function handleRemoveStudent(studentId: string) {
    if (!tenant) return;
    setConfirmRemoveId(null);
    try {
      await api.delete(`/tenant/classes/${batchId}/students/${studentId}`, { tenant: tenant.slug });
      setStudents((prev) => prev.filter((s) => s.studentId !== studentId));
    } catch (err) {
      setStudentsError(err instanceof Error ? err.message : "Failed to remove student");
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const counts = useMemo(() => ({
    approved: students.filter((s) => s.status === "approved").length,
    pending: students.filter((s) => s.status === "pending").length,
    rejected: students.filter((s) => s.status === "rejected").length,
  }), [students]);

  const visibleStudents = useMemo(
    () => students.filter((s) => s.status === rosterStatus),
    [students, rosterStatus],
  );

  // Sharing a code is the one join-code job done often, so it stays one click
  // away in the header; creating/revoking them lives in Batch settings.
  const activeJoinCode = joinCodes.find(
    (jc) => !jc.revoked && jc.usedCount < jc.maxUses && (jc.expiresAt === null || new Date(jc.expiresAt) > new Date()),
  );

  // ── Render ────────────────────────────────────────────────────────────────

  if (!user || batchLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: pageError ? "var(--danger)" : "var(--text-muted)" }}>
        {pageError || "Loading…"}
      </div>
    );
  }
  if (!batch) return null;

  const isOwner = role === "coaching_owner";
  // Owner and assigned teachers see the roster; only the owner acts on it.
  const canViewRoster = isOwner || role === "teacher";

  const studentCell = (s: BatchStudent) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Avatar name={s.name} size={28} />
      <div>
        <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-heading)" }}>{s.name}</div>
        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.email ?? s.phoneNumber ?? "—"}</div>
      </div>
    </div>
  );

  const removeCell = (s: BatchStudent) =>
    confirmRemoveId === s.studentId ? (
      <span style={{ display: "inline-flex", gap: 6 }}>
        <Button variant="danger" size="sm" onClick={() => handleRemoveStudent(s.studentId)}>Confirm</Button>
        <Button variant="ghost" size="sm" onClick={() => setConfirmRemoveId(null)}>Cancel</Button>
      </span>
    ) : (
      <Button variant="ghost" size="sm" style={{ color: "var(--danger)" }} onClick={() => setConfirmRemoveId(s.studentId)}>Remove</Button>
    );

  const approvedColumns: Column<BatchStudent>[] = [
    { key: "name", label: "Student", render: studentCell },
    { key: "enrolled", label: "Enrolled", render: (s) => <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{new Date(s.enrolledAt).toLocaleDateString()}</span> },
    ...(isOwner ? [{ key: "act", label: "", render: removeCell }] : []),
  ];

  const pendingColumns: Column<BatchStudent>[] = [
    { key: "name", label: "Student", render: studentCell },
    { key: "req", label: "Requested", render: (s) => <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{new Date(s.enrolledAt).toLocaleDateString()}</span> },
    ...(isOwner ? [{ key: "act", label: "", render: (s: BatchStudent) => (
      <div style={{ display: "flex", gap: 6 }}>
        <Button variant="app" size="sm" disabled={enrollmentActing === s.studentId} onClick={() => handleEnrollmentAction(s.studentId, "approve")}>Approve</Button>
        <Button variant="ghost" size="sm" style={{ color: "var(--danger)" }} disabled={enrollmentActing === s.studentId} onClick={() => handleEnrollmentAction(s.studentId, "reject")}>Reject</Button>
      </div>
    ) }] : []),
  ];

  const rejectedColumns: Column<BatchStudent>[] = [
    { key: "name", label: "Student", render: studentCell },
    { key: "date", label: "Date", render: (s) => <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{new Date(s.enrolledAt).toLocaleDateString()}</span> },
    ...(isOwner ? [{ key: "act", label: "", render: (s: BatchStudent) => (
      <Button variant="secondary" size="sm" disabled={enrollmentActing === s.studentId} onClick={() => handleEnrollmentAction(s.studentId, "approve")}>Re-admit</Button>
    ) }] : []),
  ];

  const columns = rosterTab === "Approved" ? approvedColumns : rosterTab === "Pending" ? pendingColumns : rejectedColumns;

  return (
    <TeacherShell tenant={tenant} user={user} role={role} active="batches">
      {/* Breadcrumb + header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, fontSize: 13 }}>
          <button onClick={() => router.push("/coaching/batches")} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", padding: 0, fontFamily: "var(--font-body)", fontSize: 13 }}>{isOwner ? "Batches" : "My Batches"}</button>
          <span style={{ color: "var(--text-muted)" }}>›</span>
          <span style={{ color: "var(--text-muted)" }}>{batch.name}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, fontFamily: "var(--font-sans)", color: "var(--accent)", flexShrink: 0 }}>
            {initials(batch.name)}
          </div>
          <div>
            <h2 style={{ margin: "0 0 4px", fontSize: 22, letterSpacing: "-0.02em" }}>{batch.name}</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {batch.grade && <Badge tone="accent">{batch.grade}</Badge>}
              <Badge tone="neutral">{counts.approved} students</Badge>
              {counts.pending > 0 && <Badge tone="warning">{counts.pending} pending</Badge>}
              <Badge tone={batch.autoApprove ? "success" : "warning"}>{batch.autoApprove ? "Auto-approve" : "Manual"}</Badge>
            </div>
          </div>
          <div style={{ flex: 1 }} />
          {isOwner && activeJoinCode && (
            <Button variant="ghost" size="sm" onClick={() => copyJoinLink(activeJoinCode)}>
              {copiedJcId === activeJoinCode.id ? "Copied!" : `Copy join link · ${activeJoinCode.code}`}
            </Button>
          )}
          {isOwner && <Button variant="secondary" size="sm" onClick={() => { setConfirmDelete(false); setEditOpen(true); }}>Batch settings</Button>}
        </div>
      </div>

      {pageError && (
        <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 16, padding: "10px 14px", border: "1px solid rgba(244,63,94,0.35)", background: "var(--danger-soft)", borderRadius: "var(--radius-md)" }}>{pageError}</p>
      )}

      {/* Teachers — visible to staff; the owner assigns */}
      {canViewRoster && (
        <div className="gv-card" style={{ padding: "14px 20px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-heading)", fontFamily: "var(--font-sans)" }}>Teachers</div>
          <div style={{ flex: 1, display: "flex", gap: 12, flexWrap: "wrap", minWidth: 0 }}>
            {batch.teachers.length === 0 ? (
              <Badge tone="warning">No teacher assigned</Badge>
            ) : (
              batch.teachers.map((t) => (
                <span key={t.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-body)" }}>
                  <Avatar name={t.name} size={22} />
                  {t.name}
                </span>
              ))
            )}
          </div>
          {isOwner && <Button variant="secondary" size="sm" onClick={openTeachers}>Manage teachers</Button>}
        </div>
      )}

      {canViewRoster ? (
        <div className="gv-card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-light)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h4 style={{ margin: 0, flex: 1, fontSize: 16 }}>Student roster</h4>
            <Tabs
              tabs={ROSTER_TABS.map((t) => `${t} (${counts[t.toLowerCase() as keyof typeof counts]})`)}
              value={`${rosterTab} (${counts[rosterTab.toLowerCase() as keyof typeof counts]})`}
              onChange={(label) => setRosterStatus(label.split(" ")[0].toLowerCase() as RosterStatus)}
            />
          </div>
          {studentsError ? (
            <div style={{ padding: 20, fontSize: 13, color: "var(--danger)" }}>{studentsError}</div>
          ) : visibleStudents.length === 0 ? (
            <div style={{ padding: 28, fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>No {rosterTab.toLowerCase()} students.</div>
          ) : (
            <DataTable columns={columns} rows={visibleStudents} maxHeight={560} style={{ border: "none", borderRadius: 0 }} />
          )}
        </div>
      ) : (
        <div className="gv-card" style={{ padding: 24 }}>
          <p style={{ margin: 0, fontSize: 14, color: "var(--text-body)", fontFamily: "var(--font-body)" }}>{batch.description ?? "No description."}</p>
        </div>
      )}

      {/* Settings modal */}
      <Modal open={isOwner && editOpen} onClose={() => setEditOpen(false)} title="Batch settings" width={520}>
          <form onSubmit={handleEditSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Input label="Name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required minLength={2} maxLength={255} />
            <Input label="Grade" placeholder="e.g. 11th" value={editForm.grade} onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })} maxLength={50} />
            <label style={{ display: "block" }}>
              <span className="gv-label">Description</span>
              <textarea maxLength={1000} rows={3} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="gv-input" style={{ height: "auto", padding: "10px 14px", resize: "vertical" }} />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "var(--text-heading)", cursor: "pointer" }}>
              <Switch checked={editForm.autoApprove} onChange={(e) => setEditForm({ ...editForm, autoApprove: e.target.checked })} />
              Auto-approve new students
            </label>
            {editError && <p style={{ margin: 0, color: "var(--danger)", fontSize: 13 }}>{editError}</p>}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" variant="app" disabled={editLoading}>{editLoading ? "Saving…" : "Save changes"}</Button>
            </div>
          </form>

          {/* Join codes — a sibling of the form above, not a child: the create
              form below would otherwise be a nested <form>, which is invalid. */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border-light)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-heading)", fontFamily: "var(--font-sans)" }}>Join codes</div>
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>
                  Share a code or its link to let students enrol in this batch.
                </div>
              </div>
              <Button type="button" variant="secondary" size="sm" style={{ flexShrink: 0 }} onClick={() => setShowJcForm((v) => !v)}>
                {showJcForm ? "Cancel" : "Generate"}
              </Button>
            </div>

            {showJcForm && (
              <form onSubmit={handleCreateJoinCode} style={{ marginTop: 12, padding: 14, border: "1px solid var(--border-light)", borderRadius: 10, background: "var(--paper-50)", display: "flex", flexDirection: "column", gap: 10 }}>
                <Input label="Expires (optional)" type="date" value={createJcForm.expiresAt} onChange={(e) => setCreateJcForm({ ...createJcForm, expiresAt: e.target.value })} />
                <Input label="Max uses (optional)" type="number" min={1} max={99999} placeholder="9999" value={createJcForm.maxUses} onChange={(e) => setCreateJcForm({ ...createJcForm, maxUses: e.target.value })} />
                {createJcErr && <p style={{ margin: 0, fontSize: 12, color: "var(--danger)" }}>{createJcErr}</p>}
                <Button type="submit" variant="app" size="sm" disabled={createJcLoading}>{createJcLoading ? "Generating…" : "Create code"}</Button>
              </form>
            )}

            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              {jcError && <p style={{ margin: 0, fontSize: 12, color: "var(--danger)" }}>{jcError}</p>}
              {joinCodes.length === 0 && !jcError ? (
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)" }}>No active codes. Generate one to let students join.</p>
              ) : (
                joinCodes.map((jc) => {
                  const isExpired = jc.expiresAt !== null && new Date() > new Date(jc.expiresAt);
                  const tone: BadgeTone = jc.revoked ? "neutral" : isExpired ? "danger" : "success";
                  return (
                    <div key={jc.id} style={{ padding: "10px 12px", border: "1px solid var(--border-light)", borderRadius: 10, background: "var(--paper-50)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 140 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <code style={{ fontFamily: "var(--font-mono)", fontSize: 13.5, fontWeight: 700, color: "var(--text-heading)", letterSpacing: "0.05em" }}>{jc.code}</code>
                          <Badge tone={tone}>{jc.revoked ? "Revoked" : isExpired ? "Expired" : "Active"}</Badge>
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 3 }}>
                          Expires {jc.expiresAt ? new Date(jc.expiresAt).toLocaleDateString() : "never"} · {jc.usedCount}/{jc.maxUses} uses
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <Button type="button" variant="ghost" size="sm" onClick={() => copyJoinLink(jc)}>
                          {copiedJcId === jc.id ? "Copied!" : "Copy link"}
                        </Button>
                        {confirmRevokeJcId === jc.id ? (
                          <>
                            <Button type="button" variant="danger" size="sm" onClick={() => handleRevokeJoinCode(jc.id)}>Confirm</Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmRevokeJcId(null)}>Cancel</Button>
                          </>
                        ) : (
                          <Button type="button" variant="ghost" size="sm" style={{ color: "var(--danger)" }} onClick={() => setConfirmRevokeJcId(jc.id)}>Revoke</Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Danger zone */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border-light)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--danger)", fontFamily: "var(--font-sans)" }}>Delete this batch</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>
                    Removes the batch, its join codes, enrollments and teacher assignments. This cannot be undone.
                  </div>
                </div>
                {confirmDelete ? (
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <Button type="button" variant="danger" size="sm" disabled={deleting} onClick={handleDeleteBatch}>
                      {deleting ? "Deleting…" : "Confirm"}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" disabled={deleting} onClick={() => setConfirmDelete(false)}>Cancel</Button>
                  </div>
                ) : (
                  <Button type="button" variant="secondary" size="sm" style={{ color: "var(--danger)", flexShrink: 0 }} onClick={() => setConfirmDelete(true)}>Delete</Button>
                )}
              </div>
          </div>
      </Modal>

      {/* Teachers modal — owner only */}
      <Modal open={isOwner && teachersOpen} onClose={() => setTeachersOpen(false)} title="Assign teachers" width={480}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>
            Assigned teachers see this batch in My Batches, can view its roster, and can set exams for it. Only you manage students and settings.
          </p>
          <TeacherPicker options={teacherOptions} value={teacherDraft} onChange={setTeacherDraft} disabled={savingTeachers} />
          {teachersErr && <p style={{ margin: 0, color: "var(--danger)", fontSize: 13 }}>{teachersErr}</p>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Button type="button" variant="ghost" onClick={() => setTeachersOpen(false)}>Cancel</Button>
            <Button type="button" variant="app" disabled={savingTeachers} onClick={handleSaveTeachers}>{savingTeachers ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      </Modal>
    </TeacherShell>
  );
}

// ── Suspense wrapper (required for useSearchParams) ──────────────────────────

export default function BatchDetailPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "var(--text-muted)" }}>
          Loading…
        </div>
      }
    >
      <BatchDetailInner />
    </Suspense>
  );
}

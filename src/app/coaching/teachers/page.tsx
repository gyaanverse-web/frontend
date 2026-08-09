"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useTenantSession } from "@/lib/useTenantSession";
import type { Tenant } from "../dashboard/types";
import { TeacherShell } from "@/components/dashboard/TeacherShell";
import { Avatar, Badge, DataTable, StatCard, type Column } from "@/components/ui";

type TeacherRow = {
  id: string; // = userId; satisfies DataTable's row-key constraint
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  joinedAt: string;
  classCount: number;
  studentCount: number;
  examCount: number;
};

export default function TeachersPage() {
  // Roster is owner-only oversight — teachers/students bounce to the dashboard.
  const { loading, user, tenant, role } = useTenantSession<Tenant>({
    allow: ["coaching_owner"],
  });

  // `null` means "not loaded yet" — the first render is already in its loading
  // state, so the mount effect never sets one synchronously.
  const [teachers, setTeachers] = useState<TeacherRow[] | null>(null);
  const [pageError, setPageError] = useState("");

  useEffect(() => {
    if (!tenant) return;
    let cancelled = false;
    api.get<{ teachers: Omit<TeacherRow, "id">[] }>("/tenant/teachers", { tenant: tenant.slug })
      .then((data) => {
        if (!cancelled) setTeachers(data.teachers.map((t) => ({ ...t, id: t.userId })));
      })
      .catch((err) => {
        if (cancelled) return;
        setPageError(err instanceof Error ? err.message : "Failed to load teachers");
        setTeachers([]);
      });
    return () => { cancelled = true; };
  }, [tenant]);

  const totals = useMemo(() => {
    return (teachers ?? []).reduce(
      (acc, t) => ({
        students: acc.students + t.studentCount,
        classes: acc.classes + t.classCount,
        exams: acc.exams + t.examCount,
      }),
      { students: 0, classes: 0, exams: 0 },
    );
  }, [teachers]);

  const columns: Column<TeacherRow>[] = [
    {
      key: "name",
      label: "Teacher",
      render: (t) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <Avatar name={t.name} size={30} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text-heading)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {t.name}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {t.email ?? t.phone ?? "—"}
            </div>
          </div>
        </div>
      ),
    },
    { key: "classCount", label: "Batches", width: 100, render: (t) => <Badge tone="accent">{t.classCount}</Badge> },
    { key: "studentCount", label: "Students", width: 100, render: (t) => <Badge tone={t.studentCount > 0 ? "success" : "neutral"}>{t.studentCount}</Badge> },
    { key: "examCount", label: "Exams", width: 100, render: (t) => <Badge tone="neutral">{t.examCount}</Badge> },
    {
      key: "joinedAt",
      label: "Joined",
      width: 140,
      render: (t) => (
        <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
          {new Date(t.joinedAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  if (loading || !user || !tenant) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 14 }}>
        Loading…
      </div>
    );
  }

  return (
    <TeacherShell tenant={tenant} user={user} role={role} active="teachers" eyebrow="Institute" title="Teachers">
      {pageError && (
        <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 16, padding: "10px 14px", border: "1px solid rgba(244,63,94,0.35)", background: "var(--danger-soft)", borderRadius: "var(--radius-md)" }}>
          {pageError}
        </p>
      )}

      {/* Summary KPIs across all teachers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 22 }}>
        <StatCard label="Teachers" value={teachers?.length ?? 0} />
        <StatCard label="Students taught" value={totals.students} sub="approved, across all batches" />
        <StatCard label="Batches" value={totals.classes} />
        <StatCard label="Exams authored" value={totals.exams} />
      </div>

      {teachers === null ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading teachers…</div>
      ) : teachers.length === 0 ? (
        <div className="gv-card" style={{ padding: 40, textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 15, color: "var(--text-body)", fontFamily: "var(--font-body)" }}>
            No teachers yet. Invite teachers from the dashboard to build your team.
          </p>
        </div>
      ) : (
        <DataTable columns={columns} rows={teachers} />
      )}
    </TeacherShell>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useTenantSession } from "@/lib/useTenantSession";
import { TeacherShell } from "@/components/dashboard/TeacherShell";
import { Avatar, Badge, DataTable, Input, Select, StatCard, type Column } from "@/components/ui";
import { formatPaise } from "@/lib/fee";
import { fmtLastActive, type StudentListRow } from "@/lib/people";

type Tenant = { id: string; slug: string; name: string };

/**
 * The students list — the front door to a person, where Batches is the front
 * door to a group.
 *
 * Open to teachers as well as the owner: the API narrows a teacher's list to
 * students approved in a batch they are assigned to, so the screen is useful to
 * both rather than being another owner-only roster.
 *
 * The fee column is present only when the API actually sent a figure. A `null`
 * `outstanding` means "not shown" — a teacher, or the platform fees switch off —
 * and rendering it as ₹0 would state something false, so the column is dropped
 * entirely instead.
 */
export default function StudentsPage() {
  const { loading, user, tenant, role } = useTenantSession<Tenant>({
    allow: ["coaching_owner", "teacher"],
  });
  const router = useRouter();

  const [students, setStudents] = useState<StudentListRow[] | null>(null);
  const [pageError, setPageError] = useState("");
  const [query, setQuery] = useState("");
  const [batch, setBatch] = useState("all");

  useEffect(() => {
    if (!tenant) return;
    let cancelled = false;
    api
      .get<{ students: StudentListRow[] }>("/tenant/people/students", { tenant: tenant.slug })
      .then((data) => {
        if (!cancelled) setStudents(data.students);
      })
      .catch((err) => {
        if (cancelled) return;
        setPageError(err instanceof Error ? err.message : "Failed to load students");
        setStudents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [tenant]);

  // Batch options come from the rows themselves rather than a second request:
  // the only batches worth filtering by are ones a listed student is actually in.
  const batchOptions = useMemo(() => {
    const names = new Set<string>();
    for (const s of students ?? []) for (const n of s.batchNames) names.add(n);
    return [...names].sort();
  }, [students]);

  const showFees = (students ?? []).some((s) => s.outstanding !== null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (students ?? []).filter((s) => {
      if (batch === "unassigned" ? s.batchCount > 0 : batch !== "all" && !s.batchNames.includes(batch)) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q) ||
        (s.phone ?? "").includes(q)
      );
    });
  }, [students, query, batch]);

  const totals = useMemo(() => {
    const rows = students ?? [];
    return {
      unassigned: rows.filter((s) => s.batchCount === 0).length,
      active: rows.filter((s) => s.attemptCount > 0).length,
      owed: rows.reduce((sum, s) => sum + (s.outstanding ?? 0), 0),
    };
  }, [students]);

  const columns: Column<StudentListRow>[] = [
    {
      key: "name",
      label: "Student",
      render: (s) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <Avatar name={s.name} size={30} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text-heading)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {s.name}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {s.email ?? s.phone ?? "—"}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "batchNames",
      label: "Batches",
      render: (s) =>
        s.batchCount === 0 ? (
          <Badge tone="warning">No batch</Badge>
        ) : (
          <span style={{ fontSize: 12.5, color: "var(--text-body)" }}>{s.batchNames.join(", ")}</span>
        ),
    },
    {
      key: "attemptCount",
      label: "Attempts",
      width: 100,
      render: (s) => <Badge tone={s.attemptCount > 0 ? "accent" : "neutral"}>{s.attemptCount}</Badge>,
    },
    {
      key: "lastActiveAt",
      label: "Last active",
      width: 130,
      render: (s) => (
        <span style={{ fontSize: 12.5, color: s.lastActiveAt ? "var(--text-muted)" : "var(--text-subtle, var(--text-muted))" }}>
          {fmtLastActive(s.lastActiveAt)}
        </span>
      ),
    },
    ...(showFees
      ? [
          {
            key: "outstanding",
            label: "Outstanding",
            width: 130,
            render: (s: StudentListRow) =>
              s.outstanding === null ? (
                <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>—</span>
              ) : s.outstanding === 0 ? (
                <Badge tone="success">Clear</Badge>
              ) : (
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--danger)" }}>{formatPaise(s.outstanding)}</span>
              ),
          },
        ]
      : []),
  ];

  if (loading || !user || !tenant) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 14 }}>
        Loading…
      </div>
    );
  }

  const isOwner = role === "coaching_owner";

  return (
    <TeacherShell
      tenant={tenant}
      user={user}
      role={role}
      active="students"
      eyebrow="Institute"
      title={isOwner ? "Students" : "My Students"}
    >
      {pageError && (
        <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 16, padding: "10px 14px", border: "1px solid rgba(244,63,94,0.35)", background: "var(--danger-soft)", borderRadius: "var(--radius-md)" }}>
          {pageError}
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 22 }}>
        <StatCard label="Students" value={students?.length ?? 0} />
        <StatCard label="Sat a paper" value={totals.active} sub="at least one attempt" />
        <StatCard label="Not in a batch" value={totals.unassigned} sub={isOwner ? "assign them from Batches" : undefined} />
        {showFees && <StatCard label="Outstanding" value={formatPaise(totals.owed)} sub="across all students" />}
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <Input
          placeholder="Search name, email or phone…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          wrapperStyle={{ flex: "1 1 260px", minWidth: 220 }}
        />
        <Select
          value={batch}
          onChange={(e) => setBatch(e.target.value)}
          wrapperStyle={{ flex: "0 1 220px" }}
          options={[
            { value: "all", label: "All batches" },
            { value: "unassigned", label: "Not in a batch" },
            ...batchOptions.map((n) => ({ value: n, label: n })),
          ]}
        />
      </div>

      {students === null ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading students…</div>
      ) : students.length === 0 ? (
        <div className="gv-card" style={{ padding: 40, textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 15, color: "var(--text-body)", fontFamily: "var(--font-body)" }}>
            {isOwner
              ? "No students yet. Share a join code or add them to a batch to get started."
              : "No students yet. You will see students here once the owner assigns you to a batch."}
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="gv-card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
          No students match that search.
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={visible}
          onRowClick={(s) => router.push(`/coaching/students/${s.id}`)}
        />
      )}
    </TeacherShell>
  );
}

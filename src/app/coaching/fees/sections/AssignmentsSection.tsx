"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Batch } from "../../dashboard/types";
import { Badge, DataTable, Icon, Select } from "@/components/ui";
import type { Column } from "@/components/ui";
import { ASSIGNMENT_STATUS_TONE, formatPaise, fmtDate, type StudentFeeAssignment } from "@/lib/fee";

type Props = { tenantSlug: string };

type BatchStudent = { studentId: string; name: string; status: string };

type Row = StudentFeeAssignment & { studentName: string };

export function AssignmentsSection({ tenantSlug }: Props) {
  const router = useRouter();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [batchId, setBatchId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Only ever called from an event handler below (the batch picker's onChange,
  // or the continuation of the batches fetch once it resolves) — never
  // directly from an effect body — so its synchronous setLoading(true) is fine.
  const loadAssignments = useCallback(async (cid: string) => {
    setLoading(true); setError("");
    try {
      // Filter server-side and walk every page: the list endpoint pages at
      // 200 max, and a batch's roster must never silently stop at the first page.
      const fetchAll = async () => {
        const all: StudentFeeAssignment[] = [];
        let cursor: string | null = null;
        do {
          const q = new URLSearchParams({ classId: cid, limit: "200" });
          if (cursor) q.set("cursor", cursor);
          const page: { items: StudentFeeAssignment[]; nextCursor: string | null } =
            await api.get(`/tenant/fees/assignments?${q}`, { tenant: tenantSlug });
          all.push(...page.items);
          cursor = page.nextCursor;
        } while (cursor);
        return all;
      };
      const [assignments, studentsRes] = await Promise.all([
        fetchAll(),
        api.get<{ students: BatchStudent[] }>(`/tenant/classes/${cid}/students`, { tenant: tenantSlug }),
      ]);
      const nameById = new Map(studentsRes.students.map((s) => [s.studentId, s.name]));
      setRows(assignments.map((a) => ({ ...a, studentName: nameById.get(a.studentId) ?? "Unknown student" })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load assignments");
    } finally {
      setLoading(false);
    }
  }, [tenantSlug]);

  useEffect(() => {
    let cancelled = false;
    api.get<{ classes: Batch[] }>("/tenant/classes", { tenant: tenantSlug })
      .then((d) => {
        if (cancelled) return;
        setBatches(d.classes);
        if (d.classes.length > 0) {
          setBatchId(d.classes[0].id);
          void loadAssignments(d.classes[0].id);
        }
      })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load batches"); });
    return () => { cancelled = true; };
  }, [tenantSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleBatchChange(cid: string) {
    setBatchId(cid);
    void loadAssignments(cid);
  }

  const columns: Column<Row>[] = [
    { key: "student", label: "Student", width: "28%", render: (r) => <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-heading)" }}>{r.studentName}</span> },
    { key: "gross", label: "Gross", width: "15%", render: (r) => <span style={{ fontSize: 13 }}>{formatPaise(r.grossAmount)}</span> },
    { key: "concession", label: "Concession", width: "15%", render: (r) => <span style={{ fontSize: 13, color: r.concessionAmount > 0 ? "var(--accent)" : "var(--text-muted)" }}>{r.concessionAmount > 0 ? `− ${formatPaise(r.concessionAmount)}` : "—"}</span> },
    { key: "net", label: "Net billed", width: "15%", render: (r) => <span style={{ fontSize: 13, fontWeight: 600 }}>{formatPaise(r.netAmount)}</span> },
    { key: "status", label: "Status", width: "13%", render: (r) => <Badge tone={ASSIGNMENT_STATUS_TONE[r.status]}>{r.status}</Badge> },
    { key: "since", label: "Since", width: "10%", render: (r) => <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{fmtDate(r.effectiveFrom)}</span> },
    {
      key: "act", label: "", width: "4%",
      render: () => <div style={{ display: "flex", justifyContent: "flex-end" }} aria-hidden="true"><Icon name="arrow-right" size={16} className="gv-row-chevron" /></div>,
    },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16, color: "var(--text-heading)" }}>Student assignments</h3>
        <div style={{ flex: 1 }} />
        <Select
          options={batches.map((c) => ({ value: c.id, label: c.name }))}
          value={batchId}
          onChange={(e) => handleBatchChange(e.target.value)}
          wrapperStyle={{ minWidth: 220 }}
        />
      </div>

      {error && (
        <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 16, padding: "10px 14px", border: "1px solid rgba(244,63,94,0.35)", background: "var(--danger-soft)", borderRadius: "var(--radius-md)" }}>{error}</p>
      )}

      {batches.length === 0 ? (
        <div className="gv-card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
          No batches yet — create one first, then assign a published fee structure to it.
        </div>
      ) : loading ? (
        <div className="gv-card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading assignments…</div>
      ) : rows.length === 0 ? (
        <div className="gv-card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
          No students are billed on this batch yet. Publish a structure and use &ldquo;Assign to a batch&rdquo; on it.
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          fixed
          onRowClick={(r) => router.push(`/coaching/fees/students/${r.studentId}?name=${encodeURIComponent(r.studentName)}`)}
        />
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { TeacherShell } from "@/components/dashboard/TeacherShell";
import { Button, DataTable, Icon, StatCard } from "@/components/ui";
import type { Column } from "@/components/ui";
import { StatusBadge } from "@/components/exam";
import {
  type ExamStatus, type ByStatusCounts,
  ADMIN_BUCKETS,
} from "@/lib/examStatus";

// ── Types ─────────────────────────────────────────────────────────────────────

type Role = "super_admin" | "coaching_owner" | "teacher" | "student";
type User = { id: string; name: string; role: Role };
type Tenant = { id: string; slug: string; name: string };

type Exam = {
  id: string;
  title: string;
  status: ExamStatus;
  visibility: "private" | "public_free" | "public_paid";
  durationMins: number;
  totalMarks: number;
  scheduledAt: string | null;
  endsAt: string | null;
  submittedAt: string | null;
  createdAt: string;
};

type ExamStats = {
  totalExams: number;
  byStatus: ByStatusCounts;
  approvalQueue: number;
  live: number;
  scheduled: number;
  underEvaluation: number;
  publicExams: number;
  totalMarks: number;
  totalAttempts: number;
  submittedAttempts: number;
  avgScorePct: number | null;
};

const VISIBILITY_LABEL: Record<Exam["visibility"], string> = {
  private: "Private",
  public_free: "Public · Free",
  public_paid: "Public · Paid",
};

// Which bucket a status belongs to (statuses not in any admin bucket — e.g.
// `draft` — are simply not shown in the admin hub).
const STATUS_TO_BUCKET: Partial<Record<ExamStatus, string>> = (() => {
  const m: Partial<Record<ExamStatus, string>> = {};
  for (const b of ADMIN_BUCKETS) for (const s of b.statuses) m[s] = b.key;
  return m;
})();

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ExamAdminPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [exams, setExams] = useState<Exam[]>([]);
  const [stats, setStats] = useState<ExamStats | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [bucket, setBucket] = useState<string>("queue");

  useEffect(() => {
    Promise.allSettled([
      api.get<{ user: User }>("/api/auth/get-session"),
      api.get<{ tenant: Tenant }>("/tenants/me"),
    ]).then(([sr, tr]) => {
      const u = sr.status === "fulfilled" ? sr.value?.user : null;
      if (!u) { router.push("/login"); return; }
      // Admin hub is owner-only; teachers/students bounce to their exams view.
      if (u.role !== "coaching_owner") { router.push("/exams"); return; }
      setUser(u);
      if (tr.status === "rejected") { router.push("/dashboard"); return; }
      const t = tr.value.tenant;
      setTenant(t);
      loadExams(t.slug).finally(() => setLoading(false));
    });
  }, [router]);

  async function loadExams(slug: string) {
    setListLoading(true); setPageError("");
    try {
      const [data, statsData] = await Promise.all([
        api.get<{ exams: Exam[] }>("/tenant/exams", { tenant: slug }),
        api.get<{ stats: ExamStats }>("/tenant/exams/stats", { tenant: slug }),
      ]);
      setExams(data.exams);
      setStats(statsData.stats);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Failed to load exams");
    } finally {
      setListLoading(false);
    }
  }

  const columns: Column<Exam>[] = [
    {
      key: "title",
      label: "Exam",
      width: "32%",
      render: (e) => (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-heading)" }}>{e.title}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {e.submittedAt ? `Submitted ${fmtWhen(e.submittedAt)}` : `Created ${new Date(e.createdAt).toLocaleDateString()}`}
          </div>
        </div>
      ),
    },
    { key: "status", label: "Status", width: "16%", render: (e) => <StatusBadge status={e.status} /> },
    {
      key: "window",
      label: "Window",
      width: "22%",
      render: (e) => (
        e.scheduledAt
          ? <span style={{ fontSize: 12.5, color: "var(--text-body)" }}>{fmtWhen(e.scheduledAt)}{e.endsAt ? ` → ${fmtWhen(e.endsAt)}` : ""}</span>
          : <span style={{ fontSize: 13, color: "var(--text-muted)" }}>—</span>
      ),
    },
    { key: "visibility", label: "Visibility", width: "14%", render: (e) => <span style={{ fontSize: 13, color: "var(--text-body)" }}>{VISIBILITY_LABEL[e.visibility]}</span> },
    {
      key: "act",
      label: "",
      width: "16%",
      render: (e) => (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button
            variant={e.status === "under_review" || e.status === "live" ? "app" : "secondary"}
            size="sm"
            onClick={() => router.push(`/exams/${e.id}`)}
          >
            {e.status === "under_review" ? "Review →" : e.status === "live" ? "Monitor →" : "Open →"}
          </Button>
        </div>
      ),
    },
  ];

  if (loading || !user || !tenant) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "var(--text-muted)" }}>
        Loading…
      </div>
    );
  }

  // Bucket counts + visible slice for the active tab.
  const counts = exams.reduce<Record<string, number>>((acc, e) => {
    const k = STATUS_TO_BUCKET[e.status];
    if (k) acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const visibleExams = exams.filter((e) => STATUS_TO_BUCKET[e.status] === bucket);
  const activeBucket = ADMIN_BUCKETS.find((b) => b.key === bucket);

  const num = (n: number | null | undefined) => (stats == null ? "…" : n == null ? "—" : String(n));

  return (
    <TeacherShell
      tenant={tenant}
      user={user}
      active="approvals"
      eyebrow="Assessments"
      title="Approvals & live"
      action={<Button variant="ghost" disabled={listLoading} onClick={() => loadExams(tenant.slug)}>{listLoading ? "Loading…" : "Refresh"}</Button>}
    >
      {pageError && (
        <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 16, padding: "10px 14px", border: "1px solid rgba(244,63,94,0.35)", background: "var(--danger-soft)", borderRadius: "var(--radius-md)" }}>{pageError}</p>
      )}

      {/* ── Headline tiles ────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14, marginBottom: 28 }}>
        <StatCard label="Awaiting review" value={num(stats?.approvalQueue)} sub="Submitted by teachers" />
        <StatCard label="Live now" value={num(stats?.live)} sub={stats ? `${stats.scheduled} scheduled` : " "} />
        <StatCard label="Under evaluation" value={num(stats?.underEvaluation)} sub="Awaiting results publish" />
        <StatCard label="Total exams" value={num(stats?.totalExams)} sub={stats ? `${stats.publicExams} public` : " "} />
      </div>

      {/* ── Bucket tabs ───────────────────────────────────────────────────── */}
      <div className="gv-fchips" role="group" aria-label="Filter exams" style={{ marginBottom: 16 }}>
        {ADMIN_BUCKETS.map((b) => (
          <button
            key={b.key}
            type="button"
            className="gv-fchip"
            aria-pressed={bucket === b.key}
            onClick={() => setBucket(b.key)}
          >
            {b.key === "queue" && <span className="gv-fchip-dot" style={{ background: "var(--warning)" }} />}
            {b.key === "live" && <span className="gv-fchip-dot" style={{ background: "var(--success)" }} />}
            {b.label}
            <span className="gv-fchip-count">{counts[b.key] ?? 0}</span>
          </button>
        ))}
      </div>

      {listLoading && exams.length === 0 ? (
        <div className="gv-card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading…</div>
      ) : visibleExams.length === 0 ? (
        <div className="gv-card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
          {bucket === "queue" ? (
            <span><Icon name="check-circle" size={16} style={{ verticalAlign: "-3px", marginRight: 6, color: "var(--success)" }} />Nothing awaiting review — you’re all caught up.</span>
          ) : (
            <>No exams in “{activeBucket?.label}” right now.</>
          )}
        </div>
      ) : (
        <DataTable columns={columns} rows={visibleExams} fixed />
      )}
    </TeacherShell>
  );
}

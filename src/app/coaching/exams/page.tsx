"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useTenantSession } from "@/lib/useTenantSession";
import { useUrlState } from "@/lib/useUrlState";
import { TeacherShell } from "@/components/dashboard/TeacherShell";
import { Button, Badge, DataTable, Icon, StatCard } from "@/components/ui";
import type { Column } from "@/components/ui";
import { StatusBadge } from "@/components/exam";
import {
  type ExamStatus, type ByStatusCounts,
  TEACHER_BUCKETS, ADMIN_BUCKETS, bucketsForRole, type StatusBucket,
} from "@/lib/examStatus";

// ── Types ─────────────────────────────────────────────────────────────────────

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
  createdAt: string;
};

// `GET /tenant/exams/stats` (11-status shape).
type ExamStats = {
  totalExams: number;
  byStatus: ByStatusCounts;
  approvalQueue: number;
  live: number;
  scheduled: number;
  underEvaluation: number;
  readyToPublish: number;
  publicExams: number;
  totalMarks: number;
  totalAttempts: number;
  submittedAttempts: number;
  avgScorePct: number | null;
};

// ── Schedule helpers ────────────────────────────────────────────────────────
// The lifecycle status is now the source of truth; scheduledAt/endsAt only drive
// the live countdowns for `scheduled` (opens in…) and `live` (ends in…) rows.

type ScheduleState = { kind: "upcoming" | "live"; opensInMs: number | null; endsInMs: number | null };

function scheduleOf(e: Exam, now: number): ScheduleState | null {
  if (e.status === "scheduled") {
    const opens = e.scheduledAt ? new Date(e.scheduledAt).getTime() : null;
    return { kind: "upcoming", opensInMs: opens != null ? opens - now : null, endsInMs: null };
  }
  if (e.status === "live") {
    const opens = e.scheduledAt ? new Date(e.scheduledAt).getTime() : null;
    const closes = e.endsAt ? new Date(e.endsAt).getTime()
      : opens ? opens + e.durationMins * 60_000 : null;
    return { kind: "live", opensInMs: null, endsInMs: closes != null ? closes - now : null };
  }
  return null;
}

function fmtWhen(ts: number): string {
  return new Date(ts).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// A compact live countdown: "2d 4h 12m" when far out, seconds when close.
function fmtCountdown(ms: number): string {
  if (ms <= 0) return "now";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

const VISIBILITY_LABEL: Record<Exam["visibility"], string> = {
  private: "Private",
  public_free: "Public · Free",
  public_paid: "Public · Paid",
};

// ── List filters ────────────────────────────────────────────────────────────
// "All" + the six teacher lifecycle buckets. Every status maps to exactly one.

// Each role groups the lifecycle differently — a teacher's hub opens on their
// Drafts, the owner's on the Approval Queue. Built per role rather than shared,
// because the owner has no draft bucket at all.
function statusToBucket(buckets: readonly StatusBucket[]): Record<ExamStatus, string> {
  const m = {} as Record<ExamStatus, string>;
  for (const b of buckets) for (const s of b.statuses) m[s] = b.key;
  return m;
}
const TEACHER_STATUS_TO_BUCKET = statusToBucket(TEACHER_BUCKETS);
const ADMIN_STATUS_TO_BUCKET = statusToBucket(ADMIN_BUCKETS);

// Every bucket key `?filter=` may legally carry, across both role groupings.
// The role's own list isn't known when the hook runs — the session is still
// resolving — so the accepted set is the union, and the render below narrows it
// to the buckets this role actually has.
const FILTER_KEYS: readonly string[] = [
  "all",
  ...new Set([...TEACHER_BUCKETS, ...ADMIN_BUCKETS].map((b) => b.key)),
];

// Keyed by bucket, across both role groupings (teacher and owner share
// `scheduled` / `live` / `evaluation`; the rest belong to one or the other).
const FILTER_DOT: Record<string, string> = {
  drafts: "var(--warning)",
  review: "var(--warning)",
  queue: "var(--warning)",
  scheduled: "var(--accent)",
  live: "var(--success)",
  evaluation: "var(--warning)",
  published: "var(--success)",
  changes: "var(--danger)",
  closed: "var(--text-muted)",
};

// ── Page ──────────────────────────────────────────────────────────────────────

function ExamsHubInner() {
  const router = useRouter();
  const { loading, user, tenant, role } = useTenantSession<Tenant>({
    allow: ["coaching_owner", "teacher"],
  });

  const [pageError, setPageError] = useState("");
  const [exams, setExams] = useState<Exam[]>([]);
  const [stats, setStats] = useState<ExamStats | null>(null);
  const [listLoading, setListLoading] = useState(true);
  // `?filter=live` — survives a refresh and is linkable, so "the three papers
  // stuck in evaluation" is a URL you can paste to the teacher who owns them.
  const [filter, setFilter] = useUrlState("filter", FILTER_KEYS, "all");
  const [now, setNow] = useState(() => Date.now());

  // Tick every second so schedule countdowns stay live.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchExams = useCallback(async (slug: string) => {
    const [data, statsData] = await Promise.all([
      api.get<{ exams: Exam[] }>("/tenant/exams", { tenant: slug }),
      api.get<{ stats: ExamStats }>("/tenant/exams/stats", { tenant: slug }),
    ]);
    return { exams: data.exams, stats: statsData.stats };
  }, []);

  // Refresh button — an event handler, so setting state up-front is fine here.
  async function handleRefresh() {
    if (!tenant) return;
    setListLoading(true); setPageError("");
    try {
      const res = await fetchExams(tenant.slug);
      setExams(res.exams);
      setStats(res.stats);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Failed to load exams");
    } finally {
      setListLoading(false);
    }
  }

  // Initial load. `listLoading` starts true, so state is only ever touched in
  // the async continuation rather than synchronously in the effect body.
  useEffect(() => {
    if (!tenant) return;
    let cancelled = false;
    fetchExams(tenant.slug)
      .then((res) => {
        if (cancelled) return;
        setExams(res.exams);
        setStats(res.stats);
      })
      .catch((err) => {
        if (!cancelled) setPageError(err instanceof Error ? err.message : "Failed to load exams");
      })
      .finally(() => { if (!cancelled) setListLoading(false); });
    return () => { cancelled = true; };
  }, [tenant, fetchExams]);

  const columns: Column<Exam>[] = [
    {
      key: "title",
      label: "Exam",
      width: "30%",
      render: (e) => (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-heading)" }}>{e.title}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            Created {new Date(e.createdAt).toLocaleDateString()}
          </div>
        </div>
      ),
    },
    // 20% is sized off the longest label the lifecycle can produce ("Changes
    // Requested") so the pill never has to wrap or spill into Schedule.
    { key: "status", label: "Status", width: "20%", render: (e) => <StatusBadge status={e.status} /> },
    {
      key: "schedule",
      label: "Schedule",
      width: "20%",
      render: (e) => {
        const sc = scheduleOf(e, now);
        if (!sc) return <span style={{ fontSize: 13, color: "var(--text-muted)" }}>—</span>;

        if (sc.kind === "live") {
          return (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span className="gv-live-badge"><span className="gv-live-dot" />Live</span>
              {sc.endsInMs != null && (
                <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>ends in {fmtCountdown(sc.endsInMs)}</span>
              )}
            </span>
          );
        }

        // Scheduled — opens in…
        return (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Icon name="clock" size={13} style={{ color: "var(--accent)", flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: "var(--text-body)" }}>
              {e.scheduledAt ? `Opens ${fmtWhen(new Date(e.scheduledAt).getTime())}` : "Scheduled"}
            </span>
            {sc.opensInMs != null && (
              <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--accent)", fontWeight: 600 }}>· {fmtCountdown(sc.opensInMs)}</span>
            )}
          </span>
        );
      },
    },
    { key: "visibility", label: "Visibility", width: "15%", render: (e) => <span style={{ fontSize: 13, color: "var(--text-body)", whiteSpace: "nowrap" }}>{VISIBILITY_LABEL[e.visibility]}</span> },
    { key: "marks", label: "Marks", width: "8%", render: (e) => <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{e.totalMarks}</span> },
    // No per-row "Manage" button: the whole row navigates to the exam, the same
    // way a class card does on /classes. This column is just the affordance.
    {
      key: "act",
      label: "",
      width: "7%",
      render: () => (
        <div style={{ display: "flex", justifyContent: "flex-end" }} aria-hidden="true">
          <Icon name="arrow-right" size={16} className="gv-row-chevron" />
        </div>
      ),
    },
  ];

  if (loading || !user || !tenant) return <PageLoading />;

  // Scheduled exams opening in the future, soonest first.
  const upcoming = exams
    .map((e) => ({ e, sc: scheduleOf(e, now) }))
    .filter((x): x is { e: Exam; sc: ScheduleState & { opensInMs: number } } => x.sc?.kind === "upcoming" && x.sc.opensInMs != null && x.sc.opensInMs > 0)
    .sort((a, b) => a.sc.opensInMs - b.sc.opensInMs);
  const nextUp = upcoming[0];

  // Per-bucket counts + the visible slice, in this role's grouping.
  const isOwnerView = role === "coaching_owner";
  const buckets = bucketsForRole(role);
  const statusBucket = isOwnerView ? ADMIN_STATUS_TO_BUCKET : TEACHER_STATUS_TO_BUCKET;
  const counts = exams.reduce<Record<string, number>>((acc, e) => {
    const k = statusBucket[e.status];
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  // A `?filter=` naming the *other* role's bucket (a shared link, a bookmark
  // kept after a role change) would otherwise render a permanently empty list
  // with no chip highlighted. Fall back to "All" instead.
  const activeFilter = filter === "all" || buckets.some((b) => b.key === filter) ? filter : "all";
  const visibleExams = activeFilter === "all" ? exams : exams.filter((e) => statusBucket[e.status] === activeFilter);
  const activeLabel = activeFilter === "all" ? "" : (buckets.find((b) => b.key === activeFilter)?.label.toLowerCase() ?? "");

  const num = (n: number | null | undefined) => (stats == null ? "…" : n == null ? "—" : String(n));

  return (
    <TeacherShell
      tenant={tenant}
      user={user}
      role={role}
      active="exams"
      eyebrow="Assessments"
      title="Exams"
      action={
        // Authoring entry point — teachers only. The owner's equivalent action
        // is reviewing what has been submitted to them.
        isOwnerView
          ? <Button variant="secondary" size="lg" icon={<Icon name="check-circle" size={16} />} onClick={() => router.push("/coaching/exams/approvals")}>Approval queue</Button>
          : <Button variant="app" size="lg" icon={<Icon name="sparkles" size={16} />} onClick={() => router.push("/coaching/test-engine")}>Generate a paper</Button>
      }
    >
      {pageError && (
        <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 16, padding: "10px 14px", border: "1px solid rgba(244,63,94,0.35)", background: "var(--danger-soft)", borderRadius: "var(--radius-md)" }}>{pageError}</p>
      )}

      {/* ── KPI stat cards ────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14, marginBottom: 28 }}>
        <StatCard
          label="Total exams"
          value={num(stats?.totalExams)}
          // An owner's list excludes drafts, so quoting a draft count here would
          // contradict the list below it.
          sub={stats ? (isOwnerView ? `${stats.approvalQueue} awaiting review` : `${stats.byStatus.draft} draft · ${stats.approvalQueue} in review`) : " "}
        />
        <StatCard
          label="Live now"
          value={num(stats?.live)}
          sub={stats ? `${stats.scheduled} scheduled` : " "}
        />
        <StatCard
          label="Awaiting results"
          value={num(stats?.underEvaluation)}
          // The sub-line is the actionable half: exams whose marks are computed
          // and sitting behind a publish click, not the ones already out.
          sub={stats ? `${stats.byStatus.ready_to_publish} ready to publish` : " "}
        />
        <StatCard
          label="Attempts taken"
          value={num(stats?.totalAttempts)}
          sub={stats ? `${stats.submittedAttempts} submitted` : " "}
        />
        <StatCard
          label="Avg score"
          value={stats == null ? "…" : stats.avgScorePct == null ? "—" : `${stats.avgScorePct}%`}
          sub={stats && stats.submittedAttempts === 0 ? "No results yet" : "Across graded results"}
        />
      </div>

      {/* ── Next-to-open highlight ────────────────────────────────────────── */}
      {nextUp && (
        <button
          onClick={() => router.push(`/coaching/exams/${nextUp.e.id}`)}
          style={{
            width: "100%", textAlign: "left", cursor: "pointer", marginBottom: 28,
            display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
            padding: "16px 20px", borderRadius: 14,
            border: "1px solid rgba(99,102,241,.30)", background: "var(--accent-soft)",
          }}
        >
          <span style={{ width: 40, height: 40, borderRadius: 11, background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon name="clock" size={20} />
          </span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--accent)" }}>Next exam opens</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-heading)", marginTop: 2 }}>{nextUp.e.title}</div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 1 }}>Opens {fmtWhen(new Date(nextUp.e.scheduledAt!).getTime())}</div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 26, fontWeight: 700, letterSpacing: "-.02em", color: "var(--text-heading)", lineHeight: 1 }}>{fmtCountdown(nextUp.sc.opensInMs)}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>until it opens</div>
          </div>
        </button>
      )}

      {/* ── Exam list ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 16, color: "var(--text-heading)" }}>All exams</h3>
        <Badge tone="neutral">{exams.length}</Badge>
        <div style={{ flex: 1 }} />
        <Button variant="ghost" size="sm" disabled={listLoading} onClick={handleRefresh}>
          {listLoading ? "Loading…" : "Refresh"}
        </Button>
      </div>

      {/* Filter chips — this role's six lifecycle buckets */}
      <div className="gv-fchips" role="group" aria-label="Filter exams" style={{ marginBottom: 16 }}>
        {[{ key: "all", label: "All" } as StatusBucket & { label: string }, ...buckets].map((b) => {
          const count = b.key === "all" ? exams.length : counts[b.key] ?? 0;
          return (
            <button
              key={b.key}
              type="button"
              className="gv-fchip"
              aria-pressed={activeFilter === b.key}
              onClick={() => setFilter(b.key)}
            >
              {FILTER_DOT[b.key] && <span className="gv-fchip-dot" style={{ background: FILTER_DOT[b.key] }} />}
              {b.label}
              <span className="gv-fchip-count">{count}</span>
            </button>
          );
        })}
      </div>

      {listLoading && exams.length === 0 ? (
        <div className="gv-card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading exams…</div>
      ) : exams.length === 0 ? (
        <div className="gv-card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
          {isOwnerView
            ? "No exams have been submitted to you yet. Papers appear here once a teacher submits them for review."
            : "No exams yet. Use “Generate a paper” to build one from your question bank."}
        </div>
      ) : visibleExams.length === 0 ? (
        <div className="gv-card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
          No {activeLabel} exams right now.{" "}
          <button
            type="button"
            onClick={() => setFilter("all")}
            style={{ background: "none", border: "none", padding: 0, color: "var(--accent)", fontWeight: 600, cursor: "pointer" }}
          >
            Show all
          </button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={visibleExams}
          fixed
          onRowClick={(e) => router.push(`/coaching/exams/${e.id}`)}
        />
      )}
    </TeacherShell>
  );
}

// ── Suspense wrapper (required for useSearchParams) ──────────────────────────

export default function ExamsHubPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ExamsHubInner />
    </Suspense>
  );
}

function PageLoading() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "var(--text-muted)" }}>
      Loading…
    </div>
  );
}

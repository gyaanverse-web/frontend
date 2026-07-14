"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { TeacherShell } from "@/components/dashboard/TeacherShell";
import { Button, Badge, DataTable, Icon, StatCard } from "@/components/ui";
import type { Column, BadgeTone } from "@/components/ui";

// ── Types ─────────────────────────────────────────────────────────────────────

type Role = "super_admin" | "coaching_owner" | "teacher" | "student";
type User = { id: string; name: string; role: Role };
type Tenant = { id: string; slug: string; name: string };

type Exam = {
  id: string;
  title: string;
  status: "draft" | "published" | "archived";
  visibility: "private" | "public_free" | "public_paid";
  durationMins: number;
  totalMarks: number;
  scheduledAt: string | null;
  endsAt: string | null;
  createdAt: string;
};

// ── Schedule helpers ────────────────────────────────────────────────────────

// - upcoming: scheduled, hasn't opened yet
// - live:     inside a timed window (ends at endsAt, or scheduledAt + duration)
// - open:     published with no schedule at all → always available
// - closed:   its timed window has passed
type ScheduleKind = "upcoming" | "live" | "open" | "closed";
type ScheduleState = { kind: ScheduleKind; label: string; opensInMs: number | null; endsInMs: number | null };

// Derive an exam's live schedule state relative to `now`. Only published exams
// carry a meaningful schedule; drafts/archived return null (shown as "—").
function scheduleOf(e: Exam, now: number): ScheduleState | null {
  if (e.status !== "published") return null;
  const opens = e.scheduledAt ? new Date(e.scheduledAt).getTime() : null;
  // The live window closes at an explicit endsAt, or — if only an open time is
  // set — one exam-duration after it opens. No schedule ⇒ always open.
  const closes = e.endsAt ? new Date(e.endsAt).getTime()
    : opens ? opens + e.durationMins * 60_000 : null;
  if (opens && opens > now) return { kind: "upcoming", label: `Opens ${fmtWhen(opens)}`, opensInMs: opens - now, endsInMs: null };
  if (closes && closes <= now) return { kind: "closed", label: "Closed", opensInMs: null, endsInMs: null };
  if (closes) return { kind: "live", label: "Live", opensInMs: null, endsInMs: closes - now };
  return { kind: "open", label: "Open now", opensInMs: null, endsInMs: null };
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

const STATUS_TONE: Record<Exam["status"], BadgeTone> = {
  published: "success",
  draft: "warning",
  archived: "neutral",
};

const VISIBILITY_LABEL: Record<Exam["visibility"], string> = {
  private: "Private",
  public_free: "Public · Free",
  public_paid: "Public · Paid",
};

// ── List filters ────────────────────────────────────────────────────────────

// Every exam falls into exactly one bucket. Drafts/archived are terminal
// statuses; published exams are bucketed by their live schedule state, so the
// same exam moves from "upcoming" → "live" → "closed" as time passes.
type FilterKey = "all" | "live" | "open" | "upcoming" | "draft" | "closed" | "archived";

function bucketOf(e: Exam, now: number): Exclude<FilterKey, "all"> {
  if (e.status === "draft") return "draft";
  if (e.status === "archived") return "archived";
  return scheduleOf(e, now)?.kind ?? "open";
}

const FILTERS: { key: FilterKey; label: string; dot?: string }[] = [
  { key: "all", label: "All" },
  { key: "live", label: "Live", dot: "var(--success)" },
  { key: "open", label: "Open now", dot: "var(--success)" },
  { key: "upcoming", label: "Upcoming", dot: "var(--warning)" },
  { key: "draft", label: "Draft", dot: "var(--warning)" },
  { key: "closed", label: "Closed", dot: "var(--text-muted)" },
  { key: "archived", label: "Archived", dot: "var(--text-muted)" },
];

type ExamStats = {
  totalExams: number;
  published: number;
  draft: number;
  archived: number;
  publicExams: number;
  totalMarks: number;
  totalAttempts: number;
  submittedAttempts: number;
  avgScorePct: number | null;
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ExamsHubPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [exams, setExams] = useState<Exam[]>([]);
  const [stats, setStats] = useState<ExamStats | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [now, setNow] = useState(() => Date.now());

  // Tick every second so schedule countdowns stay live.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    Promise.allSettled([
      api.get<{ user: User }>("/api/auth/get-session"),
      api.get<{ tenant: Tenant }>("/tenants/me"),
    ]).then(([sr, tr]) => {
      if (sr.status === "rejected") { router.push("/login"); return; }
      const u = sr.value?.user;
      if (!u) { router.push("/login"); return; }
      if (u.role === "student") { router.push("/dashboard"); return; }
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
      width: "26%",
      render: (e) => (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-heading)" }}>{e.title}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            Created {new Date(e.createdAt).toLocaleDateString()}
          </div>
        </div>
      ),
    },
    { key: "status", label: "Status", width: "12%", render: (e) => <Badge tone={STATUS_TONE[e.status]}>{e.status}</Badge> },
    {
      key: "schedule",
      label: "Schedule",
      width: "20%",
      render: (e) => {
        const sc = scheduleOf(e, now);
        if (!sc) return <span style={{ fontSize: 13, color: "var(--text-muted)" }}>—</span>;

        // Currently running in a timed window — pulsing "LIVE" pill + time left.
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

        // Always available (no schedule) — steady green pill, no pulse.
        if (sc.kind === "open") {
          return (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, color: "var(--success)", background: "var(--success-soft)", border: "1px solid rgba(16,185,129,.28)" }}>
              <Icon name="clock" size={12} style={{ flexShrink: 0 }} />Open
            </span>
          );
        }

        // Upcoming (with countdown) or closed.
        const upcoming = sc.kind === "upcoming";
        return (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Icon name="clock" size={13} style={{ color: upcoming ? "var(--warning)" : "var(--text-muted)", flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: "var(--text-body)" }}>{sc.label}</span>
            {sc.opensInMs != null && (
              <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--warning)", fontWeight: 600 }}>· {fmtCountdown(sc.opensInMs)}</span>
            )}
          </span>
        );
      },
    },
    { key: "visibility", label: "Visibility", width: "14%", render: (e) => <span style={{ fontSize: 13, color: "var(--text-body)" }}>{VISIBILITY_LABEL[e.visibility]}</span> },
    { key: "marks", label: "Marks", width: "9%", render: (e) => <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{e.totalMarks}</span> },
    { key: "mins", label: "Duration", width: "9%", render: (e) => <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{e.durationMins} min</span> },
    {
      key: "act",
      label: "",
      width: "10%",
      render: (e) => (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button variant="secondary" size="sm" onClick={() => router.push(`/exams/${e.id}`)}>Manage →</Button>
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

  // Published exams scheduled to open in the future, soonest first.
  const upcoming = exams
    .map((e) => ({ e, sc: scheduleOf(e, now) }))
    .filter((x): x is { e: Exam; sc: ScheduleState & { opensInMs: number } } => x.sc?.opensInMs != null)
    .sort((a, b) => a.sc.opensInMs - b.sc.opensInMs);
  const nextUp = upcoming[0];

  // Bucket every exam once, then derive per-filter counts and the visible slice.
  const buckets = exams.map((e) => bucketOf(e, now));
  const counts = buckets.reduce<Record<string, number>>((acc, b) => {
    acc[b] = (acc[b] ?? 0) + 1;
    return acc;
  }, {});
  const visibleExams = filter === "all" ? exams : exams.filter((_, i) => buckets[i] === filter);
  const activeLabel = FILTERS.find((f) => f.key === filter)?.label.toLowerCase() ?? "";

  return (
    <TeacherShell
      tenant={tenant}
      user={user}
      active="exams"
      eyebrow="Assessments"
      title="Exams"
      action={<Button variant="app" size="lg" icon={<Icon name="sparkles" size={16} />} onClick={() => router.push("/test-engine")}>Generate a paper</Button>}
    >
      {pageError && (
        <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 16, padding: "10px 14px", border: "1px solid rgba(244,63,94,0.35)", background: "var(--danger-soft)", borderRadius: "var(--radius-md)" }}>{pageError}</p>
      )}

      {/* ── KPI stat cards ────────────────────────────────────────────────── */}
      {(() => {
        const num = (n: number | null | undefined) => (stats == null ? "…" : n == null ? "—" : String(n));
        return (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14, marginBottom: 28 }}>
            <StatCard
              label="Total exams"
              value={num(stats?.totalExams)}
              sub={stats ? `${stats.published} published · ${stats.draft} draft` : " "}
            />
            <StatCard
              label="Published"
              value={num(stats?.published)}
              sub={stats ? `${stats.publicExams} public · ${stats.archived} archived` : " "}
            />
            <StatCard
              label="Attempts taken"
              value={num(stats?.totalAttempts)}
              sub={stats ? `${stats.submittedAttempts} submitted` : " "}
            />
            <StatCard
              label="Avg score"
              value={stats == null ? "…" : stats.avgScorePct == null ? "—" : `${stats.avgScorePct}%`}
              sub={stats && stats.submittedAttempts === 0 ? "No results yet" : "Across graded results"}
            />
            <StatCard
              label="Upcoming"
              value={String(upcoming.length)}
              sub={nextUp ? `Next opens in ${fmtCountdown(nextUp.sc.opensInMs)}` : "None scheduled"}
            />
          </div>
        );
      })()}

      {/* ── Next-to-open highlight ────────────────────────────────────────── */}
      {nextUp && (
        <button
          onClick={() => router.push(`/exams/${nextUp.e.id}`)}
          style={{
            width: "100%", textAlign: "left", cursor: "pointer", marginBottom: 28,
            display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
            padding: "16px 20px", borderRadius: 14,
            border: "1px solid rgba(245,158,11,.35)", background: "var(--warning-soft)",
          }}
        >
          <span style={{ width: 40, height: 40, borderRadius: 11, background: "var(--warning)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon name="clock" size={20} />
          </span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--warning)" }}>Next exam opens</div>
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
        <Button variant="ghost" size="sm" disabled={listLoading} onClick={() => loadExams(tenant.slug)}>
          {listLoading ? "Loading…" : "Refresh"}
        </Button>
      </div>

      {/* Filter chips — filter the list in place by status / live schedule state */}
      <div className="gv-fchips" role="group" aria-label="Filter exams" style={{ marginBottom: 16 }}>
        {FILTERS.map((f) => {
          const count = f.key === "all" ? exams.length : counts[f.key] ?? 0;
          return (
            <button
              key={f.key}
              type="button"
              className="gv-fchip"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
            >
              {f.dot && <span className="gv-fchip-dot" style={{ background: f.dot }} />}
              {f.label}
              <span className="gv-fchip-count">{count}</span>
            </button>
          );
        })}
      </div>

      {listLoading && exams.length === 0 ? (
        <div className="gv-card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading exams…</div>
      ) : exams.length === 0 ? (
        <div className="gv-card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
          No exams yet. Use “Generate a paper” to build one from your question bank.
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
        <DataTable columns={columns} rows={visibleExams} fixed />
      )}
    </TeacherShell>
  );
}

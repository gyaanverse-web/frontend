"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { TeacherShell } from "@/components/dashboard/TeacherShell";
import { Button, Card, Badge, Icon, StatCard } from "@/components/ui";
import { ProgressRing, ScoreTrendChart, JoinCoachingCard } from "./StudentBits";

type ShellUser = { name: string; role?: string };
type ShellTenant = { name: string; slug: string } | null;

// ── Backend contracts (listAvailableExamsForStudent / listReportsForStudent) ──
type SessionSummary = { id: string; status: string; startedAt: string };

type ApiExam = {
  id: string;
  title: string;
  durationMins: number;
  status: string; // scheduled | live | under_evaluation | ready_to_publish | completed
  totalMarks: number;
  maxAttempts: number;
  scheduledAt: string | null;
  endsAt: string | null;
  mySessions?: SessionSummary[];
};

type ReportSummary = {
  id: string;
  sessionId: string;
  examId: string;
  examTitle: string;
  totalScore: number;
  maxScore: number;
  status: "pending" | "ready" | "archived";
  publishedAt: string | null;
  createdAt: string;
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function fmtWhen(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function pctOf(r: ReportSummary): number {
  return r.maxScore > 0 ? Math.round((r.totalScore / r.maxScore) * 100) : 0;
}

export function StudentHome({ user, tenant }: { user: ShellUser; tenant: ShellTenant }) {
  const router = useRouter();
  const firstName = (user.name ?? "").trim().split(/\s+/)[0] || "there";

  const [exams, setExams] = useState<ApiExam[]>([]);
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get<{ exams: ApiExam[] }>("/tenant/exams").catch(() => ({ exams: [] as ApiExam[] })),
      api.get<{ reports: ReportSummary[] }>("/reports").catch(() => ({ reports: [] as ReportSummary[] })),
    ]).then(([e, r]) => {
      if (cancelled) return;
      setExams(e.exams);
      setReports(r.reports);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  // Live exam with an active session → "continue" hero card.
  const inProgress = useMemo(
    () => exams.find((e) => e.status === "live" && (e.mySessions ?? []).some((s) => s.status === "in_progress")),
    [exams],
  );

  // Live (attemptable) first, then upcoming scheduled — the "due soon" rail.
  const dueSoon = useMemo(() => {
    const live = exams.filter(
      (e) => e.status === "live"
        && !(e.mySessions ?? []).some((s) => s.status === "in_progress")
        && (e.mySessions ?? []).length < e.maxAttempts,
    );
    const upcoming = exams
      .filter((e) => e.status === "scheduled")
      .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));
    return [...live, ...upcoming].slice(0, 6);
  }, [exams]);

  const liveCount = exams.filter((e) => e.status === "live").length;
  const upcomingCount = exams.filter((e) => e.status === "scheduled").length;
  const avgPct = reports.length
    ? Math.round(reports.reduce((s, r) => s + pctOf(r), 0) / reports.length)
    : null;
  // ScoreTrendChart's y-axis starts at 40 — clamp so low scores stay on-chart.
  const trend = [...reports].reverse().map((r) => Math.max(41, pctOf(r)));
  const recent = reports.slice(0, 3);

  return (
    <TeacherShell tenant={tenant} user={user} role="student" active="home" noCoaching={!tenant}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          {/* ── Greeting ─────────────────────────────────────────────────── */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 4 }}>
            <h2 style={{ fontSize: 27, margin: 0 }}>
              {greeting()}, {firstName}
            </h2>
            {liveCount > 0 && <Badge tone="success">{liveCount} live now</Badge>}
          </div>
          <p style={{ fontSize: 15, margin: "2px 0 22px", color: "var(--text-body)" }}>
            {loading
              ? "Loading your exams…"
              : !tenant
                ? "You're set up and ready — take any public mock below, or join your coaching to get their exams too."
                : liveCount > 0
                  ? <>You have <strong style={{ color: "var(--text-heading)" }}>{liveCount} exam{liveCount !== 1 ? "s" : ""}</strong> open right now.</>
                  : upcomingCount > 0
                    ? <><strong style={{ color: "var(--text-heading)" }}>{upcomingCount} exam{upcomingCount !== 1 ? "s" : ""}</strong> coming up — check the schedule below.</>
                    : "No exams due right now — nice time to review your results."}
          </p>

          {/* Coaching-less students get the join prompt here rather than as a
              blocking screen — everything below already works without one. */}
          {!loading && !tenant && <JoinCoachingCard />}

          {/* ── Continue where you left off ──────────────────────────────── */}
          {inProgress && (
            <Card padding={0} style={{ marginBottom: 24, borderColor: "var(--accent)", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 20, padding: 22, background: "var(--accent-soft)" }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--surface-card)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                  <Icon name="file-text" size={22} style={{ color: "var(--accent)" }} />
                </div>
                <div style={{ flex: 1, lineHeight: 1.4 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent)" }}>
                    Continue where you left off
                  </div>
                  <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 19, color: "var(--text-heading)", marginTop: 2 }}>
                    {inProgress.title}
                  </div>
                  <div style={{ fontSize: 13.5, color: "var(--text-body)", marginTop: 2 }}>
                    Attempt in progress{inProgress.endsAt ? ` · closes ${fmtWhen(inProgress.endsAt)}` : ""}
                  </div>
                </div>
                <Button variant="app" size="lg" arrow onClick={() => router.push(`/student/exams/${inProgress.id}/attempt`)}>
                  Resume
                </Button>
              </div>
            </Card>
          )}

          {/* ── Due soon (live + upcoming scheduled) ─────────────────────── */}
          {dueSoon.length > 0 && (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <h3 style={{ fontSize: 17, margin: 0 }}>Due soon</h3>
                <Button variant="ghost" size="sm" onClick={() => router.push("/student/exams")}>See all</Button>
              </div>
              <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 4, marginBottom: 28 }}>
                {dueSoon.map((e) => {
                  const isLive = e.status === "live";
                  const left = Math.max(0, e.maxAttempts - (e.mySessions ?? []).length);
                  return (
                    <Card key={e.id} padding={18} style={{ minWidth: 260, display: "flex", flexDirection: "column", gap: 10, flex: "none" }}>
                      <Badge tone={isLive ? "success" : "neutral"}>{isLive ? "Live now" : "Upcoming"}</Badge>
                      <h4 style={{ margin: 0, fontSize: 15, lineHeight: 1.35, color: "var(--text-heading)" }}>{e.title}</h4>
                      <div style={{ fontFamily: "var(--font-body)", fontSize: 12.5, color: "var(--text-muted)", display: "flex", gap: 8 }}>
                        <span>{e.durationMins} min</span>
                        <span>·</span>
                        <span>{e.totalMarks} marks</span>
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--text-body)" }}>
                        {isLive
                          ? `${e.endsAt ? `Closes ${fmtWhen(e.endsAt)}` : "Open now"} · ${left}/${e.maxAttempts} attempts left`
                          : e.scheduledAt ? `Starts ${fmtWhen(e.scheduledAt)}` : "Scheduled"}
                      </div>
                      <Button
                        variant={isLive ? "app" : "secondary"}
                        size="sm"
                        style={{ marginTop: 4 }}
                        disabled={!isLive}
                        onClick={() => router.push(`/student/exams/${e.id}/intro`)}
                      >
                        {isLive ? "Start" : "Locked"}
                      </Button>
                    </Card>
                  );
                })}
              </div>
            </>
          )}

          {/* ── Progress chart + KPIs ────────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 24, marginBottom: 28, alignItems: "start" }}>
            <Card padding={20}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <h4 style={{ margin: 0, color: "var(--text-heading)" }}>Your progress</h4>
                <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                  {trend.length >= 2 ? `Last ${trend.length} results` : "Awaiting results"}
                </span>
              </div>
              {trend.length >= 2 ? (
                <ScoreTrendChart pts={trend} />
              ) : (
                <p style={{ margin: "18px 0", fontSize: 13.5, color: "var(--text-muted)" }}>
                  Your score trend appears here once you have a couple of published results.
                </p>
              )}
            </Card>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <StatCard label="Results" value={String(reports.length)} />
              <StatCard label="Avg. score" value={avgPct !== null ? `${avgPct}%` : "—"} />
              <StatCard label="Live now" value={String(liveCount)} />
              <StatCard label="Upcoming" value={String(upcomingCount)} />
            </div>
          </div>

          {/* ── Recent results ───────────────────────────────────────────── */}
          {recent.length > 0 && (
            <>
              <h3 style={{ fontSize: 17, margin: "0 0 12px" }}>Recent results</h3>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(3, recent.length)}, 1fr)`, gap: 16, marginBottom: 28 }}>
                {recent.map((r) => {
                  const pct = pctOf(r);
                  return (
                    <Card key={r.id} padding={16} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <ProgressRing pct={pct} size={48} label={`${pct}%`} />
                      <div style={{ flex: 1, lineHeight: 1.35 }}>
                        <div style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 14.5, color: "var(--text-heading)" }}>{r.examTitle}</div>
                        <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                          {r.status === "pending" ? "AI review pending" : `${r.totalScore}/${r.maxScore} (${pct}%)`}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => router.push(`/student/exams/${r.examId}/result?session=${r.sessionId}`)}>
                        View report
                      </Button>
                    </Card>
                  );
                })}
              </div>
            </>
          )}

          {/* ── Marketplace promo ────────────────────────────────────────── */}
          <Card dark padding={20} style={{ display: "flex", alignItems: "center", gap: 18, border: "none" }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
              <Icon name="store" size={21} style={{ color: "var(--text-accent)" }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 16, color: "var(--text-heading)" }}>
                Explore the public mock marketplace
              </div>
              <p style={{ fontSize: 13.5, margin: "2px 0 0", color: "var(--text-body)" }}>Free and paid mocks from institutes across India.</p>
            </div>
            <Button variant="secondary" arrow onClick={() => router.push("/mocks")}>
              Browse mocks
            </Button>
          </Card>
      </div>
    </TeacherShell>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { TeacherShell } from "@/components/dashboard/TeacherShell";
import { Card, Badge, Button, Icon } from "@/components/ui";
import { ProgressRing } from "./StudentBits";

type ShellUser = { name: string; role?: string };
type ShellTenant = { name: string; slug: string } | null;

// ── Backend contract (mirror listReportsForStudent → ReportSummary) ───────────
// Private-exam reports only appear here once the teacher publishes results;
// public (self-paced) exam reports show as soon as they're evaluated.
type ReportSummary = {
  id: string;
  sessionId: string;
  examId: string;
  examTitle: string;
  totalScore: number;
  maxScore: number;
  autoScore: number;
  aiScore: number;
  status: "pending" | "ready" | "archived";
  publishedAt: string | null;
  createdAt: string;
};

function pctOf(r: ReportSummary): number {
  return r.maxScore > 0 ? Math.round((r.totalScore / r.maxScore) * 100) : 0;
}

/** Average-score trend sparkline over recent attempts (oldest → newest). */
function ReportTrendChart({ pts }: { pts: number[] }) {
  const w = 760, h = 130, pad = 8, max = 100, min = 0;
  if (pts.length < 2) return null;
  const coords = pts.map((v, i) => [pad + (i * (w - pad * 2)) / (pts.length - 1), h - pad - ((v - min) / (max - min)) * (h - pad * 2)] as const);
  const line = coords.map((c, i) => (i === 0 ? "M" : "L") + c[0] + "," + c[1]).join(" ");
  const last = coords[coords.length - 1];
  const area = `${line} L${last[0]},${h - pad} L${coords[0][0]},${h - pad} Z`;
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
      <defs>
        <linearGradient id="rpFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#rpFill)" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((c, i) => (
        <circle
          key={i}
          cx={c[0]}
          cy={c[1]}
          r={i === coords.length - 1 ? 4 : 3}
          fill={i === coords.length - 1 ? "var(--accent)" : "var(--surface-card)"}
          stroke="var(--accent)"
          strokeWidth="2"
        />
      ))}
    </svg>
  );
}

function ReportRow({ r, onView }: { r: ReportSummary; onView: (r: ReportSummary) => void }) {
  const pct = pctOf(r);
  const pending = r.status === "pending";
  const date = new Date(r.publishedAt ?? r.createdAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  const hasAi = r.aiScore > 0 || pending;
  return (
    <Card padding={16} style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <ProgressRing pct={pct} size={44} label={`${pct}%`} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 14.5, color: "var(--text-heading)" }}>{r.examTitle}</span>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
          {date} · {pending ? "Score pending" : `${r.totalScore}/${r.maxScore} (${pct}%)`}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Badge tone="neutral">Auto {r.autoScore}</Badge>
        {hasAi && <Badge tone={pending ? "warning" : "accent"}>{pending ? "AI review pending" : `AI ${r.aiScore}`}</Badge>}
      </div>
      <Badge tone={pending ? "warning" : "success"}>{pending ? "AI review pending" : "Result ready"}</Badge>
      <Button variant="ghost" size="sm" onClick={() => onView(r)}>View</Button>
    </Card>
  );
}

export function StudentReportsHistory({ user, tenant }: { user: ShellUser; tenant: ShellTenant }) {
  const router = useRouter();

  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api.get<{ reports: ReportSummary[] }>("/reports")
      .then((res) => { if (!cancelled) setReports(res.reports); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load your results."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Oldest → newest for the trend line.
  const trend = useMemo(
    () => [...reports].reverse().map(pctOf),
    [reports],
  );

  function viewReport(r: ReportSummary) {
    router.push(`/exams/${r.examId}/result?session=${r.sessionId}`);
  }

  if (!loading && !error && reports.length === 0) {
    return <StudentReportsEmpty user={user} tenant={tenant} />;
  }

  return (
    <TeacherShell tenant={tenant} user={user} active="results" noCoaching={!tenant}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
            Progress hub
          </div>
          <h2 style={{ fontSize: 26, margin: 0 }}>My results</h2>
        </div>

        {loading && (
          <div style={{ padding: "60px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading your results…</div>
        )}

        {!loading && error && (
          <Card padding={20} style={{ color: "var(--danger)", fontSize: 14.5 }}>{error}</Card>
        )}

        {!loading && !error && (
          <>
            {/* ── Average score trend ──────────────────────────────────────── */}
            {trend.length >= 2 && (
              <Card padding={24} style={{ marginBottom: 22 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <h4 style={{ margin: 0, color: "var(--text-heading)" }}>Score trend</h4>
                  <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Last {trend.length} results</span>
                </div>
                <ReportTrendChart pts={trend} />
              </Card>
            )}

            {/* ── Report list ──────────────────────────────────────────────── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {reports.map((r) => (
                <ReportRow key={r.id} r={r} onView={viewReport} />
              ))}
            </div>
          </>
        )}
      </div>
    </TeacherShell>
  );
}

/** Empty state — shown when the student has no published results yet. */
export function StudentReportsEmpty({ user, tenant }: { user: ShellUser; tenant: ShellTenant }) {
  const router = useRouter();
  return (
    <TeacherShell tenant={tenant} user={user} active="results" noCoaching={!tenant}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
            Progress hub
          </div>
          <h2 style={{ fontSize: 26, margin: 0 }}>My results</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 14, padding: "90px 40px", maxWidth: 440, margin: "0 auto" }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="chart-column" size={36} style={{ color: "var(--accent)" }} />
          </div>
          <h3 style={{ margin: 0, fontSize: 20 }}>No results yet</h3>
          <p style={{ margin: 0, fontSize: 14.5, color: "var(--text-body)" }}>
            Results appear here after you take an exam and your teacher publishes them.
          </p>
          <Button variant="app" arrow onClick={() => router.push("/dashboard?screen=Exams")}>Go to my exams</Button>
        </div>
      </div>
    </TeacherShell>
  );
}

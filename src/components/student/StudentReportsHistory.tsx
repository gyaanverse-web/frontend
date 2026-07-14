"use client";

import { useRouter } from "next/navigation";
import { TeacherShell } from "@/components/dashboard/TeacherShell";
import { Card, Badge, Button, Icon, Select } from "@/components/ui";
import { ProgressRing } from "./StudentBits";

type ShellUser = { name: string; role?: string };
type ShellTenant = { name: string; slug: string } | null;

type Report = {
  title: string;
  subject: string;
  date: string;
  score: string;
  pct: number;
  auto: string;
  ai: string | null;
  aiPending?: boolean;
  status: "Result ready" | "AI review pending";
};

// ── Placeholder data ──────────────────────────────────────────────────────────
// Mirrors the approved design. TODO: wire to the student reports endpoint
// (`/reports` scoped to the signed-in student) once the backend surface is confirmed.
const REPORTS: Report[] = [
  { title: "Mid-Term Mock — Mechanics", subject: "Physics", date: "Jul 6, 2026", score: "228/300 (76%)", pct: 76, auto: "180/200", ai: "48/100", status: "Result ready" },
  { title: "Organic Chemistry Quiz", subject: "Chemistry", date: "Jul 2, 2026", score: "156/200 (78%)", pct: 78, auto: "156/200", ai: null, status: "Result ready" },
  { title: "Maths Weekly Test 6", subject: "Maths", date: "Jun 28, 2026", score: "162/250 (65%)", pct: 65, auto: "162/250", ai: null, status: "Result ready" },
  { title: "Rotational Motion Subjective", subject: "Physics", date: "Jun 24, 2026", score: "Pending", pct: 40, auto: "32/50", ai: null, aiPending: true, status: "AI review pending" },
];

const WEAK_AREAS = [
  { topic: "Rotational Motion", pct: 42 },
  { topic: "Organic Nomenclature", pct: 58 },
  { topic: "Sequences & Series", pct: 81 },
];

/** Average-score trend sparkline over recent attempts. */
function ReportTrendChart({ pts = [58, 61, 55, 64, 68, 66, 72, 76] }: { pts?: number[] }) {
  const w = 760, h = 130, pad = 8, max = 100, min = 40;
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

/** Topic mastery bar — red < 50%, amber < 70%, green otherwise. */
function WeakAreaBar({ topic, pct }: { topic: string; pct: number }) {
  const tone = pct < 50 ? "var(--danger)" : pct < 70 ? "var(--warning)" : "var(--success)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 13, color: "var(--text-body)", width: 160, flex: "none" }}>{topic}</span>
      <div style={{ flex: 1, height: 8, borderRadius: 999, background: "var(--border-default)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: tone }} />
      </div>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-heading)", width: 34, textAlign: "right" }}>{pct}%</span>
    </div>
  );
}

function ReportRow({ r, onView }: { r: Report; onView: (r: Report) => void }) {
  return (
    <Card padding={16} style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <ProgressRing pct={r.pct} size={44} label={`${r.pct}%`} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 14.5, color: "var(--text-heading)" }}>{r.title}</span>
          <Badge tone="accent">{r.subject}</Badge>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>{r.date} · {r.score}</div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Badge tone="neutral">Auto {r.auto}</Badge>
        {r.ai && <Badge tone={r.aiPending ? "warning" : "accent"}>{r.aiPending ? "AI review pending" : `AI ${r.ai}`}</Badge>}
      </div>
      <Badge tone={r.status === "Result ready" ? "success" : "warning"}>{r.status}</Badge>
      <Button variant="ghost" size="sm" onClick={() => onView(r)}>View</Button>
    </Card>
  );
}

export function StudentReportsHistory({ user, tenant }: { user: ShellUser; tenant: ShellTenant }) {
  const router = useRouter();

  // TODO wire API: once the student report list is live, render <StudentReportsEmpty />
  // when it returns zero reports, and route "View" to the per-report detail screen.
  function viewReport(_r: Report) {
    router.push("/reports");
  }

  return (
    <TeacherShell tenant={tenant} user={user} active="results">
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
            Progress hub
          </div>
          <h2 style={{ fontSize: 26, margin: 0 }}>My results</h2>
        </div>

        {/* ── Average score trend ──────────────────────────────────────────── */}
        <Card padding={24} style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h4 style={{ margin: 0, color: "var(--text-heading)" }}>Average score trend</h4>
            <div style={{ display: "flex", gap: 6 }}>
              {["All", "Physics", "Chemistry", "Maths"].map((s, i) => (
                <span
                  key={s}
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    padding: "5px 12px",
                    borderRadius: 999,
                    background: i === 0 ? "var(--accent)" : "var(--surface-inset)",
                    color: i === 0 ? "#fff" : "var(--text-body)",
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
          <ReportTrendChart />
        </Card>

        {/* ── Weak areas ───────────────────────────────────────────────────── */}
        <Card padding={22} style={{ marginBottom: 22 }}>
          <h4 style={{ margin: "0 0 14px", color: "var(--text-heading)" }}>Weak areas</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {WEAK_AREAS.map((w) => (
              <WeakAreaBar key={w.topic} topic={w.topic} pct={w.pct} />
            ))}
          </div>
        </Card>

        {/* ── Filters ──────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <Select options={["All subjects", "Physics", "Chemistry", "Maths"]} wrapperStyle={{ width: 180 }} />
          <Select options={["All time", "Last 30 days", "Last 90 days"]} wrapperStyle={{ width: 180 }} />
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "var(--text-body)" }}>
            <input type="checkbox" className="gv-switch" />Only my weak areas
          </label>
        </div>

        {/* ── Report list ──────────────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {REPORTS.map((r) => (
            <ReportRow key={r.title} r={r} onView={viewReport} />
          ))}
        </div>
      </div>
    </TeacherShell>
  );
}

/** Empty state — shown when the student has no results yet. */
export function StudentReportsEmpty({ user, tenant }: { user: ShellUser; tenant: ShellTenant }) {
  const router = useRouter();
  return (
    <TeacherShell tenant={tenant} user={user} active="results">
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
          <p style={{ margin: 0, fontSize: 14.5, color: "var(--text-body)" }}>Take your first exam to see your progress here.</p>
          <Button variant="app" arrow onClick={() => router.push("/dashboard?screen=Exams")}>Go to my exams</Button>
        </div>
      </div>
    </TeacherShell>
  );
}

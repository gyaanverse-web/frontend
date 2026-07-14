"use client";

import { useRouter } from "next/navigation";
import { TeacherShell } from "@/components/dashboard/TeacherShell";
import { Button, Card, Badge, Icon, StatCard } from "@/components/ui";
import { ProgressRing, ScoreTrendChart } from "./StudentBits";

type ShellUser = { name: string; role?: string };
type ShellTenant = { name: string; slug: string } | null;

// ── Placeholder data ──────────────────────────────────────────────────────────
// Mirrors the approved design. TODO: wire to the student home endpoint
// (upcoming/attempts summary) once the backend surface is confirmed.
const DUE_SOON = [
  { title: "Weekly Physics Test — Laws of Motion", subject: "Physics", q: 30, dur: "45 min", due: "Tomorrow, 6 PM", left: "2/3" },
  { title: "Organic Chemistry — Nomenclature Quiz", subject: "Chemistry", q: 20, dur: "30 min", due: "Fri, 6 PM", left: "1/2" },
  { title: "Maths — Sequences & Series", subject: "Maths", q: 25, dur: "40 min", due: "Sun, 11:59 PM", left: "3/3" },
];

const RECENT = [
  { title: "Mid-Term Mock — Mechanics", score: "228/300 (76%)", pct: 76, delta: "+12%" },
  { title: "Organic Chemistry Quiz", score: "156/200 (78%)", pct: 78, delta: "+4%" },
  { title: "Maths Weekly Test 6", score: "162/250 (65%)", pct: 65, delta: "+2%" },
];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function StudentHome({ user, tenant }: { user: ShellUser; tenant: ShellTenant }) {
  const router = useRouter();
  const firstName = (user.name ?? "").trim().split(/\s+/)[0] || "there";

  return (
    <TeacherShell tenant={tenant} user={user} active="home">
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          {/* ── Greeting ─────────────────────────────────────────────────── */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 4 }}>
            <h2 style={{ fontSize: 27, margin: 0 }}>
              {greeting()}, {firstName}
            </h2>
            <Badge tone="warning">4-day streak</Badge>
          </div>
          <p style={{ fontSize: 15, margin: "2px 0 22px", color: "var(--text-body)" }}>
            You have <strong style={{ color: "var(--text-heading)" }}>2 exams</strong> due this week.
          </p>

          {/* ── Continue where you left off ──────────────────────────────── */}
          <Card padding={0} style={{ marginBottom: 24, borderColor: "var(--accent)", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20, padding: 22, background: "var(--accent-soft)" }}>
              <ProgressRing pct={47} size={60} label="14/30" />
              <div style={{ flex: 1, lineHeight: 1.4 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent)" }}>
                  Continue where you left off
                </div>
                <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 19, color: "var(--text-heading)", marginTop: 2 }}>
                  Weekly Physics Test — Laws of Motion
                </div>
                <div style={{ fontSize: 13.5, color: "var(--text-body)", marginTop: 2 }}>14 of 30 answered · 18:42 left</div>
              </div>
              <Button variant="app" size="lg" arrow onClick={() => router.push("/dashboard?screen=Exams")}>
                Resume
              </Button>
            </div>
          </Card>

          {/* ── Due soon ─────────────────────────────────────────────────── */}
          <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontSize: 17, margin: 0 }}>Due soon</h3>
          </div>
          <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 4, marginBottom: 28 }}>
            {DUE_SOON.map((e) => (
              <Card key={e.title} padding={18} style={{ minWidth: 260, display: "flex", flexDirection: "column", gap: 10, flex: "none" }}>
                <Badge tone="accent">{e.subject}</Badge>
                <h4 style={{ margin: 0, fontSize: 15, lineHeight: 1.35, color: "var(--text-heading)" }}>{e.title}</h4>
                <div style={{ fontFamily: "var(--font-body)", fontSize: 12.5, color: "var(--text-muted)", display: "flex", gap: 8 }}>
                  <span>{e.q} Q</span>
                  <span>·</span>
                  <span>{e.dur}</span>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-body)" }}>
                  Due {e.due} · {e.left} attempts left
                </div>
                <Button variant="app" size="sm" style={{ marginTop: 4 }} onClick={() => router.push("/dashboard?screen=Exams")}>
                  Start
                </Button>
              </Card>
            ))}
          </div>

          {/* ── Progress chart + KPIs ────────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 24, marginBottom: 28, alignItems: "start" }}>
            <Card padding={20}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <h4 style={{ margin: 0, color: "var(--text-heading)" }}>Your progress</h4>
                <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Last 8 attempts</span>
              </div>
              <ScoreTrendChart />
            </Card>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <StatCard label="Exams taken" value="18" />
              <StatCard label="Avg. score" value="72%" delta="+5%" />
              <StatCard label="This week" value="2" sub="due" />
              <StatCard label="Classes" value="3" />
            </div>
          </div>

          {/* ── Recent results ───────────────────────────────────────────── */}
          <h3 style={{ fontSize: 17, margin: "0 0 12px" }}>Recent results</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
            {RECENT.map((r) => (
              <Card key={r.title} padding={16} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <ProgressRing pct={r.pct} size={48} label={`${r.pct}%`} />
                <div style={{ flex: 1, lineHeight: 1.35 }}>
                  <div style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 14.5, color: "var(--text-heading)" }}>{r.title}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                    {r.score} · <span style={{ color: "var(--success)", fontWeight: 600 }}>▲ {r.delta} vs last</span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => router.push("/reports")}>
                  View report
                </Button>
              </Card>
            ))}
          </div>

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
            <Button variant="secondary" arrow onClick={() => router.push("/exams/public")}>
              Browse mocks
            </Button>
          </Card>
      </div>
    </TeacherShell>
  );
}

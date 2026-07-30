"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { TeacherShell } from "@/components/dashboard/TeacherShell";
import { Card, Badge, Button, Icon, Tabs } from "@/components/ui";
import type { BadgeTone } from "@/components/ui";
import { NoCoachingPanel } from "./StudentBits";

type ShellUser = { name: string; role?: string };
type ShellTenant = { name: string; slug: string } | null;

// ── Backend contracts (mirror listAvailableExamsForStudent) ───────────────────
type SessionSummary = {
  id: string;
  examId: string;
  status: string; // in_progress | submitted | evaluated | …
  attemptNumber: number;
  startedAt: string;
  submittedAt: string | null;
};

type ApiExam = {
  id: string;
  title: string;
  durationMins: number;
  subjectId: string | null;
  status: string; // scheduled | live | under_evaluation | results_published | completed
  totalMarks: number;
  maxAttempts: number;
  scheduledAt: string | null;
  endsAt: string | null;
  mySessions?: SessionSummary[];
};

type Subject = { id: string; name: string };

// ── Per-student derived state ─────────────────────────────────────────────────
type StudentExamState =
  | "Upcoming"      // scheduled — locked until it goes live
  | "Not started"   // live, attempts left, nothing active
  | "In progress"   // live, active session → resume
  | "Submitted"     // attempted, results not published yet
  | "Result ready"  // results published/completed with an attempt
  | "Closed";       // exam over, never attempted

const STATE_TONE: Record<StudentExamState, BadgeTone> = {
  Upcoming: "neutral",
  "Not started": "neutral",
  "In progress": "accent",
  Submitted: "warning",
  "Result ready": "success",
  Closed: "neutral",
};

function fmtWhen(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function deriveState(e: ApiExam): StudentExamState {
  const sessions = e.mySessions ?? [];
  const active = sessions.find((s) => s.status === "in_progress");
  const attempted = sessions.length > 0;

  if (e.status === "scheduled") return "Upcoming";
  if (e.status === "live") {
    if (active) return "In progress";
    if (sessions.length >= e.maxAttempts) return "Submitted";
    return "Not started";
  }
  // Post-live states
  if (e.status === "results_published" || e.status === "completed") {
    return attempted ? "Result ready" : "Closed";
  }
  // under_evaluation
  return attempted ? "Submitted" : "Closed";
}

function windowText(e: ApiExam, state: StudentExamState): string {
  const starts = fmtWhen(e.scheduledAt);
  const ends = fmtWhen(e.endsAt);
  switch (state) {
    case "Upcoming": return starts ? `Starts ${starts}` : "Scheduled";
    case "In progress":
    case "Not started": return ends ? `Closes ${ends}` : "Open now";
    case "Submitted": return e.status === "live" ? "Attempts used" : "Results pending";
    case "Result ready": return "Results published";
    case "Closed": return ends ? `Ended ${ends}` : "Ended";
  }
}

const TABS = ["To do", "In progress", "Completed", "Upcoming"] as const;
type Tab = (typeof TABS)[number];

const TAB_STATES: Record<Tab, StudentExamState[]> = {
  "To do": ["Not started"],
  "In progress": ["In progress"],
  Completed: ["Submitted", "Result ready", "Closed"],
  Upcoming: ["Upcoming"],
};

function ExamRow({
  e, state, subjectName, onOpen,
}: {
  e: ApiExam;
  state: StudentExamState;
  subjectName: string | null;
  onOpen: (e: ApiExam, state: StudentExamState) => void;
}) {
  const locked = state === "Upcoming" || state === "Closed" || (state === "Submitted" && e.status !== "live");
  const disabled = state === "Upcoming" || state === "Closed" || state === "Submitted";
  const cta =
    state === "Upcoming" ? "Locked"
    : state === "Closed" ? "Closed"
    : state === "In progress" ? "Resume"
    : state === "Result ready" ? "View result"
    : state === "Submitted" ? (e.status === "live" ? "Submitted" : "Results pending")
    : "Start";
  const used = (e.mySessions ?? []).length;
  const left = Math.max(0, e.maxAttempts - used);
  const isLive = e.status === "live";

  return (
    <Card padding={18} style={{ display: "flex", alignItems: "center", gap: 16, opacity: locked ? 0.65 : 1 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
        <Icon name={state === "Upcoming" ? "clock" : "file-text"} size={19} style={{ color: "var(--accent)" }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 15, color: "var(--text-heading)" }}>{e.title}</span>
          {subjectName && <Badge tone="accent">{subjectName}</Badge>}
          {isLive && (
            <Badge tone="success">
              <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "currentColor", marginRight: 5, verticalAlign: "middle" }} />
              Live
            </Badge>
          )}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span>{e.durationMins} min</span><span>·</span><span>{e.totalMarks} marks</span><span>·</span><span>{windowText(e, state)}</span>
        </div>
      </div>
      <div style={{ textAlign: "right", fontSize: 12.5, color: "var(--text-body)", flex: "none" }}>
        Attempts left<br /><strong style={{ color: "var(--text-heading)" }}>{left}/{e.maxAttempts}</strong>
      </div>
      <Badge tone={STATE_TONE[state]}>{state}</Badge>
      <Button
        variant={disabled ? "secondary" : state === "Result ready" ? "ghost" : "app"}
        size="sm"
        disabled={disabled}
        style={{ minWidth: 96 }}
        onClick={() => onOpen(e, state)}
      >
        {cta}
      </Button>
    </Card>
  );
}

export function StudentMyExams({ user, tenant }: { user: ShellUser; tenant: ShellTenant }) {
  const router = useRouter();

  const [exams, setExams] = useState<ApiExam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  // Seeded from the tenant: with no coaching there are no tenant-scoped exams to
  // fetch, so the screen goes straight to its "join a coaching" state.
  const [loading, setLoading] = useState(Boolean(tenant));
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("To do");

  useEffect(() => {
    let cancelled = false;
    // Skip the tenant-scoped calls entirely with no coaching — they'd 400 on
    // the missing tenant and surface as a bogus error box.
    if (!tenant) return;
    Promise.all([
      api.get<{ exams: ApiExam[] }>("/tenant/exams"),
      api.get<{ subjects: Subject[] }>("/tenant/subjects").catch(() => ({ subjects: [] as Subject[] })),
    ])
      .then(([examRes, subjectRes]) => {
        if (cancelled) return;
        setExams(examRes.exams);
        setSubjects(subjectRes.subjects);
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load your exams."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tenant]);

  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s.name])), [subjects]);
  const withState = useMemo(() => exams.map((e) => ({ e, state: deriveState(e) })), [exams]);
  const counts = useMemo(() => {
    const c = {} as Record<Tab, number>;
    for (const t of TABS) c[t] = withState.filter(({ state }) => TAB_STATES[t].includes(state)).length;
    return c;
  }, [withState]);
  const visible = withState.filter(({ state }) => TAB_STATES[tab].includes(state));

  function openExam(e: ApiExam, state: StudentExamState) {
    if (state === "In progress") router.push(`/exams/${e.id}/attempt`);
    else if (state === "Result ready") {
      const latest = (e.mySessions ?? []).find((s) => s.status !== "in_progress");
      router.push(latest ? `/exams/${e.id}/result?session=${latest.id}` : `/exams/${e.id}/intro`);
    } else if (state === "Not started") router.push(`/exams/${e.id}/intro`);
  }

  const tabLabels = TABS.map((t) => (counts[t] ? `${t} (${counts[t]})` : t));
  const labelToTab = (label: string): Tab => TABS[tabLabels.indexOf(label)] ?? "To do";

  return (
    <TeacherShell tenant={tenant} user={user} active="exams" noCoaching={!tenant}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
            Assigned via your classes
          </div>
          <h2 style={{ fontSize: 26, margin: 0 }}>My exams</h2>
        </div>

        {!tenant && (
          <NoCoachingPanel body="Exams here are the ones your coaching assigns to your batch. Join one with its code to see them — public mocks are always open to you in the meantime." />
        )}

        {tenant && <>
        <Tabs
          tabs={tabLabels}
          value={tabLabels[TABS.indexOf(tab)]}
          onChange={(label) => setTab(labelToTab(label))}
          style={{ marginBottom: 20 }}
        />

        {loading && (
          <div style={{ padding: "60px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading your exams…</div>
        )}

        {!loading && error && (
          <Card padding={20} style={{ color: "var(--danger)", fontSize: 14.5 }}>{error}</Card>
        )}

        {!loading && !error && visible.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12, padding: "70px 40px" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="file-text" size={28} style={{ color: "var(--accent)" }} />
            </div>
            <h3 style={{ margin: 0, fontSize: 18 }}>Nothing here yet</h3>
            <p style={{ margin: 0, fontSize: 14, color: "var(--text-body)", maxWidth: 380 }}>
              {tab === "Upcoming"
                ? "No scheduled exams right now — new tests appear here once your teacher schedules them."
                : tab === "To do"
                  ? "You're all caught up. Exams assigned to your classes will show up here when they open."
                  : "No exams in this bucket yet."}
            </p>
          </div>
        )}

        {!loading && !error && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {visible.map(({ e, state }) => (
              <ExamRow
                key={e.id}
                e={e}
                state={state}
                subjectName={e.subjectId ? subjectById.get(e.subjectId) ?? null : null}
                onOpen={openExam}
              />
            ))}
          </div>
        )}
        </>}
      </div>
    </TeacherShell>
  );
}

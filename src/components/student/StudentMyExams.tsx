"use client";

import { useRouter } from "next/navigation";
import { TeacherShell } from "@/components/dashboard/TeacherShell";
import { Card, Badge, Button, Icon, Tabs } from "@/components/ui";
import type { BadgeTone } from "@/components/ui";

type ShellUser = { name: string; role?: string };
type ShellTenant = { name: string; slug: string } | null;

type ExamStatus = "Not started" | "In progress" | "Submitted" | "Result ready" | "Locked";

type Exam = {
  id: string;
  title: string;
  subject: string;
  q: number;
  dur: string;
  marks: number;
  window: string;
  left: string;
  status: ExamStatus;
};

const STATUS_TONE: Record<ExamStatus, BadgeTone> = {
  "Not started": "neutral",
  "In progress": "accent",
  Submitted: "warning",
  "Result ready": "success",
  Locked: "neutral",
};

// ── Placeholder data ──────────────────────────────────────────────────────────
// Mirrors the approved design. TODO: wire to the student exams endpoint
// (assigned exams across the student's classes) once the backend surface is confirmed.
const EXAMS: Exam[] = [
  { id: "weekly-physics", title: "Weekly Physics Test — Laws of Motion", subject: "Physics", q: 30, dur: "45 min", marks: 100, window: "Closes Sun 11:59 PM", left: "2/3", status: "Not started" },
  { id: "midterm-mechanics", title: "Mid-Term Mock — Mechanics", subject: "Physics", q: 30, dur: "60 min", marks: 100, window: "Closes today", left: "1/2", status: "In progress" },
  { id: "organic-nomenclature", title: "Organic Chemistry — Nomenclature Quiz", subject: "Chemistry", q: 20, dur: "30 min", marks: 60, window: "Available Friday 6 PM", left: "2/2", status: "Locked" },
  { id: "maths-sequences", title: "Maths — Sequences & Series", subject: "Maths", q: 25, dur: "40 min", marks: 100, window: "Closes Sun 11:59 PM", left: "3/3", status: "Not started" },
  { id: "organic-quiz", title: "Organic Chemistry Quiz", subject: "Chemistry", q: 20, dur: "30 min", marks: 60, window: "Submitted Jul 6", left: "0/2", status: "Result ready" },
];

function ExamRow({ e, onOpen }: { e: Exam; onOpen: (e: Exam) => void }) {
  const locked = e.status === "Locked";
  const cta = locked ? "Locked" : e.status === "In progress" ? "Resume" : e.status === "Result ready" ? "View result" : "Start";
  return (
    <Card padding={18} style={{ display: "flex", alignItems: "center", gap: 16, opacity: locked ? 0.6 : 1 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
        <Icon name={locked ? "clock" : "file-text"} size={19} style={{ color: "var(--accent)" }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <span style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 15, color: "var(--text-heading)" }}>{e.title}</span>
          <Badge tone="accent">{e.subject}</Badge>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)", display: "flex", gap: 8 }}>
          <span>{e.q} Q</span><span>·</span><span>{e.dur}</span><span>·</span><span>{e.marks} marks</span><span>·</span><span>{e.window}</span>
        </div>
      </div>
      <div style={{ textAlign: "right", fontSize: 12.5, color: "var(--text-body)", flex: "none" }}>
        Attempts left<br /><strong style={{ color: "var(--text-heading)" }}>{e.left}</strong>
      </div>
      <Badge tone={STATUS_TONE[e.status]}>{e.status}</Badge>
      <Button
        variant={locked ? "secondary" : e.status === "Result ready" ? "ghost" : "app"}
        size="sm"
        disabled={locked}
        style={{ minWidth: 96 }}
        onClick={() => onOpen(e)}
      >
        {cta}
      </Button>
    </Card>
  );
}

export function StudentMyExams({ user, tenant }: { user: ShellUser; tenant: ShellTenant }) {
  const router = useRouter();

  // TODO wire API: exam IDs are placeholders; the intro/attempt/result routes render
  // design-faithful screens with mocked data until the exam-session endpoints are wired.
  function openExam(e: Exam) {
    if (e.status === "Locked") return;
    if (e.status === "In progress") router.push(`/exams/${e.id}/attempt`);
    else if (e.status === "Result ready") router.push(`/exams/${e.id}/result`);
    else router.push(`/exams/${e.id}/intro`);
  }

  return (
    <TeacherShell tenant={tenant} user={user} active="exams">
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
            Assigned via your classes
          </div>
          <h2 style={{ fontSize: 26, margin: 0 }}>My exams</h2>
        </div>

        <Tabs tabs={["To do", "In progress", "Completed", "Upcoming"]} defaultValue="To do" style={{ marginBottom: 20 }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {EXAMS.map((e) => (
            <ExamRow key={e.title} e={e} onOpen={openExam} />
          ))}
        </div>
      </div>
    </TeacherShell>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { TeacherShell } from "@/components/dashboard/TeacherShell";
import { Card, Badge, Button, Icon, Input } from "@/components/ui";

type ShellUser = { name: string; role?: string };
type ShellTenant = { name: string; slug: string } | null;

type StudentClass = {
  name: string;
  grade: string;
  teacher: string;
  members: number;
  exams: number;
  next: string | null;
  pending?: boolean;
};

// ── Placeholder data ──────────────────────────────────────────────────────────
// Mirrors the approved design. TODO: wire to the student classes endpoint
// (the batches this student belongs to, incl. pending enrollments) once confirmed.
const CLASSES: StudentClass[] = [
  { name: "Physics Batch A", grade: "Class 11", teacher: "R. Verma", members: 42, exams: 12, next: "Weekly Physics Test, tomorrow" },
  { name: "Maths Foundation", grade: "Class 11", teacher: "A. Khan", members: 38, exams: 8, next: "Sequences & Series, Sun" },
  { name: "Chemistry Batch B", grade: "Class 11", teacher: "P. Das", members: 0, exams: 0, next: null, pending: true },
];

function ClassCard({ c }: { c: StudentClass }) {
  return (
    <Card padding={20} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="graduation-cap" size={19} style={{ color: "var(--accent)" }} />
        </div>
        {c.pending && <Badge tone="warning">Awaiting approval</Badge>}
      </div>
      <div>
        <h4 style={{ margin: 0, color: "var(--text-heading)" }}>{c.name}</h4>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "2px 0 0" }}>{c.grade} · {c.teacher}</p>
      </div>
      <div style={{ display: "flex", gap: 14, fontSize: 12.5, color: "var(--text-body)" }}>
        <span>{c.members} students</span><span>·</span><span>{c.exams} exams</span>
      </div>
      {!c.pending && c.next && (
        <div style={{ borderTop: "1px solid var(--border-default)", paddingTop: 10, fontSize: 13, color: "var(--text-body)" }}>
          Next: {c.next}
        </div>
      )}
    </Card>
  );
}

export function StudentMyClasses({ user, tenant }: { user: ShellUser; tenant: ShellTenant }) {
  const router = useRouter();

  return (
    <TeacherShell tenant={tenant} user={user} active="classes">
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
            Your batches
          </div>
          <h2 style={{ fontSize: 26, margin: 0 }}>My classes</h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 26 }}>
          {CLASSES.map((c) => (
            <ClassCard key={c.name} c={c} />
          ))}
        </div>

        {/* ── Join a new class ─────────────────────────────────────────────── */}
        <Card padding={22} style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <Icon name="plus" size={21} style={{ color: "var(--accent)" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 16, color: "var(--text-heading)" }}>Join a new class</div>
            <p style={{ fontSize: 13.5, margin: "2px 0 0", color: "var(--text-body)" }}>Enter the code your teacher shared with you.</p>
          </div>
          {/* TODO wire API: submit the code inline. For now this hands off to the /join flow. */}
          <Input placeholder="e.g. PHY-2K4X" wrapperStyle={{ width: 200 }} style={{ width: "100%" }} />
          <Button variant="app" onClick={() => router.push("/join")}>Join</Button>
        </Card>
      </div>
    </TeacherShell>
  );
}

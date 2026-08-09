"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { fmtDate, examState, type StudentClass, type Classmate } from "@/lib/studentClasses";
import { TeacherShell } from "@/components/dashboard/TeacherShell";
import { Card, Badge, Icon, Avatar } from "@/components/ui";
import type { IconName } from "@/components/ui";

type ShellUser = { name: string; role?: string };
type ShellTenant = { name: string; slug: string } | null;

// The exam fields this screen uses. `classIds` is what lets one batch filter the
// student's whole exam list client-side instead of calling a per-class endpoint.
type ClassExam = {
  id: string;
  title: string;
  status: string;
  durationMins: number;
  totalMarks: number;
  scheduledAt: string | null;
  endsAt: string | null;
  classIds?: string[];
  mySessions?: { id: string; status: string }[];
};

// `IconName`, not a string: Icon's prop accepts `IconName | string` and renders
// an empty box for a name it doesn't have, so a typo would fail silently.
function StatTile({ icon, value, label }: { icon: IconName; value: string; label: string }) {
  return (
    <Card padding={16} style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
        <Icon name={icon} size={18} style={{ color: "var(--accent)" }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-heading)" }}>{value}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</div>
      </div>
    </Card>
  );
}

export function StudentClassDetail({
  classId,
  user,
  tenant,
}: {
  classId: string;
  user: ShellUser;
  tenant: ShellTenant;
}) {
  const [cls, setCls] = useState<StudentClass | null>(null);
  const [classmates, setClassmates] = useState<Classmate[]>([]);
  const [exams, setExams] = useState<ClassExam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!tenant) return;
    let cancelled = false;

    // The batch itself comes from the list route rather than /tenant/classes/:id:
    // the list is the one that carries the student-shaped extras (their own
    // enrollment status, the teacher's name, the counts), and it doubles as the
    // membership check — a batch the student isn't in simply isn't in it.
    Promise.all([
      api.get<{ classes: StudentClass[] }>("/tenant/classes"),
      api.get<{ students: Classmate[] }>(`/tenant/classes/${classId}/students`)
        .catch(() => ({ students: [] as Classmate[] })),
      api.get<{ exams: ClassExam[] }>("/tenant/exams")
        .catch(() => ({ exams: [] as ClassExam[] })),
    ])
      .then(([classRes, mateRes, examRes]) => {
        if (cancelled) return;
        const found = classRes.classes.find((c) => c.id === classId) ?? null;
        setCls(found);
        if (!found) setError("This batch isn't one of yours, or your enrollment is still awaiting approval.");
        setClassmates(mateRes.students);
        setExams(examRes.exams.filter((e) => (e.classIds ?? []).includes(classId)));
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load this batch."); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [classId, tenant]);

  const upcoming = useMemo(
    () => exams.filter((e) => e.status === "scheduled" || e.status === "live").length,
    [exams],
  );

  const backLink = (
    <Link href="/student/classes" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)", textDecoration: "none", marginBottom: 14 }}>
      <span aria-hidden="true">←</span>
      <span>My classes</span>
    </Link>
  );

  if (loading || !cls) {
    return (
      <TeacherShell tenant={tenant} user={user} role="student" active="classes" noCoaching={!tenant}>
        <div style={{ maxWidth: 1080, margin: "0 auto" }}>
          {backLink}
          <Card padding={0}>
            <div style={{ padding: "56px 40px", textAlign: "center", fontSize: 14, color: loading ? "var(--text-muted)" : "var(--danger)" }}>
              {loading ? "Loading this batch…" : error || "Batch not found."}
            </div>
          </Card>
        </div>
      </TeacherShell>
    );
  }

  return (
    <TeacherShell tenant={tenant} user={user} role="student" active="classes" noCoaching={!tenant}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        {backLink}

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 24 }}>
          <div style={{ width: 52, height: 52, borderRadius: 13, background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <Icon name="graduation-cap" size={25} style={{ color: "var(--accent)" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
              {cls.grade || "Batch"}
            </div>
            <h2 style={{ fontSize: 26, margin: "2px 0 0" }}>{cls.name}</h2>
            {cls.description && (
              <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-body)", margin: "8px 0 0", maxWidth: 640 }}>
                {cls.description}
              </p>
            )}
          </div>
          <Badge tone="success">Enrolled</Badge>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 26 }}>
          <StatTile icon="users" value={String(cls.studentCount)} label={cls.studentCount === 1 ? "student" : "students"} />
          <StatTile icon="file-text" value={String(exams.length)} label={exams.length === 1 ? "exam" : "exams"} />
          <StatTile icon="clock" value={String(upcoming)} label="open or upcoming" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20, alignItems: "start" }}>
          {/* ── Exams in this batch ─────────────────────────────────────────── */}
          <Card padding={0} style={{ overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-default)" }}>
              <h3 style={{ margin: 0, fontSize: 16, color: "var(--text-heading)" }}>Exams</h3>
              <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>Papers your teacher assigned to this batch.</p>
            </div>
            {exams.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", fontSize: 13.5, color: "var(--text-muted)" }}>
                No exams assigned to this batch yet.
              </div>
            ) : (
              exams.map((e) => {
                const state = examState(e);
                return (
                  <Link
                    key={e.id}
                    href={`/student/exams/${e.id}/intro`}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: "1px solid var(--border-light)", color: "inherit", textDecoration: "none" }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-heading)" }}>{e.title}</div>
                      <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                        {e.durationMins} min · {e.totalMarks} marks
                        {e.scheduledAt ? ` · ${fmtDate(e.scheduledAt)}` : ""}
                      </div>
                    </div>
                    <Badge tone={state.tone}>{state.label}</Badge>
                  </Link>
                );
              })
            )}
          </Card>

          {/* ── Teacher + classmates ────────────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <Card padding={20}>
              <h3 style={{ margin: "0 0 14px", fontSize: 16, color: "var(--text-heading)" }}>Your teacher</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar name={cls.teacherName ?? "?"} size={40} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-heading)" }}>
                    {cls.teacherName ?? "Not assigned"}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Batch teacher</div>
                </div>
              </div>
              <p style={{ margin: "14px 0 0", paddingTop: 14, borderTop: "1px solid var(--border-default)", fontSize: 12.5, color: "var(--text-muted)" }}>
                You joined on {fmtDate(cls.enrolledAt)}.
              </p>
            </Card>

            <Card padding={20}>
              <h3 style={{ margin: "0 0 4px", fontSize: 16, color: "var(--text-heading)" }}>Classmates</h3>
              <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--text-muted)" }}>
                {classmates.length} enrolled in this batch.
              </p>
              {classmates.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-muted)" }}>No one else has joined yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {classmates.map((m) => (
                    <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar name={m.name} size={30} />
                      <span style={{ fontSize: 13.5, color: "var(--text-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.name}
                        {m.name === user.name && (
                          <span style={{ color: "var(--text-muted)", fontSize: 12 }}> · you</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </TeacherShell>
  );
}

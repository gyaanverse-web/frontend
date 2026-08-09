"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  fmtDate, normalizeClassCode, validateClassCode, classJoinPath, type StudentClass,
} from "@/lib/studentClasses";
import { TeacherShell } from "@/components/dashboard/TeacherShell";
import { Card, Badge, Button, Icon, Input } from "@/components/ui";
import { NoCoachingPanel } from "./StudentBits";

type ShellUser = { name: string; role?: string };
type ShellTenant = { name: string; slug: string } | null;

function ClassCard({ c }: { c: StudentClass }) {
  const pending = c.enrollmentStatus === "pending";
  const subtitle = [c.grade, c.teacherName].filter(Boolean).join(" · ");

  const body = (
    <Card
      padding={20}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        height: "100%",
        // A request still in review reads as provisional, not as a batch you're in.
        borderColor: pending ? "var(--warning)" : undefined,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: pending ? "var(--warning-soft)" : "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
          <Icon name={pending ? "clock" : "graduation-cap"} size={19} style={{ color: pending ? "var(--warning)" : "var(--accent)" }} />
        </div>
        {pending && <Badge tone="warning">Awaiting approval</Badge>}
      </div>
      <div>
        <h4 style={{ margin: 0, color: "var(--text-heading)" }}>{c.name}</h4>
        {subtitle && <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "2px 0 0" }}>{subtitle}</p>}
      </div>

      {/* Counts are meaningless while the request is in review — the student
          isn't in the batch yet, so its roster and papers aren't theirs to see. */}
      {!pending && (
        <div style={{ display: "flex", gap: 10, fontSize: 12.5, color: "var(--text-body)" }}>
          <span>{c.studentCount} {c.studentCount === 1 ? "student" : "students"}</span>
          <span style={{ color: "var(--text-muted)" }}>·</span>
          <span>{c.examCount} {c.examCount === 1 ? "exam" : "exams"}</span>
        </div>
      )}

      <div style={{ marginTop: "auto", borderTop: "1px solid var(--border-default)", paddingTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 12.5, color: "var(--text-muted)" }}>
        <span>
          {pending
            ? `Requested ${fmtDate(c.enrolledAt)} — your teacher reviews it next.`
            : `Joined ${fmtDate(c.enrolledAt)}`}
        </span>
        {/* Not `.gv-row-chevron` — that class's hover lift is scoped to
            `.gv-table tbody tr`, so outside a table it only sets a base opacity. */}
        {!pending && <Icon name="arrow-right" size={15} style={{ flex: "none", opacity: 0.55 }} />}
      </div>
    </Card>
  );

  // Only an approved batch has anything behind it. A pending card stays inert
  // rather than linking to a page that would 403 on its roster.
  if (pending) return body;
  return (
    <Link href={`/student/classes/${c.id}`} style={{ display: "block", height: "100%", color: "inherit", textDecoration: "none" }}>
      {body}
    </Link>
  );
}

export function StudentMyClasses({ user, tenant }: { user: ShellUser; tenant: ShellTenant }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [codeErr, setCodeErr] = useState("");

  const [classes, setClasses] = useState<StudentClass[]>([]);
  // Seeded from the tenant: with no coaching there are no tenant-scoped batches
  // to fetch, so the screen goes straight to its "join a coaching" state.
  const [loading, setLoading] = useState(Boolean(tenant));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!tenant) return;
    let cancelled = false;
    api.get<{ classes: StudentClass[] }>("/tenant/classes")
      .then((d) => { if (!cancelled) setClasses(d.classes); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load your classes."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tenant]);

  // Requests in review sort first — they're the ones the student is waiting on.
  const sorted = useMemo(
    () => [...classes].sort((a, b) =>
      Number(b.enrollmentStatus === "pending") - Number(a.enrollmentStatus === "pending")),
    [classes],
  );
  const pendingCount = sorted.filter((c) => c.enrollmentStatus === "pending").length;

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const err = validateClassCode(code);
    setCodeErr(err ?? "");
    if (err) return;
    // Hand off to the class preview + confirm screen, which validates the code
    // and performs the join. NOT /join — that redeems coaching codes.
    router.push(classJoinPath(code));
  }

  return (
    <TeacherShell tenant={tenant} user={user} role="student" active="classes" noCoaching={!tenant}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
            Your batches
          </div>
          <h2 style={{ fontSize: 26, margin: 0 }}>My classes</h2>
        </div>

        {!tenant ? (
          <NoCoachingPanel body="Batches belong to a coaching institute. Once you join one with its code, the batches you're enrolled in show up here." />
        ) : (
          <>
        {error && (
          <p style={{ margin: "0 0 18px", padding: "10px 14px", background: "var(--danger-soft)", border: "1px solid rgba(244,63,94,0.35)", borderRadius: "var(--radius-md)", fontSize: 13, color: "var(--danger)" }}>
            {error}
          </p>
        )}

        {pendingCount > 0 && (
          <Card padding={16} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, borderColor: "var(--warning)", background: "var(--warning-soft)" }}>
            <Icon name="clock" size={19} style={{ color: "var(--warning)", flex: "none" }} />
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-body)" }}>
              {pendingCount === 1 ? "1 join request is" : `${pendingCount} join requests are`} waiting on your
              teacher&rsquo;s approval. You&rsquo;ll get the batch&rsquo;s exams and results once it&rsquo;s approved.
            </p>
          </Card>
        )}

        {loading ? (
          <Card padding={0} style={{ overflow: "hidden", marginBottom: 26 }}>
            <div style={{ padding: "56px 40px", textAlign: "center", fontSize: 14, color: "var(--text-muted)" }}>
              Loading your batches&hellip;
            </div>
          </Card>
        ) : sorted.length === 0 ? (
          <Card padding={0} style={{ overflow: "hidden", marginBottom: 26 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12, padding: "56px 40px" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="graduation-cap" size={28} style={{ color: "var(--accent)" }} />
              </div>
              <h3 style={{ margin: 0, fontSize: 19, color: "var(--text-heading)" }}>You&rsquo;re not in any batch yet</h3>
              <p style={{ margin: 0, maxWidth: 440, fontSize: 14, lineHeight: 1.6, color: "var(--text-body)" }}>
                Once your teacher adds you to a batch &mdash; or you join one with a class code &mdash; it shows up here with its schedule and exams.
              </p>
            </div>
          </Card>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 26 }}>
            {sorted.map((c) => (
              <ClassCard key={c.id} c={c} />
            ))}
          </div>
        )}

        {/* ── Join a new class ─────────────────────────────────────────────── */}
        <Card padding={22}>
          <form onSubmit={handleJoin} style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
              <Icon name="plus" size={21} style={{ color: "var(--accent)" }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 16, color: "var(--text-heading)" }}>Join a new class</div>
              <p style={{ fontSize: 13.5, margin: "2px 0 0", color: "var(--text-body)" }}>Enter the 8-character class code your teacher shared with you.</p>
            </div>
            <Input
              value={code}
              onChange={(e) => setCode(normalizeClassCode(e.target.value))}
              placeholder="ABCD2345"
              maxLength={8}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              aria-label="Class join code"
              wrapperStyle={{ width: 200 }}
              style={{ width: "100%", fontFamily: "var(--font-mono)", letterSpacing: 3, textTransform: "uppercase" }}
            />
            <Button type="submit" variant="app" disabled={code.length !== 8}>Join</Button>
          </form>
          {codeErr && (
            <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--danger)" }}>{codeErr}</p>
          )}
        </Card>
          </>
        )}
      </div>
    </TeacherShell>
  );
}

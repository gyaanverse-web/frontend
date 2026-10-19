"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useTenantSession } from "@/lib/useTenantSession";
import { TeacherShell } from "@/components/dashboard/TeacherShell";
import {
  Avatar, Badge, Button, Card, DataTable, DetailRows, Modal, StatCard, Tabs,
  type Column, type DetailRow,
} from "@/components/ui";
import { EXAM_STATUS_META } from "@/lib/examStatus";
import { formatPaise } from "@/lib/fee";
import { FeeLedgerPanel } from "@/components/people/FeeLedgerPanel";
import {
  ENROLLMENT_LABEL, ENROLLMENT_TONE, attemptBadge, fmtPersonDate, formatScore,
  type GuardianRef, type StudentBatchRef, type StudentExamAttempt, type StudentProfile,
} from "@/lib/people";

type Tenant = { id: string; slug: string; name: string };

/**
 * One student, everything about them — the page that used to not exist.
 *
 * The tab strip is built from what the API actually returned, not from the
 * viewer's role: the student payload is a discriminated union on `scope`, and a
 * teacher's arm has no `fees` and no `guardians` key at all. So a teacher sees
 * three tabs and no disabled ones, and this screen never has to re-derive a
 * permission the server already applied.
 *
 * `fees: null` on an owner payload is the third state: fees are switched off
 * platform-wide (`fees_enabled`, ops-panel only), which is not the same as a
 * student who owes nothing. The tab is absent for null and shows the ledger's
 * own empty state for zeros — matching how Settings drops the Billing tab.
 */
function StudentDetailInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const studentId = params?.id as string;

  const { loading, user, tenant, role } = useTenantSession<Tenant>({
    allow: ["coaching_owner", "teacher"],
  });

  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [error, setError] = useState("");
  // Seeded from `?tab=` so the fee screens can deep-link straight to the ledger.
  // It stays null when absent, and the first available tab wins — which also
  // covers `?tab=Fees` arriving for a viewer who has no Fees tab.
  const [tab, setTab] = useState<string | null>(searchParams.get("tab"));
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async (slug: string) => {
    return api.get<StudentProfile>(`/tenant/people/students/${studentId}`, { tenant: slug });
  }, [studentId]);

  useEffect(() => {
    if (!tenant) return;
    let cancelled = false;
    load(tenant.slug)
      .then((p) => { if (!cancelled) setProfile(p); })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load student");
      });
    return () => { cancelled = true; };
  }, [tenant, load]);

  if (loading || !user || !tenant) return <PageLoading />;

  const isOwner = role === "coaching_owner";
  const showFees = profile?.scope === "owner" && profile.fees !== null;
  const showGuardians = profile?.scope === "owner";

  const tabs = [
    "Overview",
    "Batches",
    "Exams & Results",
    ...(showFees ? ["Fees"] : []),
    ...(showGuardians ? ["Guardians"] : []),
  ];
  const active = tab && tabs.includes(tab) ? tab : tabs[0];

  async function handleRemove() {
    if (!tenant) return;
    setRemoving(true);
    try {
      await api.delete(`/tenant/members/${studentId}`, { tenant: tenant.slug });
      router.push("/coaching/students");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove student");
      setRemoving(false);
      setConfirmRemove(false);
    }
  }

  return (
    <TeacherShell
      tenant={tenant}
      user={user}
      role={role}
      active="students"
      eyebrow="Institute · Student"
      title={profile?.student.name ?? "Student"}
      action={
        isOwner && profile ? (
          <Button variant="secondary" onClick={() => setConfirmRemove(true)}>Remove from coaching</Button>
        ) : undefined
      }
    >
      <Button variant="ghost" size="sm" onClick={() => router.push("/coaching/students")} style={{ marginBottom: 16 }}>
        ← All students
      </Button>

      {error && (
        <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 16, padding: "10px 14px", border: "1px solid rgba(244,63,94,0.35)", background: "var(--danger-soft)", borderRadius: "var(--radius-md)" }}>
          {error}
        </p>
      )}

      {!profile ? (
        !error && <div className="gv-card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading student…</div>
      ) : (
        <>
          <PersonHeader profile={profile} />

          <Tabs tabs={tabs} value={active} onChange={setTab} style={{ marginBottom: 20 }} />

          {active === "Overview" && <OverviewTab profile={profile} />}
          {active === "Batches" && <BatchesTab batches={profile.batches} isOwner={isOwner} />}
          {active === "Exams & Results" && <AttemptsTab attempts={profile.attempts} scope={profile.scope} />}
          {active === "Fees" && profile.scope === "owner" && (
            <FeeLedgerPanel
              tenantSlug={tenant.slug}
              studentId={studentId}
              studentName={profile.student.name}
              autoOpenPayment={searchParams.get("action") === "pay"}
            />
          )}
          {active === "Guardians" && profile.scope === "owner" && (
            <GuardiansTab guardians={profile.guardians} />
          )}
        </>
      )}

      {confirmRemove && profile && (
        <Modal open title="Remove from coaching" onClose={() => setConfirmRemove(false)}>
          <p style={{ margin: "0 0 18px", fontSize: 14, color: "var(--text-body)", lineHeight: 1.6 }}>
            Remove <strong>{profile.student.name}</strong> from {tenant.name}? They lose access to every
            batch and paper here. Their past attempts and results are kept.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <Button variant="danger" onClick={handleRemove} disabled={removing}>
              {removing ? "Removing…" : "Remove"}
            </Button>
            <Button variant="secondary" onClick={() => setConfirmRemove(false)}>Cancel</Button>
          </div>
        </Modal>
      )}
    </TeacherShell>
  );
}

/** Identity strip — who this is, at a glance, above the tabs. */
function PersonHeader({ profile }: { profile: StudentProfile }) {
  const s = profile.student;
  return (
    <Card padding={18} style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      <Avatar name={s.name} size={52} />
      <div style={{ minWidth: 0, flex: "1 1 220px" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-heading)" }}>{s.name}</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
          {s.email ?? s.phone ?? "No contact details"}
          {" · "}
          Joined {fmtPersonDate(s.joinedAt)}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Badge tone={profile.batches.length > 0 ? "accent" : "warning"}>
          {profile.batches.length === 1 ? "1 batch" : `${profile.batches.length} batches`}
        </Badge>
        <Badge tone="neutral">{profile.activity.attempted} attempts</Badge>
        {profile.activity.averagePercent !== null && (
          <Badge tone={profile.activity.averagePercent >= 40 ? "success" : "danger"}>
            {profile.activity.averagePercent}% average
          </Badge>
        )}
      </div>
    </Card>
  );
}

function OverviewTab({ profile }: { profile: StudentProfile }) {
  const s = profile.student;
  const rows: DetailRow[] = [
    { label: "Name", value: s.name },
    {
      label: "Email",
      value: (
        <>
          {s.email ?? "—"}
          {s.email && (
            <span style={{ marginLeft: 8 }}>
              <Badge tone={s.emailVerified ? "success" : "warning"}>{s.emailVerified ? "Verified" : "Unverified"}</Badge>
            </span>
          )}
        </>
      ),
    },
    {
      label: "Phone",
      value: (
        <>
          {s.phone ?? "—"}
          {s.phone && (
            <span style={{ marginLeft: 8 }}>
              <Badge tone={s.phoneVerified ? "success" : "warning"}>{s.phoneVerified ? "Verified" : "Unverified"}</Badge>
            </span>
          )}
        </>
      ),
    },
    { label: "Joined this coaching", value: fmtPersonDate(s.joinedAt) },
    // Two different dates, and the gap between them is often the interesting
    // part: a long-standing account that joined here last week.
    { label: "Account created", value: fmtPersonDate(s.accountCreatedAt) },
    {
      label: "User ID",
      value: <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>{s.id}</span>,
    },
  ];

  const fees = profile.scope === "owner" ? profile.fees : null;

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14, marginBottom: 20 }}>
        <StatCard label="Attempts" value={profile.activity.attempted} />
        <StatCard label="Submitted" value={profile.activity.submitted} />
        <StatCard label="Marked" value={profile.activity.evaluated} />
        <StatCard
          label="Average"
          value={profile.activity.averagePercent === null ? "—" : `${profile.activity.averagePercent}%`}
          sub={profile.activity.averagePercent === null ? "nothing marked yet" : "across marked papers"}
        />
        {fees && (
          <StatCard
            label="Outstanding"
            value={formatPaise(fees.balance)}
            sub={fees.overdueAmount > 0
              ? <span style={{ color: "var(--danger)" }}>{formatPaise(fees.overdueAmount)} overdue</span>
              : "Nothing overdue"}
          />
        )}
      </div>

      <Card padding={0}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-default)" }}>
          <h4 style={{ margin: 0, fontSize: 15 }}>Details</h4>
        </div>
        {/* Read-only. Editing another person's account is not a capability the
            API has — `PATCH /api/auth/me` is self-only — so there is no Edit
            button to put here. */}
        <DetailRows rows={rows} />
      </Card>

      {profile.scope === "teacher" && (
        <p style={{ marginTop: 16, fontSize: 12.5, color: "var(--text-muted)" }}>
          You are seeing the batches you teach and the papers you wrote. Fees and guardian contacts
          are the coaching owner&apos;s view.
        </p>
      )}
    </>
  );
}

function BatchesTab({ batches, isOwner }: { batches: StudentBatchRef[]; isOwner: boolean }) {
  const router = useRouter();

  if (batches.length === 0) {
    return (
      <div className="gv-card" style={{ padding: 40, textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 14.5, color: "var(--text-body)" }}>
          {isOwner
            ? "Not in any batch yet. Add them from a batch's roster."
            : "This student is not in any batch you teach."}
        </p>
      </div>
    );
  }

  const columns: Column<StudentBatchRef>[] = [
    {
      key: "name",
      label: "Batch",
      render: (b) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text-heading)" }}>{b.name}</div>
          {b.grade && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{b.grade}</div>}
        </div>
      ),
    },
    {
      key: "teachers",
      label: "Teachers",
      render: (b) =>
        b.teachers.length === 0 ? (
          <Badge tone="warning">No teacher assigned</Badge>
        ) : (
          <span style={{ fontSize: 12.5, color: "var(--text-body)" }}>{b.teachers.map((t) => t.name).join(", ")}</span>
        ),
    },
    {
      key: "status",
      label: "Enrollment",
      width: 160,
      render: (b) => <Badge tone={ENROLLMENT_TONE[b.status]}>{ENROLLMENT_LABEL[b.status]}</Badge>,
    },
    {
      key: "enrolledAt",
      label: "Since",
      width: 130,
      render: (b) => <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{fmtPersonDate(b.enrolledAt)}</span>,
    },
  ];

  return <DataTable columns={columns} rows={batches} onRowClick={(b) => router.push(`/coaching/batches/${b.id}`)} />;
}

function AttemptsTab({ attempts, scope }: { attempts: StudentExamAttempt[]; scope: StudentProfile["scope"] }) {
  const router = useRouter();

  if (attempts.length === 0) {
    return (
      <div className="gv-card" style={{ padding: 40, textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 14.5, color: "var(--text-body)" }}>
          {scope === "teacher"
            ? "This student has not attempted any of your papers yet."
            : "No attempts yet. They will appear here once the student sits a paper."}
        </p>
      </div>
    );
  }

  const columns: Column<StudentExamAttempt & { id: string }>[] = [
    {
      key: "examTitle",
      label: "Paper",
      render: (a) => (
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text-heading)" }}>{a.examTitle}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {EXAM_STATUS_META[a.examStatus].label}
            {a.attemptNumber > 1 && ` · attempt ${a.attemptNumber}`}
          </div>
        </div>
      ),
    },
    {
      key: "sessionStatus",
      label: "Status",
      width: 180,
      render: (a) => {
        const b = attemptBadge(a);
        return <Badge tone={b.tone}>{b.label}</Badge>;
      },
    },
    {
      key: "score",
      label: "Score",
      width: 150,
      render: (a) => (
        <span style={{ fontSize: 13, fontWeight: a.score === null ? 400 : 600, color: a.score === null ? "var(--text-muted)" : "var(--text-heading)" }}>
          {formatScore(a)}
        </span>
      ),
    },
    {
      key: "startedAt",
      label: "Started",
      width: 130,
      render: (a) => <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{fmtPersonDate(a.startedAt)}</span>,
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={attempts.map((a) => ({ ...a, id: a.sessionId }))}
        onRowClick={(a) => router.push(`/coaching/exams/${a.examId}`)}
      />
      <p style={{ marginTop: 12, fontSize: 12.5, color: "var(--text-muted)" }}>
        &ldquo;Marked, not released&rdquo; means the paper is scored but the student cannot see the result
        yet — publishing the exam releases it.
      </p>
    </>
  );
}

function GuardiansTab({ guardians }: { guardians: GuardianRef[] }) {
  if (guardians.length === 0) {
    return (
      <div className="gv-card" style={{ padding: 40, textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 14.5, color: "var(--text-body)" }}>
          No guardian contacts yet. Add one from the Fees tab — fee reminders go to the primary guardian.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
      {guardians.map((g) => (
        <Card key={g.id} padding={18}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: "var(--text-heading)" }}>{g.name}</span>
            {g.isPrimary && <Badge tone="accent">Primary</Badge>}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", textTransform: "capitalize" }}>{g.relation}</div>
          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", columnGap: 8, rowGap: 4, fontSize: 13, color: "var(--text-body)" }}>
            {g.phone && (
              <>
                <span style={{ color: "var(--text-muted)" }}>Phone</span>
                <span>{g.phone}</span>
              </>
            )}
            {g.email && (
              <>
                <span style={{ color: "var(--text-muted)" }}>Email</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{g.email}</span>
              </>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function StudentDetailPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <StudentDetailInner />
    </Suspense>
  );
}

function PageLoading() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "var(--text-muted)" }}>
      Loading…
    </div>
  );
}

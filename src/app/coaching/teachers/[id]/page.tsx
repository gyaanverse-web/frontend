"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useTenantSession } from "@/lib/useTenantSession";
import { TeacherShell } from "@/components/dashboard/TeacherShell";
import {
  Avatar, Badge, Button, Card, DataTable, DetailRows, StatCard, Tabs,
  type Column, type DetailRow,
} from "@/components/ui";
import { EXAM_STATUS_META } from "@/lib/examStatus";
import { fmtPersonDate, type TeacherBatchRef, type TeacherPaperRef, type TeacherProfile } from "@/lib/people";

type Tenant = { id: string; slug: string; name: string };

/**
 * The owner's view of one teacher: contact, the batches they are assigned to,
 * and the papers they have authored.
 *
 * Owner-only, and the API agrees — `/tenant/people/teachers/:id` is guarded on
 * the `coaching_owner` membership, so a teacher reaching this URL gets a 403
 * from the route and this page's own `allow` bounces them before that.
 *
 * Papers never include a `draft`. The backend filters them out of the list AND
 * the count, because an owner who can see that a draft exists has been told
 * about an unfinished paper either way.
 */
export default function TeacherDetailPage() {
  const params = useParams();
  const router = useRouter();
  const teacherId = params?.id as string;

  const { loading, user, tenant, role } = useTenantSession<Tenant>({ allow: ["coaching_owner"] });

  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("Overview");

  useEffect(() => {
    if (!tenant) return;
    let cancelled = false;
    api
      .get<TeacherProfile>(`/tenant/people/teachers/${teacherId}`, { tenant: tenant.slug })
      .then((p) => { if (!cancelled) setProfile(p); })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load teacher");
      });
    return () => { cancelled = true; };
  }, [tenant, teacherId]);

  if (loading || !user || !tenant) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 14 }}>
        Loading…
      </div>
    );
  }

  const tabs = ["Overview", "Batches", "Papers"];

  return (
    <TeacherShell
      tenant={tenant}
      user={user}
      role={role}
      active="teachers"
      eyebrow="Institute · Teacher"
      title={profile?.teacher.name ?? "Teacher"}
    >
      <Button variant="ghost" size="sm" onClick={() => router.push("/coaching/teachers")} style={{ marginBottom: 16 }}>
        ← All teachers
      </Button>

      {error && (
        <p style={{ color: "var(--danger)", fontSize: 13, marginBottom: 16, padding: "10px 14px", border: "1px solid rgba(244,63,94,0.35)", background: "var(--danger-soft)", borderRadius: "var(--radius-md)" }}>
          {error}
        </p>
      )}

      {!profile ? (
        !error && <div className="gv-card" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading teacher…</div>
      ) : (
        <>
          <Card padding={18} style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <Avatar name={profile.teacher.name} size={52} />
            <div style={{ minWidth: 0, flex: "1 1 220px" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-heading)" }}>{profile.teacher.name}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>
                {profile.teacher.email ?? profile.teacher.phone ?? "No contact details"}
                {" · "}
                Joined {fmtPersonDate(profile.teacher.joinedAt)}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Badge tone={profile.workload.batchCount > 0 ? "accent" : "warning"}>
                {profile.workload.batchCount === 1 ? "1 batch" : `${profile.workload.batchCount} batches`}
              </Badge>
              <Badge tone="neutral">{profile.workload.paperCount} papers</Badge>
            </div>
          </Card>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 14, marginBottom: 20 }}>
            <StatCard label="Batches" value={profile.workload.batchCount} />
            <StatCard label="Students taught" value={profile.workload.studentCount} sub="approved, across their batches" />
            <StatCard label="Papers authored" value={profile.workload.paperCount} sub="drafts not counted" />
          </div>

          <Tabs tabs={tabs} value={tab} onChange={setTab} style={{ marginBottom: 20 }} />

          {tab === "Overview" && <OverviewTab profile={profile} />}
          {tab === "Batches" && <BatchesTab batches={profile.batches} />}
          {tab === "Papers" && <PapersTab papers={profile.papers} />}
        </>
      )}
    </TeacherShell>
  );
}

function OverviewTab({ profile }: { profile: TeacherProfile }) {
  const t = profile.teacher;
  const rows: DetailRow[] = [
    { label: "Name", value: t.name },
    {
      label: "Email",
      value: (
        <>
          {t.email ?? "—"}
          {t.email && (
            <span style={{ marginLeft: 8 }}>
              <Badge tone={t.emailVerified ? "success" : "warning"}>{t.emailVerified ? "Verified" : "Unverified"}</Badge>
            </span>
          )}
        </>
      ),
    },
    {
      label: "Phone",
      value: (
        <>
          {t.phone ?? "—"}
          {t.phone && (
            <span style={{ marginLeft: 8 }}>
              <Badge tone={t.phoneVerified ? "success" : "warning"}>{t.phoneVerified ? "Verified" : "Unverified"}</Badge>
            </span>
          )}
        </>
      ),
    },
    { label: "Joined this coaching", value: fmtPersonDate(t.joinedAt) },
    { label: "Account created", value: fmtPersonDate(t.accountCreatedAt) },
    {
      label: "User ID",
      value: <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>{t.id}</span>,
    },
  ];

  return (
    <Card padding={0}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-default)" }}>
        <h4 style={{ margin: 0, fontSize: 15 }}>Details</h4>
      </div>
      <DetailRows rows={rows} />
    </Card>
  );
}

function BatchesTab({ batches }: { batches: TeacherBatchRef[] }) {
  const router = useRouter();

  if (batches.length === 0) {
    return (
      <div className="gv-card" style={{ padding: 40, textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 14.5, color: "var(--text-body)" }}>
          Not assigned to any batch yet. Assign them from a batch&apos;s settings.
        </p>
      </div>
    );
  }

  const columns: Column<TeacherBatchRef>[] = [
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
      key: "studentCount",
      label: "Students",
      width: 110,
      render: (b) => <Badge tone={b.studentCount > 0 ? "success" : "neutral"}>{b.studentCount}</Badge>,
    },
    {
      key: "assignedAt",
      label: "Assigned",
      width: 130,
      render: (b) => <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{fmtPersonDate(b.assignedAt)}</span>,
    },
  ];

  return <DataTable columns={columns} rows={batches} onRowClick={(b) => router.push(`/coaching/batches/${b.id}`)} />;
}

function PapersTab({ papers }: { papers: TeacherPaperRef[] }) {
  const router = useRouter();

  if (papers.length === 0) {
    return (
      <div className="gv-card" style={{ padding: 40, textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 14.5, color: "var(--text-body)" }}>
          No papers submitted yet. Papers appear here once the teacher sends one for review —
          work in progress stays private to them.
        </p>
      </div>
    );
  }

  const columns: Column<TeacherPaperRef>[] = [
    {
      key: "title",
      label: "Paper",
      render: (p) => (
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--text-heading)" }}>{p.title}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {p.totalMarks} marks
            {p.scheduledAt && ` · ${fmtPersonDate(p.scheduledAt)}`}
          </div>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      width: 170,
      render: (p) => <Badge tone={EXAM_STATUS_META[p.status].tone}>{EXAM_STATUS_META[p.status].label}</Badge>,
    },
    {
      key: "createdAt",
      label: "Created",
      width: 130,
      render: (p) => <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{fmtPersonDate(p.createdAt)}</span>,
    },
  ];

  return (
    <>
      <DataTable columns={columns} rows={papers} onRowClick={(p) => router.push(`/coaching/exams/${p.id}`)} />
      <p style={{ marginTop: 12, fontSize: 12.5, color: "var(--text-muted)" }}>
        Drafts are not listed. A paper becomes visible to you when the teacher submits it for review.
      </p>
    </>
  );
}

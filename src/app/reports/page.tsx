"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { TeacherShell } from "@/components/dashboard/TeacherShell";
import { Card, Button, Badge } from "@/components/ui";
import type { BadgeTone } from "@/components/ui";

type SessionUser = { id: string; name: string; role?: string };
type Tenant = { id: string; slug: string; name: string };

type ReportStatus = "pending" | "ready" | "archived";

type ReportSummary = {
  id: string;
  sessionId: string;
  examId: string;
  examTitle: string;
  studentId: string;
  totalScore: number;
  maxScore: number;
  autoScore: number;
  aiScore: number;
  status: ReportStatus;
  publishedAt: string | null;
  createdAt: string;
};

const STATUS_TONE: Record<ReportStatus, BadgeTone> = {
  ready: "success",
  pending: "warning",
  archived: "neutral",
};

export default function ReportsPage() {
  const router = useRouter();

  const [reports, setReports] = useState<ReportSummary[] | null>(null);
  const [pageError, setPageError] = useState("");
  const [user, setUser] = useState<SessionUser | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);

  useEffect(() => {
    Promise.allSettled([
      api.get<{ user: SessionUser | null }>("/api/auth/get-session"),
      api.get<{ reports: ReportSummary[] }>("/reports"),
      api.get<{ tenant: Tenant }>("/tenants/me"),
    ]).then(([sr, rr, tr]) => {
      if (sr.status === "fulfilled" && !sr.value?.user) {
        router.push("/login?next=/reports");
        return;
      }
      if (sr.status === "fulfilled" && sr.value?.user) setUser(sr.value.user);
      if (tr.status === "fulfilled") setTenant(tr.value.tenant); // best-effort; sidebar renders regardless
      if (rr.status === "rejected") {
        const msg = rr.reason instanceof Error ? rr.reason.message : "Failed to load reports";
        if (msg.includes("401") || msg.includes("Unauthorized")) {
          router.push("/login?next=/reports");
          return;
        }
        setPageError(msg);
        setReports([]);
        return;
      }
      setReports(rr.value.reports);
    });
  }, [router]);

  return (
    <TeacherShell tenant={tenant} user={user} active="analytics" eyebrow="Your results" title="My reports">
      {pageError && (
        <p style={{ margin: "0 0 16px", padding: "10px 14px", background: "var(--danger-soft)", border: "1px solid rgba(244,63,94,0.35)", borderRadius: "var(--radius-md)", fontSize: 13, color: "var(--danger)" }}>
          {pageError}
        </p>
      )}

      {reports === null && !pageError && <div style={{ fontSize: 14, color: "var(--text-muted)" }}>Loading reports…</div>}

      {reports !== null && reports.length === 0 && !pageError && (
        <Card padding={0}>
          <div style={{ padding: "48px 24px", textAlign: "center" }}>
            <p style={{ margin: "0 0 16px", fontSize: 15, color: "var(--text-body)" }}>You haven&apos;t taken any exams yet.</p>
            <Link href="/exams/public">
              <Button variant="app" arrow>Browse exams</Button>
            </Link>
          </div>
        </Card>
      )}

      {reports && reports.length > 0 && (
        <>
          <Card padding={0}>
            <table className="gv-table">
              <thead>
                <tr>
                  <th>Exam</th>
                  <th style={{ textAlign: "right", width: 120 }}>Score</th>
                  <th style={{ textAlign: "center", width: 110 }}>Status</th>
                  <th style={{ textAlign: "right", width: 140 }}>Date</th>
                  <th style={{ width: 90 }} />
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => {
                  const pct = r.maxScore > 0 ? Math.round((r.totalScore / r.maxScore) * 100) : 0;
                  const scoreColor = pct >= 50 ? "var(--success)" : "var(--danger)";
                  const when = new Date(r.publishedAt ?? r.createdAt);
                  return (
                    <tr key={r.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: "var(--text-heading)" }}>{r.examTitle}</div>
                        {r.aiScore > 0 && (
                          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                            Objective {r.autoScore} + AI {r.aiScore}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span style={{ fontWeight: 700, color: scoreColor }}>{r.totalScore}</span>
                        <span style={{ color: "var(--text-muted)" }}> / {r.maxScore}</span>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{pct}%</div>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                      </td>
                      <td style={{ textAlign: "right", fontSize: 13, color: "var(--text-body)" }}>
                        {when.toLocaleDateString()}
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                          {when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Link href={`/exams/${r.examId}/results/${r.sessionId}`} className="gv-btn gv-btn--app gv-btn--sm" style={{ textDecoration: "none" }}>
                          <span>View</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
          <p style={{ marginTop: 12, fontSize: 12, color: "var(--text-muted)" }}>
            Showing {reports.length} report{reports.length === 1 ? "" : "s"}. Reports are kept until you delete your account.
          </p>
        </>
      )}
    </TeacherShell>
  );
}

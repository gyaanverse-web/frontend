"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { CSSProperties } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { getSession } from "@/lib/sessionStore";
import { NavBar } from "@/components/NavBar";
import { Badge, Card } from "@/components/ui";

type PublicExamPreview = {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  durationMins: number;
  gradeLevel: string | null;
  visibility: "public_free" | "public_paid";
  price: string | null;
  totalMarks: number;
  maxAttempts: number;
  status: string;
  publishedAt: string | null;
  scheduledAt: string | null;
  endsAt: string | null;
};



const cell: CSSProperties = {
  padding: "12px 18px",
  borderBottom: "1px solid var(--border-default)",
  fontSize: 14,
  color: "var(--text-body)",
  verticalAlign: "middle",
};

const lc: CSSProperties = {
  ...cell,
  width: 150,
  fontWeight: 600,
  whiteSpace: "nowrap",
  color: "var(--text-muted)",
};

export default function ExamPreviewPage() {
  const params = useParams();
  const examId = params.id as string;

  const [exam, setExam]         = useState<PublicExamPreview | null>(null);
  const [loading, setLoading]   = useState(true);
  const [pageError, setPageError] = useState("");
  const [navUser, setNavUser]   = useState<{ name: string } | null | undefined>(undefined);

  useEffect(() => {
    api.get<{ exam: PublicExamPreview }>(`/exams/${examId}/preview`)
      .then(d => setExam(d.exam))
      .catch(err => setPageError(err instanceof Error ? err.message : "Exam not found"))
      .finally(() => setLoading(false));
    getSession()
      .then(d => setNavUser(d.user ? { name: d.user.name } : null))
      .catch(() => setNavUser(null));
  }, [examId]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "var(--text-muted)", background: "var(--bg-page)" }}>
        Loading…
      </div>
    );
  }

  if (pageError || !exam) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, background: "var(--bg-page)" }}>
        <p style={{ color: "var(--danger)", fontSize: 14, margin: 0 }}>{pageError || "Exam not found."}</p>
        <Link href="/mocks" className="gv-btn gv-btn--secondary gv-btn--sm" style={{ gap: 6 }}>
          <span aria-hidden="true">←</span>
          <span>Browse Exams</span>
        </Link>
      </div>
    );
  }

  const isFree = exam.visibility === "public_free";
  const now = new Date();
  const hasStarted = !exam.scheduledAt || now >= new Date(exam.scheduledAt);
  const hasEnded   = !!exam.endsAt && now > new Date(exam.endsAt);
  const canTake    = exam.status === "published" && hasStarted && !hasEnded;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-page)" }}>

      <NavBar
        back={{ href: "/mocks", label: "Browse Exams" }}
        user={navUser}
        right={
          <Badge tone={isFree ? "success" : "warning"}>
            {isFree ? "Free" : `₹${exam.price}`}
          </Badge>
        }
      />

      <main style={{ flex: 1, padding: 28, display: "flex", justifyContent: "center" }}>
        <div style={{ maxWidth: 640, width: "100%" }}>

          {/* Exam card */}
          <Card padding={0} style={{ marginBottom: 20, overflow: "hidden" }}>
            <div style={{ padding: "20px 18px", borderBottom: "1px solid var(--border-default)" }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--text-heading)" }}>{exam.title}</h1>
              {exam.gradeLevel && (
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>Grade {exam.gradeLevel}</div>
              )}
            </div>

            {exam.description && (
              <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border-default)", fontSize: 14, color: "var(--text-body)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {exam.description}
              </div>
            )}

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr><td style={lc}>Total Marks</td><td style={cell}>{exam.totalMarks}</td></tr>
                <tr><td style={lc}>Duration</td><td style={cell}>{exam.durationMins} minutes</td></tr>
                <tr><td style={lc}>Max Attempts</td><td style={cell}>{exam.maxAttempts}</td></tr>
                <tr>
                  <td style={lc}>Access</td>
                  <td style={cell}>
                    <Badge tone={isFree ? "success" : "warning"}>
                      {isFree ? "Free" : `Paid — ₹${exam.price}`}
                    </Badge>
                  </td>
                </tr>
                {exam.scheduledAt && (
                  <tr><td style={lc}>Opens At</td><td style={cell}>{new Date(exam.scheduledAt).toLocaleString()}</td></tr>
                )}
                {exam.endsAt && (
                  <tr><td style={lc}>Closes At</td><td style={cell}>{new Date(exam.endsAt).toLocaleString()}</td></tr>
                )}
              </tbody>
            </table>
          </Card>

          {/* Instructions */}
          {exam.instructions && (
            <Card padding={18} style={{ marginBottom: 20, background: "var(--warning-soft)", borderColor: "var(--warning)" }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--warning)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Instructions
              </div>
              <div style={{ fontSize: 14, color: "var(--text-body)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                {exam.instructions}
              </div>
            </Card>
          )}

          {/* Availability notice */}
          {!canTake && (
            <Card padding={16} style={{ marginBottom: 20, background: "var(--surface-inset)", fontSize: 14, color: "var(--text-body)" }}>
              {hasEnded
                ? "This exam has ended and is no longer accepting submissions."
                : !hasStarted
                ? `This exam opens on ${new Date(exam.scheduledAt!).toLocaleString()}.`
                : "This exam is not currently available."}
            </Card>
          )}

          {/* CTA */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {canTake && (
              <Link href={`/student/exams/${exam.id}/intro`} className="gv-btn gv-btn--app gv-btn--md">
                {isFree ? "Start Exam →" : "Buy & Start →"}
              </Link>
            )}
            <Link href="/mocks" className="gv-btn gv-btn--secondary gv-btn--md" style={{ gap: 6 }}>
              <span aria-hidden="true">←</span>
              <span>Browse All Exams</span>
            </Link>
            <Link href="/login" className="gv-btn gv-btn--ghost gv-btn--md">Sign in to Dashboard</Link>
          </div>

        </div>
      </main>

      <footer style={{ borderTop: "1px solid var(--border-default)", padding: "14px 28px", fontSize: 13, color: "var(--text-muted)" }}>
        &copy; {new Date().getFullYear()} Gyaanverse
      </footer>
    </div>
  );
}

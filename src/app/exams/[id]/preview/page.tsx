"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { CSSProperties } from "react";
import { api } from "@/lib/api";
import { NavBar } from "@/components/NavBar";
import {
  btnPrimary as btnP,
  btnSecondary as btnS,
  labelCell,
  tableCell,
} from "@/lib/uiStyles";

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
  ...tableCell,
  padding: "8px 12px",
  borderBottom: "1px solid #eee",
};

const lc: CSSProperties = {
  ...labelCell,
  ...cell,
  width: "140px",
};

const btnPLink: CSSProperties = {
  ...btnP,
  textDecoration: "none",
  display: "inline-block",
};

const btnSLink: CSSProperties = {
  ...btnS,
  textDecoration: "none",
  display: "inline-block",
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
    api.get<{ user: { name: string } }>("/api/auth/get-session")
      .then(d => setNavUser(d.user ? { name: d.user.name } : null))
      .catch(() => setNavUser(null));
  }, [examId]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px" }}>
        Loading…
      </div>
    );
  }

  if (pageError || !exam) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px" }}>
        <p style={{ color: "#c00", fontSize: "13px" }}>{pageError || "Exam not found."}</p>
        <a href="/exams/public" style={{ ...btnS, fontSize: "13px", padding: "5px 14px" }}>← Browse Exams</a>
      </div>
    );
  }

  const isFree = exam.visibility === "public_free";
  const now = new Date();
  const hasStarted = !exam.scheduledAt || now >= new Date(exam.scheduledAt);
  const hasEnded   = !!exam.endsAt && now > new Date(exam.endsAt);
  const canTake    = exam.status === "published" && hasStarted && !hasEnded;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      <NavBar
        back={{ href: "/exams/public", label: "Browse Exams" }}
        user={navUser}
        right={
          <span style={{
            fontSize: "11px", fontWeight: "bold", padding: "2px 8px",
            background: isFree ? "#dcfce7" : "#fef9c3",
            color: isFree ? "#166534" : "#713f12",
            border: `1px solid ${isFree ? "#86efac" : "#fde068"}`,
          }}>
            {isFree ? "FREE" : `₹${exam.price}`}
          </span>
        }
      />

      <main style={{ flex: 1, padding: "24px", display: "flex", justifyContent: "center" }}>
        <div style={{ maxWidth: "600px", width: "100%" }}>

          {/* Exam card */}
          <div style={{ background: "#fff", border: "1px solid #aaa", marginBottom: "16px" }}>
            <div style={{ background: "#1a2e4a", color: "#fff", padding: "14px 18px" }}>
              <h1 style={{ margin: 0, fontSize: "18px", fontWeight: "bold" }}>{exam.title}</h1>
              {exam.gradeLevel && (
                <div style={{ fontSize: "12px", color: "#aac4e8", marginTop: "4px" }}>Grade {exam.gradeLevel}</div>
              )}
            </div>

            {exam.description && (
              <div style={{ padding: "14px 18px", borderBottom: "1px solid #eee", fontSize: "14px", color: "#333", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
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
                    <span style={{
                      padding: "2px 8px", fontSize: "12px", fontWeight: "bold",
                      background: isFree ? "#dcfce7" : "#fef9c3",
                      color: isFree ? "#166534" : "#713f12",
                      border: `1px solid ${isFree ? "#86efac" : "#fde068"}`,
                    }}>
                      {isFree ? "Free" : `Paid — ₹${exam.price}`}
                    </span>
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
          </div>

          {/* Instructions */}
          {exam.instructions && (
            <div style={{ background: "#fffbeb", border: "1px solid #f59e0b", padding: "14px 18px", marginBottom: "16px" }}>
              <div style={{ fontWeight: "bold", fontSize: "13px", color: "#92400e", marginBottom: "8px" }}>Instructions</div>
              <div style={{ fontSize: "13px", color: "#333", lineHeight: "1.7", whiteSpace: "pre-wrap" }}>
                {exam.instructions}
              </div>
            </div>
          )}

          {/* Availability notice */}
          {!canTake && (
            <div style={{ background: "#f3f4f6", border: "1px solid #d1d5db", padding: "12px 16px", marginBottom: "16px", fontSize: "13px", color: "#374151" }}>
              {hasEnded
                ? "This exam has ended and is no longer accepting submissions."
                : !hasStarted
                ? `This exam opens on ${new Date(exam.scheduledAt!).toLocaleString()}.`
                : "This exam is not currently available."}
            </div>
          )}

          {/* CTA */}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            {canTake && (
              <a href={`/exams/${exam.id}/take`} style={btnP}>
                {isFree ? "Start Exam →" : "Buy & Start →"}
              </a>
            )}
            <a href="/exams/public" style={btnS}>← Browse All Exams</a>
            <a href="/login" style={{ ...btnS, color: "#1a4db8", borderColor: "#1a4db8" }}>Sign in to Dashboard</a>
          </div>

        </div>
      </main>

      <footer style={{ background: "#ddd", borderTop: "1px solid #aaa", padding: "6px 16px", fontSize: "12px", color: "#333" }}>
        &copy; {new Date().getFullYear()} Gyanverse
      </footer>
    </div>
  );
}

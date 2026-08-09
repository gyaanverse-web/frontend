"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, hasTenantContext } from "@/lib/api";
import { getSession, invalidateSession } from "@/lib/sessionStore";
import { NavBar } from "@/components/NavBar";
import { Button, Badge, Card } from "@/components/ui";

type PublicExam = {
  id: string;
  title: string;
  description: string | null;
  durationMins: number;
  gradeLevel: string | null;
  subjectId: string | null;
  visibility: "public_free" | "public_paid";
  price: string | null;
  totalMarks: number;
  maxAttempts: number;
  publishedAt: string | null;
};

type Subject = {
  id: string;
  name: string;
  gradeLevel: string | null;
};




export default function PublicExamsPage() {
  const router = useRouter();
  const [exams, setExams]           = useState<PublicExam[]>([]);
  const [subjects, setSubjects]     = useState<Subject[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());
  const [navUser, setNavUser] = useState<{ name: string } | null | undefined>(undefined);

  const [gradeFilter, setGradeFilter]     = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");

  async function fetchExams(grade?: string, subjectId?: string) {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams();
      if (grade) params.set("gradeLevel", grade);
      if (subjectId) params.set("subjectId", subjectId);
      const path = `/exams/public${params.toString() ? `?${params}` : ""}`;
      const data = await api.get<{ exams: PublicExam[] }>(path);
      setExams(data.exams);
      return data.exams;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load exams");
      return [];
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    try { await api.post("/api/auth/sign-out", {}); } catch { /* ignore */ }
    invalidateSession();
    router.push("/login");
  }

  useEffect(() => {
    Promise.all([
      fetchExams(),
      getSession().catch(() => null),
      hasTenantContext()
        ? api.get<{ subjects: Subject[] }>("/tenant/subjects").catch(() => null)
        : Promise.resolve(null),
    ]).then(async ([examList, session, subjectsRes]) => {
      if (subjectsRes) setSubjects(subjectsRes.subjects);

      const u = session?.user ?? null;
      setNavUser(u ? { name: u.name } : null);

      if (!u) return;

      // Check purchase status for all paid exams in parallel
      const paidExams = examList.filter(e => e.visibility === "public_paid");
      if (paidExams.length === 0) return;

      const results = await Promise.allSettled(
        paidExams.map(e =>
          api.get<{ purchased: boolean }>(`/exams/${e.id}/purchase/status`)
        )
      );

      const purchased = new Set<string>();
      results.forEach((r, i) => {
        if (r.status === "fulfilled" && r.value.purchased) {
          purchased.add(paidExams[i].id);
        }
      });
      setPurchasedIds(purchased);
    });
  }, []);

  function handleFilter() {
    fetchExams(gradeFilter || undefined, subjectFilter || undefined);
  }

  function handleReset() {
    setGradeFilter(""); setSubjectFilter("");
    fetchExams();
  }

  const gradeLevels = Array.from(new Set(exams.map(e => e.gradeLevel).filter(Boolean))) as string[];

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-page)" }}>

      <NavBar activePage="exams" user={navUser} onSignOut={handleSignOut} />

      <main style={{ flex: 1, padding: 28 }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>

          {/* Filters */}
          <Card padding={20} style={{ marginBottom: 20, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={{ display: "block" }}>
              <span className="gv-label">Grade</span>
              <input
                className="gv-input"
                value={gradeFilter}
                onChange={e => setGradeFilter(e.target.value)}
                placeholder="e.g. 11, 12, JEE"
                list="grade-options"
                style={{ width: 170 }}
              />
              <datalist id="grade-options">
                {gradeLevels.map(g => <option key={g} value={g} />)}
              </datalist>
            </label>
            {subjects.length > 0 && (
              <label style={{ display: "block" }}>
                <span className="gv-label">Subject</span>
                <select className="gv-select" value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)} style={{ width: 200 }}>
                  <option value="">All subjects</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
            )}
            <Button variant="app" onClick={handleFilter}>Filter</Button>
            {(gradeFilter || subjectFilter) && (
              <Button variant="secondary" onClick={handleReset}>Reset</Button>
            )}
          </Card>

          {/* Results */}
          {loading ? (
            <div style={{ fontSize: 14, color: "var(--text-muted)", padding: "24px 0" }}>Loading…</div>
          ) : error ? (
            <Card padding={16} style={{ borderColor: "var(--danger)", background: "var(--danger-soft)", color: "var(--danger)", fontSize: 14 }}>
              {error}
            </Card>
          ) : exams.length === 0 ? (
            <div style={{ fontSize: 14, color: "var(--text-muted)", padding: "24px 0" }}>No public exams found.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {exams.map(exam => {
                const isFree = exam.visibility === "public_free";
                const needsPurchase = !isFree && !purchasedIds.has(exam.id);
                return (
                  <Card key={exam.id} padding={20} style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-heading)" }}>{exam.title}</span>
                        <Badge tone={isFree ? "success" : "warning"}>
                          {isFree ? "Free" : `₹${exam.price}`}
                        </Badge>
                        {exam.gradeLevel && <Badge tone="neutral">Grade {exam.gradeLevel}</Badge>}
                      </div>
                      {exam.description && (
                        <p style={{ margin: "0 0 8px", fontSize: 14, color: "var(--text-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {exam.description}
                        </p>
                      )}
                      <div style={{ fontSize: 13, color: "var(--text-muted)", display: "flex", gap: 16, flexWrap: "wrap" }}>
                        <span>{exam.durationMins} min</span>
                        <span>{exam.totalMarks} marks</span>
                        <span>Max {exam.maxAttempts} attempt{exam.maxAttempts !== 1 ? "s" : ""}</span>
                        {exam.publishedAt && <span>Published {new Date(exam.publishedAt).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                      <Link href={`/mocks/${exam.id}`} className="gv-btn gv-btn--secondary gv-btn--sm">
                        Preview
                      </Link>
                      <Link
                        href={`/student/exams/${exam.id}/intro`}
                        className={`gv-btn gv-btn--sm ${needsPurchase ? "gv-btn--accent" : "gv-btn--app"}`}
                      >
                        {needsPurchase ? `Buy ₹${exam.price}` : "Take Exam"}
                      </Link>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

        </div>
      </main>

      <footer style={{ borderTop: "1px solid var(--border-default)", padding: "14px 28px", fontSize: 13, color: "var(--text-muted)" }}>
        &copy; {new Date().getFullYear()} Gyanverse
      </footer>
    </div>
  );
}

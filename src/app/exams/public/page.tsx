"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, hasTenantContext } from "@/lib/api";
import { NavBar } from "@/components/NavBar";
import {
  btnPrimary as btnP,
  btnSecondary as btnS,
  inputBase as inp,
  linkButtonBase,
} from "@/lib/uiStyles";

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
    router.push("/login");
  }

  useEffect(() => {
    Promise.all([
      fetchExams(),
      api.get<{ user: { id: string; name: string } }>("/api/auth/get-session").catch(() => null),
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
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      <NavBar activePage="exams" user={navUser} onSignOut={handleSignOut} />

      <main style={{ flex: 1, padding: "20px 24px" }}>
        <div style={{ maxWidth: "900px" }}>

          {/* Filters */}
          <div style={{ background: "#fff", border: "1px solid #aaa", padding: "12px 16px", marginBottom: "16px", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <div style={{ fontSize: "11px", fontWeight: "bold", color: "#555", marginBottom: "4px" }}>GRADE</div>
              <input
                value={gradeFilter}
                onChange={e => setGradeFilter(e.target.value)}
                placeholder="e.g. 11, 12, JEE"
                list="grade-options"
                style={{ ...inp, width: "140px" }}
              />
              <datalist id="grade-options">
                {gradeLevels.map(g => <option key={g} value={g} />)}
              </datalist>
            </div>
            {subjects.length > 0 && (
              <div>
                <div style={{ fontSize: "11px", fontWeight: "bold", color: "#555", marginBottom: "4px" }}>SUBJECT</div>
                <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)} style={{ ...inp, padding: "5px 8px" }}>
                  <option value="">All subjects</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            <button onClick={handleFilter} style={btnP}>Filter</button>
            {(gradeFilter || subjectFilter) && (
              <button onClick={handleReset} style={btnS}>Reset</button>
            )}
          </div>

          {/* Results */}
          {loading ? (
            <div style={{ fontSize: "13px", color: "#555", padding: "20px 0" }}>Loading…</div>
          ) : error ? (
            <div style={{ color: "#c00", fontSize: "13px", padding: "10px", border: "1px solid #c00", background: "#fff5f5" }}>{error}</div>
          ) : exams.length === 0 ? (
            <div style={{ fontSize: "13px", color: "#555", padding: "20px 0" }}>No public exams found.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {exams.map(exam => (
                <div key={exam.id} style={{ background: "#fff", border: "1px solid #ddd", padding: "14px 16px", display: "flex", gap: "16px", alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginBottom: "4px" }}>
                      <span style={{ fontSize: "15px", fontWeight: "bold", color: "#111" }}>{exam.title}</span>
                      <span style={{
                        fontSize: "11px", fontWeight: "bold", padding: "1px 7px",
                        background: exam.visibility === "public_free" ? "#dcfce7" : "#fef9c3",
                        color: exam.visibility === "public_free" ? "#166534" : "#713f12",
                        border: `1px solid ${exam.visibility === "public_free" ? "#86efac" : "#fde068"}`,
                      }}>
                        {exam.visibility === "public_free" ? "FREE" : `₹${exam.price}`}
                      </span>
                      {exam.gradeLevel && (
                        <span style={{ fontSize: "11px", color: "#555", background: "#f0f0f0", padding: "1px 6px", border: "1px solid #ddd" }}>
                          Grade {exam.gradeLevel}
                        </span>
                      )}
                    </div>
                    {exam.description && (
                      <p style={{ margin: "0 0 6px", fontSize: "13px", color: "#555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {exam.description}
                      </p>
                    )}
                    <div style={{ fontSize: "12px", color: "#777", display: "flex", gap: "14px", flexWrap: "wrap" }}>
                      <span>{exam.durationMins} min</span>
                      <span>{exam.totalMarks} marks</span>
                      <span>Max {exam.maxAttempts} attempt{exam.maxAttempts !== 1 ? "s" : ""}</span>
                      {exam.publishedAt && <span>Published {new Date(exam.publishedAt).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: "6px" }}>
                    <a href={`/exams/${exam.id}/preview`} style={{ ...btnS, ...linkButtonBase, fontSize: "12px", padding: "4px 12px", textAlign: "center" }}>
                      Preview
                    </a>
                    <a
                      href={`/exams/${exam.id}/take`}
                      style={{
                        ...(exam.visibility === "public_paid" && !purchasedIds.has(exam.id) ? {
                          background: "#92400e", color: "#fff", border: "1px solid #92400e",
                        } : btnP),
                        ...linkButtonBase, fontSize: "12px", padding: "4px 12px", textAlign: "center", fontWeight: "bold", cursor: "pointer",
                      }}
                    >
                      {exam.visibility === "public_paid" && !purchasedIds.has(exam.id)
                        ? `Buy ₹${exam.price}`
                        : "Take Exam"}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </main>

      <footer style={{ background: "#ddd", borderTop: "1px solid #aaa", padding: "6px 16px", fontSize: "12px", color: "#333" }}>
        &copy; {new Date().getFullYear()} Gyanverse
      </footer>
    </div>
  );
}

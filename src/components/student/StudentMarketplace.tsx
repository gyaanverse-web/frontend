"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TeacherShell } from "@/components/dashboard/TeacherShell";
import { Card, Badge, Button, Icon, Input, Select } from "@/components/ui";
import { api } from "@/lib/api";
import { useUrlSearch, useUrlState } from "@/lib/useUrlState";

type ShellUser = { name: string; role?: string };
type ShellTenant = { name: string; slug: string } | null;

// ── Backend contracts (mirror /exams/public and /tenant/subjects) ──────────────
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

type Subject = { id: string; name: string; gradeLevel: string | null };

type PriceFilter = "Free & Paid" | "Free only" | "Paid only";

// The dropdown reads in prose; the URL reads in slugs. `?price=free` says the
// same thing as "Free only" without the ampersand and spaces.
const PRICE_BY_SLUG: Record<string, PriceFilter> = {
  all: "Free & Paid",
  free: "Free only",
  paid: "Paid only",
};
const SLUG_BY_PRICE: Record<PriceFilter, string> = {
  "Free & Paid": "all",
  "Free only": "free",
  "Paid only": "paid",
};
const PRICE_SLUGS: readonly string[] = Object.keys(PRICE_BY_SLUG);

function priceLabel(e: PublicExam): string {
  return e.visibility === "public_free" ? "Free" : `₹${e.price ?? "—"}`;
}

function MockCard({
  m,
  subjectName,
  owned,
  onOpen,
}: {
  m: PublicExam;
  subjectName: string | null;
  owned: boolean;
  onOpen: (m: PublicExam) => void;
}) {
  const isFree = m.visibility === "public_free";
  const startable = isFree || owned;
  return (
    <Card padding={20} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Icon name="file-text" size={20} style={{ color: "var(--accent)" }} />
        {owned ? (
          <Badge tone="success">Purchased</Badge>
        ) : (
          <Badge tone={isFree ? "success" : "accent"}>{priceLabel(m)}</Badge>
        )}
      </div>
      <div>
        <h4 style={{ margin: "0 0 2px", fontSize: 15, color: "var(--text-heading)" }}>{m.title}</h4>
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: 0 }}>
          {subjectName ?? (m.gradeLevel ? `Grade ${m.gradeLevel}` : "Public mock")}
        </p>
      </div>
      <div style={{ display: "flex", gap: 10, fontSize: 12, color: "var(--text-body)" }}>
        <span>{m.durationMins} min</span>
        <span>·</span>
        <span>{m.totalMarks} marks</span>
        <span>·</span>
        <span>Max {m.maxAttempts}</span>
      </div>
      <Button variant={startable ? "app" : "secondary"} size="sm" onClick={() => onOpen(m)}>
        {startable ? "Start attempt" : `Buy for ${priceLabel(m)}`}
      </Button>
    </Card>
  );
}

export function StudentMarketplace({ user, tenant }: { user: ShellUser; tenant: ShellTenant }) {
  const router = useRouter();

  const [exams, setExams] = useState<PublicExam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      api.get<{ exams: PublicExam[] }>("/exams/public"),
      api.get<{ subjects: Subject[] }>("/tenant/subjects").catch(() => ({ subjects: [] as Subject[] })),
    ])
      .then(async ([examRes, subjectRes]) => {
        if (cancelled) return;
        setExams(examRes.exams);
        setSubjects(subjectRes.subjects);

        // Purchase status for paid mocks (parallel; failures = not purchased).
        const paid = examRes.exams.filter((e) => e.visibility === "public_paid");
        if (paid.length > 0) {
          const results = await Promise.allSettled(
            paid.map((e) => api.get<{ purchased: boolean }>(`/exams/${e.id}/purchase/status`)),
          );
          if (cancelled) return;
          const owned = new Set<string>();
          results.forEach((r, i) => {
            if (r.status === "fulfilled" && r.value.purchased) owned.add(paid[i].id);
          });
          setPurchasedIds(owned);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load mocks");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s.name])), [subjects]);
  const grades = useMemo(
    () => Array.from(new Set(exams.map((e) => e.gradeLevel).filter(Boolean))) as string[],
    [exams],
  );

  const subjectOptions = ["All subjects", ...subjects.map((s) => s.name)];
  const gradeOptions = ["All grades", ...grades.map((g) => `Grade ${g}`)];

  // Filters live in the URL so a student can share "the free Physics mocks" as a
  // link, and so coming back from an exam they opened restores the list they
  // were browsing instead of the unfiltered grid.
  //
  // Subject and grade accept whatever the catalog currently offers, which is
  // only known after the fetch — until then the options list is just the "All …"
  // sentinel and a deep-linked value reads as that. It resolves itself on the
  // render after the data lands, and nothing is written to the URL meanwhile.
  const [search, setSearch] = useUrlSearch("q");
  const [subjectFilter, setSubjectFilter] = useUrlState("subject", subjectOptions, "All subjects");
  const [gradeFilter, setGradeFilter] = useUrlState("grade", gradeOptions, "All grades");
  const [priceSlug, setPriceSlug] = useUrlState("price", PRICE_SLUGS, "all");
  const priceFilter = PRICE_BY_SLUG[priceSlug];

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return exams.filter((e) => {
      if (q && !e.title.toLowerCase().includes(q)) return false;
      if (subjectFilter !== "All subjects" && subjectById.get(e.subjectId ?? "") !== subjectFilter) return false;
      if (gradeFilter !== "All grades" && `Grade ${e.gradeLevel}` !== gradeFilter && e.gradeLevel !== gradeFilter)
        return false;
      if (priceFilter === "Free only" && e.visibility !== "public_free") return false;
      if (priceFilter === "Paid only" && e.visibility !== "public_paid") return false;
      return true;
    });
  }, [exams, search, subjectFilter, gradeFilter, priceFilter, subjectById]);

  // The intro screen resolves purchase state itself (free/assigned/purchased →
  // start; unpurchased paid → checkout wall), so every card lands there.
  function openMock(m: PublicExam) {
    router.push(`/student/exams/${m.id}/intro`);
  }

  return (
    <TeacherShell tenant={tenant} user={user} role="student" active="marketplace" noCoaching={!tenant}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
            Discover
          </div>
          <h2 style={{ fontSize: 26, margin: 0 }}>Public mock tests</h2>
        </div>

        {/* ── Filters ──────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          <Input
            placeholder="Search mocks…"
            wrapperStyle={{ flex: 1 }}
            style={{ width: "100%" }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            options={subjectOptions}
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            wrapperStyle={{ width: 170 }}
          />
          <Select
            options={gradeOptions}
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            wrapperStyle={{ width: 150 }}
          />
          <Select
            options={["Free & Paid", "Free only", "Paid only"]}
            value={priceFilter}
            onChange={(e) => setPriceSlug(SLUG_BY_PRICE[e.target.value as PriceFilter])}
            wrapperStyle={{ width: 150 }}
          />
        </div>

        {/* ── Grid ─────────────────────────────────────────────────────────── */}
        {loading ? (
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Loading mocks…</p>
        ) : error ? (
          <Card padding={20} style={{ color: "var(--danger)", fontSize: 14 }}>{error}</Card>
        ) : visible.length === 0 ? (
          <Card padding={40} style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
            No mocks match your filters.
          </Card>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {visible.map((m) => (
              <MockCard
                key={m.id}
                m={m}
                subjectName={m.subjectId ? subjectById.get(m.subjectId) ?? null : null}
                owned={purchasedIds.has(m.id)}
                onOpen={openMock}
              />
            ))}
          </div>
        )}
      </div>
    </TeacherShell>
  );
}

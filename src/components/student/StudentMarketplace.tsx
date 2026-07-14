"use client";

import { useRouter } from "next/navigation";
import { TeacherShell } from "@/components/dashboard/TeacherShell";
import { Card, Badge, Button, Icon, Input, Select } from "@/components/ui";

type ShellUser = { name: string; role?: string };
type ShellTenant = { name: string; slug: string } | null;

type Mock = {
  title: string;
  by: string;
  q: number;
  dur: string;
  marks: number;
  attempts: string;
  price: string;
  owned?: boolean;
};

// ── Placeholder data ──────────────────────────────────────────────────────────
// Mirrors the approved design. TODO: wire to the public mocks endpoint
// (the real functional marketplace still lives at /exams/public) once confirmed.
const MOCKS: Mock[] = [
  { title: "JEE Main Full Mock #4 — Full Syllabus", by: "Sharma Classes", q: 90, dur: "180 min", marks: 300, attempts: "1.2k", price: "Free" },
  { title: "NEET Biology Sprint", by: "Apex Academy", q: 45, dur: "60 min", marks: 180, attempts: "860", price: "₹49" },
  { title: "Class 12 Boards — Physics", by: "Sharma Classes", q: 35, dur: "90 min", marks: 70, attempts: "540", price: "Free" },
  { title: "JEE Advanced Maths Set 2", by: "Pinnacle Coaching", q: 54, dur: "180 min", marks: 183, attempts: "410", price: "₹99" },
  { title: "NEET Chemistry Rapid", by: "Apex Academy", q: 45, dur: "60 min", marks: 180, attempts: "702", price: "Free" },
  { title: "Mock Test Series — Full", by: "Pinnacle Coaching", q: 180, dur: "360 min", marks: 720, attempts: "1.4k", price: "₹199", owned: true },
];

function MockCard({ m, onOpen }: { m: Mock; onOpen: (m: Mock) => void }) {
  const startable = m.price === "Free" || m.owned;
  return (
    <Card padding={20} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Icon name="file-text" size={20} style={{ color: "var(--accent)" }} />
        {m.owned ? (
          <Badge tone="success">Purchased</Badge>
        ) : (
          <Badge tone={m.price === "Free" ? "success" : "accent"}>{m.price}</Badge>
        )}
      </div>
      <div>
        <h4 style={{ margin: "0 0 2px", fontSize: 15, color: "var(--text-heading)" }}>{m.title}</h4>
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", margin: 0 }}>{m.by}</p>
      </div>
      <div style={{ display: "flex", gap: 10, fontSize: 12, color: "var(--text-body)" }}>
        <span>{m.q} Q</span><span>·</span><span>{m.dur}</span><span>·</span><span>{m.marks} marks</span>
      </div>
      <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{m.attempts} attempts</div>
      <Button variant={startable ? "app" : "secondary"} size="sm" onClick={() => onOpen(m)}>
        {startable ? "Start attempt" : `Buy for ${m.price}`}
      </Button>
    </Card>
  );
}

export function StudentMarketplace({ user, tenant }: { user: ShellUser; tenant: ShellTenant }) {
  const router = useRouter();

  // TODO wire API: route to the mock preview / checkout screens once built. For now
  // every card hands off to the existing functional public marketplace.
  function openMock(_m: Mock) {
    router.push("/exams/public");
  }

  return (
    <TeacherShell tenant={tenant} user={user} active="marketplace">
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
            Discover
          </div>
          <h2 style={{ fontSize: 26, margin: 0 }}>Public mock tests</h2>
        </div>

        {/* ── Filters ──────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          <Input placeholder="Search mocks…" wrapperStyle={{ flex: 1 }} style={{ width: "100%" }} />
          <Select options={["All subjects", "Physics", "Chemistry", "Maths", "Biology"]} wrapperStyle={{ width: 170 }} />
          <Select options={["All grades", "Class 11", "Class 12"]} wrapperStyle={{ width: 150 }} />
          <Select options={["Free & Paid", "Free only", "Paid only"]} wrapperStyle={{ width: 150 }} />
        </div>

        {/* ── Grid ─────────────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {MOCKS.map((m) => (
            <MockCard key={m.title} m={m} onOpen={openMock} />
          ))}
        </div>
      </div>
    </TeacherShell>
  );
}

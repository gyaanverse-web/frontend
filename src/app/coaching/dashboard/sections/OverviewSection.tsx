"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Card, Badge, Button, Icon, Eyebrow } from "@/components/ui";
import type { IconName } from "@/components/ui";
import { PLANS, fmtLimit, type PlanName, type Tenant, type Member, type Class, type Exam } from "../types";
import { examStatusLabel } from "@/lib/examStatus";

/**
 * `isOwner` gates the commercial/administrative half of this screen.
 *
 * Overview is a shared staff screen, so a teacher lands here too — but plan
 * usage, upgrades and invites are the owner's business, and both of those
 * buttons navigate to OWNER_ONLY_SCREENS that simply bounce a teacher back
 * here. Hiding them removes information a teacher has no use for AND two
 * controls that silently did nothing.
 */
type Props = { tenant: Tenant; isOwner: boolean; onNavigate: (screen: string) => void };

type ActivityItem = { icon: IconName; text: string; date: number; tone: "success" | "accent" | "danger" | "neutral" };

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function OverviewSection({ tenant, isOwner, onNavigate }: Props) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [classes, setClasses] = useState<Class[] | null>(null);
  const [exams, setExams] = useState<Exam[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const opts = { tenant: tenant.slug };
    Promise.allSettled([
      api.get<{ members: Member[] }>("/tenant/members", opts),
      api.get<{ classes: Class[] }>("/tenant/classes", opts),
      api.get<{ exams: Exam[] }>("/tenant/exams", opts),
    ]).then(([m, c, e]) => {
      if (m.status === "fulfilled") setMembers(m.value.members);
      if (c.status === "fulfilled") setClasses(c.value.classes);
      if (e.status === "fulfilled") setExams(e.value.exams);
      setLoading(false);
    });
  }, [tenant.slug]);

  const plan = (["free", "starter", "growth", "pro"].includes(tenant.plan) ? tenant.plan : "free") as PlanName;
  const limits = PLANS[plan].limits;

  const studentCount = members?.filter((m) => m.role === "student").length ?? null;
  const teacherCount = members?.filter((m) => m.role === "teacher").length ?? null;
  const batchCount = classes?.length ?? null;

  const now = new Date();
  const mocksThisMonth =
    exams?.filter((x) => {
      const d = new Date(x.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length ?? null;

  // ── Recent activity, derived from real members + exams ──────────────────────
  const activity: ActivityItem[] = [];
  for (const m of members ?? []) {
    if (m.role === "coaching_owner") continue;
    activity.push({
      icon: m.role === "teacher" ? "users" : "graduation-cap",
      text: `${m.name} joined as ${m.role === "teacher" ? "teacher" : "student"}`,
      date: new Date(m.joinedAt).getTime(),
      tone: "success",
    });
  }
  for (const x of exams ?? []) {
    activity.push({
      icon: "file-text",
      text: `${x.title} — ${examStatusLabel(x.status)}`,
      date: new Date(x.createdAt).getTime(),
      tone: x.status === "live" || x.status === "ready_to_publish" ? "accent" : "neutral",
    });
  }
  activity.sort((a, b) => b.date - a.date);
  const recent = activity.slice(0, 6);

  const toneColor = (t: ActivityItem["tone"]) =>
    t === "danger" ? "var(--danger)" : t === "success" ? "var(--success)" : t === "neutral" ? "var(--text-muted)" : "var(--accent)";
  const toneBg = (t: ActivityItem["tone"]) =>
    t === "danger" ? "var(--danger-soft)" : t === "success" ? "var(--success-soft)" : t === "neutral" ? "var(--surface-inset)" : "var(--accent-soft)";

  return (
    <div>
      {/* Page head */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginBottom: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Eyebrow>{tenant.name}</Eyebrow>
          <h2 style={{ fontSize: 26, margin: 0 }}>Institute overview</h2>
        </div>
        <div style={{ flex: 1 }} />
        {isOwner && (
          <Button variant="app" icon={<Icon name="users" size={15} />} onClick={() => onNavigate("Invites / Join Codes")}>
            Invite member
          </Button>
        )}
      </div>

      {/* Activity + plan usage. With no plan card the activity list takes the
          full width rather than leaving a 300px gap where it used to sit. */}
      <div style={{ display: "grid", gridTemplateColumns: isOwner ? "minmax(0, 1fr) 300px" : "minmax(0, 1fr)", gap: 18, alignItems: "start" }}>
        <Card padding={0}>
          <div style={{ padding: "13px 18px", borderBottom: "1px solid var(--border-default)", display: "flex", alignItems: "center" }}>
            <h4 style={{ flex: 1, margin: 0, fontSize: 14 }}>Recent activity</h4>
            <Badge tone="neutral">Latest</Badge>
          </div>
          {loading ? (
            <div style={{ padding: "18px", fontSize: 13, color: "var(--text-muted)" }}>Loading activity…</div>
          ) : recent.length === 0 ? (
            <div style={{ padding: "28px 18px", fontSize: 13, color: "var(--text-muted)", textAlign: "center" }}>
              No recent activity yet. Invite members and publish exams to get started.
            </div>
          ) : (
            recent.map((a, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "11px 18px",
                  borderBottom: i < recent.length - 1 ? "1px solid var(--border-default)" : "none",
                }}
              >
                <div style={{ width: 30, height: 30, borderRadius: 99, flexShrink: 0, background: toneBg(a.tone), display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon name={a.icon} size={14} style={{ color: toneColor(a.tone) }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, color: "var(--text-heading)", fontFamily: "var(--font-body)", lineHeight: 1.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {a.text}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{relativeTime(a.date)}</div>
                </div>
              </div>
            ))
          )}
        </Card>

        {isOwner && (
          <Card padding={18}>
            <h4 style={{ margin: "0 0 14px", fontSize: 14 }}>Plan usage</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              <UsageBar label="Students" used={studentCount} max={limits.students} />
              <UsageBar label="Teachers" used={teacherCount} max={limits.teachers} />
              <UsageBar label="Batches" used={batchCount} max={limits.classes} />
              <UsageBar label="Mocks (mo)" used={mocksThisMonth} max={limits.mocks_per_month} />
            </div>
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--border-default)" }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-body)", marginBottom: 10 }}>
                {PLANS[plan].label} plan
              </div>
              {plan !== "pro" && (
                <Button variant="app" size="sm" arrow style={{ width: "100%" }} onClick={() => onNavigate("Plan & Billing")}>
                  Upgrade plan
                </Button>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function UsageBar({ label, used, max }: { label: string; used: number | null; max: number }) {
  const unlimited = max >= 99999;
  const pct = used === null || unlimited ? 0 : Math.min(100, Math.round((used / max) * 100));
  const color = pct >= 90 ? "var(--danger)" : pct >= 72 ? "var(--warning)" : "var(--accent)";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontFamily: "var(--font-body)", marginBottom: 5 }}>
        <span style={{ color: "var(--text-body)" }}>{label}</span>
        <span style={{ color: "var(--text-heading)", fontWeight: 600 }}>
          {used === null ? "—" : used} / {fmtLimit(max)}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 99, background: "var(--surface-inset)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99 }} />
      </div>
    </div>
  );
}

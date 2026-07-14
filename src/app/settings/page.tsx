"use client";

import { useEffect, useState } from "react";
import { PageShell } from "@/components/dashboard/PageShell";
import { Card, Switch, Icon } from "@/components/ui";
import { notifApi } from "@/lib/notifications";
import type { NotificationType } from "@/lib/notifications";

// User-facing copy for each toggleable type. Only types that actually send an
// outbound channel (email or SMS) appear here — `class_update` is in-app only
// and always shows in the bell, so there is nothing to toggle for it.
const NOTIF_TYPES: {
  type: NotificationType;
  label: string;
  description: string;
  channel: string;
}[] = [
  {
    type: "exam_assigned",
    label: "New exam assigned",
    description: "When a teacher assigns you a new exam or mock test.",
    channel: "Email",
  },
  {
    type: "exam_starting_soon",
    label: "Exam starting soon",
    description: "A reminder shortly before a scheduled exam begins.",
    channel: "SMS",
  },
  {
    type: "result_ready",
    label: "Result ready",
    description: "When your exam has been evaluated and results are out.",
    channel: "Email",
  },
  {
    type: "invite_received",
    label: "Invitation received",
    description: "When you are invited to join a class or coaching.",
    channel: "Email",
  },
  {
    type: "invite_accepted",
    label: "Invitation accepted",
    description: "When someone accepts an invitation you sent.",
    channel: "Email",
  },
  {
    type: "payment_confirmed",
    label: "Payment confirmed",
    description: "Receipts and confirmations for successful payments.",
    channel: "Email",
  },
  {
    type: "payment_failed",
    label: "Payment failed",
    description: "Alerts when a payment could not be processed.",
    channel: "Email + SMS",
  },
  {
    type: "plan_limit_warning",
    label: "Plan limit warnings",
    description: "When your coaching is close to a plan limit.",
    channel: "Email",
  },
];

export default function SettingsPage() {
  // undefined = still loading; a Set holds the types that are muted (off).
  const [muted, setMuted] = useState<Set<NotificationType> | null>(null);
  const [saving, setSaving] = useState<NotificationType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    notifApi
      .getPreferences()
      .then((r) => {
        const off = new Set<NotificationType>();
        for (const p of r.preferences) {
          // A type is "off" only when both outbound channels are disabled.
          if (!p.emailEnabled && !p.smsEnabled) off.add(p.type);
        }
        setMuted(off);
      })
      .catch(() => {
        // No saved preferences yet → everything defaults on.
        setMuted(new Set());
      });
  }, []);

  async function toggle(type: NotificationType, enabled: boolean) {
    if (!muted) return;
    setSaving(type);
    setError(null);

    // Optimistic update
    const next = new Set(muted);
    if (enabled) next.delete(type);
    else next.add(type);
    setMuted(next);

    try {
      await notifApi.setPreference(type, enabled);
    } catch {
      // Roll back on failure
      setMuted(muted);
      setError("Couldn't save that change. Please try again.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <PageShell eyebrow="Settings" title="Notification preferences" maxWidth={720}>
      <Card padding={0}>
        {/* Intro / in-app note */}
        <div
          style={{
            display: "flex",
            gap: 12,
            padding: "18px 22px",
            borderBottom: "1px solid var(--border-default)",
            alignItems: "flex-start",
          }}
        >
          <span style={{ color: "var(--accent)", marginTop: 1 }}>
            <Icon name="bell" size={18} />
          </span>
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 13,
              color: "var(--text-body)",
              lineHeight: 1.5,
            }}
          >
            Choose which updates reach you by email and SMS. Everything always
            appears in your in-app notification bell — these switches only control
            the outbound email &amp; SMS alerts. All are on by default.
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: "10px 22px",
              background: "var(--danger-soft, rgba(220,38,38,0.08))",
              color: "var(--danger)",
              fontSize: 13,
              fontFamily: "var(--font-body)",
              borderBottom: "1px solid var(--border-default)",
            }}
          >
            {error}
          </div>
        )}

        {/* Rows */}
        {NOTIF_TYPES.map((t, i) => {
          const isOn = muted ? !muted.has(t.type) : true;
          return (
            <div
              key={t.type}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "16px 22px",
                borderBottom:
                  i < NOTIF_TYPES.length - 1
                    ? "1px solid var(--border-default)"
                    : "none",
                opacity: muted === null ? 0.5 : 1,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontFamily: "var(--font-sans)",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--text-heading)",
                    marginBottom: 3,
                  }}
                >
                  {t.label}
                  <span
                    className="gv-badge"
                    style={{
                      padding: "1px 7px",
                      fontSize: 10,
                      color: "var(--text-muted)",
                      background: "var(--surface-inset)",
                      borderRadius: 999,
                      fontWeight: 600,
                    }}
                  >
                    {t.channel}
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 12.5,
                    color: "var(--text-muted)",
                    lineHeight: 1.4,
                  }}
                >
                  {t.description}
                </div>
              </div>

              <Switch
                checked={isOn}
                disabled={muted === null || saving === t.type}
                onChange={(e) => toggle(t.type, e.target.checked)}
                aria-label={`Toggle ${t.label} alerts`}
              />
            </div>
          );
        })}
      </Card>
    </PageShell>
  );
}

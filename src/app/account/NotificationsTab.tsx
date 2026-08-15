"use client";

import { useEffect, useState } from "react";
import { Card, Switch, Icon } from "@/components/ui";
import { notifApi } from "@/lib/notifications";
import type { NotificationType } from "@/lib/notifications";

/**
 * Which outbound alerts reach this user.
 *
 * ── What is deliberately NOT listed here ────────────────────────────────────
 *
 * Only types that (a) send an outbound channel and (b) have a real emitter in
 * the backend. Two separate exclusions:
 *
 *  - `class_update` is in-app only. It always shows in the bell, so there is
 *    nothing to toggle.
 *  - `exam_starting_soon`, `payment_failed` and `plan_limit_warning` are declared
 *    in `notification.types.ts` and have email/SMS templates, but NOTHING IN THE
 *    BACKEND EVER EMITS THEM — there is no call site for any of the three. They
 *    used to appear here, so a user could switch off an alert that could never
 *    have arrived, and switch on one that still never would. The types and
 *    templates are intentionally left in place server-side; add the row back here
 *    the same day a sender starts firing, not before.
 */
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
];

export function NotificationsTab() {
  // null = still loading; a Set holds the types that are muted (off).
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
        // No saved preferences yet → everything defaults on. This is now a
        // genuine "nothing saved" case: the route no longer requires a coaching
        // membership, so a coaching-less student does not land here via a 403
        // and get shown switches that cannot be saved.
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
  );
}

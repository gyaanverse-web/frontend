import { api, hasTenantContext } from "./api";

function notifPath(suffix = ""): string {
  return hasTenantContext()
    ? `/tenant/notifications${suffix}`
    : `/notifications${suffix}`;
}

export type NotificationType =
  | "exam_assigned"
  | "exam_starting_soon"
  | "result_ready"
  | "class_update"
  | "invite_received"
  | "invite_accepted"
  | "payment_confirmed"
  | "payment_failed"
  | "plan_limit_warning";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export interface Notification {
  id: string;
  userId: string;
  tenantId: string | null;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  priority: NotificationPriority;
  readAt: string | null;
  archivedAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface NotificationPage {
  items: Notification[];
  nextCursor: string | null;
}

export interface NotificationPreference {
  type: NotificationType;
  emailEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;
}

export const notifApi = {
  list: (cursor?: string) =>
    api.get<NotificationPage>(
      notifPath(cursor ? `?cursor=${encodeURIComponent(cursor)}` : "")
    ),

  unreadCount: () =>
    api.get<{ count: number }>(notifPath("/unread-count")),

  markRead: (id: string) =>
    api.patch<{ ok: true }>(notifPath(`/${id}/read`), {}),

  markAllRead: () =>
    api.patch<{ ok: true }>(notifPath("/read-all"), {}),

  archive: (id: string) =>
    api.delete<{ ok: true }>(notifPath(`/${id}`)),

  // ── Preferences (tenant-scoped only) ──────────────────────────────────────
  getPreferences: () =>
    api.get<{ preferences: NotificationPreference[] }>(
      "/tenant/notifications/preferences"
    ),

  // One toggle per type: "on" delivers email/SMS per the type's config, "off"
  // mutes both outbound channels. In-app is always kept on server-side.
  setPreference: (type: NotificationType, enabled: boolean) =>
    api.patch<{ ok: true }>(`/tenant/notifications/preferences/${type}`, {
      emailEnabled: enabled,
      smsEnabled: enabled,
    }),
};

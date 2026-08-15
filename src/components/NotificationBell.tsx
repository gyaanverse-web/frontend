"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { notifApi } from "@/lib/notifications";
import { resolveTenantSlug, hasTenantContext } from "@/lib/api";
import type { Notification, NotificationType } from "@/lib/notifications";
import { Icon } from "@/components/ui/Icon";

// Mirror api.ts: on *.lvh.me the API lives on the same subdomain, port 8000.
// Keeps SSE same-site with the page so the session cookie is sent.
function getApiBase(): string {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  }
  const host = window.location.hostname;
  if (host.endsWith(".lvh.me")) return `http://${host}:8000`;
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
}

// ── Sound ─────────────────────────────────────────────────────────────────────
// A short two-note "ding" synthesised with the Web Audio API — no asset to ship
// and no network request. The AudioContext is created lazily on first use.

const SOUND_PREF_KEY = "gv-notif-sound"; // "off" = muted; anything else = on

let audioCtx: AudioContext | null = null;

function playChime() {
  try {
    if (!audioCtx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctx) return;
      audioCtx = new Ctx();
    }
    const ctx = audioCtx;
    if (ctx.state === "suspended") void ctx.resume();

    const now = ctx.currentTime;
    // Two ascending notes (E6 → A6) for a gentle bell-like cue.
    const notes = [
      { freq: 1318.51, at: 0 },
      { freq: 1760.0, at: 0.11 },
    ];
    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = n.freq;
      const t = now + n.at;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    }
  } catch {
    // Autoplay blocked or Web Audio unavailable — fail silently.
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Type → dot colour, drawn from DS semantic tokens where one fits.
const TYPE_DOT: Record<NotificationType, string> = {
  exam_assigned:      "var(--accent)",
  exam_starting_soon: "var(--danger)",
  result_ready:       "var(--success)",
  class_update:       "#7c3aed",
  invite_received:    "var(--accent)",
  invite_accepted:    "var(--success)",
  payment_confirmed:  "var(--success)",
  payment_failed:     "var(--danger)",
  plan_limit_warning: "var(--warning)",
};

// ── Sub-component: single notification row ────────────────────────────────────

function NotifItem({
  n,
  onClick,
  onArchive,
}: {
  n: Notification;
  onClick: () => void;
  onArchive: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isUnread = !n.readAt;
  const dot = TYPE_DOT[n.type] ?? "var(--text-muted)";

  const row: CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "11px 14px",
    borderBottom: "1px solid var(--border-default)",
    background: hovered
      ? "var(--surface-inset)"
      : isUnread
        ? "var(--accent-soft)"
        : "var(--surface-card)",
    cursor: n.link ? "pointer" : "default",
    transition: "background var(--duration-fast) var(--ease-out)",
  };

  return (
    <div
      style={row}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Priority / type dot */}
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: dot,
          flexShrink: 0,
          marginTop: 6,
          opacity: isUnread ? 1 : 0.35,
        }}
      />

      {/* Text block */}
      <div style={{ flex: 1, overflow: "hidden" }} onClick={onClick}>
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 13,
            fontWeight: isUnread ? 700 : 500,
            color: "var(--text-heading)",
            marginBottom: 2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {n.title}
        </div>
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 12,
            color: "var(--text-body)",
            lineHeight: 1.45,
            maxHeight: "2.9em",
            overflow: "hidden",
          }}
        >
          {n.body}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            marginTop: 4,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {relativeTime(n.createdAt)}
        </div>
      </div>

      {/* Archive × */}
      <button
        title="Archive"
        aria-label="Archive notification"
        onClick={(e) => {
          e.stopPropagation();
          onArchive();
        }}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--text-muted)",
          fontSize: 17,
          lineHeight: 1,
          cursor: "pointer",
          padding: "0 2px",
          flexShrink: 0,
          marginTop: -1,
          transition: "color var(--duration-fast) var(--ease-out)",
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-heading)")
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)")
        }
      >
        ×
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [muted, setMuted] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  // Ref mirror so the long-lived SSE handler always reads the latest mute state.
  const mutedRef = useRef(false);

  // Load persisted sound preference once on mount (client-only).
  useEffect(() => {
    const stored = localStorage.getItem(SOUND_PREF_KEY);
    const isMuted = stored === "off";
    setMuted(isMuted);
    mutedRef.current = isMuted;
  }, []);

  function toggleMuted() {
    setMuted((prev) => {
      const next = !prev;
      mutedRef.current = next;
      localStorage.setItem(SOUND_PREF_KEY, next ? "off" : "on");
      return next;
    });
  }

  // ── Initial load ────────────────────────────────────────────────────────────

  useEffect(() => {
    notifApi
      .unreadCount()
      .then((r) => setUnreadCount(r.count))
      .catch((err) => console.error("[NotificationBell] unreadCount failed:", err));

    notifApi
      .list()
      .then((page) => {
        setItems(page.items);
        setNextCursor(page.nextCursor);
      })
      .catch((err) => console.error("[NotificationBell] list failed:", err));
  }, []);

  // ── SSE: real-time push ─────────────────────────────────────────────────────

  useEffect(() => {
    const ctrl = new AbortController();
    let retryDelay = 2_000;
    let retryCount = 0;
    const MAX_RETRIES = 6;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function scheduleRetry() {
      if (ctrl.signal.aborted || retryCount >= MAX_RETRIES) return;
      retryCount++;
      retryTimer = setTimeout(() => { void connect(); }, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 30_000);
    }

    async function connect() {
      if (ctrl.signal.aborted) return;
      const sseRoute = hasTenantContext() ? "/tenant/notifications/stream" : "/notifications/stream";
      const url = new URL(sseRoute, getApiBase());

      try {
        const res = await fetch(url.toString(), {
          credentials: "include",
          signal: ctrl.signal,
          headers: {
            Accept: "text/event-stream",
            "X-Tenant-Slug": resolveTenantSlug(),
          },
        });
        if (!res.ok || !res.body) {
          // 4xx = auth/permission failure — don't retry, it won't recover on its own
          if (res.status >= 400 && res.status < 500) return;
          console.error(`[NotificationBell] SSE ${res.status} ${res.statusText}`);
          scheduleRetry();
          return;
        }

        retryDelay = 2_000;
        retryCount = 0;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          // SSE events are separated by double newlines
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";

          for (const event of events) {
            for (const line of event.split("\n")) {
              if (!line.startsWith("data: ")) continue;
              try {
                const n = JSON.parse(line.slice(6)) as Notification;
                setItems((prev) => [n, ...prev.filter((x) => x.id !== n.id)]);
                setUnreadCount((c) => c + 1);
                if (!mutedRef.current) playChime();
              } catch {
                // malformed JSON — skip
              }
            }
          }
        }

        // Stream closed cleanly (server restart, idle timeout) — reconnect
        scheduleRetry();
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== "AbortError") {
          console.error("[NotificationBell] SSE error:", err);
          scheduleRetry();
        }
      }
    }

    void connect();

    return () => {
      ctrl.abort();
      if (retryTimer !== null) clearTimeout(retryTimer);
    };
  }, []);

  // ── Click-outside to close ──────────────────────────────────────────────────

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        panelRef.current?.contains(target) ||
        bellRef.current?.contains(target)
      )
        return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // ── Actions ─────────────────────────────────────────────────────────────────

  async function handleMarkRead(id: string) {
    try {
      await notifApi.markRead(id);
      setItems((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, readAt: new Date().toISOString() } : n
        )
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // ignore
    }
  }

  async function handleMarkAllRead() {
    try {
      await notifApi.markAllRead();
      const now = new Date().toISOString();
      setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? now })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  }

  async function handleArchive(id: string) {
    const item = items.find((n) => n.id === id);
    try {
      await notifApi.archive(id);
      setItems((prev) => prev.filter((n) => n.id !== id));
      if (!item?.readAt) setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // ignore
    }
  }

  async function handleLoadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await notifApi.list(nextCursor);
      setItems((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      console.error("[NotificationBell] loadMore failed:", err);
    } finally {
      setLoadingMore(false);
    }
  }

  function handleItemClick(n: Notification) {
    if (!n.readAt) handleMarkRead(n.id);
    if (!n.link) return;
    if (n.link.startsWith("http")) {
      window.open(n.link, "_blank", "noopener,noreferrer");
    } else {
      window.location.href = n.link;
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const hasUnread = items.some((n) => !n.readAt);

  return (
    <div style={{ position: "relative" }}>
      {/* Bell button — matches the ghost icon buttons in the top bar */}
      <button
        ref={bellRef}
        onClick={() => setOpen((o) => !o)}
        className="gv-btn gv-btn--ghost gv-btn--sm"
        aria-label="Notifications"
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{
          position: "relative",
          width: 36,
          padding: 0,
          color: open ? "var(--accent)" : "var(--text-muted)",
        }}
      >
        <Icon name="bell" size={18} />

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: 3,
              right: 3,
              minWidth: 16,
              height: 16,
              padding: "0 4px",
              borderRadius: 999,
              background: "var(--danger)",
              color: "#fff",
              fontSize: 9.5,
              fontWeight: 700,
              lineHeight: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontVariantNumeric: "tabular-nums",
              boxShadow: "0 0 0 2px var(--surface-card)",
              pointerEvents: "none",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Notifications"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 340,
            background: "var(--surface-card)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-lg)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            maxHeight: 460,
            overflow: "hidden",
          }}
        >
          {/* Panel header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              padding: "13px 16px",
              borderBottom: "1px solid var(--border-default)",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                fontWeight: 700,
                color: "var(--text-heading)",
              }}
            >
              Notifications
              {unreadCount > 0 && (
                <span className="gv-badge gv-badge--accent" style={{ padding: "2px 8px", fontSize: 10 }}>
                  {unreadCount} new
                </span>
              )}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {hasUnread && (
                <button
                  onClick={handleMarkAllRead}
                  style={{
                    background: "transparent",
                    color: "var(--accent)",
                    border: "none",
                    fontFamily: "var(--font-body)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={toggleMuted}
                title={muted ? "Unmute notification sound" : "Mute notification sound"}
                aria-label={muted ? "Unmute notification sound" : "Mute notification sound"}
                aria-pressed={muted}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  display: "inline-flex",
                  color: muted ? "var(--text-muted)" : "var(--accent)",
                }}
              >
                <Icon name={muted ? "volume-off" : "volume"} size={16} />
              </button>
            </div>
          </div>

          {/* Scrollable list */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {items.length === 0 ? (
              <div
                style={{
                  padding: "40px 16px",
                  textAlign: "center",
                  fontFamily: "var(--font-body)",
                  fontSize: 13,
                  color: "var(--text-muted)",
                }}
              >
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: "var(--surface-inset)",
                    color: "var(--text-muted)",
                    marginBottom: 12,
                  }}
                >
                  <Icon name="bell" size={20} />
                </div>
                <div>You&rsquo;re all caught up</div>
              </div>
            ) : (
              items.map((n) => (
                <NotifItem
                  key={n.id}
                  n={n}
                  onClick={() => handleItemClick(n)}
                  onArchive={() => handleArchive(n.id)}
                />
              ))
            )}

            {/* Load more */}
            {nextCursor && (
              <div style={{ padding: 12 }}>
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="gv-btn gv-btn--secondary gv-btn--sm"
                  style={{ width: "100%" }}
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </div>

          {/* Panel footer */}
          <div
            style={{
              borderTop: "1px solid var(--border-default)",
              padding: "10px 16px",
              background: "var(--bg-section-alt)",
              flexShrink: 0,
            }}
          >
            <a
              href="/account?tab=notifications"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontFamily: "var(--font-body)",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--accent)",
                textDecoration: "none",
              }}
            >
              Notification preferences
              <Icon name="arrow-right" size={13} />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

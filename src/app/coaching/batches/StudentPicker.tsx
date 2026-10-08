"use client";

import { useMemo, useState } from "react";
import { Avatar, Input } from "@/components/ui";

export type StudentOption = {
  userId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
};

/**
 * Searchable multi-select of the coaching's own students, for the owner filling
 * a batch. Only students who aren't on the batch roster yet are passed in — the
 * join code (in Batch settings) is the other, optional way in.
 */
export function StudentPicker({
  options,
  value,
  onChange,
  disabled,
  loading,
}: {
  options: StudentOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((s) =>
      [s.name, s.email, s.phone].some((f) => f?.toLowerCase().includes(q)),
    );
  }, [options, query]);

  const muted = { margin: 0, fontSize: 12.5, color: "var(--text-muted)", fontFamily: "var(--font-body)" };

  if (loading) return <p style={muted}>Loading students…</p>;

  if (options.length === 0) {
    return (
      <p style={muted}>
        Every student in this coaching is already on this batch&apos;s roster. New students join the
        coaching first — share your coaching link, or a batch join code from Batch settings.
      </p>
    );
  }

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  const allShownSelected = matches.length > 0 && matches.every((s) => value.includes(s.userId));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Input
        placeholder="Search by name, email or phone"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={disabled}
        autoFocus
      />

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ ...muted, flex: 1 }}>
          {value.length > 0 ? `${value.length} selected` : `${options.length} available`}
        </span>
        <button
          type="button"
          disabled={disabled || matches.length === 0}
          onClick={() => {
            const shown = matches.map((s) => s.userId);
            onChange(
              allShownSelected
                ? value.filter((v) => !shown.includes(v))
                : [...new Set([...value, ...shown])],
            );
          }}
          style={{
            background: "none", border: "none", padding: 0, fontSize: 12.5, fontFamily: "var(--font-body)",
            color: "var(--accent)", cursor: disabled || matches.length === 0 ? "default" : "pointer",
          }}
        >
          {allShownSelected ? "Clear these" : query.trim() ? "Select matches" : "Select all"}
        </button>
      </div>

      {matches.length === 0 ? (
        <p style={muted}>No student matches “{query.trim()}”.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
          {matches.map((s) => {
            const checked = value.includes(s.userId);
            return (
              <label
                key={s.userId}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                  border: `1px solid ${checked ? "var(--accent)" : "var(--border-light)"}`,
                  background: checked ? "var(--accent-soft)" : "var(--paper-50)",
                  borderRadius: 10, cursor: disabled ? "default" : "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggle(s.userId)}
                  style={{ accentColor: "var(--accent)", width: 16, height: 16, margin: 0 }}
                />
                <Avatar name={s.name} size={26} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-heading)" }}>{s.name}</div>
                  {(s.email || s.phone) && (
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.email ?? s.phone}</div>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

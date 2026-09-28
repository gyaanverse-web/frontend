"use client";

import { Avatar } from "@/components/ui";

export type TeacherOption = { userId: string; name: string; email?: string | null };

/**
 * Multi-select list of the coaching's teachers, for the owner assigning a batch.
 * A batch may have any number of teachers, including none.
 */
export function TeacherPicker({
  options,
  value,
  onChange,
  disabled,
}: {
  options: TeacherOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  if (options.length === 0) {
    return (
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)", fontFamily: "var(--font-body)" }}>
        No teachers in this coaching yet. Invite one from the Teachers page, then assign them here.
      </p>
    );
  }

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
      {options.map((t) => {
        const checked = value.includes(t.userId);
        return (
          <label
            key={t.userId}
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
              onChange={() => toggle(t.userId)}
              style={{ accentColor: "var(--accent)", width: 16, height: 16, margin: 0 }}
            />
            <Avatar name={t.name} size={26} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-heading)" }}>{t.name}</div>
              {t.email && <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{t.email}</div>}
            </div>
          </label>
        );
      })}
    </div>
  );
}

/** "A. Sharma, R. Khan" — or null when nobody is assigned. */
export function teacherNames(teachers: { name: string }[]): string | null {
  return teachers.length ? teachers.map((t) => t.name).join(", ") : null;
}

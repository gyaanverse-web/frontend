"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { inputBase as inp } from "@/lib/uiStyles";

// Generation scope selector: one Subject (required) + an optional multi-select of
// chapters across that subject's modules. Leaving chapters unchecked generates
// from the whole subject. The backend's pickQuestionsForGeneration filters at the
// finest non-empty level, so we send chapterIds when any are checked.

type Item = { id: string; name: string };
export type GenScope = { subjectId?: string; chapterIds: string[] };

export function GenerationScopePicker({
  tenantSlug,
  subjects,
  onChange,
}: {
  tenantSlug: string;
  subjects: Item[];
  onChange: (s: GenScope) => void;
}) {
  const [subjectId, setSubjectId] = useState("");
  const [groups, setGroups] = useState<{ module: Item; chapters: Item[] }[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  async function selectSubject(sid: string) {
    setSubjectId(sid);
    setChecked(new Set());
    setGroups([]);
    onChange({ subjectId: sid || undefined, chapterIds: [] });
    if (!sid) return;
    setLoading(true);
    try {
      const md = await api.get<{ modules: Item[] }>(`/tenant/subjects/${sid}/modules`, { tenant: tenantSlug });
      const grps = await Promise.all(
        md.modules.map(async (m) => {
          const cd = await api
            .get<{ chapters: Item[] }>(`/tenant/modules/${m.id}/chapters`, { tenant: tenantSlug })
            .catch(() => ({ chapters: [] as Item[] }));
          return { module: m, chapters: cd.chapters };
        }),
      );
      setGroups(grps);
    } finally {
      setLoading(false);
    }
  }

  function toggle(chapterId: string) {
    const next = new Set(checked);
    if (next.has(chapterId)) next.delete(chapterId);
    else next.add(chapterId);
    setChecked(next);
    onChange({ subjectId: subjectId || undefined, chapterIds: [...next] });
  }

  function clearAll() {
    setChecked(new Set());
    onChange({ subjectId: subjectId || undefined, chapterIds: [] });
  }

  const totalChapters = groups.reduce((n, g) => n + g.chapters.length, 0);

  return (
    <div>
      <div style={{ display: "flex", gap: "10px", alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <label style={{ fontSize: "11px", color: "#555" }}>Subject *</label>
          <select value={subjectId} onChange={(e) => selectSubject(e.target.value)} style={{ ...inp, minWidth: "180px" }}>
            <option value="">— select —</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {subjectId && totalChapters > 0 && (
          <span style={{ fontSize: "11px", color: "#555" }}>
            {checked.size === 0 ? "Whole subject" : `${checked.size} chapter${checked.size > 1 ? "s" : ""} selected`}
            {checked.size > 0 && (
              <button
                type="button"
                onClick={clearAll}
                style={{ marginLeft: "8px", background: "none", border: "none", color: "#1a4db8", cursor: "pointer", fontSize: "11px", textDecoration: "underline", padding: 0 }}
              >
                clear
              </button>
            )}
          </span>
        )}
      </div>

      {subjectId && (
        <div style={{ marginTop: "8px" }}>
          {loading ? (
            <div style={{ fontSize: "12px", color: "#555" }}>Loading chapters…</div>
          ) : totalChapters === 0 ? (
            <div style={{ fontSize: "12px", color: "#888" }}>No chapters yet — will use the whole subject.</div>
          ) : (
            <div style={{ border: "1px solid #eee", background: "#fafafa", padding: "8px", maxHeight: "220px", overflowY: "auto" }}>
              {groups.filter((g) => g.chapters.length > 0).map((g) => (
                <div key={g.module.id} style={{ marginBottom: "6px" }}>
                  <div style={{ fontSize: "11px", fontWeight: "bold", color: "#555", marginBottom: "2px" }}>{g.module.name}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", paddingLeft: "6px" }}>
                    {g.chapters.map((c) => (
                      <label key={c.id} style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px", cursor: "pointer" }}>
                        <input type="checkbox" checked={checked.has(c.id)} onChange={() => toggle(c.id)} />
                        {c.name}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

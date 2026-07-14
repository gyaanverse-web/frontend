"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { inputBase as inp } from "@/lib/uiStyles";

// Cascading Subject → Module → Chapter → Section → Concept selector.
// Each level below Subject is optional ("— any —"); children lazy-load when a
// parent is chosen. The selected path is reported via onChange; the parent
// decides how deep to use it (the backend denormalizes ancestors from the
// deepest id, so sending just that one is enough).

type Item = { id: string; name: string };

export type HierarchyPath = {
  subjectId?: string;
  moduleId?: string;
  chapterId?: string;
  sectionId?: string;
  conceptId?: string;
};

// Returns the most specific selected level, or null if nothing is chosen.
export function deepestId(p: HierarchyPath): { key: keyof HierarchyPath; id: string } | null {
  if (p.conceptId) return { key: "conceptId", id: p.conceptId };
  if (p.sectionId) return { key: "sectionId", id: p.sectionId };
  if (p.chapterId) return { key: "chapterId", id: p.chapterId };
  if (p.moduleId) return { key: "moduleId", id: p.moduleId };
  if (p.subjectId) return { key: "subjectId", id: p.subjectId };
  return null;
}

function PField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      <label style={{ fontSize: "11px", color: "#555" }}>{label}</label>
      {children}
    </div>
  );
}

export function HierarchyPicker({
  tenantSlug,
  subjects,
  value,
  onChange,
  includeDeep = true,
}: {
  tenantSlug: string;
  subjects: Item[];
  value: HierarchyPath;
  onChange: (p: HierarchyPath) => void;
  includeDeep?: boolean; // include Section + Concept levels
}) {
  const [modules, setModules] = useState<Item[]>([]);
  const [chapters, setChapters] = useState<Item[]>([]);
  const [sections, setSections] = useState<Item[]>([]);
  const [concepts, setConcepts] = useState<Item[]>([]);

  async function load(path: string, key: string): Promise<Item[]> {
    try {
      const d = await api.get<Record<string, Item[]>>(path, { tenant: tenantSlug });
      return d[key] ?? [];
    } catch {
      return [];
    }
  }

  async function pickSubject(subjectId: string) {
    setModules([]); setChapters([]); setSections([]); setConcepts([]);
    onChange({ subjectId: subjectId || undefined });
    if (subjectId) setModules(await load(`/tenant/subjects/${subjectId}/modules`, "modules"));
  }

  async function pickModule(moduleId: string) {
    setChapters([]); setSections([]); setConcepts([]);
    onChange({ subjectId: value.subjectId, moduleId: moduleId || undefined });
    if (moduleId) setChapters(await load(`/tenant/modules/${moduleId}/chapters`, "chapters"));
  }

  async function pickChapter(chapterId: string) {
    setSections([]); setConcepts([]);
    onChange({ subjectId: value.subjectId, moduleId: value.moduleId, chapterId: chapterId || undefined });
    if (chapterId && includeDeep) setSections(await load(`/tenant/chapters/${chapterId}/sections`, "sections"));
  }

  async function pickSection(sectionId: string) {
    setConcepts([]);
    onChange({ subjectId: value.subjectId, moduleId: value.moduleId, chapterId: value.chapterId, sectionId: sectionId || undefined });
    if (sectionId) setConcepts(await load(`/tenant/sections/${sectionId}/concepts`, "concepts"));
  }

  function pickConcept(conceptId: string) {
    onChange({ ...value, conceptId: conceptId || undefined });
  }

  const sel = (v: string | undefined) => v ?? "";

  return (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-end" }}>
      <PField label="Subject *">
        <select value={sel(value.subjectId)} onChange={(e) => pickSubject(e.target.value)} style={{ ...inp, minWidth: "150px" }}>
          <option value="">— select —</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </PField>

      {value.subjectId && (
        <PField label="Module">
          <select value={sel(value.moduleId)} onChange={(e) => pickModule(e.target.value)} style={{ ...inp, minWidth: "140px" }}>
            <option value="">— any —</option>
            {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </PField>
      )}

      {value.moduleId && (
        <PField label="Chapter">
          <select value={sel(value.chapterId)} onChange={(e) => pickChapter(e.target.value)} style={{ ...inp, minWidth: "140px" }}>
            <option value="">— any —</option>
            {chapters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </PField>
      )}

      {includeDeep && value.chapterId && (
        <PField label="Section">
          <select value={sel(value.sectionId)} onChange={(e) => pickSection(e.target.value)} style={{ ...inp, minWidth: "140px" }}>
            <option value="">— any —</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </PField>
      )}

      {includeDeep && value.sectionId && (
        <PField label="Concept">
          <select value={sel(value.conceptId)} onChange={(e) => pickConcept(e.target.value)} style={{ ...inp, minWidth: "140px" }}>
            <option value="">— any —</option>
            {concepts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </PField>
      )}
    </div>
  );
}

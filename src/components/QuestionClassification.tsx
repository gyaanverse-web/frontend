"use client";

import { Field } from "@/components/QuestionEditor";

// Optional classification for a bank question: where it came from (source) and
// its Bloom cognitive level. Both feed source-/cognitive-filtered generation.

export const COGNITIVE_LEVELS = ["remember", "understand", "apply", "analyze", "evaluate", "create"] as const;

export type Classification = {
  sourceType: "" | "original" | "textbook" | "pyq";
  book: string;
  page: string;
  examName: string;
  examYear: string;
  cognitiveLevel: string;
};

export const emptyClassification: Classification = {
  sourceType: "", book: "", page: "", examName: "", examYear: "", cognitiveLevel: "",
};

// Classification → API fragments (source object + cognitiveLevel string).
export function buildClassification(c: Classification): { source?: Record<string, unknown>; cognitiveLevel?: string } {
  let source: Record<string, unknown> | undefined;
  if (c.sourceType) {
    source = { type: c.sourceType };
    if (c.sourceType === "textbook") {
      if (c.book.trim()) source.book = c.book.trim();
      if (c.page.trim()) source.page = parseInt(c.page, 10);
    } else if (c.sourceType === "pyq") {
      if (c.examName.trim()) source.examName = c.examName.trim();
      if (c.examYear.trim()) source.examYear = parseInt(c.examYear, 10);
    }
  }
  return { source, cognitiveLevel: c.cognitiveLevel || undefined };
}

// API → Classification (for editing an existing question).
export function parseClassification(
  source: Record<string, unknown> | null | undefined,
  metadata: Record<string, unknown> | null | undefined,
): Classification {
  const c = { ...emptyClassification };
  if (source && typeof source.type === "string") {
    c.sourceType = source.type as Classification["sourceType"];
    c.book = (source.book as string) ?? "";
    c.page = source.page != null ? String(source.page) : "";
    c.examName = (source.examName as string) ?? "";
    c.examYear = source.examYear != null ? String(source.examYear) : "";
  }
  if (metadata && typeof metadata.cognitiveLevel === "string") c.cognitiveLevel = metadata.cognitiveLevel;
  return c;
}

export function QuestionClassification({
  value,
  onChange,
}: {
  value: Classification;
  onChange: (c: Classification) => void;
}) {
  const set = (patch: Partial<Classification>) => onChange({ ...value, ...patch });
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
      <Field label="Source">
        <select className="gv-select" value={value.sourceType} onChange={(e) => set({ sourceType: e.target.value as Classification["sourceType"] })} style={{ width: 180 }}>
          <option value="">— none —</option>
          <option value="original">Original</option>
          <option value="textbook">Textbook</option>
          <option value="pyq">Past year (PYQ)</option>
        </select>
      </Field>

      {value.sourceType === "textbook" && (
        <>
          <Field label="Book"><input className="gv-input" value={value.book} onChange={(e) => set({ book: e.target.value })} style={{ width: 200 }} /></Field>
          <Field label="Page"><input className="gv-input" type="number" value={value.page} onChange={(e) => set({ page: e.target.value })} style={{ width: 90 }} /></Field>
        </>
      )}
      {value.sourceType === "pyq" && (
        <>
          <Field label="Exam"><input className="gv-input" value={value.examName} onChange={(e) => set({ examName: e.target.value })} placeholder="JEE_MAINS" style={{ width: 160 }} /></Field>
          <Field label="Year"><input className="gv-input" type="number" value={value.examYear} onChange={(e) => set({ examYear: e.target.value })} style={{ width: 100 }} /></Field>
        </>
      )}

      <Field label="Cognitive level">
        <select className="gv-select" value={value.cognitiveLevel} onChange={(e) => set({ cognitiveLevel: e.target.value })} style={{ width: 180 }}>
          <option value="">— none —</option>
          {COGNITIVE_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </Field>
    </div>
  );
}

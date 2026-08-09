"use client";

import { Button } from "@/components/ui";

// Shared, type-aware editor for a question's payload + answerKey. Used by the
// question-bank add/edit forms and the test-engine draft add/edit flows.

export const QUESTION_TYPES = [
  ["mcq_single", "MCQ (single)"],
  ["mcq_multiple", "MCQ (multiple)"],
  ["integer", "Integer"],
  ["numerical", "Numerical"],
  ["subjective", "Subjective"],
  ["assertion_reason", "Assertion/Reason"],
  ["fill_blanks", "Fill blanks"],
  ["match", "Match"],
] as const;

export const TYPE_LABEL = Object.fromEntries(QUESTION_TYPES) as Record<string, string>;
export const DIFFICULTIES = ["easy", "medium", "hard"] as const;

export const letter = (i: number) => String.fromCharCode(97 + i); // 0 -> "a"

export type EditorState = {
  options: string[];
  correctSingle: number;
  correctMulti: number[];
  intValue: string;
  numValue: string;
  numTolerance: string;
  subjSample: string;
  subjRubric: string;
  arAssertion: string;
  arReason: string;
  arOption: string;
  fbAnswers: string; // newline separated
  matchLeft: string; // newline separated
  matchRight: string; // newline separated
  matchPairs: Record<number, number>; // leftIndex -> rightIndex
};

export const emptyEditor: EditorState = {
  options: ["", ""],
  correctSingle: 0,
  correctMulti: [],
  intValue: "",
  numValue: "",
  numTolerance: "",
  subjSample: "",
  subjRubric: "",
  arAssertion: "",
  arReason: "",
  arOption: "A",
  fbAnswers: "",
  matchLeft: "",
  matchRight: "",
  matchPairs: {},
};

// EditorState → API payload/answerKey (with light validation).
export function buildPayloadAnswer(
  type: string,
  st: EditorState,
): { payload: Record<string, unknown>; answerKey: Record<string, unknown> } | { error: string } {
  switch (type) {
    case "mcq_single":
    case "mcq_multiple": {
      const opts = st.options.map((t) => t.trim()).filter(Boolean);
      if (opts.length < 2) return { error: "Add at least two options" };
      const payload = { options: opts.map((t, i) => ({ id: letter(i), text: t })) };
      if (type === "mcq_single") {
        if (st.correctSingle < 0 || st.correctSingle >= opts.length) return { error: "Select the correct option" };
        return { payload, answerKey: { optionId: letter(st.correctSingle) } };
      }
      const ids = st.correctMulti.filter((i) => i < opts.length).map(letter);
      if (ids.length < 1) return { error: "Select at least one correct option" };
      return { payload, answerKey: { optionIds: ids } };
    }
    case "integer": {
      if (st.intValue.trim() === "" || Number.isNaN(parseInt(st.intValue, 10))) return { error: "Enter the integer answer" };
      return { payload: {}, answerKey: { value: parseInt(st.intValue, 10) } };
    }
    case "numerical": {
      if (st.numValue.trim() === "" || Number.isNaN(parseFloat(st.numValue))) return { error: "Enter the numerical answer" };
      const answerKey: Record<string, unknown> = { value: parseFloat(st.numValue) };
      if (st.numTolerance.trim() !== "") answerKey.tolerance = parseFloat(st.numTolerance);
      return { payload: {}, answerKey };
    }
    case "subjective": {
      const answerKey: Record<string, unknown> = {};
      if (st.subjSample.trim()) answerKey.sampleAnswer = st.subjSample.trim();
      if (st.subjRubric.trim()) answerKey.rubric = st.subjRubric.trim();
      return { payload: {}, answerKey };
    }
    case "assertion_reason": {
      if (!st.arAssertion.trim() || !st.arReason.trim()) return { error: "Enter both assertion and reason" };
      return { payload: { assertion: st.arAssertion.trim(), reason: st.arReason.trim() }, answerKey: { option: st.arOption } };
    }
    case "fill_blanks": {
      const answers = st.fbAnswers.split("\n").map((a) => a.trim()).filter(Boolean);
      if (answers.length < 1) return { error: "Enter at least one blank answer (one per line)" };
      return { payload: { blanks: answers.length }, answerKey: { answers } };
    }
    case "match": {
      const left = st.matchLeft.split("\n").map((t) => t.trim()).filter(Boolean);
      const right = st.matchRight.split("\n").map((t) => t.trim()).filter(Boolean);
      if (left.length < 2 || right.length < 2) return { error: "Add at least two left and two right items" };
      const pairs = left.map((_, li) => {
        const ri = st.matchPairs[li];
        return ri != null && ri < right.length ? { leftId: `l${li}`, rightId: `r${ri}` } : null;
      }).filter(Boolean) as { leftId: string; rightId: string }[];
      if (pairs.length < 1) return { error: "Map at least one pair" };
      return {
        payload: {
          left: left.map((t, i) => ({ id: `l${i}`, text: t })),
          right: right.map((t, i) => ({ id: `r${i}`, text: t })),
        },
        answerKey: { pairs },
      };
    }
    default:
      return { error: `Unsupported type: ${type}` };
  }
}

// API payload/answerKey → EditorState (for editing an existing question).
export function parseToEditor(
  type: string,
  payload: Record<string, unknown> | null | undefined,
  answerKey: Record<string, unknown> | null | undefined,
): EditorState {
  const st: EditorState = { ...emptyEditor, matchPairs: {} };
  const p = payload ?? {};
  const a = answerKey ?? {};
  try {
    switch (type) {
      case "mcq_single":
      case "mcq_multiple": {
        const opts = (p.options as { id: string; text: string }[]) ?? [];
        st.options = opts.length ? opts.map((o) => o.text) : ["", ""];
        if (type === "mcq_single") {
          st.correctSingle = Math.max(0, opts.findIndex((o) => o.id === (a.optionId as string)));
        } else {
          const ids = new Set((a.optionIds as string[]) ?? []);
          st.correctMulti = opts.map((o, i) => (ids.has(o.id) ? i : -1)).filter((i) => i >= 0);
        }
        break;
      }
      case "integer":
        st.intValue = a.value != null ? String(a.value) : "";
        break;
      case "numerical":
        st.numValue = a.value != null ? String(a.value) : "";
        st.numTolerance = a.tolerance != null ? String(a.tolerance) : "";
        break;
      case "subjective":
        st.subjSample = (a.sampleAnswer as string) ?? "";
        st.subjRubric = (a.rubric as string) ?? "";
        break;
      case "assertion_reason":
        st.arAssertion = (p.assertion as string) ?? "";
        st.arReason = (p.reason as string) ?? "";
        st.arOption = (a.option as string) ?? "A";
        break;
      case "fill_blanks":
        st.fbAnswers = ((a.answers as string[]) ?? []).join("\n");
        break;
      case "match": {
        const left = (p.left as { id: string; text: string }[]) ?? [];
        const right = (p.right as { id: string; text: string }[]) ?? [];
        st.matchLeft = left.map((l) => l.text).join("\n");
        st.matchRight = right.map((r) => r.text).join("\n");
        const pairs = (a.pairs as { leftId: string; rightId: string }[]) ?? [];
        const map: Record<number, number> = {};
        for (const pr of pairs) {
          const li = parseInt(String(pr.leftId).replace(/\D/g, ""), 10);
          const ri = parseInt(String(pr.rightId).replace(/\D/g, ""), 10);
          if (!Number.isNaN(li) && !Number.isNaN(ri)) map[li] = ri;
        }
        st.matchPairs = map;
        break;
      }
    }
  } catch {
    /* fall back to whatever was parsed */
  }
  return st;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span className="gv-label">{label}</span>
      {children}
    </div>
  );
}

// The type-specific editor block. Render inside any form.
export function QuestionEditor({
  type,
  ed,
  setEd,
}: {
  type: string;
  ed: EditorState;
  setEd: React.Dispatch<React.SetStateAction<EditorState>>;
}) {
  const isMcq = type === "mcq_single" || type === "mcq_multiple";
  return (
    <div
      style={{
        padding: 16,
        background: "var(--surface-inset)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-md)",
      }}
    >
      {isMcq && (
        <>
          <span className="gv-label">
            Options ({type === "mcq_single" ? "pick one correct" : "tick all correct"})
          </span>
          {ed.options.map((opt, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              {type === "mcq_single" ? (
                <input type="radio" name="correct" checked={ed.correctSingle === i} onChange={() => setEd((s) => ({ ...s, correctSingle: i }))} style={{ accentColor: "var(--accent)" }} />
              ) : (
                <input type="checkbox" checked={ed.correctMulti.includes(i)} onChange={(e) => setEd((s) => ({ ...s, correctMulti: e.target.checked ? [...s.correctMulti, i] : s.correctMulti.filter((x) => x !== i) }))} style={{ accentColor: "var(--accent)" }} />
              )}
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", width: 16 }}>{letter(i)}.</span>
              <input className="gv-input" value={opt} onChange={(e) => setEd((s) => ({ ...s, options: s.options.map((o, j) => (j === i ? e.target.value : o)) }))} placeholder={`Option ${letter(i)}`} style={{ flex: 1 }} />
              {ed.options.length > 2 && (
                <Button type="button" variant="ghost" size="sm" aria-label={`Remove option ${letter(i)}`} onClick={() => setEd((s) => ({ ...s, options: s.options.filter((_, j) => j !== i) }))}>✕</Button>
              )}
            </div>
          ))}
          <Button type="button" variant="secondary" size="sm" style={{ marginTop: 4 }} onClick={() => setEd((s) => ({ ...s, options: [...s.options, ""] }))}>+ Option</Button>
        </>
      )}

      {type === "integer" && (
        <Field label="Correct integer">
          <input className="gv-input" type="number" value={ed.intValue} onChange={(e) => setEd((s) => ({ ...s, intValue: e.target.value }))} style={{ width: 140 }} />
        </Field>
      )}

      {type === "numerical" && (
        <div style={{ display: "flex", gap: 16 }}>
          <Field label="Correct value"><input className="gv-input" type="number" value={ed.numValue} onChange={(e) => setEd((s) => ({ ...s, numValue: e.target.value }))} style={{ width: 140 }} /></Field>
          <Field label="Tolerance (±)"><input className="gv-input" type="number" value={ed.numTolerance} onChange={(e) => setEd((s) => ({ ...s, numTolerance: e.target.value }))} placeholder="optional" style={{ width: 140 }} /></Field>
        </div>
      )}

      {type === "subjective" && (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <Field label="Sample answer (optional)"><textarea className="gv-textarea" value={ed.subjSample} onChange={(e) => setEd((s) => ({ ...s, subjSample: e.target.value }))} rows={3} style={{ width: 280 }} /></Field>
          <Field label="Rubric (optional)"><textarea className="gv-textarea" value={ed.subjRubric} onChange={(e) => setEd((s) => ({ ...s, subjRubric: e.target.value }))} rows={3} style={{ width: 280 }} /></Field>
        </div>
      )}

      {type === "assertion_reason" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Field label="Assertion"><input className="gv-input" value={ed.arAssertion} onChange={(e) => setEd((s) => ({ ...s, arAssertion: e.target.value }))} /></Field>
          <Field label="Reason"><input className="gv-input" value={ed.arReason} onChange={(e) => setEd((s) => ({ ...s, arReason: e.target.value }))} /></Field>
          <Field label="Correct option">
            <select className="gv-select" value={ed.arOption} onChange={(e) => setEd((s) => ({ ...s, arOption: e.target.value }))} style={{ width: 140 }}>
              {["A", "B", "C", "D", "E"].map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
        </div>
      )}

      {type === "fill_blanks" && (
        <Field label="Answers (one per line — blanks count is inferred)">
          <textarea className="gv-textarea" value={ed.fbAnswers} onChange={(e) => setEd((s) => ({ ...s, fbAnswers: e.target.value }))} rows={3} style={{ width: 280 }} />
        </Field>
      )}

      {type === "match" && <MatchEditor ed={ed} setEd={setEd} />}
    </div>
  );
}

function MatchEditor({ ed, setEd }: { ed: EditorState; setEd: React.Dispatch<React.SetStateAction<EditorState>> }) {
  const left = ed.matchLeft.split("\n").map((t) => t.trim()).filter(Boolean);
  const right = ed.matchRight.split("\n").map((t) => t.trim()).filter(Boolean);
  return (
    <div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
        <Field label="Left items (one per line)"><textarea className="gv-textarea" value={ed.matchLeft} onChange={(e) => setEd((s) => ({ ...s, matchLeft: e.target.value }))} rows={3} style={{ width: 240 }} /></Field>
        <Field label="Right items (one per line)"><textarea className="gv-textarea" value={ed.matchRight} onChange={(e) => setEd((s) => ({ ...s, matchRight: e.target.value }))} rows={3} style={{ width: 240 }} /></Field>
      </div>
      {left.length > 0 && right.length > 0 && (
        <div>
          <span className="gv-label">Map each left → right</span>
          {left.map((l, li) => (
            <div key={li} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: "var(--text-body)", width: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l}</span>
              <span aria-hidden="true" style={{ fontSize: 13, color: "var(--text-muted)" }}>→</span>
              <select className="gv-select" aria-label={`Match for ${l}`} value={ed.matchPairs[li] ?? ""} onChange={(e) => setEd((s) => ({ ...s, matchPairs: { ...s.matchPairs, [li]: parseInt(e.target.value, 10) } }))} style={{ flex: 1, maxWidth: 240 }}>
                <option value="">—</option>
                {right.map((r, ri) => <option key={ri} value={ri}>{r}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import type { CSSProperties } from "react";
import { MathText } from "./Math";
import { TYPE_LABEL } from "./QuestionEditor";
import { Badge } from "./ui";
import type { BadgeTone } from "./ui";

/**
 * Read-only, presentation-quality render of a single question — body and options
 * are rendered through KaTeX (`MathText`), so `$...$` / `$$...$$` LaTeX shows as
 * real math. Correct answers are highlighted. Reused by the question-bank preview
 * modal (and anywhere a question needs to be shown, not edited).
 */

export type PreviewQuestion = {
  type: string;
  body: string;
  payload?: Record<string, unknown> | null;
  answerKey?: Record<string, unknown> | null;
  difficulty?: string | null;
  marks?: number;
  negativeMarks?: number;
  explanation?: string | null;
  imageUrls?: string[] | null;
  isVerified?: boolean;
};

const DIFF_TONE: Record<string, BadgeTone> = {
  easy: "success",
  moderate: "warning",
  medium: "warning",
  hard: "danger",
};

const AR_LABELS = [
  ["A", "Both A and R are true and R is the correct explanation of A."],
  ["B", "Both A and R are true but R is not the correct explanation of A."],
  ["C", "A is true but R is false."],
  ["D", "A is false but R is true."],
  ["E", "Both A and R are false."],
] as const;

const bodyStyle: CSSProperties = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: 16,
  lineHeight: 1.7,
  color: "var(--text-heading)",
};

const sectionLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.09em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  marginBottom: 8,
};

function OptionRow({ letter, text, correct }: { letter: string; text: string; correct: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "11px 14px",
        borderRadius: 10,
        border: `1.5px solid ${correct ? "var(--success)" : "var(--border-light)"}`,
        background: correct ? "rgba(16,185,129,.07)" : "var(--surface-card)",
      }}
    >
      <span
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          flexShrink: 0,
          background: correct ? "var(--success)" : "var(--surface-inset)",
          color: correct ? "#fff" : "var(--text-muted)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        {letter}
      </span>
      <MathText text={text} style={{ flex: 1, fontSize: 14.5, color: "var(--text-heading)" }} />
      {correct && (
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--success)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          ✓ Correct
        </span>
      )}
    </div>
  );
}

function AnswerArea({ q }: { q: PreviewQuestion }) {
  const p = q.payload ?? {};
  const a = q.answerKey ?? {};

  if (q.type === "mcq_single" || q.type === "mcq_multiple") {
    const options = (p.options as { id: string; text: string }[]) ?? [];
    const correct = new Set<string>(
      q.type === "mcq_single"
        ? [(a.optionId as string) ?? ""]
        : ((a.optionIds as string[]) ?? []),
    );
    if (options.length === 0) return null;
    return (
      <div>
        <div style={sectionLabel}>Options</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {options.map((o) => (
            <OptionRow key={o.id} letter={o.id.toUpperCase()} text={o.text} correct={correct.has(o.id)} />
          ))}
        </div>
      </div>
    );
  }

  if (q.type === "integer" || q.type === "numerical") {
    const tol = p.tolerance;
    return (
      <div>
        <div style={sectionLabel}>Correct answer</div>
        <div style={{ display: "inline-flex", alignItems: "baseline", gap: 8, padding: "10px 16px", borderRadius: 10, border: "1.5px solid var(--success)", background: "rgba(16,185,129,.07)" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 17, fontWeight: 700, color: "var(--text-heading)" }}>{String(a.value ?? "—")}</span>
          {tol != null && tol !== "" && <span style={{ fontSize: 13, color: "var(--text-muted)" }}>± {String(tol)}</span>}
        </div>
      </div>
    );
  }

  if (q.type === "subjective") {
    const sample = (a.sampleAnswer as string) ?? "";
    const rubric = (a.rubric as string) ?? "";
    if (!sample && !rubric) return <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Manually graded — no fixed answer.</div>;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {sample && (
          <div>
            <div style={sectionLabel}>Model answer</div>
            <MathText text={sample} style={{ fontSize: 14, color: "var(--text-body)", lineHeight: 1.6 }} />
          </div>
        )}
        {rubric && (
          <div>
            <div style={sectionLabel}>Rubric</div>
            <MathText text={rubric} style={{ fontSize: 14, color: "var(--text-body)", lineHeight: 1.6 }} />
          </div>
        )}
      </div>
    );
  }

  if (q.type === "assertion_reason") {
    const chosen = (a.option as string) ?? "";
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <div style={sectionLabel}>Assertion (A)</div>
          <MathText text={(p.assertion as string) ?? ""} style={{ fontSize: 14.5, color: "var(--text-heading)", lineHeight: 1.6 }} />
        </div>
        <div>
          <div style={sectionLabel}>Reason (R)</div>
          <MathText text={(p.reason as string) ?? ""} style={{ fontSize: 14.5, color: "var(--text-heading)", lineHeight: 1.6 }} />
        </div>
        <div>
          <div style={sectionLabel}>Correct option</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {AR_LABELS.map(([id, text]) => (
              <OptionRow key={id} letter={id} text={text} correct={chosen === id} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (q.type === "fill_blanks") {
    const answers = (a.answers as string[]) ?? [];
    return (
      <div>
        <div style={sectionLabel}>Answers</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {answers.map((ans, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "1.5px solid var(--success)", background: "rgba(16,185,129,.07)" }}>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{i + 1}.</span>
              <MathText text={ans} style={{ fontSize: 14, fontWeight: 600, color: "var(--text-heading)" }} />
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (q.type === "match") {
    const left = (p.left as { id: string; text: string }[]) ?? [];
    const right = (p.right as { id: string; text: string }[]) ?? [];
    const pairs = (a.pairs as { leftId: string; rightId: string }[]) ?? [];
    const rightById = new Map(right.map((r) => [r.id, r.text]));
    return (
      <div>
        <div style={sectionLabel}>Correct matches</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {left.map((l) => {
            const pair = pairs.find((pr) => pr.leftId === l.id);
            const rightText = pair ? rightById.get(pair.rightId) : undefined;
            return (
              <div key={l.id} style={{ display: "grid", gridTemplateColumns: "1fr 24px 1fr", gap: 8, alignItems: "center" }}>
                <div style={{ padding: "8px 12px", border: "1px solid var(--border-light)", borderRadius: 8, fontSize: 13.5 }}>
                  <MathText text={l.text} />
                </div>
                <div style={{ textAlign: "center", color: "var(--text-muted)" }}>↔</div>
                <div style={{ padding: "8px 12px", border: `1px solid ${rightText ? "var(--success)" : "var(--border-light)"}`, borderRadius: 8, fontSize: 13.5, background: rightText ? "rgba(16,185,129,.07)" : "transparent" }}>
                  {rightText ? <MathText text={rightText} /> : <span style={{ color: "var(--text-muted)" }}>—</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}

export function QuestionPreview({ q }: { q: PreviewQuestion }) {
  const diff = (q.difficulty ?? "").toLowerCase();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Meta row */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <Badge tone="accent">{TYPE_LABEL[q.type] ?? q.type}</Badge>
        {q.difficulty && <Badge tone={DIFF_TONE[diff] ?? "neutral"}>{q.difficulty}</Badge>}
        {q.isVerified && (
          <span style={{ fontSize: 11, color: "var(--success)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>✓ Verified</span>
        )}
        <div style={{ flex: 1 }} />
        {q.marks != null && (
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {q.marks} marks{q.negativeMarks ? ` · −${q.negativeMarks}` : ""}
          </span>
        )}
      </div>

      {/* Question body */}
      <MathText text={q.body} style={bodyStyle} />

      {/* Image */}
      {q.imageUrls && q.imageUrls[0] && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={q.imageUrls[0]} alt="Question figure" style={{ maxWidth: "100%", borderRadius: 10, border: "1px solid var(--border-light)" }} />
      )}

      {/* Answer / options */}
      <AnswerArea q={q} />

      {/* Explanation */}
      {q.explanation && (
        <div style={{ padding: "12px 16px", background: "var(--surface-inset)", borderRadius: 10, border: "1px solid var(--border-light)" }}>
          <div style={sectionLabel}>Explanation</div>
          <MathText text={q.explanation} style={{ fontSize: 14, color: "var(--text-body)", lineHeight: 1.65 }} />
        </div>
      )}
    </div>
  );
}

// Paper structure — the "what's in this exam" summary shown before anyone sees
// a question. Derived entirely from the question rows the API already returns;
// there is no section column in the schema, so a "part" here is a run of
// questions of the same type, which is how Indian papers are sectioned in
// practice (Part A: MCQ, Part B: Numerical, Part C: Subjective).
//
// Shared deliberately: the student instruction sheet and the teacher paper
// overview must never disagree about how many questions or marks a paper holds.

import { QUESTION_TYPE_LABELS, type QuestionType } from "./questionTypes";

/** The minimum a question must expose to be summarised. */
export interface StructuralQuestion {
  type: QuestionType | string;
  marks: number | string;
  negativeMarks: number | string;
  difficulty?: string | null;
}

export interface PaperPart {
  type: string;
  label: string;
  count: number;
  /** Marks per question, or null when questions in this part differ. */
  marksEach: number | null;
  totalMarks: number;
  /** Negative marks per question, or null when they differ within the part. */
  negativeEach: number | null;
  /** 1-based position of the first/last question of this part in the paper. */
  from: number;
  to: number;
  /** False when questions of this type are interleaved with other types. */
  contiguous: boolean;
}

export interface PaperStructure {
  parts: PaperPart[];
  totalQuestions: number;
  totalMarks: number;
  hasNegative: boolean;
  /** Largest negative-mark value anywhere in the paper (0 when none). */
  maxNegative: number;
  /** Populated only when the caller's questions carry `difficulty`. */
  difficultyMix: { level: string; count: number }[];
}

/** Numeric columns can arrive as strings from the driver; coerce defensively. */
function num(v: number | string | null | undefined): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

function labelFor(type: string): string {
  return QUESTION_TYPE_LABELS[type as QuestionType] ?? type;
}

/**
 * Summarise a paper. `questions` must already be in presentation order — the
 * API returns them ordered by `order`, and positions are taken from array index
 * so this holds whether `order` is 0- or 1-based.
 *
 * Parts appear in the order their type is first encountered, so the summary
 * reads top-to-bottom like the paper itself.
 */
export function buildPaperStructure(questions: readonly StructuralQuestion[]): PaperStructure {
  const parts: PaperPart[] = [];
  const byType = new Map<string, PaperPart>();
  // Tracks whether we have already left a type's run and come back to it.
  const seenSince = new Map<string, number>();

  let totalMarks = 0;
  let maxNegative = 0;
  const difficulty = new Map<string, number>();

  questions.forEach((q, i) => {
    const pos = i + 1;
    const marks = num(q.marks);
    const neg = num(q.negativeMarks);
    totalMarks += marks;
    if (neg > maxNegative) maxNegative = neg;

    if (q.difficulty) difficulty.set(q.difficulty, (difficulty.get(q.difficulty) ?? 0) + 1);

    let part = byType.get(q.type);
    if (!part) {
      part = {
        type: q.type,
        label: labelFor(q.type),
        count: 0,
        marksEach: marks,
        totalMarks: 0,
        negativeEach: neg,
        from: pos,
        to: pos,
        contiguous: true,
      };
      byType.set(q.type, part);
      parts.push(part);
    } else {
      // A gap since this type's last question means the run is broken.
      if (seenSince.get(q.type) !== pos - 1) part.contiguous = false;
      if (part.marksEach !== null && part.marksEach !== marks) part.marksEach = null;
      if (part.negativeEach !== null && part.negativeEach !== neg) part.negativeEach = null;
    }

    part.count += 1;
    part.totalMarks += marks;
    part.to = pos;
    seenSince.set(q.type, pos);
  });

  const DIFFICULTY_ORDER = ["easy", "medium", "hard"];
  const difficultyMix = [...difficulty.entries()]
    .map(([level, count]) => ({ level, count }))
    .sort((a, b) => {
      const ai = DIFFICULTY_ORDER.indexOf(a.level);
      const bi = DIFFICULTY_ORDER.indexOf(b.level);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

  return {
    parts,
    totalQuestions: questions.length,
    totalMarks,
    hasNegative: maxNegative > 0,
    maxNegative,
    difficultyMix,
  };
}

/** "Q1–Q20" for a clean run, "20 questions" when the type is interleaved. */
export function partRange(part: PaperPart): string {
  if (!part.contiguous) return `${part.count} question${part.count === 1 ? "" : "s"}`;
  return part.from === part.to ? `Q${part.from}` : `Q${part.from}–Q${part.to}`;
}

/** Trims trailing zeros so 4 shows as "4" and 1.5 stays "1.5". */
export function fmtMarks(n: number): string {
  return Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(2)));
}

/** Per-question marks cell: a number, or "Varies" for a mixed part. */
export function partMarksEach(part: PaperPart): string {
  return part.marksEach === null ? "Varies" : fmtMarks(part.marksEach);
}

/** Per-question negative-marks cell. */
export function partNegativeEach(part: PaperPart): string {
  if (part.negativeEach === null) return "Varies";
  return part.negativeEach > 0 ? `−${fmtMarks(part.negativeEach)}` : "Nil";
}

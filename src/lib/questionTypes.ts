// The 8 question types the exam module supports. Mirrors the backend union in
// `exam.types.ts`. Shared because both the authoring UI and the report-review
// UI label the same types and must not drift apart.

export type QuestionType =
  | "mcq_single" | "mcq_multiple" | "integer" | "numerical"
  | "subjective" | "match" | "assertion_reason" | "fill_blanks";

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  mcq_single:       "MCQ (Single)",
  mcq_multiple:     "MCQ (Multiple)",
  integer:          "Integer",
  numerical:        "Numerical",
  subjective:       "Subjective",
  match:            "Match the Following",
  assertion_reason: "Assertion-Reason",
  fill_blanks:      "Fill in the Blanks",
};

/**
 * Types the AI pipeline grades rather than the objective auto-marker. These are
 * the answers a teacher actually has to verify before publishing — everything
 * else is a key comparison.
 */
export const AI_GRADED_TYPES: readonly QuestionType[] = ["subjective"] as const;

export function isAiGradedType(type: QuestionType): boolean {
  return AI_GRADED_TYPES.includes(type);
}

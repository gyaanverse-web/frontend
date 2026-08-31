"use client";

import { useMemo } from "react";
import katex from "katex";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type MathProps = {
  /** Raw LaTeX source — no $...$ delimiters needed. */
  expression: string;
  /** Display mode = block-level, bigger fractions. Default false (inline). */
  display?: boolean;
  /**
   * Fall back to plain text on a parse error instead of KaTeX's red error
   * output. Used for auto-detected math (see `MathText`), where a mis-detection
   * must degrade to the text we started with rather than shout at the reader.
   */
  quiet?: boolean;
  className?: string;
};

/**
 * Render a single LaTeX expression via KaTeX. Safe — `throwOnError: false`
 * makes KaTeX render parse errors inline (in red) instead of crashing the
 * page. `trust: false` disables `\href`, `\url`, and other vectors that
 * could execute scripts or load arbitrary content.
 */
export function Tex({ expression, display = false, quiet = false, className }: MathProps) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(expression, {
        displayMode: display,
        throwOnError: quiet,
        errorColor: "#c00",
        strict: "ignore",
        trust: false,
        output: "html",
      });
    } catch {
      // Fallback: render as plain text if KaTeX implodes for any reason
      return escapeHtml(expression);
    }
  }, [expression, display, quiet]);

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ── Mixed text + math renderer ────────────────────────────────────────────

type Segment =
  | { type: "text"; content: string }
  | { type: "math"; content: string; display: boolean; auto?: boolean };

/**
 * Split a string on $$...$$ (display math) and $...$ (inline math).
 * Backslash-escaped delimiters (\$) are treated as literal text.
 * Unbalanced delimiters are left as text — no crash.
 */
function parseMixed(text: string): Segment[] {
  const segments: Segment[] = [];
  let i = 0;
  let buf = "";

  const flush = () => {
    if (buf) {
      segments.push({ type: "text", content: buf });
      buf = "";
    }
  };

  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];

    // Escaped dollar
    if (ch === "\\" && next === "$") {
      buf += "$";
      i += 2;
      continue;
    }

    // Display math $$...$$
    if (ch === "$" && next === "$") {
      const close = text.indexOf("$$", i + 2);
      if (close === -1) {
        buf += text.slice(i);
        i = text.length;
        continue;
      }
      flush();
      segments.push({ type: "math", content: text.slice(i + 2, close), display: true });
      i = close + 2;
      continue;
    }

    // Inline math $...$
    if (ch === "$") {
      const close = text.indexOf("$", i + 1);
      if (close === -1) {
        buf += text.slice(i);
        i = text.length;
        continue;
      }
      flush();
      segments.push({ type: "math", content: text.slice(i + 1, close), display: false });
      i = close + 1;
      continue;
    }

    buf += ch;
    i++;
  }
  flush();
  return segments;
}

// ── Delimiter-less LaTeX ──────────────────────────────────────────────────
//
// Not everything that reaches this component is `$`-delimited. The evaluation
// engine's `_normalize_latex_text` deliberately *strips* `$` and `$$` from every
// OCR'd step and every piece of feedback before it is stored, so a step arrives
// here as bare source — `Area = \frac{22}{7} \times 49 \mathrm{cm}^2` — which the
// delimiter parser above sees as ordinary prose and prints verbatim. That is the
// raw-LaTeX-as-text the review screens were showing.
//
// So text runs are swept a second time for expressions that carry no delimiters.
// The sweep only runs on strings containing a LaTeX control sequence, which is
// the one signal ordinary prose never produces — a teacher-authored body in
// plain text or Unicode maths (π, ², ½) is left exactly as it was written.

/** `\frac`, `\times`, `\mathrm`… — the gate for the whole sweep. */
const CONTROL_SEQUENCE = /\\[a-zA-Z]+/;

/**
 * What makes a run of tokens an expression rather than a stray number. Without
 * this, "100" in "the area is 100" would be handed to KaTeX for no gain.
 */
const STRONG_MATH = /[\\^_{}=+<>±×÷≈≤≥]/;

/** Letters only, optional trailing punctuation — the shape of an English word. */
function isProseWord(token: string): boolean {
  return /^[A-Za-z][A-Za-z'’-]*[.,;:!?)]?$/.test(token);
}

/**
 * Whether a token ends the expression being built.
 *
 * The threshold moves with context because two-letter runs are ambiguous: `dx`
 * in `\int x \sin(x) dx` and `at` in `v = u + at` are products of variables, not
 * words, and breaking on them strands a dangling `v = u +` in maths type next to
 * an "at" in body type. Once an expression is under way a token needs three
 * letters to end it, which `the`, `and` and `area` have and `dx` does not.
 */
function breaksMath(token: string, spanActive: boolean): boolean {
  if (!isProseWord(token)) return false;
  const letters = (token.match(/[A-Za-z]/g) ?? []).length;
  return letters >= (spanActive ? 3 : 2);
}

/**
 * Split a run of undelimited text into text and math segments.
 *
 * Prose and formulae are separated at word boundaries, so "Using \frac{1}{2}bh,
 * the area is 100" keeps its English as English and renders only the fraction.
 * Trailing sentence punctuation is pushed back out of the expression — a comma
 * set in KaTeX's maths font next to one set in the body font is glaringly
 * mismatched, and it is not part of the maths.
 */
function splitBareLatex(text: string): Segment[] {
  if (!CONTROL_SEQUENCE.test(text)) return [{ type: "text", content: text }];

  const out: Segment[] = [];
  let textBuf = "";
  let mathBuf: string[] = [];

  const flushText = () => {
    if (textBuf) {
      out.push({ type: "text", content: textBuf });
      textBuf = "";
    }
  };

  const flushMath = () => {
    if (mathBuf.length === 0) return;
    let expr = mathBuf.join("");
    mathBuf = [];

    const trailingWs = /\s+$/.exec(expr)?.[0] ?? "";
    if (trailingWs) expr = expr.slice(0, -trailingWs.length);
    const punct = /[.,;:!?]+$/.exec(expr)?.[0] ?? "";
    if (punct) expr = expr.slice(0, -punct.length);
    // "Step 1: \int …" — the numbering is prose that happens to start with a
    // digit, and setting it in maths type separates it from the "Step" beside it.
    const label = /^\d+[.:)]\s+/.exec(expr)?.[0] ?? "";
    if (label) expr = expr.slice(label.length);

    if (expr && STRONG_MATH.test(expr)) {
      textBuf += label;
      flushText();
      out.push({ type: "math", content: expr, display: false, auto: true });
      textBuf += punct + trailingWs;
    } else {
      // A run with no operator in it was never maths — put it back verbatim.
      textBuf += label + expr + punct + trailingWs;
    }
  };

  const parts = text.split(/(\s+)/).filter((p) => p !== "");

  parts.forEach((part, i) => {
    if (/^\s+$/.test(part)) {
      // Whitespace joins the expression only if one continues on the far side,
      // so the gap before a following word stays in the body font.
      const next = parts[i + 1];
      if (mathBuf.length > 0 && next !== undefined && !breaksMath(next, true)) {
        mathBuf.push(part);
      } else {
        flushMath();
        textBuf += part;
      }
      return;
    }

    if (breaksMath(part, mathBuf.length > 0)) {
      flushMath();
      textBuf += part;
    } else {
      mathBuf.push(part);
    }
  });

  flushMath();
  flushText();
  return out;
}

type MathTextProps = {
  /** Text with optional $...$ inline or $$...$$ display math. */
  text: string;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Render text that may contain inline `$...$` or display `$$...$$` math, plus
 * undelimited LaTeX (see `splitBareLatex`).
 * Preserves newlines so callers don't need `whiteSpace: pre-wrap` separately.
 */
export function MathText({ text, className, style }: MathTextProps) {
  const segments = useMemo(
    () =>
      parseMixed(text ?? "").flatMap((seg) =>
        seg.type === "text" ? splitBareLatex(seg.content) : [seg],
      ),
    [text],
  );

  return (
    <span className={className} style={{ whiteSpace: "pre-wrap", ...style }}>
      {segments.map((seg, idx) =>
        seg.type === "math" ? (
          <Tex key={idx} expression={seg.content} display={seg.display} quiet={seg.auto} />
        ) : (
          <span key={idx}>{seg.content}</span>
        ),
      )}
    </span>
  );
}

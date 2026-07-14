"use client";

import { useMemo } from "react";
import katex from "katex";

type MathProps = {
  /** Raw LaTeX source — no $...$ delimiters needed. */
  expression: string;
  /** Display mode = block-level, bigger fractions. Default false (inline). */
  display?: boolean;
  className?: string;
};

/**
 * Render a single LaTeX expression via KaTeX. Safe — `throwOnError: false`
 * makes KaTeX render parse errors inline (in red) instead of crashing the
 * page. `trust: false` disables `\href`, `\url`, and other vectors that
 * could execute scripts or load arbitrary content.
 */
export function Tex({ expression, display = false, className }: MathProps) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(expression, {
        displayMode: display,
        throwOnError: false,
        errorColor: "#c00",
        strict: "ignore",
        trust: false,
        output: "html",
      });
    } catch {
      // Fallback: render as plain text if KaTeX implodes for any reason
      const escaped = expression
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return escaped;
    }
  }, [expression, display]);

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
  | { type: "math"; content: string; display: boolean };

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

type MathTextProps = {
  /** Text with optional $...$ inline or $$...$$ display math. */
  text: string;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Render text that may contain inline `$...$` or display `$$...$$` math.
 * Preserves newlines so callers don't need `whiteSpace: pre-wrap` separately.
 */
export function MathText({ text, className, style }: MathTextProps) {
  const segments = useMemo(() => parseMixed(text ?? ""), [text]);

  return (
    <span className={className} style={{ whiteSpace: "pre-wrap", ...style }}>
      {segments.map((seg, idx) =>
        seg.type === "math" ? (
          <Tex key={idx} expression={seg.content} display={seg.display} />
        ) : (
          <span key={idx}>{seg.content}</span>
        ),
      )}
    </span>
  );
}

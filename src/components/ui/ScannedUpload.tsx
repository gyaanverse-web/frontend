import type { HTMLAttributes } from "react";
import { MathText } from "../Math";

export interface ScannedStep {
  text: string;
  wrong?: boolean;
}

export interface ScannedUploadProps extends HTMLAttributes<HTMLDivElement> {
  steps?: ScannedStep[];
  label?: string;
  /** Render each step's text through KaTeX, honoring `$...$` / `$$...$$` math spans. */
  math?: boolean;
}

/** "SCANNED UPLOAD" inset panel: solution steps in serif italic; the wrong step crimson + underlined. */
export function ScannedUpload({ steps = [], label = "Scanned Upload", math = false, style, ...rest }: ScannedUploadProps) {
  return (
    <div
      style={{
        background: "var(--surface-inset)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-md)",
        padding: "16px 20px",
        ...style,
      }}
      {...rest}
    >
      <div
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      {steps.map((s, i) => (
        <div
          key={i}
          style={{
            fontFamily: "var(--font-serif-display)",
            fontStyle: "italic",
            fontSize: 16,
            lineHeight: 1.9,
            color: s.wrong ? "var(--danger)" : "var(--text-heading)",
            textDecoration: s.wrong ? "underline" : "none",
            textUnderlineOffset: 4,
          }}
        >
          {math ? <MathText text={s.text} /> : s.text}
        </div>
      ))}
    </div>
  );
}

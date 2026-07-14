"use client";

import { useState } from "react";
import type { HTMLAttributes } from "react";

export interface TabsProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  tabs?: string[];
  value?: string;
  defaultValue?: string;
  onChange?: (tab: string) => void;
}

/** Underline tab strip. Controlled (value+onChange) or uncontrolled (defaultValue). */
export function Tabs({
  tabs = [],
  value,
  defaultValue,
  onChange = () => {},
  className = "",
  ...rest
}: TabsProps) {
  const [internal, setInternal] = useState(defaultValue ?? tabs[0]);
  const active = value !== undefined ? value : internal;
  return (
    <div className={`gv-tabs ${className}`} role="tablist" {...rest}>
      {tabs.map((t) => (
        <button
          key={t}
          role="tab"
          aria-selected={t === active}
          className="gv-tab"
          onClick={() => {
            setInternal(t);
            onChange(t);
          }}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

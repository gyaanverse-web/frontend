import type { HTMLAttributes } from "react";

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  name?: string;
  size?: number;
  src?: string | null;
}

/** Circular initials avatar. */
export function Avatar({ name = "", size = 32, src = null, style, ...rest }: AvatarProps) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className="gv-avatar"
      style={{ width: size, height: size, fontSize: size * 0.38, ...style }}
      {...rest}
    >
      {src ? (
        <img src={src} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        initials
      )}
    </span>
  );
}

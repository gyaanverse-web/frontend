"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface ModalProps {
  /** Whether the dialog is shown. */
  open: boolean;
  /** Called on overlay click, Escape, or the close button. */
  onClose: () => void;
  /** Optional title — renders the header row with a close button. */
  title?: ReactNode;
  /** Panel width in px (clamped to the viewport). Default 460. */
  width?: number;
  children: ReactNode;
}

/**
 * Accessible, robust modal.
 *
 * Rendered through a portal on `document.body` so it escapes any scrolling or
 * transformed ancestor (e.g. the TeacherShell's `overflow:auto` <main>) — that
 * nesting is what made the old inline modals let the page scroll *behind* the
 * overlay. Also locks background scroll and closes on Escape.
 */
export function Modal({ open, onClose, title, width = 460, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  // `open` starts false and only flips true on a user action (post-hydration),
  // so the portal never runs during SSR; this guard is just belt-and-braces.
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    // mousedown (not click) so a drag that starts inside an input and ends on
    // the overlay doesn't accidentally close the dialog.
    <div className="gv-modal-overlay" onMouseDown={onClose}>
      <div
        className="gv-modal-panel"
        style={{ width, maxWidth: "calc(100vw - 32px)", maxHeight: "calc(100vh - 48px)" }}
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {title != null && (
          <div className="gv-modal-head">
            <h4 className="gv-modal-title">{title}</h4>
            <button type="button" className="gv-modal-close" onClick={onClose} aria-label="Close">×</button>
          </div>
        )}
        <div className="gv-modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

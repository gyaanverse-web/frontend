"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Button, Modal } from "@/components/ui";
import { errorMessage } from "@/lib/fee";

/**
 * Shows the backend's printable receipt page (`?format=html`) in an iframe.
 *
 * The page is rendered server-side from the payment's frozen snapshot, with the
 * REVERSED / BOUNCED / PENDING CLEARANCE stamp as the only live field — so we
 * show exactly that document rather than re-drawing a receipt from live data
 * (LLD §4, "Why documentSnapshot exists"). Fetched as text because the route
 * needs the tenant header a plain new-tab navigation can't send.
 *
 * `path` is the receipt route without the query string, e.g.
 * `/tenant/fees/payments/:id/receipt` or `/fees/receipts/:id`. null = closed.
 */
export function ReceiptModal({ path, tenant, onClose }: { path: string | null; tenant?: string; onClose: () => void }) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState("");
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    api.getText(`${path}?format=html`, { tenant })
      .then((h) => { if (!cancelled) setHtml(h); })
      .catch((err) => { if (!cancelled) setError(errorMessage(err, "Could not load the receipt")); });
    return () => { cancelled = true; setHtml(null); setError(""); };
  }, [path, tenant]);

  return (
    <Modal open={path !== null} onClose={onClose} title="Receipt" width={720}>
      {error ? (
        <p style={{ margin: 0, color: "var(--danger)", fontSize: 13 }}>{error}</p>
      ) : html === null ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>Loading receipt…</div>
      ) : (
        <>
          {/* sandbox without allow-scripts: the page is static, and allow-modals
              is what lets the parent call print() on it. */}
          <iframe
            ref={frameRef}
            title="Receipt"
            srcDoc={html}
            sandbox="allow-same-origin allow-modals"
            style={{ width: "100%", height: 520, border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", background: "#fff" }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
            <Button type="button" variant="ghost" onClick={onClose}>Close</Button>
            <Button type="button" variant="app" onClick={() => frameRef.current?.contentWindow?.print()}>Print</Button>
          </div>
        </>
      )}
    </Modal>
  );
}

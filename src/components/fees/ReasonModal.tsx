"use client";

import { useState } from "react";
import { Button, Input, Modal } from "@/components/ui";
import { errorMessage } from "@/lib/fee";

export interface ReasonPrompt {
  title: string;
  /** What the action does — shown above the field. */
  body: string;
  confirmLabel: string;
  danger?: boolean;
  /** Runs with the entered reason. Throwing keeps the dialog open with the error. */
  onConfirm: (reason: string) => Promise<void>;
}

/**
 * Every correction in the fee ledger — reversing a payment, bouncing a cheque,
 * reversing an adjustment or a concession — requires a reason, and all of them
 * are the same shape: explain, ask why, confirm. null = closed.
 */
export function ReasonModal({ prompt, onClose }: { prompt: ReasonPrompt | null; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function close() {
    setReason(""); setError("");
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt) return;
    setBusy(true); setError("");
    try {
      await prompt.onConfirm(reason.trim());
      setReason("");
      onClose();
    } catch (err) {
      setError(errorMessage(err, "That didn't work"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={prompt !== null} onClose={close} title={prompt?.title}>
      {prompt && (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-body)", lineHeight: 1.55 }}>{prompt.body}</p>
          <Input label="Reason" required maxLength={500} autoFocus value={reason} onChange={(e) => setReason(e.target.value)}
            help="Kept on the audit trail." />
          {error && <p style={{ margin: 0, color: "var(--danger)", fontSize: 13 }}>{error}</p>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
            <Button type="submit" variant={prompt.danger ? "danger" : "app"} disabled={busy || !reason.trim()}>
              {busy ? "Working…" : prompt.confirmLabel}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

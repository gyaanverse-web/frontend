"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Badge, Button, Card, Icon, Input, Modal, Switch } from "@/components/ui";
import { errorMessage, type FeeGuardian } from "@/lib/fee";

type Props = {
  tenantSlug: string;
  studentId: string;
  guardians: FeeGuardian[];
  onChanged: () => void;
};

const EMPTY = { name: "", relation: "Father", phone: "", email: "", isPrimary: false };

/**
 * Guardian contacts (LLD §4 student_guardians). Guardians have no login — they
 * exist so reminders and bounce notices reach whoever actually pays. Reminders
 * go to the primary guardian only.
 */
export function GuardiansPanel({ tenantSlug, studentId, guardians, onChanged }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      await api.post(`/tenant/fees/students/${studentId}/guardians`, {
        name: form.name.trim(),
        relation: form.relation.trim(),
        phone: form.phone.replace(/[\s-]/g, "") || null,
        email: form.email.trim() || null,
        isPrimary: form.isPrimary || undefined,
      }, { tenant: tenantSlug });
      setShowAdd(false);
      setForm(EMPTY);
      onChanged();
    } catch (err) {
      setError(errorMessage(err, "Failed to add the guardian"));
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(id: string) {
    setError("");
    try {
      await api.delete(`/tenant/fees/guardians/${id}`, { tenant: tenantSlug });
      setConfirmRemove(null);
      onChanged();
    } catch (err) {
      setError(errorMessage(err, "Failed to remove the guardian"));
    }
  }

  return (
    <Card padding={18}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 15, color: "var(--text-heading)" }}>Guardians</h3>
        <div style={{ flex: 1 }} />
        <Button variant="ghost" size="sm" icon={<Icon name="plus" size={14} />} onClick={() => setShowAdd(true)}>Add</Button>
      </div>
      {error && !showAdd && <p style={{ margin: "0 0 10px", color: "var(--danger)", fontSize: 13 }}>{error}</p>}
      {guardians.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
          No guardian on file. Add one so fee reminders and bounce notices reach whoever pays.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {guardians.map((g) => (
            <div key={g.id} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-heading)" }}>{g.name}</span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{g.relation}</span>
                  {g.isPrimary && <Badge tone="accent">Primary</Badge>}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--text-body)", marginTop: 2, wordBreak: "break-word" }}>
                  {[g.phone, g.email].filter(Boolean).join(" · ")}
                </div>
              </div>
              {confirmRemove === g.id ? (
                <div style={{ display: "flex", gap: 4 }}>
                  <Button variant="danger" size="sm" onClick={() => handleRemove(g.id)}>Remove</Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(null)}>Keep</Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(g.id)}>Remove</Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add guardian">
        <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="Name" required maxLength={120} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="Relation" required maxLength={30} placeholder="Father, Mother, Guardian…"
            value={form.relation} onChange={(e) => setForm((f) => ({ ...f, relation: e.target.value }))} />
          <Input label="Phone" type="tel" placeholder="+919876543210"
            value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            help="10–15 digits, optionally with a leading +. SMS reminders go here." />
          <Input label="Email" type="email" maxLength={255}
            value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <Switch label={guardians.length === 0 ? "Primary contact (the first guardian always is)" : "Make this the primary contact"}
            checked={guardians.length === 0 || form.isPrimary} disabled={guardians.length === 0}
            onChange={(e) => setForm((f) => ({ ...f, isPrimary: e.target.checked }))} />
          {error && <p style={{ margin: 0, color: "var(--danger)", fontSize: 13 }}>{error}</p>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button type="button" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button type="submit" variant="app" disabled={busy || (!form.phone.trim() && !form.email.trim())}>
              {busy ? "Saving…" : "Add guardian"}
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}

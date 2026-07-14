"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { api } from "@/lib/api";
import type { Invite, Tenant } from "../types";
import { sh, cell, inp, btnP, btnS, btnD } from "../styles";

type Props = { tenant: Tenant };

export function InvitesSection({ tenant }: Props) {
  const [invites, setInvites]     = useState<Invite[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");

  const [showForm, setShowForm]         = useState(false);
  const [contact, setContact]           = useState("");
  const [contactType, setContactType]   = useState<"email" | "phone">("email");
  const [sendLoading, setSendLoading]   = useState(false);
  const [sendMsg, setSendMsg]           = useState("");
  const [sendErr, setSendErr]           = useState("");
  const [sentLink, setSentLink]         = useState<string | null>(null);
  const [linkCopied, setLinkCopied]     = useState(false);

  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError("");
    try {
      const data = await api.get<{ invites: Invite[] }>("/tenant/invites", { tenant: tenant.slug });
      setInvites(data.invites);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invites");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSendErr(""); setSendMsg(""); setSentLink(null); setLinkCopied(false); setSendLoading(true);
    try {
      const via = contactType;
      const res = await api.post<{ invite: { token: string } }>(
        "/tenant/invites",
        { contact, contactType },
        { tenant: tenant.slug },
      );
      setContact("");
      setSendMsg(
        via === "email"
          ? "Invite created — an email was sent to the teacher."
          : "Invite created. SMS delivery isn't automated yet — copy the link below and send it to the teacher yourself.",
      );
      setSentLink(`${window.location.origin}/accept-invite?token=${res.invite.token}`);
      load();
    } catch (err) {
      setSendErr(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setSendLoading(false);
    }
  }

  async function copyInviteLink(url: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback for non-secure contexts (e.g. http://niazi.lvh.me in dev)
        const el = document.createElement("textarea");
        el.value = url;
        el.style.cssText = "position:fixed;opacity:0";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      setSendErr("Failed to copy link");
    }
  }

  async function handleRevoke(inviteId: string) {
    setConfirmRevokeId(null); setError("");
    try {
      await api.delete(`/tenant/invites/${inviteId}`, { tenant: tenant.slug });
      setInvites(prev => prev.map(inv => inv.id === inviteId ? { ...inv, status: "revoked" as const } : inv));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke invite");
    }
  }

  const visible = statusFilter === "all" ? invites : invites.filter(inv => inv.status === statusFilter);

  return (
    <div style={{ background: "var(--surface-card)", border: "1px solid var(--border-default)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-sm)", marginBottom: "16px", overflow: "hidden" }}>
      <div style={sh}>
        <span>Teacher invites</span>
        <button
          type="button"
          onClick={() => { setShowForm(v => !v); setSendErr(""); setSendMsg(""); setSentLink(null); }}
          style={{ ...(showForm ? btnS : btnP), padding: "6px 14px", fontSize: 12 }}
        >
          {showForm ? "Cancel" : "+ Invite teacher"}
        </button>
      </div>

        <>
          {/* Send invite form (collapsed by default) */}
          {showForm && (
          <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-default)", background: "var(--bg-section-alt)" }}>
            <form onSubmit={handleSend} style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: "13px", fontWeight: "bold", whiteSpace: "nowrap" }}>Send Invite</span>
              <select
                value={contactType}
                onChange={e => { setContactType(e.target.value as "email" | "phone"); setContact(""); setSendErr(""); setSendMsg(""); }}
                style={{ ...inp, cursor: "pointer" }}
              >
                <option value="email">Email</option>
                <option value="phone">Phone</option>
              </select>
              <input
                required
                type={contactType === "email" ? "email" : "tel"}
                placeholder={contactType === "email" ? "teacher@example.com" : "+91XXXXXXXXXX"}
                value={contact}
                onChange={e => setContact(e.target.value)}
                style={{ ...inp, flex: 1, minWidth: "180px" }}
              />
              <button type="submit" disabled={sendLoading} style={{ ...btnP, opacity: sendLoading ? 0.6 : 1, whiteSpace: "nowrap" }}>
                {sendLoading ? "Sending…" : "Send Invite"}
              </button>
            </form>
            {sendErr && <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--danger)" }}>{sendErr}</p>}
            {sendMsg && (
              <div style={{ margin: "6px 0 0" }}>
                <p style={{ margin: 0, fontSize: "12px", color: "var(--success)" }}>{sendMsg}</p>
                {sentLink && (
                  <div style={{ marginTop: "6px", display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                    <code style={{ fontSize: "11px", background: "var(--bg-section-alt)", border: "1px solid var(--border-default)", borderRadius: "4px", padding: "3px 6px", maxWidth: "280px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {sentLink}
                    </code>
                    <button type="button" onClick={() => copyInviteLink(sentLink)} style={{ ...btnS, fontSize: "11px", padding: "2px 8px" }}>
                      {linkCopied ? "Copied!" : "Copy link"}
                    </button>
                  </div>
                )}
                <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--text-muted)" }}>
                  In dev mode the invite link is also printed to the backend console.
                </p>
              </div>
            )}
          </div>
          )}

          {/* Status filter tabs */}
          <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-default)", display: "flex", gap: "4px", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)", marginRight: "4px" }}>Filter:</span>
            {["all", "pending", "accepted", "revoked"].map(f => (
              <button key={f} onClick={() => setStatusFilter(f)} style={{ fontSize: "12px", fontWeight: 600, padding: "5px 14px", cursor: "pointer", borderRadius: "var(--radius-pill)", border: statusFilter === f ? "1px solid var(--accent)" : "1px solid var(--border-default)", background: statusFilter === f ? "var(--accent)" : "var(--surface-card)", color: statusFilter === f ? "#fff" : "var(--text-body)" }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
            <button onClick={load} disabled={loading} style={{ ...btnS, marginLeft: "auto", fontSize: "11px", padding: "2px 8px", opacity: loading ? 0.5 : 1 }}>
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>

          {/* Invites table */}
          {error ? (
            <div style={{ padding: "12px", fontSize: "13px", color: "var(--danger)" }}>{error}</div>
          ) : visible.length === 0 ? (
            <div style={{ padding: "12px", fontSize: "13px", color: "var(--text-muted)" }}>
              No {statusFilter === "all" ? "" : statusFilter + " "}invites found.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg-section-alt)" }}>
                  <th style={{ ...cell, fontWeight: "bold", textAlign: "left" }}>Contact</th>
                  <th style={{ ...cell, fontWeight: "bold", textAlign: "left" }}>Status</th>
                  <th style={{ ...cell, fontWeight: "bold", textAlign: "left" }}>Expires</th>
                  <th style={{ ...cell, fontWeight: "bold", textAlign: "left" }}>Sent</th>
                  <th style={{ ...cell, fontWeight: "bold", textAlign: "left", width: "80px" }}></th>
                </tr>
              </thead>
              <tbody>
                {visible.map(inv => {
                  const statusStyle: CSSProperties =
                    inv.status === "pending"  ? { background: "#fef9c3", color: "#713f12", border: "1px solid #fde068" } :
                    inv.status === "accepted" ? { background: "#dcfce7", color: "var(--success)", border: "1px solid #86efac" } :
                                                { background: "#f3f4f6", color: "#6b7280", border: "1px solid #d1d5db" };
                  const isExpired = inv.status === "pending" && new Date() > new Date(inv.expiresAt);
                  return (
                    <tr key={inv.id}>
                      <td style={{ ...cell, fontFamily: "monospace", fontSize: "12px" }}>
                        {inv.contact}
                        <span style={{ marginLeft: 8, fontFamily: "var(--font-body)", fontSize: "11px", color: "var(--text-muted)", textTransform: "capitalize" }}>
                          · {inv.contactType}
                        </span>
                      </td>
                      <td style={cell}>
                        <span style={{ ...statusStyle, padding: "3px 10px", fontSize: "11px", fontWeight: "bold", borderRadius: "var(--radius-pill)" }}>
                          {isExpired ? "expired" : inv.status}
                        </span>
                      </td>
                      <td style={{ ...cell, fontSize: "12px", color: isExpired ? "var(--danger)" : "#555" }}>
                        {new Date(inv.expiresAt).toLocaleDateString()}
                      </td>
                      <td style={{ ...cell, fontSize: "12px", color: "var(--text-muted)" }}>{new Date(inv.createdAt).toLocaleDateString()}</td>
                      <td style={{ ...cell, whiteSpace: "nowrap" }}>
                        {inv.status === "pending" && (
                          confirmRevokeId === inv.id ? (
                            <span style={{ display: "inline-flex", gap: "4px" }}>
                              <button onClick={() => handleRevoke(inv.id)} style={{ ...btnD, padding: "2px 8px", fontSize: "11px" }}>Confirm</button>
                              <button onClick={() => setConfirmRevokeId(null)} style={{ ...btnS, padding: "2px 6px", fontSize: "11px" }}>✕</button>
                            </span>
                          ) : (
                            <button onClick={() => setConfirmRevokeId(inv.id)} style={{ background: "transparent", color: "var(--danger)", border: "1px solid var(--danger)", padding: "3px 12px", cursor: "pointer", borderRadius: "var(--radius-pill)", fontSize: "12px" }}>
                              Revoke
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
    </div>
  );
}
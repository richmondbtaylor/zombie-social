"use client";
import { useState } from "react";
import type { MemberRole } from "@/lib/db";

interface MemberRow {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  deactivated: boolean;
}

export default function TeamClient({
  initialMembers,
  canManage,
  myId,
}: {
  initialMembers: MemberRow[];
  canManage: boolean;
  myId: string;
}) {
  const [members, setMembers] = useState<MemberRow[]>(initialMembers);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("editor");
  const [msg, setMsg] = useState("");
  const [inviting, setInviting] = useState(false);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    setInviting(true);
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.detail ?? "Could not send the invite.");
        return;
      }
      setMsg(
        data.emailed
          ? `Invite emailed to ${email}.`
          : `Invite created. Share this link: ${data.inviteUrl}`,
      );
      setEmail("");
    } finally {
      setInviting(false);
    }
  }

  async function remove(id: string, name: string) {
    setMsg("");
    const res = await fetch("/api/members", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(data.detail ?? `Could not remove ${name}.`);
      return;
    }
    setMsg(`${name} removed. Their pending posts were reassigned to you.`);
    setMembers((ms) => ms.map((m) => (m.id === id ? { ...m, deactivated: true } : m)));
  }

  return (
    <>
      <div className="list">
        {members.map((m) => (
          <div key={m.id} className="card row" style={{ justifyContent: "space-between" }}>
            <div>
              <strong>{m.name}</strong>{" "}
              <span className="pill">{m.role}</span>
              {m.deactivated && (
                <span className="pill" style={{ background: "#fbe4e2", color: "var(--danger)" }}>removed</span>
              )}
              <div className="muted small">{m.email}</div>
            </div>
            {canManage && !m.deactivated && m.id !== myId && (
              <button className="ghost small-btn" onClick={() => remove(m.id, m.name)}>Remove</button>
            )}
          </div>
        ))}
      </div>

      {canManage ? (
        <form onSubmit={invite} className="card stack" style={{ maxWidth: 520, marginTop: 16 }}>
          <strong>Invite a teammate</strong>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@company.com" required />
          </label>
          <label>
            Role
            <select value={role} onChange={(e) => setRole(e.target.value as MemberRole)}>
              <option value="editor">Editor — writes and schedules</option>
              <option value="viewer">Viewer — read only</option>
            </select>
          </label>
          <button type="submit" disabled={inviting}>{inviting ? "Sending…" : "Send invite"}</button>
          <p className="muted small">Invites expire after 7 days and can be used once.</p>
        </form>
      ) : (
        <p className="muted">Only the workspace owner can invite or remove teammates.</p>
      )}

      {msg && <p className="error">{msg}</p>}
    </>
  );
}

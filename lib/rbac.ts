import type { MemberRole } from "@/lib/db";

// ─── RBAC helpers (safe for client + server) ────────────────────────────────

export function canCreate(role: MemberRole): boolean {
  return role === "owner" || role === "editor";
}

export function canPublish(role: MemberRole): boolean {
  return role === "owner" || role === "editor";
}

export function canEdit(role: MemberRole): boolean {
  return role === "owner" || role === "editor";
}

export function canDelete(role: MemberRole): boolean {
  return role === "owner" || role === "editor";
}

export function canSchedule(role: MemberRole): boolean {
  return role === "owner" || role === "editor";
}

export function canInvite(role: MemberRole): boolean {
  return role === "owner";
}

export function canManageBilling(role: MemberRole): boolean {
  return role === "owner";
}

export function canExport(role: MemberRole): boolean {
  return role === "owner" || role === "editor";
}

export function isViewer(role: MemberRole): boolean {
  return role === "viewer";
}

import { NextResponse } from "next/server";
import { db, newId } from "@/lib/db";
import { getAuthMember, canInvite } from "@/lib/auth";
import { Problems } from "@/lib/problem";
import { INVITE_EXPIRY_DAYS } from "@/lib/config";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET() {
  const me = await getAuthMember();
  if (!me) return Problems.UNAUTHORIZED();
  const { data } = await db()
    .from("members")
    .select("id, name, email, role, deactivated")
    .eq("workspace_id", me.workspaceId);
  return NextResponse.json(data ?? []);
}

/** Invite a teammate by email. Owner-only; single-use token expiring in 7 days. */
export async function POST(req: Request) {
  const me = await getAuthMember();
  if (!me) return Problems.UNAUTHORIZED();
  if (!canInvite(me.role)) return Problems.FORBIDDEN("Only the workspace owner can send invites.");

  const b = await req.json().catch(() => ({}));
  const email = String(b.email ?? "").trim().toLowerCase();
  const role = String(b.role ?? "viewer");
  if (!email || !email.includes("@")) return Problems.BAD_REQUEST("A valid email address is required.");
  if (!["owner", "editor", "viewer"].includes(role)) return Problems.BAD_REQUEST("Invalid role.");

  // Reject inviting an address that's already a member.
  const { data: existing } = await db()
    .from("members")
    .select("id")
    .eq("workspace_id", me.workspaceId)
    .eq("email", email)
    .maybeSingle();
  if (existing) return Problems.CONFLICT("That email is already a member of this workspace.");

  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 3600 * 1000).toISOString();

  const { error } = await db().from("workspace_invites").insert({
    id: newId(),
    workspace_id: me.workspaceId,
    email,
    role,
    token,
    expires_at: expiresAt,
  });
  if (error) return Problems.INTERNAL(error.message);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const inviteUrl = `${appUrl}/auth/invite?token=${token}`;

  // Send the invite via Resend if configured; otherwise return the URL for the owner to share.
  const apiKey = process.env.RESEND_API_KEY;
  let emailed = false;
  if (apiKey && appUrl) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL ?? "invites@example.com",
          to: email,
          subject: `You're invited to Zombie Social`,
          text: `${me.name} invited you to join their workspace as a ${role}.\n\nAccept: ${inviteUrl}\nThis link expires in ${INVITE_EXPIRY_DAYS} days.`,
        }),
      });
      emailed = res.ok;
    } catch (err) {
      console.warn("[invite] email send failed", err);
    }
  }

  return NextResponse.json({ ok: true, inviteUrl, emailed });
}

/** Accept an invite: registers the user and links them to the workspace. */
export async function PUT(req: Request) {
  const { token } = await req.json().catch(() => ({ token: "" }));
  if (!token) return Problems.BAD_REQUEST("Invite token is required.");

  const { data: invite } = await db()
    .from("workspace_invites")
    .select("*")
    .eq("token", String(token))
    .maybeSingle();
  if (!invite) return Problems.NOT_FOUND("Invite not found.");
  if (invite.used_at) return Problems.CONFLICT("This invite has already been used.");
  if (new Date(invite.expires_at).getTime() < Date.now()) return Problems.CONFLICT("This invite has expired.");

  // Mark invite used and create the member. Linking to the Supabase auth user happens on
  // first sign-in by matching email, or immediately if the caller already has a session.
  const { supabaseServer } = await import("@/lib/auth");
  const { data: { user } } = await (await supabaseServer()).auth.getUser();

  const memberId = newId();
  const { error } = await db().from("members").insert({
    id: memberId,
    workspace_id: invite.workspace_id,
    user_id: user?.id ?? memberId,
    name: String(invite.email).split("@")[0],
    email: invite.email,
    role: invite.role,
  });
  if (error) return Problems.INTERNAL(error.message);

  await db().from("workspace_invites").update({ used_at: new Date().toISOString() }).eq("id", invite.id);

  await db().from("audit_log").insert({
    id: newId(),
    workspace_id: invite.workspace_id,
    actor_id: memberId,
    action: "member.accept_invite",
    entity_type: "member",
    entity_id: memberId,
    details: { role: invite.role },
  });

  return NextResponse.json({ ok: true });
}

/** DELETE — remove a member: reassign their pending scheduled posts to the owner, audit it. */
export async function DELETE(req: Request) {
  const me = await getAuthMember();
  if (!me) return Problems.UNAUTHORIZED();
  if (me.role !== "owner") return Problems.FORBIDDEN("Only the owner can remove members.");

  const { memberId } = await req.json().catch(() => ({ memberId: "" }));
  if (!memberId) return Problems.BAD_REQUEST("memberId is required.");
  if (memberId === me.id) return Problems.BAD_REQUEST("You cannot remove yourself as the owner.");

  const { data: target } = await db().from("members").select("*").eq("id", String(memberId)).eq("workspace_id", me.workspaceId).single();
  if (!target) return Problems.NOT_FOUND("Member not found.");

  // Reassign pending scheduled/pending_review posts to the workspace owner.
  const { data: ownerMember } = await db()
    .from("members")
    .select("id")
    .eq("workspace_id", me.workspaceId)
    .eq("role", "owner")
    .neq("id", String(memberId))
    .limit(1)
    .maybeSingle();

  if (ownerMember) {
    await db()
      .from("posts")
      .update({ created_by: ownerMember.id })
      .eq("created_by", String(memberId))
      .in("status", ["draft", "scheduled", "pending_review"]);
  }

  await db().from("members").update({ deactivated: true }).eq("id", String(memberId));

  await db().from("audit_log").insert({
    id: newId(),
    workspace_id: me.workspaceId,
    actor_id: me.id,
    action: "member.remove",
    entity_type: "member",
    entity_id: String(memberId),
    details: { reassigned_to: ownerMember?.id },
  });

  return NextResponse.json({ ok: true });
}

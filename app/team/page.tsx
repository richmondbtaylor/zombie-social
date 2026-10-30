import { db } from "@/lib/db";
import { getAuthMember } from "@/lib/auth";
import { canInvite } from "@/lib/rbac";
import type { MemberRole } from "@/lib/db";
import TeamClient from "@/components/TeamClient";

export const dynamic = "force-dynamic";

interface MemberRow {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  deactivated: boolean;
}

export default async function TeamPage() {
  const me = await getAuthMember();
  if (!me) {
    return (
      <div className="card">
        <strong>Not signed in.</strong>
        <p className="muted">Run the app with DEMO_MODE=1 to use the demo workspace.</p>
      </div>
    );
  }

  const { data } = await db()
    .from("members")
    .select("id, name, email, role, deactivated")
    .eq("workspace_id", me.workspaceId)
    .order("role");

  const members: MemberRow[] = (data ?? []).map((m) => ({
    id: m.id as string,
    name: m.name as string,
    email: m.email as string,
    role: m.role as MemberRole,
    deactivated: m.deactivated as boolean,
  }));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Team</h1>
          <p className="sub">Owners manage billing and approvals. Editors write and schedule. Viewers read only.</p>
        </div>
      </div>
      <TeamClient
        initialMembers={members}
        canManage={canInvite(me.role)}
        myId={me.id}
      />
    </>
  );
}

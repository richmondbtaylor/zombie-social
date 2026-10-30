import { NextResponse } from "next/server";
import { getAuthMember } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const me = await getAuthMember();
  if (!me) {
    return NextResponse.json({ code: "unauthorized", title: "Unauthorized", detail: "Not signed in." }, { status: 401 });
  }
  return NextResponse.json({
    id: me.id,
    workspaceId: me.workspaceId,
    name: me.name,
    email: me.email,
    role: me.role,
    deactivated: me.deactivated,
  });
}

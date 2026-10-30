import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import type { MemberRole } from "@/lib/db";

// Re-export RBAC for convenience in server route handlers
export {
  canCreate, canPublish, canEdit, canDelete,
  canSchedule, canInvite, canManageBilling, canExport, isViewer,
} from "@/lib/rbac";

// ─── Server-side Supabase client with cookie handling ────────────────────────

export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    },
  );
}

// ─── Middleware Supabase client (for request-time auth) ──────────────────────

export function supabaseMiddleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          req.cookies.set({ name, value, ...options });
          res = NextResponse.next({ request: req });
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          req.cookies.set({ name, value: "", ...options });
          res = NextResponse.next({ request: req });
          res.cookies.set({ name, value: "", ...options });
        },
      },
    },
  );
  return { client, res };
}

// ─── Get authenticated member for current request ────────────────────────────

export async function getAuthMember() {
  // Demo mode: skip Supabase Auth entirely and resolve a seeded member by email.
  if (process.env.DEMO_MODE === "1") {
    const email = process.env.DEMO_AS || "maya@harborpine.example";
    const { data: member } = await db()
      .from("members")
      .select("id, workspace_id, user_id, name, email, role, deactivated")
      .eq("email", email)
      .single();
    if (!member) return null;
    return {
      id: member.id as string,
      workspaceId: member.workspace_id as string,
      userId: member.user_id as string,
      name: member.name as string,
      email: member.email as string,
      role: member.role as MemberRole,
      deactivated: member.deactivated as boolean,
    };
  }

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: member } = await db()
    .from("members")
    .select("id, workspace_id, user_id, name, email, role, deactivated")
    .eq("user_id", user.id)
    .single();

  if (!member) return null;
  return {
    id: member.id as string,
    workspaceId: member.workspace_id as string,
    userId: member.user_id as string,
    name: member.name as string,
    email: member.email as string,
    role: member.role as MemberRole,
    deactivated: member.deactivated as boolean,
  };
}

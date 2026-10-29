import { NextResponse } from "next/server";

// ZOMBIE: there is no job runner. Nothing ever looks for scheduled posts whose time has come,
// so scheduled posts never go out (post 1005 is already late). Build a job (Vercel Cron, a
// queue, or Supabase scheduled functions) that calls this every minute, publishes what is due,
// retries failures and protects this route with a secret.
export async function GET() {
  return NextResponse.json({ error: "The scheduler is not built yet." }, { status: 501 });
}

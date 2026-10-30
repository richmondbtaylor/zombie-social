"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useEffect, useState } from "react";
import type { MemberRole } from "@/lib/db";

// ─── Browser-side Supabase client ────────────────────────────────────────────

export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// ─── Current user info (replaces old localStorage-based useMe) ───────────────

export interface MeInfo {
  id: string;
  workspaceId: string;
  name: string;
  email: string;
  role: MemberRole;
  deactivated: boolean;
}

export function useMe(): MeInfo | null {
  const [me, setMe] = useState<MeInfo | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.id) setMe(data);
      })
      .catch(() => {});
  }, []);

  return me;
}

// ─── Auth actions ────────────────────────────────────────────────────────────

export async function signInWithEmail(email: string) {
  const supabase = supabaseBrowser();
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) throw error;
}

export async function signOut() {
  const supabase = supabaseBrowser();
  await supabase.auth.signOut();
  window.location.href = "/auth/login";
}

"use client";
// ZOMBIE: there are no accounts. "Me" is just an id saved in this browser, picked from a dropdown.
// Anyone can pretend to be anyone. Replace this with real sign-in (Supabase Auth, Clerk, Auth.js...).
import { useEffect, useState } from "react";

const KEY = "zombie-social-me";

export function setMe(id: string) {
  localStorage.setItem(KEY, id);
  window.dispatchEvent(new Event("me-changed"));
}

// Returns the current user's id, or null until the page has loaded.
export function useMe(): string | null {
  const [me, setMeState] = useState<string | null>(null);
  useEffect(() => {
    const read = () => setMeState(localStorage.getItem(KEY));
    read();
    window.addEventListener("me-changed", read);
    return () => window.removeEventListener("me-changed", read);
  }, []);
  return me;
}

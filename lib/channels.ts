import type { Platform } from "@/lib/db";

export const PLATFORM_NAMES: Record<Platform, string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  x: "X",
  tiktok: "TikTok",
  facebook: "Facebook",
};

// ZOMBIE: the character limits are wrong or out of date. LinkedIn posts can be much longer than
// 1300, TikTok captions are longer than 150 now, and X counts every link as 23 characters.
// Look up each platform's current limit (check the current rule) and fix the numbers.
export const LIMITS: Record<Platform, number> = {
  instagram: 2200,
  linkedin: 1300,
  x: 280,
  tiktok: 150,
  facebook: 5000,
};

// ZOMBIE: the counter is plain string length. Emoji, accents and links are counted wrong
// (X counts a link as 23 characters, no matter how long it is). It also only warns:
// nothing on the server stops a post that is over the limit.
export function countChars(text: string, _platform: Platform): number {
  return text.length;
}

export const PLATFORM_COLORS: Record<Platform, string> = {
  instagram: "#c13584",
  linkedin: "#0a66c2",
  x: "#16151d",
  tiktok: "#00a3a3",
  facebook: "#1877f2",
};

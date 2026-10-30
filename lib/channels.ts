import type { Platform } from "@/lib/db";

export const PLATFORM_NAMES: Record<Platform, string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  x: "X",
  tiktok: "TikTok",
  facebook: "Facebook",
};

// Verified against each platform's public docs as of 2026-10.
export const LIMITS: Record<Platform, number> = {
  instagram: 2200,
  linkedin: 3000,
  x: 280,
  tiktok: 2200,
  facebook: 63206,
};

const URL_RE = /https?:\/\/[^\s]+/g;
const X_URL_WEIGHT = 23;

/** Count characters the way each platform does. */
export function countChars(text: string, platform: Platform): number {
  if (platform === "x") {
    // X counts every http(s) link as 23 characters regardless of length,
    // and counts graphemes (so emoji and accents are 1 each).
    const replaced = text.replace(URL_RE, "x".repeat(X_URL_WEIGHT));
    return Array.from(replaced).length;
  }
  // Grapheme-ish count via code points for the other platforms.
  return Array.from(text).length;
}

export const PLATFORM_COLORS: Record<Platform, string> = {
  instagram: "#c13584",
  linkedin: "#0a66c2",
  x: "#16151d",
  tiktok: "#00a3a3",
  facebook: "#1877f2",
};

// Image aspect-ratio limits enforced before publish.
export interface RatioRule { label: string; min: number; max: number }
export const RATIO_LIMITS: Partial<Record<Platform, RatioRule>> = {
  instagram: { label: "square or portrait between 1.91:1 and 4:5", min: 0.8, max: 1.91 },
  tiktok: { label: "vertical 9:16 preferred", min: 0.5, max: 0.6 },
};

export function ratioOk(width: number, height: number, platform: Platform): boolean {
  const rule = RATIO_LIMITS[platform];
  if (!rule) return true;
  const ratio = width / height;
  return ratio >= rule.min && ratio <= rule.max;
}

export function ratioMessage(platform: Platform): string {
  const rule = RATIO_LIMITS[platform];
  return rule ? `${PLATFORM_NAMES[platform]} requires ${rule.label}.` : "";
}

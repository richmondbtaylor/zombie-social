"use client";
import type { Platform } from "@/lib/db";

/** Minimal platform logo SVGs — single-color, inherits currentColor. */
const ICONS: Record<Platform, React.ReactNode> = {
  instagram: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ width: "1em", height: "1em" }}>
      <rect x="2" y="2" width="20" height="20" rx="5" /><circle cx="12" cy="12" r="5" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: "1em", height: "1em" }}>
      <path d="M20.45 20.45h-3.56v-5.6c0-1.34-.03-3.07-1.87-3.07-1.87 0-2.16 1.46-2.16 2.97v5.7H9.3V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.44a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.56V9h3.56v11.45z"/>
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: "1em", height: "1em" }}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.425 11.24H15.73l-5.18-6.75-5.93 6.75H2.31l7.73-8.83L1.76 2.25h6.74l4.68 6.24 5.06-6.24z"/>
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: "1em", height: "1em" }}>
      <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.25 1.68v3.99c-1.44-.04-2.87-.36-4.17-1.01v8.85c0 4.3-3.46 7.82-7.73 7.82-4.26 0-7.72-3.52-7.72-7.82 0-4.3 3.46-7.82 7.72-7.82.35 0 .7.03 1.04.08v4.02c-.34-.06-.69-.09-1.04-.09-2.07 0-3.75 1.7-3.75 3.81s1.68 3.81 3.75 3.81c2.08 0 3.76-1.7 3.76-3.81V.02z"/>
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: "1em", height: "1em" }}>
      <path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.41 0 12.07c0 6.03 4.39 11.04 10.13 11.93v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.69.24 2.69.24v2.97h-1.52c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8v8.44C19.61 23.11 24 18.1 24 12.07z"/>
    </svg>
  ),
};

export default function PlatformIcon({ platform, size = 18 }: { platform: Platform; size?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", fontSize: size, lineHeight: 1, width: size, height: size }}>
      {ICONS[platform]}
    </span>
  );
}

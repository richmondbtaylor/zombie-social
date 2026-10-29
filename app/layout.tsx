import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import Sponsors from "@/components/Sponsors";
import PretendPicker from "@/components/PretendPicker";

export const metadata: Metadata = {
  title: "Zombie Social",
  description: "A half-built social post scheduler. Bring it back to life.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="zombie-bar">
          🧟 Zombie build: it half works. Read ZOMBIE.md for what to fix.
        </div>
        <nav className="nav">
          <Link href="/" className="brand">Zombie Social</Link>
          <Link href="/">Queue</Link>
          <Link href="/compose">Compose</Link>
          <Link href="/calendar">Calendar</Link>
          <Link href="/drafts">Drafts</Link>
          <Link href="/analytics">Analytics</Link>
          <Link href="/channels">Channels</Link>
          <Link href="/pricing">Pricing</Link>
          <PretendPicker />
        </nav>
        <main>{children}</main>
        <Sponsors />
      </body>
    </html>
  );
}

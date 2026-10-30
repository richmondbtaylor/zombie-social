import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import Sponsors from "@/components/Sponsors";

export const metadata: Metadata = {
  title: "Zombie Social",
  description: "A multi-tenant social media scheduling SaaS.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="nav">
          <Link href="/" className="brand">Zombie Social</Link>
          <Link href="/">Queue</Link>
          <Link href="/compose">Compose</Link>
          <Link href="/calendar">Calendar</Link>
          <Link href="/drafts">Drafts</Link>
          <Link href="/analytics">Analytics</Link>
          <Link href="/channels">Channels</Link>
          <Link href="/team">Team</Link>
          <Link href="/pricing">Pricing</Link>
        </nav>
        <main>{children}</main>
        <Sponsors />
      </body>
    </html>
  );
}

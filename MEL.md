# MEL.md

This is a hackathon project: a half-built copy of Buffer, Later and Hootsuite (a social post scheduler) that we are turning into a real SaaS product the whole group can use.

## The stack

- Next.js (App Router) + TypeScript + React. Plain CSS in `app/globals.css`, no Tailwind.
- Data: `lib/db.ts` reads and writes `data/db.json`. `data/seed.json` is the starting data (members, channels, posts with fake results). This is temporary.
- Routes: `app/api/members`, `channels`, `channels/[id]` (disconnect), `posts`, `posts/[id]`, `posts/[id]/publish`, `analytics`, `analytics/export`, `upload`, `cron/publish`. Pages: Queue (`app/page.tsx`), `compose`, `calendar`, `drafts`, `analytics`, `channels`, `pricing`.
- Channel limits and the character counter are in `lib/channels.ts`. `components/PostRow.tsx` draws one post in the queue and drafts.
- "Who am I" is a dropdown (`components/PretendPicker.tsx`, `lib/useMe.ts`). There are no real accounts yet.
- Payments: `app/api/checkout/route.ts` is a stub. Stripe is not connected.
- Runs on port 3111.

## The job

Work through `ZOMBIE.md` in order: make it work, make it secure, make it compliant, connect Stripe, ship it.
Every planted problem in the code is marked with a `ZOMBIE:` comment.
This app posts for people on other companies' platforms, so token safety and each platform's rules come first.

## Rules for agents

- Keep it running. Run `npm run build` after each change and fix what breaks.
- Never commit secrets. Keys and tokens go in `.env.local` (it is git-ignored).
- Use Stripe test mode keys only. Never post to a real social account while testing.
- Keep all sample data fake. Never add real people's accounts or tokens.
- Never send access tokens to the browser.
- When you fix a `ZOMBIE:` item, delete its comment and tick its box in `ZOMBIE.md`.
- Small commits with plain messages.

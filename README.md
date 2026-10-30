# Zombie Social

> A multi-tenant social media scheduling SaaS — Buffer / Later / Hootsuite alternative.

**Replaces:** Buffer, Later and Hootsuite (Buffer is from $5/month per channel)

## Architecture

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript 5
- **Database:** PostgreSQL via Supabase (row-level security, multi-tenant workspaces)
- **Auth:** Supabase Auth (magic links + OAuth) with RBAC (owner / editor / viewer)
- **Storage:** Supabase Storage (pre-signed uploads, Sharp image derivatives)
- **Billing:** Stripe Checkout (metered by channel count) with webhook-driven plan enforcement
- **Scheduling:** Vercel Cron (1-min interval) with claim-based locking and exponential backoff
- **Email:** Resend (invite emails, failure alerts)
- **Encryption:** AES-256-GCM for OAuth tokens at rest

## Setup

```bash
# 1. Clone and install
git clone https://github.com/richmondbtaylor/zombie-social.git
cd zombie-social
npm install

# 2. Configure environment
cp .env.example .env.local
# Fill in all required values (Supabase, Stripe, OAuth, etc.)

# 3. Run the database migration
# Copy supabase/migrations/001_schema.sql into your Supabase SQL Editor and execute it

# 4. Seed the database (optional, for initial demo data)
npm run seed

# 5. Start the dev server
npm run dev
```

Open http://localhost:3111.

## What's included

- **Multi-tenant workspaces** with member roles (owner / editor / viewer)
- **Supabase Auth** — magic links and OAuth sign-in, no more "Pretend to be" dropdown
- **Real OAuth** — connect LinkedIn and X accounts with proper token encryption and revocation
- **Post scheduling** — create, edit, schedule, submit for review, approve/reject
- **Batch publishing** — Vercel Cron worker with claim-based locking, stale-post detection, per-channel spacing, and exponential backoff (1/5/15 min)
- **Character counting** — platform-aware (X counts links as 23 chars), server-enforced limits
- **Duplicate detection** — SHA-256 hash check within 24-hour rolling window
- **Sponsored post compliance** — #ad auto-appended, platform branded-content flags passed
- **Image upload** — Supabase Storage with magic-byte validation, 5 MB cap, Sharp derivatives (1:1, 9:16, 16:9)
- **Analytics** — engagement rate ÷ impressions (not followers), per-post aggregation across all channels, CSV export
- **Stripe billing** — Checkout, Customer Portal, webhook-driven plan enforcement, 3-day grace period, channel freezing on downgrade
- **RBAC** — viewers cannot create, edit, delete, schedule, publish, invite, or export; owners approve/reject
- **Audit log** — every create, edit, publish, delete, connect, disconnect, invite, and billing event
- **RFC 7807 errors** — structured JSON (`code`, `title`, `detail`) with correct HTTP status codes

## Deployment

Deploy to Vercel with the Supabase integration:

```bash
vercel --prod
```

The `vercel.json` configures a 1-minute cron for `/api/cron/publish`. Set all env vars in the Vercel dashboard.

## License

MIT.

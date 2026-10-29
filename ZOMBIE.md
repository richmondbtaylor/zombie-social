# 🧟 ZOMBIE.md: what's broken

This app is a zombie on purpose. Pick items off this list. Every box you tick gets it closer to a product we can all use and stop paying for Buffer, Later and Hootsuite.

Search the code for `ZOMBIE:` to find every planted problem.

## 1. Make it work

- [ ] "Connect account" gets a 501 (`app/api/channels/route.ts`). Every platform needs its own OAuth sign-in. Build one platform first, then the rest. Handle token refresh.
- [ ] "Publish now" gets a 501 (`app/api/posts/[id]/publish/route.ts`). Build it with the platform posting APIs, then set the post to published or failed.
- [ ] Nothing ever posts at the scheduled time (`app/api/cron/publish/route.ts`). There is no job runner. Post 1005 in the seed is already late and still says "scheduled". Build a job that runs every minute, posts what is due, and retries failures.
- [ ] The character limits are wrong (`lib/channels.ts`). LinkedIn is set too low, TikTok is far too low, and Facebook is a guess. Look up each platform's current limit.
- [ ] The counter is plain string length (`countChars` in `lib/channels.ts`). X counts every link as 23 characters, and emoji and accents count differently. Count the way each platform does.
- [ ] The counter only warns. The server accepts a post over the limit (`app/api/posts/route.ts`). Block it on the server.
- [ ] You can schedule a post in the past (`app/api/posts/route.ts`). Reject it.
- [ ] Times are saved with no time zone (`app/api/posts/route.ts`, `Post.scheduledAt` in `lib/db.ts`). A post for 2 pm lands at the wrong hour for people in other zones. Save UTC plus the workspace time zone and show times in that zone.
- [ ] The queue is sorted newest first (`app/page.tsx`). It should show the next post to go out first.
- [ ] The week calendar puts evening posts on the wrong day (`app/calendar/page.tsx`). It uses the UTC date instead of the local date.
- [ ] Image upload is turned off (`app/api/upload/route.ts`). Build it with real file storage.
- [ ] Engagement rate divides by followers (`app/api/analytics/route.ts`). Use impressions, and say on the page which one you use.
- [ ] "Average impressions per post" divides by the number of channels, not posts (`app/api/analytics/route.ts`).
- [ ] "Top post" looks at the first channel result only (`app/api/analytics/route.ts`).
- [ ] "Export CSV" on Analytics gets a 501 (`app/api/analytics/export/route.ts`). Build it.
- [ ] Analytics numbers are fake seed data. Pull real numbers from the platforms.
- [ ] No duplicate check and no daily cap on posts (`app/api/posts/route.ts`). The same text can go to the same channel over and over.
- [ ] You cannot edit a scheduled post in the composer, only delete it. Build edit.

## 2. Make it secure

- [ ] There is no login. The "Pretend to be" dropdown lets anyone act as anyone (`components/PretendPicker.tsx`, `lib/useMe.ts`). Add accounts (Supabase Auth, Clerk, Auth.js...).
- [ ] `GET /api/channels` sends access tokens and refresh tokens to any browser (`app/api/channels/route.ts`). Never send tokens to the client.
- [ ] Tokens are stored as plain text in `data/db.json` (`lib/db.ts`). Encrypt them at rest, with a key that is not in the code.
- [ ] "Disconnect" only flips a flag (`app/api/channels/[id]/route.ts`). The tokens stay on disk and are never revoked with the platform. Revoke them and delete them.
- [ ] Any caller can edit or delete any post, and a viewer has the same power as the owner (`app/api/posts/[id]/route.ts`). Check who is calling and their role.
- [ ] `createdBy` comes from the request (`app/api/posts/route.ts`). Take it from the signed-in user.
- [ ] Posts are not checked on the server (`app/api/posts/route.ts`): empty text, no channels, channel ids that do not exist, any image URL. Validate it all.
- [ ] `PATCH /api/posts/[id]` copies any field onto the post, even `status` and `createdBy`. Allow only the fields you mean to.
- [ ] Image URLs are shown as text today. When you render them, only allow `https` links and check what they point to.
- [ ] The scheduler route has no secret. When you build it, protect it so only your job runner can call it (`app/api/cron/publish/route.ts`).
- [ ] Ids are guessable (`lib/db.ts`). Use random ids and check that the record belongs to the signed-in workspace.
- [ ] Data lives in `data/db.json` on disk. Move it to a real database.
- [ ] No audit log. Add who scheduled, edited, published and deleted what.

## 3. Make it compliant

A social scheduler posts for people on other companies' platforms. Their rules are the rules.

- [ ] **Platform developer terms:** Meta (Instagram and Facebook), LinkedIn, X and TikTok each have developer terms and an API review. Most need an app review before you can post for other people. Read each platform's terms before you build its connector.
- [ ] **API rate limits and posting caps:** each platform limits how many posts an account can publish through the API per day, and how often you can call it. The numbers change, so check the current rule. Count your posts, back off on errors, and show the user a clear message.
- [ ] **Posting needs the user's action:** some platforms (TikTok is one) require the user to review and approve the post, and to see the privacy and consent choices, before it goes live. Do not build a button that posts without the user's say. Read the current posting rules for each platform.
- [ ] **Automation and spam rules:** posting the same text again and again, or from many accounts, breaks platform rules and can get accounts banned (`app/api/posts/route.ts`). Add the duplicate check and a daily cap.
- [ ] **FTC Endorsement Guides:** if a post is paid or the poster has a material connection (free product, code, payment), the US FTC says the post must clearly say so. Use #ad, or the platform's paid partnership label. The "sponsored" box is saved but does nothing today (`app/api/posts/route.ts`). Add the disclosure to the text and set the platform's branded content flag.
- [ ] **User tokens:** treat them like passwords. They must be encrypted, never shown in the app, and revocable. When a user disconnects or deletes their account, revoke the token with the platform and delete it.
- [ ] **Platform data deletion:** some platforms (Meta is one) expect you to offer a way to delete a user's data and to answer a data deletion request. Build it.
- [ ] **Privacy laws (GDPR, CCPA/CPRA):** you hold connected account data, post history and analytics. Say what you collect, why, and how to delete it. Teams that serve the EU need a legal basis.
- [ ] **Images and music:** posting a picture or sound that the user does not own can break copyright rules (DMCA in the US). Add a note and a takedown process.
- [ ] **Accessibility:** add alt text for images. Some platforms support it, and it helps everyone.
- [ ] **Subscriptions:** US auto-renewal laws (for example California) and FTC rules need clear pricing and an easy cancel.
- [ ] No privacy policy or terms page.
- [ ] No way for a user to export or delete their data.

## 4. Connect Stripe

- [ ] `app/api/checkout/route.ts` returns a 501. Create a Stripe Checkout Session (test mode is fine).
- [ ] Add a webhook route that marks the account as paid.
- [ ] Lock the paid features behind the plan (for example: number of channels, team members, analytics).

## 5. Ship it

- [ ] Deploy it (Vercel, Netlify, Railway...). The JSON file database will not survive this, so do section 2 first.
- [ ] A scheduler needs something that runs on a timer. On Vercel, use Cron. Set up the secret first.
- [ ] Put the live link in your README.

## What "done" looks like

Someone who has never seen it can sign up, pay, connect an account, schedule a post, see it go out at the right time, and come back tomorrow to find their data still there.

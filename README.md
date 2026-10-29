# Zombie Social

> A half-built copy of **Buffer / Later / Hootsuite**. It runs, it kind of works, and it is not ready for real users.
> Your job tonight: bring it back to life.

**Replaces:** Buffer, Later and Hootsuite (Buffer is from $5/month per channel)

**Live demo:** https://zombie-social.vercel.app (a shared demo: data resets whenever the server restarts)
<!-- Price verified 2026-10-29 at https://buffer.com/pricing : Essentials plan is $5/month for 1 channel (monthly billing), Team is $10/month for 1 channel, billed per channel. Later's page only showed yearly-billed prices ($18.75/month Starter) and no monthly price, so it is not used. -->

## Run it (2 minutes)

You need [Node.js 20 or newer](https://nodejs.org).

```bash
npm install
npm run dev
```

Open http://localhost:3111.

## What works

- A "Pretend to be" dropdown in the top bar picks who you are (there are no real accounts). Three team members: an owner, an editor and a viewer.
- Five fake channels: Instagram, LinkedIn, X, TikTok and Facebook. They are only names and handles in `data/seed.json`.
- Composer: write text, pick channels, pick a date and time, add an image URL, mark a post as sponsored. A character counter shows each channel's limit.
- Queue: every scheduled, published and failed post.
- Week calendar: seven days in a CSS grid, with colored dots for the channels. Use Previous week and Next week.
- Drafts: save a draft, then pick a time and schedule it later.
- Analytics: totals and a table per channel. The numbers are fake and come from the seed file.
- 12 fake posts across two weeks (published, scheduled, drafts and one failed).
- Pricing page (Stripe is not connected).

Try it: open Compose, pick Instagram and X, type a long post and watch the two counters. Pick a time and press Schedule, then look for it in the Queue and on the Calendar.

## What's broken

See [ZOMBIE.md](ZOMBIE.md). That's the to-do list for the night. "Connect account" and "Publish now" give a 501, and nothing ever posts at the scheduled time.

## How we build tonight

- **Mel** ([openmel.dev](https://openmel.dev)) does the building. Open this folder in Mel and give it tasks from ZOMBIE.md.
- **Prompt Anything** ([promptanything.io](https://www.promptanything.io)) writes the prompts. Use it inside Mel for features, agents, customer success flows, code fixes and reading this repo.
- **MEL.md** in this folder tells Mel's agents what this project is and how to work on it.

## Submit

Fork this repo, push your work, and send your link through the submission form before the deadline.
Many people can pick the same app. The one that actually works wins.

## License

MIT. Use it, ship it, share it.

# WesSeats — Wesleyan Seat Availability Alerts

Notifies students by email/SMS the moment a seat opens up in a WesMaps course
section they're watching.

## How it works

1. **WesMaps is public** — `owaprod-pub.wesleyan.edu/reg/!wesmaps_page.html` shows
   course listings and per-section "Seats Available" counts with no login
   required. No student credentials are ever collected or stored.
2. Students sign in with a **6-digit code emailed to their `@wesleyan.edu`
   address** (no passwords).
3. They search a subject (e.g. `COMP`) and click "Watch" on a section.
4. A scheduled job (`/api/cron/check-seats`, run every 10 min via Vercel Cron)
   re-fetches each *distinct* watched course page once per run — grouped so
   100 students watching the same section only costs Wesleyan's server one
   request, not 100 — and compares the new seat count to the last known one.
5. On a `0 → >0` transition, everyone watching that section gets notified
   (email via Resend, SMS via Twilio if they opted in and gave a phone number).

## Stack

- Next.js 14 (App Router) — frontend + API routes
- Postgres + Prisma — users, watches, cached seat snapshots
- Resend — transactional email
- Twilio — SMS
- Vercel Cron — scheduler (swap for GitHub Actions / a VPS crontab + `scripts/check-seats.ts` if not on Vercel)

## Setup

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, SESSION_SECRET, CRON_SECRET, RESEND_API_KEY, TWILIO_*
npx prisma migrate dev --name init
npm run dev
```

Deploy on Vercel: push to a repo, import into Vercel, set the same env vars
in the project settings, and `vercel.json` will register the cron job
automatically.

## Important things to sort out before opening this to "all Wesleyan students"

**1. Talk to the Registrar / IT first.** Even though WesMaps requires no
login, running an automated poller against it at scale is worth clearing
with Wesleyan's IT or Registrar's office before launch — partly courtesy,
partly to make sure you're not tripping any acceptable-use or scraping
policy, and partly because they may actually prefer to help (some schools
have added seat-alert features once students proved demand). Check
`wesleyan.edu/robots.txt` and any Terms of Use on the site as a first step.

**2. Be gentle with request volume.** The cron job is already deduplicated
by distinct `crse`+`term` page, but as your watch list grows into the
hundreds of distinct sections, a 10-minute interval could mean real load.
Consider:
   - Widening the interval (e.g. 15–20 min) as usage grows
   - Prioritizing sections with `lastSeats <= 2` (near-full/likely-to-move) for
     tighter polling, and checking less-contested classes less often
   - Adding a random jitter so requests aren't all fired in the same second

**3. Verify the scraper against the live site regularly.** WesMaps' markup
can change without notice (registrar redesigns, term rollovers). The parser
in `src/lib/wesmaps.ts` works off plain-text pattern matching rather than
brittle selectors, but you should spot-check it each semester, and consider
alerting yourself (not just users) if a scrape returns zero parsed sections
for a page that should have data — that usually means the markup shifted,
not that seats are actually gone.

**4. Data you're collecting.** Emails, optional phone numbers, and which
courses students want — this is data worth protecting. Use HTTPS everywhere
(Vercel does this by default), don't log phone numbers/emails in plaintext
application logs, and consider a simple privacy note on the sign-in page
about what's stored and why.

**5. Term codes.** WesMaps term codes (e.g. `1269` for Fall 2026) aren't
obviously derivable — grab them from the "Home" link on any WesMaps page each
semester and update `CURRENT_TERM` in `src/app/page.tsx`, or build a small
term picker that scrapes the dropdown on the WesMaps home page.

## Not yet built (natural next steps)

- Term picker in the UI instead of a hardcoded constant
- Rate-limiting sign-in code requests (currently no throttle on `/api/auth/request-code`)
- A "your alert already fired" indicator so students know why a watch went quiet
- Admin dashboard showing total distinct sections being polled, to gut-check load before scaling up
- Unsubscribe/pause-all link in notification emails

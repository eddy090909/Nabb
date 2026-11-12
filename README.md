# Nabb

**The easiest way in to a course you're trying to get into.** Watch a full
Wesleyan course section and get an email (and optionally a text) the moment a
seat opens.

Nabb never asks for student passwords. It reads public WesMaps pages and signs
students in with a one-time code sent to their `@wesleyan.edu` address.

## Wesleyan's course sites right now (Nov 2026)

Wesleyan is part-way through a switch, and the sites don't agree with each other:

| Site | Use it for | Notes |
| --- | --- | --- |
| [Old WesMaps](https://owaprod-pub.wesleyan.edu/reg/!wesmaps_page.html) | Browsing every course | **Nabb reads courses and seats from here.** Faculty were told to send students here. |
| Stellic | Preregistering and registering | Doesn't list every course yet. |
| [New WesMaps](https://webapps.wesleyan.edu/wesmaps/wesmaps-search.html) | Not recommended yet | Missing courses and isn't picking up faculty edits (e.g. prerequisites). |

Faculty expect this advice to change soon, so the WesMaps source is a single
setting (`WESMAPS_SOURCE`, see [Switching WesMaps source](#switching-wesmaps-source)).

## How it works

1. A student signs in with a 6-digit code emailed to their Wesleyan address.
2. They pick a term, search a subject code (e.g. `COMP`), and click **Watch**
   on a section.
3. A scheduled job (`/api/cron/check-seats`) runs **only during registration
   windows**. It fetches each *distinct* watched course page once per run, so
   100 students watching the same section cost Wesleyan's server one request,
   not 100.
4. When a section goes from 0 seats to more than 0, everyone watching it gets
   an email (via Resend) and, if they opted in, a text (via Twilio). The watch
   is then marked as alerted.

### Registration windows

WesMaps only shows **"Seats Available:"** during add/drop and adjustment
periods. The rest of the year the field is missing, seat counts come back as
`null`, and the UI shows "Not yet open". That's expected, not a scraper bug.

Polling is limited to these windows (`src/lib/registration.ts`,
America/New_York calendar days, inclusive):

| Window | Dates | Status |
| --- | --- | --- |
| Fall 2026 add/drop | Sept 7–18, 2026 | Confirmed |
| Spring 2027 adjustment | Nov 18–21, 2026 | **Start confirmed, end is a placeholder.** Confirm with the Registrar. |

Override them with `REGISTRATION_WINDOWS` (format in `.env.example`). The
banner at the top of the app shows the next window automatically.

## Switching WesMaps source

```
WESMAPS_SOURCE=legacy   # default: old WesMaps (owaprod-pub.wesleyan.edu)
WESMAPS_SOURCE=new      # new WesMaps (webapps.wesleyan.edu) — not built yet
```

The code is split so that switching is a one-file job:

| File | What it does |
| --- | --- |
| `src/lib/wesmaps.ts` | Picks the source from `WESMAPS_SOURCE`. The rest of the app imports only from here. |
| `src/lib/wesmaps-legacy.ts` | Old WesMaps scraper (works today). |
| `src/lib/wesmaps-new.ts` | New WesMaps stub. Throws a clear error until it's built. |
| `src/lib/wesmaps-types.ts` | The shapes every source must return. |

Before building `wesmaps-new.ts`, check on the live site:

- Does the search page load its data from a JSON endpoint (browser dev tools →
  Network tab)? That would be much sturdier than parsing HTML.
- Does it show per-section enrollment limits and seats available at all?
- What course id does it use? Existing watches store old WesMaps' `crse` id,
  so if the new site uses a different id, existing watches need mapping before
  you switch.
- Do term codes match `src/lib/terms.ts`?

## Stack

- **Next.js 14** (App Router): frontend and API routes
- **Postgres + Prisma** (Neon): users, login codes, watches, seat snapshots
- **Resend**: email (login codes and seat alerts)
- **Twilio**: SMS
- **Vercel Cron**: scheduler. The Hobby plan only allows once a day; for
  ~10-minute polling during windows, use Vercel Pro or call
  `scripts/check-seats.ts` from GitHub Actions or a crontab.

## Run it locally

```bash
npm install
cp .env.example .env   # fill in DATABASE_URL, SESSION_SECRET, CRON_SECRET, RESEND_API_KEY, TWILIO_*
npx prisma migrate dev --name init
npm run dev
```

Open http://localhost:3000.

To deploy, import the repo into Vercel and set the same env vars there.
`vercel.json` registers the cron job.

## Project layout

```
src/app/page.tsx                 the whole UI (client component)
src/app/globals.css              styles, light + dark theme
src/app/api/auth/*               email-code sign-in / sign-out
src/app/api/search               subject search (via WesMaps)
src/app/api/watches              list / add / remove watches
src/app/api/me                   notification settings (phone, SMS opt-in)
src/app/api/registration-status  is a window open? which source?
src/app/api/cron/check-seats     the poller
src/lib/wesmaps*.ts              WesMaps sources (see above)
src/lib/registration.ts          registration windows
src/lib/terms.ts                 term codes for the term picker
src/lib/notify.ts                email + SMS sending
```

## Each semester

- [ ] Add the new term code to `src/lib/terms.ts` (find it in the "Home" link
      on any WesMaps page).
- [ ] Update registration windows in `src/lib/registration.ts` or
      `REGISTRATION_WINDOWS`.
- [ ] Re-check which WesMaps site Wesleyan recommends, and set
      `WESMAPS_SOURCE` to match.
- [ ] During add/drop, spot-check that seats parse correctly on a few courses.
      If a page returns zero *sections* (not just null seats), the markup
      probably changed.

## Before opening this to all of Wesleyan

1. **Talk to the Registrar / ITS first.** WesMaps needs no login, but running
   an automated poller against it at scale is worth clearing with them.
   Partly courtesy, partly to make sure it doesn't break any acceptable-use
   policy, and they might even want to help. Check
   `wesleyan.edu/robots.txt` and any terms of use first.
2. **Go easy on request volume.** Polling is already limited to registration
   windows and deduplicated per course page. As watches grow into the
   hundreds, consider a longer interval (15–20 min), polling near-full
   sections (`lastSeats <= 2`) more often than the rest, and adding random
   jitter.
3. **Protect student data.** Emails, phone numbers and course interests are
   stored. Keep HTTPS on, don't log emails or phone numbers in plain text, and
   add a short privacy note to the sign-in page.
4. **Remove the demo login bypass.** `DEMO_BYPASS_CODE` lets anyone sign in
   as any Wesleyan email. Leave it unset in production.

## Not built yet

- New WesMaps source (`src/lib/wesmaps-new.ts`)
- Confirmed end date for the spring adjustment window
- Admin view of how many distinct sections are being polled
- Unsubscribe / pause-all link in alert emails
- "Notify me again" if a section fills and reopens after an alert

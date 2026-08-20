import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchSeatInfo } from "@/lib/wesmaps";
import { sendSeatAlertEmail, sendSeatAlertSms } from "@/lib/notify";

/**
 * Triggered on a schedule (e.g. Vercel Cron every 5-10 minutes - see vercel.json).
 * Protected by CRON_SECRET so randoms can't hammer WesMaps through your app.
 *
 * Strategy: group active watches by (crse, term) so each distinct WesMaps
 * detail page is fetched once per run, no matter how many students/sections
 * are watching courses on that page. This keeps our request volume to
 * Wesleyan's servers proportional to distinct courses tracked, not users.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const activeWatches = await db.watch.findMany({ where: { active: true } });
  if (activeWatches.length === 0) {
    return NextResponse.json({ checked: 0, notified: 0 });
  }

  const groups = new Map<string, { crse: string; term: string }>();
  for (const w of activeWatches) {
    groups.set(`${w.crse}::${w.term}`, { crse: w.crse, term: w.term });
  }

  let notified = 0;
  const errors: string[] = [];

  for (const { crse, term } of groups.values()) {
    let seatInfoList;
    try {
      seatInfoList = await fetchSeatInfo(crse, term);
    } catch (err) {
      errors.push(`${crse}/${term}: ${(err as Error).message}`);
      continue;
    }

    for (const info of seatInfoList) {
      if (info.seatsAvailable === null) continue;

      // Cache the snapshot (useful for debugging / future features like graphs).
      const sectionLabelGuess = `${crse}-${info.sectionNum}`; // fallback label for the cache row
      await db.courseSnapshot.upsert({
        where: { crse_term_sectionLabel: { crse, term, sectionLabel: sectionLabelGuess } },
        update: {
          seatsAvailable: info.seatsAvailable,
          enrollmentLimit: info.enrollmentLimit ?? 0,
          checkedAt: new Date(),
        },
        create: {
          crse,
          term,
          sectionLabel: sectionLabelGuess,
          seatsAvailable: info.seatsAvailable,
          enrollmentLimit: info.enrollmentLimit ?? 0,
        },
      });

      // Find every watch that matches this crse/term/section.
      const matchingWatches = activeWatches.filter(
        (w) => w.crse === crse && w.term === term && w.sectionLabel.endsWith(`-${info.sectionNum}`)
      );

      for (const watch of matchingWatches) {
        const wasFull = watch.lastSeats === null || watch.lastSeats <= 0;
        const nowOpen = info.seatsAvailable > 0;

        if (wasFull && nowOpen) {
          const user = await db.user.findUnique({ where: { id: watch.userId } });
          if (user) {
            try {
              if (user.notifyEmail) {
                await sendSeatAlertEmail(user.email, watch.sectionLabel, watch.courseTitle, info.seatsAvailable);
              }
              if (user.notifySms && user.phone) {
                await sendSeatAlertSms(user.phone, watch.sectionLabel, info.seatsAvailable);
              }
              notified++;
            } catch (err) {
              errors.push(`notify ${user.email}: ${(err as Error).message}`);
            }
          }
        }

        await db.watch.update({
          where: { id: watch.id },
          data: {
            lastSeats: info.seatsAvailable,
            notifiedAt: wasFull && nowOpen ? new Date() : watch.notifiedAt,
          },
        });
      }
    }
  }

  return NextResponse.json({ checked: groups.size, notified, errors: errors.length ? errors : undefined });
}

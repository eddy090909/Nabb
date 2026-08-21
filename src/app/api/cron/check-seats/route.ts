import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchSeatInfo } from "@/lib/wesmaps";
import { sendSeatAlertEmail, sendSeatAlertSms } from "@/lib/notify";
import { isRegistrationWindowActive } from "@/lib/registration";

/**
 * Triggered on a schedule (e.g. Vercel Cron every 10 minutes - see vercel.json).
 * Protected by CRON_SECRET so randoms can't hammer WesMaps through your app.
 *
 * Only runs during registration windows (see src/lib/registration.ts). Outside
 * those windows WesMaps typically omits "Seats Available:", so polling would
 * waste requests for no signal — same approach SpotCheck used.
 *
 * Strategy: group active watches by (crse, term) so each distinct WesMaps
 * detail page is fetched once per run, no matter how many students/sections
 * are watching courses on that page.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!isRegistrationWindowActive()) {
    console.log("check-seats: outside registration window — skipping WesMaps poll");
    return NextResponse.json({
      checked: 0,
      notified: 0,
      skipped: "outside_registration_window",
    });
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
      // null = seats not published yet (common even inside a window early on)
      if (info.seatsAvailable === null) continue;

      const matchingWatches = activeWatches.filter(
        (w) => w.crse === crse && w.term === term && w.sectionLabel.endsWith(`-${info.sectionNum}`)
      );

      const sectionLabel =
        matchingWatches[0]?.sectionLabel ?? `${crse}-${info.sectionNum}`;

      await db.courseSnapshot.upsert({
        where: { crse_term_sectionLabel: { crse, term, sectionLabel } },
        update: {
          seatsAvailable: info.seatsAvailable,
          enrollmentLimit: info.enrollmentLimit ?? 0,
          checkedAt: new Date(),
        },
        create: {
          crse,
          term,
          sectionLabel,
          seatsAvailable: info.seatsAvailable,
          enrollmentLimit: info.enrollmentLimit ?? 0,
        },
      });

      for (const watch of matchingWatches) {
        // Unknown baseline: record seats without notifying (avoids false alerts).
        if (watch.lastSeats === null) {
          await db.watch.update({
            where: { id: watch.id },
            data: { lastSeats: info.seatsAvailable },
          });
          continue;
        }

        const wasFull = watch.lastSeats <= 0;
        const nowOpen = info.seatsAvailable > 0;

        if (wasFull && nowOpen) {
          const user = await db.user.findUnique({ where: { id: watch.userId } });
          if (!user) continue;

          const wantsEmail = user.notifyEmail;
          const wantsSms = user.notifySms && !!user.phone;
          if (!wantsEmail && !wantsSms) {
            // No channels enabled — still clear the transition so we don't loop.
            await db.watch.update({
              where: { id: watch.id },
              data: {
                lastSeats: info.seatsAvailable,
                notifiedAt: new Date(),
                active: false,
              },
            });
            continue;
          }

          try {
            if (wantsEmail) {
              await sendSeatAlertEmail(
                user.email,
                watch.sectionLabel,
                watch.courseTitle,
                info.seatsAvailable
              );
            }
            if (wantsSms && user.phone) {
              await sendSeatAlertSms(user.phone, watch.sectionLabel, info.seatsAvailable);
            }
            await db.watch.update({
              where: { id: watch.id },
              data: {
                lastSeats: info.seatsAvailable,
                notifiedAt: new Date(),
                active: false,
              },
            });
            notified++;
          } catch (err) {
            // Leave lastSeats unchanged so the next run can retry the alert.
            errors.push(`notify ${user.email}: ${(err as Error).message}`);
          }
        } else {
          await db.watch.update({
            where: { id: watch.id },
            data: { lastSeats: info.seatsAvailable },
          });
        }
      }
    }
  }

  return NextResponse.json({
    checked: groups.size,
    notified,
    errors: errors.length ? errors : undefined,
  });
}

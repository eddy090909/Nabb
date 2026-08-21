import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { fetchSeatInfoForSection } from "@/lib/wesmaps";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const watches = await db.watch.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ watches });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { crse, term, sectionLabel, courseTitle } = await req.json();
  if (!crse || !term || !sectionLabel || !courseTitle) {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
  }

  // Grab current seat count immediately so the watch starts with an accurate baseline
  // rather than notifying incorrectly on the very next cron run. null is fine outside
  // registration windows (seats not published yet).
  let lastSeats: number | null = null;
  try {
    const info = await fetchSeatInfoForSection(crse, term, sectionLabel);
    lastSeats = info?.seatsAvailable ?? null;
  } catch (err) {
    console.error("Failed to fetch initial seat count:", err);
  }

  const watch = await db.watch.upsert({
    where: {
      userId_crse_term_sectionLabel: { userId: user.id, crse, term, sectionLabel },
    },
    update: { active: true, lastSeats, courseTitle },
    create: {
      userId: user.id,
      crse,
      term,
      sectionLabel,
      courseTitle,
      lastSeats,
    },
  });

  return NextResponse.json({ watch });
}

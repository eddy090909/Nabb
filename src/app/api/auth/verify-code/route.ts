import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isWesleyanEmail, issueSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

function sessionResponse(userId: string) {
  const token = issueSessionToken(userId);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return res;
}

export async function POST(req: NextRequest) {
  const { email, code } = await req.json();

  if (!email || !isWesleyanEmail(email) || !code) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // DEMO-ONLY: remove this block and DEMO_BYPASS_CODE from env before any
  // real deployment. Anyone who knows this code can sign in as any email.
  const demoBypass = process.env.DEMO_BYPASS_CODE?.trim();
  if (demoBypass && code === demoBypass) {
    const user = await db.user.upsert({
      where: { email: normalizedEmail },
      update: {},
      create: { email: normalizedEmail },
    });
    return sessionResponse(user.id);
  }

  const user = await db.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    return NextResponse.json({ error: "Invalid code." }, { status: 400 });
  }

  const loginCode = await db.loginCode.findFirst({
    where: { userId: user.id, code, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (!loginCode) {
    return NextResponse.json({ error: "Invalid or expired code." }, { status: 400 });
  }

  await db.loginCode.update({ where: { id: loginCode.id }, data: { usedAt: new Date() } });

  return sessionResponse(user.id);
}

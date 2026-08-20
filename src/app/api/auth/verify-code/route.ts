import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isWesleyanEmail, issueSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, code } = await req.json();

  if (!email || !isWesleyanEmail(email) || !code) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { email: email.toLowerCase().trim() } });
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

  const token = issueSessionToken(user.id);
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

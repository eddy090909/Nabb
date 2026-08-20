import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isWesleyanEmail, generateCode } from "@/lib/auth";
import { sendLoginCodeEmail } from "@/lib/notify";

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  if (!email || typeof email !== "string" || !isWesleyanEmail(email)) {
    return NextResponse.json(
      { error: "Please use your @wesleyan.edu email address." },
      { status: 400 }
    );
  }

  const normalizedEmail = email.toLowerCase().trim();

  const user = await db.user.upsert({
    where: { email: normalizedEmail },
    update: {},
    create: { email: normalizedEmail },
  });

  const code = generateCode();
  await db.loginCode.create({
    data: {
      userId: user.id,
      code,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    },
  });

  await sendLoginCodeEmail(normalizedEmail, code);

  return NextResponse.json({ ok: true });
}

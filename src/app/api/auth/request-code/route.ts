import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isWesleyanEmail, generateCode } from "@/lib/auth";
import { sendLoginCodeEmail } from "@/lib/notify";

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 5;

export async function POST(req: NextRequest) {
  try {
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

    const recentCount = await db.loginCode.count({
      where: {
        userId: user.id,
        createdAt: { gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) },
      },
    });

    if (recentCount >= RATE_LIMIT_MAX) {
      return NextResponse.json(
        { error: "Too many code requests. Try again in a few minutes." },
        { status: 429 }
      );
    }

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
  } catch (err) {
    console.error("request-code failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    const isDb =
      message.includes("Can't reach database") ||
      message.includes("DATABASE_URL") ||
      message.includes("PrismaClientInitializationError");
    return NextResponse.json(
      {
        error: isDb
          ? "Database is not reachable. Set a real DATABASE_URL in .env and run migrations."
          : "Could not send sign-in code. Try again.",
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

/** Normalize US-centric phone input to E.164 (+1…). Returns null if invalid. */
function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (input.trim().startsWith("+") && digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }
  return null;
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  return NextResponse.json({
    email: user.email,
    phone: user.phone,
    notifyEmail: user.notifyEmail,
    notifySms: user.notifySms,
  });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = await req.json();
  const data: {
    phone?: string | null;
    notifyEmail?: boolean;
    notifySms?: boolean;
  } = {};

  if ("notifyEmail" in body) {
    data.notifyEmail = Boolean(body.notifyEmail);
  }
  if ("notifySms" in body) {
    data.notifySms = Boolean(body.notifySms);
  }

  if ("phone" in body) {
    const raw = typeof body.phone === "string" ? body.phone.trim() : "";
    if (!raw) {
      data.phone = null;
    } else {
      const normalized = normalizePhone(raw);
      if (!normalized) {
        return NextResponse.json(
          { error: "Enter a valid US phone number (10 digits or +1…)." },
          { status: 400 }
        );
      }
      data.phone = normalized;
    }
  }

  const nextNotifySms = data.notifySms ?? user.notifySms;
  const nextPhone = "phone" in data ? data.phone : user.phone;
  if (nextNotifySms && !nextPhone) {
    return NextResponse.json(
      { error: "Add a phone number before enabling SMS alerts." },
      { status: 400 }
    );
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data,
  });

  return NextResponse.json({
    email: updated.email,
    phone: updated.phone,
    notifyEmail: updated.notifyEmail,
    notifySms: updated.notifySms,
  });
}

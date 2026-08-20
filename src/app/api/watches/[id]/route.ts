import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const watch = await db.watch.findUnique({ where: { id: params.id } });
  if (!watch || watch.userId !== user.id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await db.watch.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

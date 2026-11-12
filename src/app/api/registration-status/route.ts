import { NextResponse } from "next/server";
import { getRegistrationWindows, isRegistrationWindowActive } from "@/lib/registration";
import { getWesmapsSource } from "@/lib/wesmaps";

// Must run per request: the answer depends on today's date, so it can't be prerendered at build.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    active: isRegistrationWindowActive(),
    windows: getRegistrationWindows(),
    // Which WesMaps site seat data currently comes from ("legacy" | "new").
    wesmapsSource: getWesmapsSource(),
  });
}

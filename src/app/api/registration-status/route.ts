import { NextResponse } from "next/server";
import { getRegistrationWindows, isRegistrationWindowActive } from "@/lib/registration";

export async function GET() {
  return NextResponse.json({
    active: isRegistrationWindowActive(),
    windows: getRegistrationWindows(),
  });
}

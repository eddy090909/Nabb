import { NextRequest, NextResponse } from "next/server";
import { searchCourses } from "@/lib/wesmaps";

// e.g. GET /api/search?subject=COMP&term=1269
export async function GET(req: NextRequest) {
  const subject = req.nextUrl.searchParams.get("subject");
  const term = req.nextUrl.searchParams.get("term");

  if (!subject || !term) {
    return NextResponse.json({ error: "subject and term are required" }, { status: 400 });
  }

  try {
    const results = await searchCourses(subject.toUpperCase(), term);
    return NextResponse.json({ results });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to reach WesMaps." }, { status: 502 });
  }
}

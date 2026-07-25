import { NextResponse } from "next/server";
import { readMobileReleasePolicy } from "@/modules/mobile/mobile-release-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return NextResponse.json(readMobileReleasePolicy(request), {
    headers: { "Cache-Control": "no-store" },
  });
}

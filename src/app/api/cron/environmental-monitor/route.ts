import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { processEnvironmentalMonitoring } from "@/modules/environmental/environmental-monitor.service";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"))) return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  const processedAt = new Date().toISOString();
  try {
    const environmental = await processEnvironmentalMonitoring();
    return NextResponse.json({ success: true, processedAt, environmental });
  } catch (error) {
    console.error("Environmental monitoring failed:", error);
    return NextResponse.json({ success: false, processedAt, error: "Environmental monitoring failed." }, { status: 500 });
  }
}

import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { generateComplianceCalendarOccurrences, monitorComplianceCalendar } from "@/modules/compliance/compliance-calendar.service";
import { processComplianceMonitoring } from "@/modules/compliance/compliance-monitor.service";
import { processOccupationalHealthMonitoring } from "@/modules/occupational-health/occupational-health.service";
import { processCriticalControlMonitoring } from "@/modules/assurance/critical-control.service";
import { processCertificationReviewMonitoring } from "@/modules/assurance/certification-readiness.service";
import { processAssetMonitoring } from "@/modules/assets/asset.service";
import { processBehaviorSafetyMonitoring } from "@/modules/behavior-safety/behavior-safety.service";
import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request.headers.get("authorization"))) return NextResponse.json({ success: false, error: "Unauthorized." }, { status: 401 });
  try {
    const [compliance, calendarGeneration, calendarMonitoring, occupationalHealth, criticalControls, certificationReviews, assets, behaviorSafety] = await Promise.all([processComplianceMonitoring(), generateComplianceCalendarOccurrences(), monitorComplianceCalendar(), processOccupationalHealthMonitoring(), processCriticalControlMonitoring(), processCertificationReviewMonitoring(), processAssetMonitoring(), processBehaviorSafetyMonitoring()]);
    return NextResponse.json({ success: true, processedAt: new Date().toISOString(), compliance, calendarGeneration, calendarMonitoring, occupationalHealth, criticalControls, certificationReviews, assets, behaviorSafety });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Compliance monitoring failed." }, { status: 500 });
  }
}

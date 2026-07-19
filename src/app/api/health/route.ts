import { prisma } from "@/lib/prisma";
import { inspectProductionEnvironment } from "@/lib/production-env";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checkedAt = new Date().toISOString();
  const configuration = inspectProductionEnvironment();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const ready = process.env.NODE_ENV !== "production" || configuration.valid;
    return NextResponse.json({ status: ready ? "ready" : "degraded", checkedAt, database: "available", configuration: ready ? "valid" : "invalid" }, { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Health check database probe failed:", error);
    return NextResponse.json({ status: "unavailable", checkedAt, database: "unavailable", configuration: configuration.valid ? "valid" : "invalid" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

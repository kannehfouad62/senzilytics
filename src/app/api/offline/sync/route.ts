import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { syncOfflineSubmissionsService } from "@/modules/mobile/offline-sync.service";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.sessionValid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const currentUser = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, organizationId: true, departmentId: true, role: true, isActive: true } });
  if (!currentUser?.isActive || !currentUser.organizationId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await syncOfflineSubmissionsService({ organizationId: currentUser.organizationId, userId: currentUser.id, departmentId: currentUser.departmentId, role: currentUser.role as UserRole, request: await request.json().catch(() => null) });
  return NextResponse.json(result.body, { status: result.status });
}

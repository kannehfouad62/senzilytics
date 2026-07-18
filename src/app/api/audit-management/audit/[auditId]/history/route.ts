import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import {
  PermissionKey,
} from "@prisma/client";
import { NextResponse } from "next/server";

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

function parsePageSize(
  value: string | null
) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    return DEFAULT_PAGE_SIZE;
  }

  return Math.min(
    Math.max(parsed, 1),
    MAX_PAGE_SIZE
  );
}

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      auditId: string;
    }>;
  }
) {
  await requirePermission(
    PermissionKey.VIEW_AUDITS
  );

  const { organizationId } =
    await getCurrentUserTenant();

  const { auditId } =
    await context.params;

  const audit =
    await prisma.enterpriseAudit.findFirst({
      where: {
        id: auditId,
        organizationId,
      },
      select: {
        id: true,
      },
    });

  if (!audit) {
    return NextResponse.json(
      {
        success: false,
        message:
          "The enterprise audit was not found.",
      },
      {
        status: 404,
      }
    );
  }

  const url = new URL(request.url);
  const take = parsePageSize(
    url.searchParams.get("take")
  );
  const cursor =
    url.searchParams.get("cursor");

  const records =
    await prisma.enterpriseAuditHistory.findMany({
      where: {
        organizationId,
        auditId,
      },
      orderBy: [
        {
          createdAt: "desc",
        },
        {
          id: "desc",
        },
      ],
      take: take + 1,
      ...(cursor
        ? {
            cursor: {
              id: cursor,
            },
            skip: 1,
          }
        : {}),
      select: {
        id: true,
        userId: true,
        action: true,
        entityType: true,
        entityId: true,
        title: true,
        description: true,
        previousValue: true,
        newValue: true,
        metadata: true,
        createdAt: true,
      },
    });

  const hasMore =
    records.length > take;

  const visibleRecords =
    hasMore
      ? records.slice(0, take)
      : records;

  const userIds = Array.from(
    new Set(
      visibleRecords
        .map((record) => record.userId)
        .filter(
          (value): value is string =>
            Boolean(value)
        )
    )
  );

  const users =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: {
            organizationId,
            id: {
              in: userIds,
            },
          },
          select: {
            id: true,
            name: true,
            email: true,
            jobTitle: true,
          },
        })
      : [];

  const usersById = new Map(
    users.map((user) => [
      user.id,
      user,
    ])
  );

  return NextResponse.json({
    success: true,
    history: visibleRecords.map(
      (record) => ({
        ...record,
        createdAt:
          record.createdAt.toISOString(),
        actor: record.userId
          ? usersById.get(
              record.userId
            ) ?? null
          : null,
      })
    ),
    nextCursor:
      hasMore
        ? visibleRecords.at(-1)?.id ??
          null
        : null,
  });
}

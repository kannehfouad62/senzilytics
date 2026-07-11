import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DocumentStatus } from "@prisma/client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json(
      {
        error: "Unauthorized.",
      },
      {
        status: 401,
      }
    );
  }

  const { id } = await params;

  const currentUser = await prisma.user.findUnique({
    where: {
      email: session.user.email,
    },
    select: {
      id: true,
      organizationId: true,
    },
  });

  if (!currentUser?.organizationId) {
    return NextResponse.json(
      {
        error: "Your account is not assigned to an organization.",
      },
      {
        status: 403,
      }
    );
  }

  const document = await prisma.document.findFirst({
    where: {
      id,
      organizationId: currentUser.organizationId,
      status: {
        not: DocumentStatus.DELETED,
      },
    },
    select: {
      id: true,
      versionGroupId: true,
    },
  });

  if (!document) {
    return NextResponse.json(
      {
        error: "Document not found.",
      },
      {
        status: 404,
      }
    );
  }

  const versions = await prisma.document.findMany({
    where: {
      organizationId: currentUser.organizationId,
      versionGroupId: document.versionGroupId,
      status: {
        not: DocumentStatus.DELETED,
      },
    },
    include: {
      uploadedBy: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      version: "desc",
    },
  });

  return NextResponse.json({
    versions: versions.map((version) => ({
      id: version.id,
      name: version.name,
      originalName: version.originalName,
      description: version.description,
      mimeType: version.mimeType,
      sizeBytes: version.sizeBytes,
      version: version.version,
      isLatest: version.isLatest,
      status: version.status,
      createdAt: version.createdAt.toISOString(),
      uploadedBy: version.uploadedBy
        ? {
            name: version.uploadedBy.name,
            email: version.uploadedBy.email,
          }
        : null,
    })),
  });
}
import { get } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeDownloadName(name: string) {
  return name
    .replace(/[\r\n"]/g, "")
    .replace(/[^\w.\- ()]/g, "_")
    .slice(0, 180);
}

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
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
        not: "DELETED",
      },
    },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      storageKey: true,
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

  const result = await get(document.storageKey, {
    access: "private",
    ifNoneMatch: request.headers.get("if-none-match") ?? undefined,
  });

  if (!result) {
    return NextResponse.json(
      {
        error: "The stored file could not be found.",
      },
      {
        status: 404,
      }
    );
  }

  if (result.statusCode === 304) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: result.blob.etag,
        "Cache-Control": "private, no-cache",
      },
    });
  }

  if (result.statusCode !== 200 || !result.stream) {
    return NextResponse.json(
      {
        error: "The stored file could not be retrieved.",
      },
      {
        status: 404,
      }
    );
  }

  const downloadName = sanitizeDownloadName(document.originalName);

  const headers = new Headers({
    "Content-Type":
      result.blob.contentType ||
      document.mimeType ||
      "application/octet-stream",
    "Content-Disposition": `attachment; filename="${downloadName}"`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-cache",
    ETag: result.blob.etag,
  });
  
  if (result.blob.size !== null) {
    headers.set("Content-Length", String(result.blob.size));
  }
  
  return new NextResponse(result.stream, {
    headers,
  });
}
import { get } from "@vercel/blob";
import { ActivityAction, DocumentStatus, PermissionKey } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/core/activity-log/activity-log.service";
import { prisma } from "@/lib/prisma";
import {
  authenticateMobileRequest,
  MobileAuthError,
} from "@/modules/mobile/mobile-auth.service";
import { getMobileAssignedPermissions } from "@/modules/mobile/mobile-executive.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/mobile/documents/[id]/file">
) {
  try {
    const [{ user, organization }, { id }] = await Promise.all([
      authenticateMobileRequest(request),
      context.params,
    ]);
    const permissions = await getMobileAssignedPermissions(user.role);
    if (!permissions.includes(PermissionKey.MANAGE_DOCUMENTS)) {
      return NextResponse.json(
        {
          error: "forbidden",
          errorDescription:
            "Your role cannot access controlled documents.",
        },
        { status: 403, headers: { "cache-control": "no-store" } }
      );
    }

    const document = await prisma.document.findFirst({
      where: {
        id,
        organizationId: organization.id,
        status: { not: DocumentStatus.DELETED },
      },
      select: {
        id: true,
        name: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        storageKey: true,
        checksum: true,
      },
    });
    if (!document) {
      return NextResponse.json(
        {
          error: "not_found",
          errorDescription: "Document not found.",
        },
        { status: 404, headers: { "cache-control": "no-store" } }
      );
    }

    const result = await get(document.storageKey, {
      access: "private",
      ifNoneMatch: request.headers.get("if-none-match") ?? undefined,
    });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return NextResponse.json(
        {
          error: "not_found",
          errorDescription: "The stored document could not be retrieved.",
        },
        { status: 404, headers: { "cache-control": "no-store" } }
      );
    }

    await logActivity({
      organizationId: organization.id,
      userId: user.id,
      action: ActivityAction.SYSTEM,
      entityType: "Document",
      entityId: document.id,
      title: "Controlled document accessed from native mobile",
      description: document.name,
      metadata: {
        versionedFileName: document.originalName,
        sizeBytes: document.sizeBytes,
        checksum: document.checksum,
      },
    });

    const headers = new Headers({
      "Content-Type":
        result.blob.contentType ||
        document.mimeType ||
        "application/octet-stream",
      "Content-Disposition": `attachment; filename="${sanitizeFileName(
        document.originalName
      )}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      ETag: result.blob.etag,
    });
    if (result.blob.size !== null) {
      headers.set("Content-Length", String(result.blob.size));
    }

    return new NextResponse(result.stream, { headers });
  } catch (error) {
    if (!(error instanceof MobileAuthError)) {
      console.error("Mobile document retrieval failed:", error);
    }
    return NextResponse.json(
      {
        error:
          error instanceof MobileAuthError
            ? error.code
            : "document_retrieval_failed",
        errorDescription:
          error instanceof MobileAuthError
            ? error.message
            : "The document could not be retrieved.",
      },
      {
        status: error instanceof MobileAuthError ? error.status : 500,
        headers: { "cache-control": "no-store" },
      }
    );
  }
}

function sanitizeFileName(name: string) {
  return name
    .replace(/[\r\n"]/g, "")
    .replace(/[^\w.\- ()]/g, "_")
    .slice(0, 180);
}

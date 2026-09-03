import { get } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { ActivityAction, PermissionKey, ResearchImportStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { logActivity } from "@/core/activity-log/activity-log.service";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { profileResearchFile } from "@/modules/research/research-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ["text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
type Payload = { projectId: string; name: string; fileName: string; fileSize: number };

async function user() {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Sign in before importing research data.");
  await requirePermission(PermissionKey.MANAGE_RESEARCH_DATASETS);
  const current = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true, organizationId: true } });
  if (!current?.organizationId) throw new Error("Your account is not assigned to an organization.");
  return { id: current.id, organizationId: current.organizationId };
}

function parsePayload(raw?: string | null): Payload {
  const data = JSON.parse(raw || "null") as Partial<Payload> | null;
  if (!data?.projectId || !data.name?.trim() || !data.fileName || !data.fileSize) throw new Error("Enter a dataset name and select a file.");
  if (data.fileSize < 1 || data.fileSize > MAX_BYTES) throw new Error("Research data files must be between 1 byte and 10 MB.");
  return { projectId: data.projectId, name: data.name.trim().slice(0, 160), fileName: data.fileName.slice(0, 180), fileSize: data.fileSize };
}

export async function POST(request: Request) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return NextResponse.json({ error: "Private research storage is not configured." }, { status: 500 });
  try {
    const body = (await request.json()) as HandleUploadBody;
    return NextResponse.json(await handleUpload({
      request,
      body,
      token,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const [current, data] = await Promise.all([user(), Promise.resolve(parsePayload(clientPayload))]);
        const project = await prisma.researchProject.findFirst({ where: { id: data.projectId, organizationId: current.organizationId }, select: { id: true } });
        if (!project) throw new Error("Research project not found.");
        if (!pathname.startsWith(`research-imports/${project.id}/`)) throw new Error("The import storage path is invalid.");
        return { allowedContentTypes: TYPES, maximumSizeInBytes: MAX_BYTES, addRandomSuffix: true, tokenPayload: JSON.stringify({ ...data, organizationId: current.organizationId, userId: current.id }) };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const data = JSON.parse(tokenPayload || "null") as Payload & { organizationId: string; userId: string };
        const stored = await get(blob.pathname, { access: "private" });
        if (!stored || stored.statusCode !== 200 || !stored.stream) throw new Error("The uploaded source file could not be profiled.");
        const bytes = await new Response(stored.stream).arrayBuffer();
        try {
          const profile = await profileResearchFile(bytes, blob.contentType, data.fileName);
          const dataset = await prisma.researchImportedDataset.create({ data: {
            organizationId: data.organizationId, projectId: data.projectId, name: data.name,
            status: ResearchImportStatus.PROFILED, sourceFileName: data.fileName, sourceBlobPath: blob.pathname,
            mimeType: blob.contentType, sizeBytes: data.fileSize, rowCount: profile.rowCount,
            columnCount: profile.columnCount, previewSnapshot: profile.preview, importedById: data.userId,
            profiledAt: new Date(), variables: { create: profile.variables },
          } });
          await logActivity({ organizationId: data.organizationId, userId: data.userId, action: ActivityAction.CREATE, entityType: "ResearchImportedDataset", entityId: dataset.id, title: "External research dataset imported", description: data.name, metadata: { projectId: data.projectId, rowCount: profile.rowCount, columnCount: profile.columnCount } });
        } catch (cause) {
          await prisma.researchImportedDataset.create({ data: {
            organizationId: data.organizationId, projectId: data.projectId, name: `${data.name} — rejected ${Date.now()}`,
            status: ResearchImportStatus.REJECTED, sourceFileName: data.fileName, sourceBlobPath: blob.pathname,
            mimeType: blob.contentType, sizeBytes: data.fileSize, importedById: data.userId,
            profileErrors: [cause instanceof Error ? cause.message : "File profiling failed."],
          } });
        }
      },
    }));
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Research import failed." }, { status: 400 });
  }
}

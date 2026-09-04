import { get } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import {
  ActivityAction,
  PermissionKey,
  ResearchSamplingDesignStatus,
  ResearchSamplingDesignType,
} from "@prisma/client";
import { NextResponse } from "next/server";

import { logActivity } from "@/core/activity-log/activity-log.service";
import { auth } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { parseResearchFileRows } from "@/modules/research/research-import";
import { validateSamplingFrame } from "@/modules/research/research-sampling-frame";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = [
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
type Payload = {
  projectId: string;
  designId: string;
  name: string;
  fileName: string;
  fileSize: number;
  identifierColumn: string;
  strataColumn: string | null;
  clusterColumn: string | null;
};

async function currentUser() {
  const session = await auth();
  if (!session?.user?.email)
    throw new Error("Sign in before uploading a sampling frame.");
  await requirePermission(PermissionKey.MANAGE_RESEARCH_DATASETS);
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, organizationId: true },
  });
  if (!user?.organizationId)
    throw new Error("Your account is not assigned to an organization.");
  return { id: user.id, organizationId: user.organizationId };
}

function parsePayload(raw?: string | null): Payload {
  const value = JSON.parse(raw || "null") as Partial<Payload> | null;
  if (
    !value?.projectId ||
    !value.designId ||
    !value.name?.trim() ||
    !value.identifierColumn?.trim() ||
    !value.fileName ||
    !value.fileSize
  )
    throw new Error("Complete the sampling-frame upload details.");
  if (value.fileSize < 1 || value.fileSize > MAX_BYTES)
    throw new Error("Sampling-frame files must be between 1 byte and 10 MB.");
  return {
    projectId: value.projectId,
    designId: value.designId,
    name: value.name.trim().slice(0, 160),
    fileName: value.fileName.slice(0, 180),
    fileSize: value.fileSize,
    identifierColumn: value.identifierColumn.trim().slice(0, 160),
    strataColumn: value.strataColumn?.trim().slice(0, 160) || null,
    clusterColumn: value.clusterColumn?.trim().slice(0, 160) || null,
  };
}

export async function POST(request: Request) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token)
    return NextResponse.json(
      { error: "Private research storage is not configured." },
      { status: 500 },
    );
  try {
    const body = (await request.json()) as HandleUploadBody;
    return NextResponse.json(
      await handleUpload({
        request,
        body,
        token,
        onBeforeGenerateToken: async (pathname, clientPayload) => {
          const [user, data] = await Promise.all([
            currentUser(),
            Promise.resolve(parsePayload(clientPayload)),
          ]);
          const design = await prisma.researchSamplingDesign.findFirst({
            where: {
              id: data.designId,
              projectId: data.projectId,
              organizationId: user.organizationId,
              status: ResearchSamplingDesignStatus.APPROVED,
            },
          });
          if (!design)
            throw new Error("An approved tenant sampling design is required.");
          if (
            design.type === ResearchSamplingDesignType.STRATIFIED &&
            !data.strataColumn
          )
            throw new Error(
              "The approved stratified design requires a strata column.",
            );
          if (
            (design.type === ResearchSamplingDesignType.CLUSTER ||
              design.type === ResearchSamplingDesignType.MULTISTAGE) &&
            !data.clusterColumn
          )
            throw new Error(
              "The approved cluster or multistage design requires a cluster column.",
            );
          if (
            !pathname.startsWith(
              `research-sampling-frames/${data.projectId}/${data.designId}/`,
            )
          )
            throw new Error("The sampling-frame storage path is invalid.");
          return {
            allowedContentTypes: TYPES,
            maximumSizeInBytes: MAX_BYTES,
            addRandomSuffix: true,
            tokenPayload: JSON.stringify({
              ...data,
              organizationId: user.organizationId,
              userId: user.id,
            }),
          };
        },
        onUploadCompleted: async ({ blob, tokenPayload }) => {
          const data = JSON.parse(tokenPayload || "null") as Payload & {
            organizationId: string;
            userId: string;
          };
          const [stored, design] = await Promise.all([
            get(blob.pathname, { access: "private" }),
            prisma.researchSamplingDesign.findFirst({
              where: {
                id: data.designId,
                projectId: data.projectId,
                organizationId: data.organizationId,
                status: ResearchSamplingDesignStatus.APPROVED,
              },
            }),
          ]);
          if (!stored || stored.statusCode !== 200 || !stored.stream || !design)
            throw new Error(
              "The approved sampling frame could not be validated.",
            );
          const bytes = await new Response(stored.stream).arrayBuffer();
          const parsed = validateSamplingFrame({
            rows: await parseResearchFileRows(
              bytes,
              blob.contentType,
              data.fileName,
            ),
            identifierColumn: data.identifierColumn,
            strataColumn: data.strataColumn,
            clusterColumn: data.clusterColumn,
          });
          if (
            design.samplingFrameSize &&
            parsed.frameRows.length !== design.samplingFrameSize
          )
            throw new Error(
              `The approved design specifies ${design.samplingFrameSize} frame units; the uploaded frame contains ${parsed.frameRows.length}.`,
            );
          if (
            design.populationSize &&
            parsed.frameRows.length > design.populationSize
          )
            throw new Error(
              "The sampling frame cannot exceed the approved population size.",
            );
          const latest = await prisma.researchSamplingFrame.aggregate({
            where: { samplingDesignId: design.id },
            _max: { version: true },
          });
          const frame = await prisma.researchSamplingFrame.create({
            data: {
              organizationId: data.organizationId,
              projectId: data.projectId,
              samplingDesignId: design.id,
              version: (latest._max.version ?? 0) + 1,
              name: data.name,
              sourceFileName: data.fileName,
              sourceBlobPath: blob.pathname,
              mimeType: blob.contentType,
              sizeBytes: data.fileSize,
              rowCount: parsed.frameRows.length,
              identifierColumn: data.identifierColumn,
              strataColumn: data.strataColumn,
              clusterColumn: data.clusterColumn,
              headerSnapshot: parsed.headers,
              validationSnapshot: parsed.validation,
              createdById: data.userId,
            },
          });
          await logActivity({
            organizationId: data.organizationId,
            userId: data.userId,
            action: ActivityAction.CREATE,
            entityType: "ResearchSamplingFrame",
            entityId: frame.id,
            title: "Private sampling frame validated",
            description: `${frame.name} v${frame.version}`,
            metadata: {
              projectId: data.projectId,
              designId: design.id,
              rowCount: frame.rowCount,
            },
          });
        },
      }),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Sampling-frame upload failed.",
      },
      { status: 400 },
    );
  }
}

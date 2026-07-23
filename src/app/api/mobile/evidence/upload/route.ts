import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import {
  authenticateMobileRequest,
  MobileAuthError,
} from "@/modules/mobile/mobile-auth.service";
import {
  completeMobileEvidenceUpload,
  isMobileEvidenceSynchronized,
  MAX_MOBILE_EVIDENCE_BYTES,
  MOBILE_EVIDENCE_CONTENT_TYPES,
  parseMobileEvidencePayload,
  resolveMobileEvidenceTarget,
  type MobileEvidenceTokenPayload,
} from "@/modules/mobile/mobile-evidence.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const evidenceId = new URL(request.url).searchParams.get("evidenceId");
    if (!evidenceId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(evidenceId)) {
      return NextResponse.json(
        { error: "invalid_request", errorDescription: "Evidence identifier is invalid." },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }
    const { user, organization } = await authenticateMobileRequest(request);
    return NextResponse.json({
      synchronized: await isMobileEvidenceSynchronized({
        evidenceId,
        organizationId: organization.id,
        userId: user.id,
      }),
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return mobileEvidenceError(error);
  }
}

export async function POST(request: Request) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "storage_unavailable", errorDescription: "Evidence storage is not configured." },
      { status: 500 }
    );
  }
  let body: HandleUploadBody;
  try {
    body = await request.json() as HandleUploadBody;
  } catch {
    return NextResponse.json(
      { error: "invalid_request", errorDescription: "Evidence upload request is invalid." },
      { status: 400 }
    );
  }
  try {
    const response = await handleUpload({
      request,
      body,
      token,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const [{ user, organization }, payload] = await Promise.all([
          authenticateMobileRequest(request),
          Promise.resolve(parseMobileEvidencePayload(clientPayload)),
        ]);
        const resolved = await resolveMobileEvidenceTarget({
          payload,
          organizationId: organization.id,
          userId: user.id,
          role: user.role,
        });
        const prefix = `mobile-evidence/${resolved.localEvidenceId}/`;
        if (!pathname.startsWith(prefix) || pathname !== `${prefix}${resolved.fileName}`) {
          throw new Error("Evidence upload path is invalid.");
        }
        return {
          allowedContentTypes: [...MOBILE_EVIDENCE_CONTENT_TYPES],
          maximumSizeInBytes: MAX_MOBILE_EVIDENCE_BYTES,
          addRandomSuffix: false,
          allowOverwrite: true,
          tokenPayload: JSON.stringify(resolved),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const payload = JSON.parse(tokenPayload || "null") as MobileEvidenceTokenPayload;
        await completeMobileEvidenceUpload({
          payload,
          blob: {
            url: blob.url,
            pathname: blob.pathname,
            contentType: blob.contentType,
          },
        });
      },
    });
    return NextResponse.json(response, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return mobileEvidenceError(error);
  }
}

function mobileEvidenceError(error: unknown) {
  if (!(error instanceof MobileAuthError)) {
    console.error("Mobile evidence request failed:", error);
  }
  return NextResponse.json(
    {
      error: error instanceof MobileAuthError ? error.code : "evidence_failed",
      errorDescription: error instanceof Error ? error.message : "Evidence upload failed.",
    },
    {
      status: error instanceof MobileAuthError ? error.status : 400,
      headers: { "cache-control": "no-store" },
    }
  );
}

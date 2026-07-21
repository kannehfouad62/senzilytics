import { NextRequest, NextResponse } from "next/server";
import { integrationResources, listIntegrationResource, parseIntegrationQuery, type IntegrationResource } from "@/modules/integrations/integration-api.service";
import { authenticateIntegrationRequest, IntegrationApiError, logIntegrationRequest } from "@/modules/integrations/integration.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ resource: string }> }) {
  const startedAt = Date.now();
  const { resource: requestedResource } = await context.params;
  if (!(requestedResource in integrationResources)) return apiResponse({ error: { code: "not_found", message: "API resource was not found." } }, 404);
  const resource = requestedResource as IntegrationResource;
  let audit: Awaited<ReturnType<typeof authenticateIntegrationRequest>> | null = null;
  let statusCode = 200;
  try {
    audit = await authenticateIntegrationRequest(request, integrationResources[resource]);
    const query = parseIntegrationQuery(request.nextUrl);
    const result = await listIntegrationResource({ resource, organizationId: audit.credential.organizationId, ...query });
    return apiResponse({ data: result.data, meta: { requestId: audit.requestId, resource, nextCursor: result.nextCursor } }, 200, audit.requestId);
  } catch (error) {
    statusCode = error instanceof IntegrationApiError ? error.status : 500;
    const code = error instanceof IntegrationApiError ? error.code : "internal_error";
    const message = error instanceof IntegrationApiError ? error.message : "The API request could not be completed.";
    if (!(error instanceof IntegrationApiError)) console.error("Integration API request failed:", error);
    return apiResponse({ error: { code, message }, meta: { requestId: audit?.requestId ?? null } }, statusCode, audit?.requestId);
  } finally {
    if (audit) await logIntegrationRequest({ organizationId: audit.credential.organizationId, credentialId: audit.credential.id, requestId: audit.requestId, route: request.nextUrl.pathname, method: request.method, statusCode, durationMs: Date.now() - startedAt });
  }
}

function apiResponse(body: unknown, status: number, requestId?: string) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store", ...(requestId ? { "x-request-id": requestId } : {}) } });
}

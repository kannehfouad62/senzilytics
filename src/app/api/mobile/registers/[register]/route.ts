import { NextResponse } from "next/server";
import { authenticateMobileRequest, MobileAuthError } from "@/modules/mobile/mobile-auth.service";
import { getMobileAssignedPermissions } from "@/modules/mobile/mobile-executive.service";
import { MOBILE_REGISTER_LIMITS, type MobileRegisterKey } from "@/modules/mobile/mobile-register-limits";
import { decodeMobileRegisterCursor, mobileRegisterPage } from "@/modules/mobile/mobile-register-cursor";
import { getMobileRiskField } from "@/modules/mobile/mobile-risk-field.service";
import { getMobileMocPermitWorkspace } from "@/modules/mobile/mobile-moc-permit.service";
import { getMobileAssetContractorWorkspace } from "@/modules/mobile/mobile-asset-contractor.service";
import { getMobileHygieneHealthWorkspace } from "@/modules/mobile/mobile-hygiene-health.service";

export const dynamic = "force-dynamic";

const REGISTER_KEYS = [
  "riskRecords",
  "jsaRecords",
  "mocRecords",
  "permitRecords",
  "assetRecords",
  "contractorRecords",
  "hygieneAssessments",
  "surveillancePrograms",
] as const satisfies readonly MobileRegisterKey[];

type Register = (typeof REGISTER_KEYS)[number];

function isRegister(value: string): value is Register {
  return (REGISTER_KEYS as readonly string[]).includes(value);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ register: string }> }
) {
  try {
    const { register } = await context.params;
    if (!isRegister(register)) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const { user, organization } = await authenticateMobileRequest(request);
    const permissions = await getMobileAssignedPermissions(user.role);
    let cursor: string | null;
    try {
      cursor = decodeMobileRegisterCursor(
        new URL(request.url).searchParams.get("cursor"),
        register
      );
    } catch {
      return NextResponse.json(
        { error: "invalid_cursor", errorDescription: "The register continuation token is invalid." },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }
    const common = {
      organizationId: organization.id,
      userId: user.id,
      permissions,
    };
    let records: Array<{ id: string }>;
    switch (register) {
      case "riskRecords": {
        const workspace = await getMobileRiskField({ ...common, riskCursor: cursor });
        records = workspace.risks;
        break;
      }
      case "jsaRecords": {
        const workspace = await getMobileRiskField({ ...common, jsaCursor: cursor });
        records = workspace.jsas;
        break;
      }
      case "mocRecords": {
        const workspace = await getMobileMocPermitWorkspace({ ...common, mocCursor: cursor });
        records = workspace.mocs;
        break;
      }
      case "permitRecords": {
        const workspace = await getMobileMocPermitWorkspace({ ...common, permitCursor: cursor });
        records = workspace.permits;
        break;
      }
      case "assetRecords": {
        const workspace = await getMobileAssetContractorWorkspace({ ...common, assetCursor: cursor });
        records = workspace.assets;
        break;
      }
      case "contractorRecords": {
        const workspace = await getMobileAssetContractorWorkspace({ ...common, contractorCursor: cursor });
        records = workspace.contractors;
        break;
      }
      case "hygieneAssessments": {
        const workspace = await getMobileHygieneHealthWorkspace({ ...common, assessmentCursor: cursor });
        records = workspace.assessments;
        break;
      }
      case "surveillancePrograms": {
        const workspace = await getMobileHygieneHealthWorkspace({ ...common, programCursor: cursor });
        records = workspace.programs;
        break;
      }
    }
    return NextResponse.json(
      mobileRegisterPage(register, records, MOBILE_REGISTER_LIMITS[register]),
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof MobileAuthError) {
      return NextResponse.json(
        { error: error.code, errorDescription: error.message },
        { status: error.status, headers: { "cache-control": "no-store" } }
      );
    }
    console.error("Mobile register continuation failed", error);
    return NextResponse.json(
      { error: "server_error", errorDescription: "The register could not be loaded." },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}

import {
  AssetDefectStatus,
  AssetMaintenanceStatus,
  AssetStatus,
  ConfigurableFormModule,
  ConfigurableSubmissionStatus,
  ContractorStatus,
  PermissionKey,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getAssetDefectNextStatuses,
} from "@/modules/assets/asset.service";
import {
  getAssetNextStatuses,
  getMaintenanceNextStatuses,
} from "@/modules/assets/asset-lifecycle";
import { getPublishedRuntimeForms } from "@/modules/forms/runtime-form.service";

export function mobileAssetContractorCapabilities(
  permissions: readonly PermissionKey[]
) {
  const granted = new Set(permissions);
  return {
    canViewAssets: granted.has(PermissionKey.VIEW_ASSETS),
    canManageAssets: granted.has(PermissionKey.MANAGE_ASSETS),
    canViewContractors: granted.has(PermissionKey.VIEW_CONTRACTORS),
    canManageContractors: granted.has(PermissionKey.MANAGE_CONTRACTORS),
  };
}

export async function getMobileAssetContractorWorkspace(input: {
  organizationId: string;
  userId: string;
  permissions: readonly PermissionKey[];
  now?: Date;
}) {
  const capabilities = mobileAssetContractorCapabilities(input.permissions);
  const now = input.now ?? new Date();
  const recentCutoff = new Date(now.getTime() - 30 * 86_400_000);

  const [assets, contractors, assetInspectionForms, contractorForms] =
    await Promise.all([
      capabilities.canViewAssets
        ? prisma.asset.findMany({
            where: {
              organizationId: input.organizationId,
              OR: [
                { status: { not: AssetStatus.RETIRED } },
                { updatedAt: { gte: recentCutoff } },
              ],
            },
            select: {
              id: true,
              reference: true,
              name: true,
              description: true,
              type: true,
              status: true,
              criticality: true,
              isSafetyCritical: true,
              manufacturer: true,
              modelNumber: true,
              serialNumber: true,
              location: true,
              commissionedAt: true,
              inspectionIntervalDays: true,
              lastInspectionAt: true,
              nextInspectionDueAt: true,
              maintenanceIntervalDays: true,
              lastMaintenanceAt: true,
              nextMaintenanceDueAt: true,
              permitRequired: true,
              site: { select: { id: true, name: true } },
              department: { select: { id: true, name: true } },
              owner: { select: { id: true, name: true } },
              inspections: {
                select: {
                  id: true,
                  inspectedAt: true,
                  result: true,
                  conditionScore: true,
                  evidenceReference: true,
                  observations: true,
                  immediateAction: true,
                  nextInspectionDueAt: true,
                  inspectedBy: { select: { id: true, name: true } },
                },
                orderBy: { inspectedAt: "desc" },
                take: 5,
              },
              defects: {
                where: {
                  OR: [
                    { status: { not: AssetDefectStatus.CLOSED } },
                    { updatedAt: { gte: recentCutoff } },
                  ],
                },
                select: {
                  id: true,
                  reference: true,
                  title: true,
                  description: true,
                  severity: true,
                  status: true,
                  dueDate: true,
                  immediateControls: true,
                  repairPlan: true,
                  verificationEvidence: true,
                  verifiedAt: true,
                  correctiveActionId: true,
                  reportedBy: { select: { id: true, name: true } },
                  owner: { select: { id: true, name: true } },
                  verifiedBy: { select: { id: true, name: true } },
                },
                orderBy: [{ severity: "desc" }, { dueDate: "asc" }],
                take: 20,
              },
              maintenanceRecords: {
                where: {
                  OR: [
                    {
                      status: {
                        notIn: [
                          AssetMaintenanceStatus.COMPLETED,
                          AssetMaintenanceStatus.CANCELLED,
                        ],
                      },
                    },
                    { updatedAt: { gte: recentCutoff } },
                  ],
                },
                select: {
                  id: true,
                  type: true,
                  status: true,
                  title: true,
                  scheduledAt: true,
                  dueAt: true,
                  startedAt: true,
                  completedAt: true,
                  serviceProvider: true,
                  workOrderReference: true,
                  workSummary: true,
                  evidenceReference: true,
                  downtimeHours: true,
                  nextMaintenanceDueAt: true,
                  technician: { select: { id: true, name: true } },
                  defect: {
                    select: { id: true, reference: true, title: true },
                  },
                },
                orderBy: [{ dueAt: "asc" }, { scheduledAt: "desc" }],
                take: 20,
              },
            },
            orderBy: [
              { isSafetyCritical: "desc" },
              { criticality: "desc" },
              { nextInspectionDueAt: "asc" },
            ],
            take: 75,
          })
        : Promise.resolve([]),
      capabilities.canViewContractors
        ? prisma.contractor.findMany({
            where: {
              organizationId: input.organizationId,
              OR: [
                { status: { not: ContractorStatus.INACTIVE } },
                { updatedAt: { gte: recentCutoff } },
              ],
            },
            select: {
              id: true,
              name: true,
              legalName: true,
              registrationNumber: true,
              primaryContactName: true,
              primaryContactEmail: true,
              primaryContactPhone: true,
              services: true,
              safetyProgramSummary: true,
              insuranceProvider: true,
              insurancePolicyNumber: true,
              insuranceExpiresAt: true,
              status: true,
              safetyRating: true,
              approvedAt: true,
              suspensionReason: true,
              notes: true,
              approvedBy: { select: { id: true, name: true } },
              sites: {
                select: {
                  id: true,
                  approvedAt: true,
                  expiresAt: true,
                  notes: true,
                  site: { select: { id: true, name: true } },
                },
                orderBy: { site: { name: "asc" } },
              },
              workers: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  employeeNumber: true,
                  email: true,
                  phone: true,
                  jobTitle: true,
                  status: true,
                  inductionCompletedAt: true,
                  inductionExpiresAt: true,
                  medicalExpiresAt: true,
                  competencySummary: true,
                  notes: true,
                },
                orderBy: [{ status: "asc" }, { lastName: "asc" }],
                take: 100,
              },
              permitsToWork: {
                where: {
                  status: {
                    notIn: ["CLOSED", "CANCELLED", "EXPIRED"],
                  },
                },
                select: {
                  id: true,
                  reference: true,
                  title: true,
                  status: true,
                  plannedStartAt: true,
                  plannedEndAt: true,
                  site: { select: { id: true, name: true } },
                },
                orderBy: { plannedStartAt: "desc" },
                take: 20,
              },
            },
            orderBy: [{ status: "asc" }, { name: "asc" }],
            take: 75,
          })
        : Promise.resolve([]),
      capabilities.canViewAssets
        ? getPublishedRuntimeForms(
            input.organizationId,
            ConfigurableFormModule.ASSET_SAFETY
          )
        : Promise.resolve([]),
      capabilities.canViewContractors
        ? getPublishedRuntimeForms(
            input.organizationId,
            ConfigurableFormModule.CONTRACTOR
          )
        : Promise.resolve([]),
    ]);

  const capturedContractorForms = contractors.length
    ? await prisma.configurableFormSubmission.findMany({
        where: {
          organizationId: input.organizationId,
          entityType: ConfigurableFormModule.CONTRACTOR,
          entityId: { in: contractors.map((contractor) => contractor.id) },
          status: ConfigurableSubmissionStatus.SUBMITTED,
        },
        select: { entityId: true, definitionId: true },
      })
    : [];
  const submittedFormCounts = new Map<string, number>();
  for (const submission of capturedContractorForms) {
    const key = `${submission.entityId}:${submission.definitionId}`;
    if (!submittedFormCounts.has(key)) {
      submittedFormCounts.set(key, 1);
    }
  }

  return {
    capabilities,
    assetInspectionForms,
    assets: assets.map((asset) => ({
      ...asset,
      nextStatuses: getAssetNextStatuses(asset.status),
      isOwner: asset.owner?.id === input.userId,
      defects: asset.defects.map((defect) => ({
        ...defect,
        nextStatuses: getAssetDefectNextStatuses(defect.status),
        isAssignedToCurrentUser: defect.owner?.id === input.userId,
      })),
      maintenanceRecords: asset.maintenanceRecords.map((record) => ({
        ...record,
        downtimeHours:
          record.downtimeHours === null ? null : Number(record.downtimeHours),
        nextStatuses: getMaintenanceNextStatuses(record.status),
        isAssignedToCurrentUser: record.technician?.id === input.userId,
      })),
    })),
    contractors: contractors.map((contractor) => ({
      ...contractor,
      nextStatuses: Object.values(ContractorStatus).filter(
        (status) => status !== contractor.status
      ),
      requiredFormCount: contractorForms.length,
      submittedFormCount: contractorForms.filter((form) =>
        submittedFormCounts.has(`${contractor.id}:${form.id}`)
      ).length,
      workers: contractor.workers.map((worker) => ({
        ...worker,
        inductionCurrent:
          worker.status === "ACTIVE" &&
          Boolean(worker.inductionExpiresAt && worker.inductionExpiresAt > now),
        medicalCurrent:
          !worker.medicalExpiresAt || worker.medicalExpiresAt > now,
      })),
    })),
  };
}

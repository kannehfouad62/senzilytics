import { prisma } from "@/lib/prisma";
import { completeMissingEntityForms } from "@/modules/forms/entity-form-completion.service";
import {
  createPreparedSubmissions,
  type PreparedSubmission,
} from "@/modules/forms/runtime-form.service";
import {
  ActivityAction,
  ChemicalApprovalStatus,
  ChemicalSignalWord,
  ConfigurableFormModule,
  Prisma,
} from "@prisma/client";
import { isChemicalTransitionAllowed } from "@/modules/chemicals/chemical-lifecycle";

type OfflineSubmissionInput = {
  id: string;
  capturedAt: Date;
  payloadHash: string;
};

async function recordChemicalOfflineSubmission(
  tx: Prisma.TransactionClient,
  input: {
    organizationId: string;
    userId: string;
    offlineSubmission?: OfflineSubmissionInput;
  },
  recordType: string,
  recordId: string
) {
  if (!input.offlineSubmission) return;
  await tx.offlineSubmission.create({
    data: {
      id: input.offlineSubmission.id,
      organizationId: input.organizationId,
      userId: input.userId,
      recordType,
      recordId,
      capturedAt: input.offlineSubmission.capturedAt,
      payloadHash: input.offlineSubmission.payloadHash,
    },
  });
}

export async function createChemicalService(input: {
  organizationId: string;
  userId: string;
  productName: string;
  productCode?: string | null;
  manufacturer?: string | null;
  supplier?: string | null;
  casNumber?: string | null;
  description?: string | null;
  signalWord: ChemicalSignalWord;
  hazardClassifications?: string | null;
  pictograms?: string | null;
  exposureLimits?: string | null;
  requiredPpe?: string | null;
  firstAidMeasures?: string | null;
  spillResponse?: string | null;
  storageRequirements?: string | null;
  incompatibilities?: string | null;
  sdsRevisionDate?: Date | null;
  sdsReviewDueDate?: Date | null;
  customSubmissions?: PreparedSubmission[];
}) {
  const creator = await prisma.user.findFirst({
    where: {
      id: input.userId,
      organizationId: input.organizationId,
    },
  });

  if (!creator) {
    throw new Error("The chemical creator is not a tenant user.");
  }

  return prisma.$transaction(async (tx) => {
    const chemical = await tx.chemical.create({
      data: {
        organizationId: input.organizationId,
        productName: input.productName,
        productCode: input.productCode,
        manufacturer: input.manufacturer,
        supplier: input.supplier,
        casNumber: input.casNumber,
        description: input.description,
        signalWord: input.signalWord,
        hazardClassifications: input.hazardClassifications,
        pictograms: input.pictograms,
        exposureLimits: input.exposureLimits,
        requiredPpe: input.requiredPpe,
        firstAidMeasures: input.firstAidMeasures,
        spillResponse: input.spillResponse,
        storageRequirements: input.storageRequirements,
        incompatibilities: input.incompatibilities,
        sdsRevisionDate: input.sdsRevisionDate,
        sdsReviewDueDate: input.sdsReviewDueDate,
      },
    });

    await createPreparedSubmissions(tx, {
      organizationId: input.organizationId,
      userId: input.userId,
      module: ConfigurableFormModule.CHEMICAL,
      entityId: chemical.id,
      submissions: input.customSubmissions ?? [],
    });

    await tx.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: ActivityAction.CREATE,
        entityType: "Chemical",
        entityId: chemical.id,
        title: "Chemical product created",
        description: chemical.productName,
        metadata: {
          signalWord: chemical.signalWord,
          productCode: chemical.productCode,
          customFormCount: input.customSubmissions?.length ?? 0,
        },
      },
    });

    return chemical;
  });
}

export async function completeChemicalFormsService(input: {
  organizationId: string;
  userId: string;
  chemicalId: string;
  submissions: PreparedSubmission[];
  offlineSubmission?: OfflineSubmissionInput;
}) {
  const chemical = await prisma.chemical.findFirst({
    where: { id: input.chemicalId, organizationId: input.organizationId },
    select: { id: true },
  });

  if (!chemical) {
    throw new Error("Chemical product not found in this organization.");
  }

  await completeMissingEntityForms({
    organizationId: input.organizationId,
    userId: input.userId,
    module: ConfigurableFormModule.CHEMICAL,
    entityId: chemical.id,
    activityEntityType: "Chemical",
    activityTitle: "Chemical forms captured",
    formLabel: "chemical",
    submissions: input.submissions,
    offlineSubmission: input.offlineSubmission,
    offlineRecordType: input.offlineSubmission ? "CHEMICAL_FORMS" : undefined,
  });
}

export async function upsertChemicalInventoryService(input: {
  organizationId: string;
  userId: string;
  chemicalId: string;
  siteId: string;
  storageLocation: string;
  quantity: number;
  unit: string;
  maximumAllowed?: number | null;
  containerType?: string | null;
  storageNotes?: string | null;
  offlineSubmission?: OfflineSubmissionInput;
}) {
  const [chemical, site] = await Promise.all([
    prisma.chemical.findFirst({
      where: { id: input.chemicalId, organizationId: input.organizationId },
      select: { id: true, productName: true },
    }),
    prisma.site.findFirst({
      where: { id: input.siteId, organizationId: input.organizationId },
      select: { id: true, name: true },
    }),
  ]);
  if (!chemical || !site) {
    throw new Error("Select a valid chemical and tenant site.");
  }
  if (!Number.isFinite(input.quantity) || input.quantity < 0) {
    throw new Error("Chemical inventory quantity must be a non-negative number.");
  }
  if (
    input.maximumAllowed !== null &&
    input.maximumAllowed !== undefined &&
    (!Number.isFinite(input.maximumAllowed) || input.maximumAllowed < 0)
  ) {
    throw new Error("Maximum allowed quantity must be a non-negative number.");
  }
  if (!input.storageLocation.trim() || !input.unit.trim()) {
    throw new Error("Storage location and inventory unit are required.");
  }

  return prisma.$transaction(async (tx) => {
    const inventory = await tx.chemicalInventory.upsert({
      where: {
        chemicalId_siteId_storageLocation: {
          chemicalId: chemical.id,
          siteId: site.id,
          storageLocation: input.storageLocation.trim(),
        },
      },
      update: {
        quantity: input.quantity,
        unit: input.unit.trim(),
        maximumAllowed: input.maximumAllowed,
        containerType: input.containerType,
        storageNotes: input.storageNotes,
        inventoriedAt: new Date(),
        limitNotifiedAt:
          input.maximumAllowed !== null &&
          input.maximumAllowed !== undefined &&
          input.quantity <= input.maximumAllowed
            ? null
            : undefined,
      },
      create: {
        chemicalId: chemical.id,
        siteId: site.id,
        storageLocation: input.storageLocation.trim(),
        quantity: input.quantity,
        unit: input.unit.trim(),
        maximumAllowed: input.maximumAllowed,
        containerType: input.containerType,
        storageNotes: input.storageNotes,
      },
    });
    await tx.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: ActivityAction.UPDATE,
        entityType: "ChemicalInventory",
        entityId: inventory.id,
        title: "Chemical inventory counted",
        description: `${chemical.productName} · ${site.name} · ${inventory.storageLocation}`,
        metadata: {
          chemicalId: chemical.id,
          siteId: site.id,
          quantity: inventory.quantity,
          unit: inventory.unit,
          maximumAllowed: inventory.maximumAllowed,
        },
      },
    });
    await recordChemicalOfflineSubmission(
      tx,
      input,
      "CHEMICAL_INVENTORY",
      inventory.id
    );
    return inventory;
  });
}

export async function updateChemicalApprovalStatusService(input: {
  organizationId: string;
  userId: string;
  chemicalId: string;
  status: ChemicalApprovalStatus;
  offlineSubmission?: OfflineSubmissionInput;
}) {
  const chemical = await prisma.chemical.findFirst({
    where: { id: input.chemicalId, organizationId: input.organizationId },
  });
  if (!chemical) {
    throw new Error("Chemical product not found in this organization.");
  }
  if (chemical.status === input.status) {
    if (input.offlineSubmission) {
      await prisma.$transaction((tx) =>
        recordChemicalOfflineSubmission(
          tx,
          input,
          "CHEMICAL_STATUS",
          chemical.id
        )
      );
    }
    return chemical;
  }
  if (!isChemicalTransitionAllowed(chemical.status, input.status)) {
    throw new Error(
      `A ${chemical.status.replaceAll("_", " ")} chemical cannot move to ${input.status.replaceAll("_", " ")}.`
    );
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.chemical.update({
      where: { id: chemical.id },
      data: {
        status: input.status,
        reviewedById: input.userId,
        reviewedAt: new Date(),
      },
    });
    await tx.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: ActivityAction.STATUS_CHANGE,
        entityType: "Chemical",
        entityId: chemical.id,
        title: "Chemical approval status changed",
        description: `${chemical.status} → ${input.status}`,
        metadata: {
          previousStatus: chemical.status,
          newStatus: input.status,
        },
      },
    });
    await recordChemicalOfflineSubmission(
      tx,
      input,
      "CHEMICAL_STATUS",
      updated.id
    );
    return updated;
  });
}

import { prisma } from "@/lib/prisma";
import { completeMissingEntityForms } from "@/modules/forms/entity-form-completion.service";
import {
  createPreparedSubmissions,
  type PreparedSubmission,
} from "@/modules/forms/runtime-form.service";
import {
  ActivityAction,
  ChemicalSignalWord,
  ConfigurableFormModule,
} from "@prisma/client";

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
  });
}

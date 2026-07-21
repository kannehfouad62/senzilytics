import { prisma } from "@/lib/prisma";
import { completeMissingEntityForms } from "@/modules/forms/entity-form-completion.service";
import {
  createPreparedSubmissions,
  type PreparedSubmission,
} from "@/modules/forms/runtime-form.service";
import {
  ActivityAction,
  ConfigurableFormModule,
  ConfigurableFormVersionStatus,
  ConfigurableSubmissionStatus,
  ContractorStatus,
  ContractorWorkerStatus,
} from "@prisma/client";

export async function createContractorService(input: {
  organizationId: string;
  userId: string;
  name: string;
  legalName?: string | null;
  registrationNumber?: string | null;
  taxIdentifier?: string | null;
  primaryContactName?: string | null;
  primaryContactEmail?: string | null;
  primaryContactPhone?: string | null;
  services?: string | null;
  safetyProgramSummary?: string | null;
  insuranceProvider?: string | null;
  insurancePolicyNumber?: string | null;
  insuranceExpiresAt?: Date | null;
  safetyRating?: number | null;
  notes?: string | null;
  siteIds: string[];
  customSubmissions?: PreparedSubmission[];
}) {
  const siteIds = [...new Set(input.siteIds)];
  const [creator, sites] = await Promise.all([
    prisma.user.findFirst({
      where: { id: input.userId, organizationId: input.organizationId },
    }),
    prisma.site.findMany({
      where: { id: { in: siteIds }, organizationId: input.organizationId },
      select: { id: true },
    }),
  ]);

  if (!creator) {
    throw new Error("The contractor creator is not a tenant user.");
  }

  if (sites.length !== siteIds.length || sites.length === 0) {
    throw new Error("Select at least one valid site.");
  }

  if (
    input.safetyRating !== null &&
    input.safetyRating !== undefined &&
    (!Number.isFinite(input.safetyRating) ||
      input.safetyRating < 0 ||
      input.safetyRating > 100)
  ) {
    throw new Error("Safety rating must be between 0 and 100.");
  }

  return prisma.$transaction(async (tx) => {
    const contractor = await tx.contractor.create({
      data: {
        organizationId: input.organizationId,
        name: input.name,
        legalName: input.legalName,
        registrationNumber: input.registrationNumber,
        taxIdentifier: input.taxIdentifier,
        primaryContactName: input.primaryContactName,
        primaryContactEmail: input.primaryContactEmail,
        primaryContactPhone: input.primaryContactPhone,
        services: input.services,
        safetyProgramSummary: input.safetyProgramSummary,
        insuranceProvider: input.insuranceProvider,
        insurancePolicyNumber: input.insurancePolicyNumber,
        insuranceExpiresAt: input.insuranceExpiresAt,
        safetyRating: input.safetyRating,
        notes: input.notes,
        sites: {
          create: sites.map((site) => ({ siteId: site.id })),
        },
      },
    });

    await createPreparedSubmissions(tx, {
      organizationId: input.organizationId,
      userId: input.userId,
      module: ConfigurableFormModule.CONTRACTOR,
      entityId: contractor.id,
      submissions: input.customSubmissions ?? [],
    });

    await tx.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: ActivityAction.CREATE,
        entityType: "Contractor",
        entityId: contractor.id,
        title: "Contractor registered",
        description: contractor.name,
        metadata: {
          status: contractor.status,
          siteCount: sites.length,
          customFormCount: input.customSubmissions?.length ?? 0,
        },
      },
    });

    return contractor;
  });
}

export async function updateContractorStatusService(input: {
  organizationId: string;
  userId: string;
  contractorId: string;
  status: ContractorStatus;
  reason?: string | null;
}) {
  const contractor = await prisma.contractor.findFirst({
    where: { id: input.contractorId, organizationId: input.organizationId },
    include: { sites: true },
  });

  if (!contractor) {
    throw new Error("Contractor not found in this organization.");
  }

  if (input.status === ContractorStatus.APPROVED) {
    if (
      !contractor.sites.some(
        (site) => !site.expiresAt || site.expiresAt > new Date()
      )
    ) {
      throw new Error(
        "Authorize at least one site with a current approval before contractor approval."
      );
    }

    if (
      !contractor.insuranceExpiresAt ||
      contractor.insuranceExpiresAt <= new Date()
    ) {
      throw new Error("Valid future-dated insurance is required for approval.");
    }
    const [publishedForms, submittedForms] = await Promise.all([
      prisma.configurableFormDefinition.count({
        where: {
          organizationId: input.organizationId,
          module: ConfigurableFormModule.CONTRACTOR,
          isActive: true,
          versions: {
            some: { status: ConfigurableFormVersionStatus.PUBLISHED },
          },
        },
      }),
      prisma.configurableFormSubmission.count({
        where: {
          organizationId: input.organizationId,
          entityType: ConfigurableFormModule.CONTRACTOR,
          entityId: contractor.id,
          status: ConfigurableSubmissionStatus.SUBMITTED,
        },
      }),
    ]);
    if (submittedForms < publishedForms) {
      throw new Error(
        "Complete all published contractor forms and required attachments before approval."
      );
    }
  }

  if (input.status === ContractorStatus.SUSPENDED && !input.reason) {
    throw new Error("Provide a suspension reason.");
  }

  if (contractor.status === input.status) {
    return contractor;
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.contractor.update({
      where: { id: contractor.id },
      data: {
        status: input.status,
        approvedById:
          input.status === ContractorStatus.APPROVED
            ? input.userId
            : contractor.approvedById,
        approvedAt:
          input.status === ContractorStatus.APPROVED
            ? new Date()
            : contractor.approvedAt,
        suspensionReason:
          input.status === ContractorStatus.SUSPENDED
            ? input.reason
            : null,
      },
    });

    await tx.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: ActivityAction.STATUS_CHANGE,
        entityType: "Contractor",
        entityId: contractor.id,
        title: "Contractor status changed",
        description: `${contractor.status} → ${input.status}`,
        metadata: {
          previousStatus: contractor.status,
          newStatus: input.status,
          reason: input.reason,
        },
      },
    });

    return updated;
  });
}

export async function addContractorSiteService(input: {
  organizationId: string;
  userId: string;
  contractorId: string;
  siteId: string;
  expiresAt?: Date | null;
  notes?: string | null;
}) {
  const [contractor, site] = await Promise.all([
    prisma.contractor.findFirst({
      where: { id: input.contractorId, organizationId: input.organizationId },
    }),
    prisma.site.findFirst({
      where: { id: input.siteId, organizationId: input.organizationId },
    }),
  ]);

  if (!contractor || !site) {
    throw new Error("Select a valid contractor and site.");
  }
  if (input.expiresAt && input.expiresAt <= new Date()) {
    throw new Error("Site authorization expiry must be in the future.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.contractorSite.upsert({
      where: {
        contractorId_siteId: {
          contractorId: contractor.id,
          siteId: site.id,
        },
      },
      update: { expiresAt: input.expiresAt, notes: input.notes },
      create: {
        contractorId: contractor.id,
        siteId: site.id,
        expiresAt: input.expiresAt,
        notes: input.notes,
      },
    });
    await tx.activityLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: ActivityAction.UPDATE,
        entityType: "Contractor",
        entityId: contractor.id,
        title: "Contractor site authorization updated",
        description: `${contractor.name} authorized for ${site.name}`,
        metadata: { siteId: site.id, expiresAt: input.expiresAt },
      },
    });
  });
}

export async function addContractorWorkerService(input: {
  organizationId: string;
  userId: string;
  contractorId: string;
  firstName: string;
  lastName: string;
  employeeNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  status: ContractorWorkerStatus;
  inductionCompletedAt?: Date | null;
  inductionExpiresAt?: Date | null;
  medicalExpiresAt?: Date | null;
  competencySummary?: string | null;
  notes?: string | null;
}) {
  const contractor = await prisma.contractor.findFirst({
    where: { id: input.contractorId, organizationId: input.organizationId },
  });

  if (!contractor) {
    throw new Error("Contractor not found in this organization.");
  }
  if (
    input.inductionCompletedAt &&
    input.inductionExpiresAt &&
    input.inductionExpiresAt <= input.inductionCompletedAt
  ) {
    throw new Error("Induction expiry must be after completion.");
  }
  if (
    input.status === ContractorWorkerStatus.ACTIVE &&
    (!input.inductionExpiresAt || input.inductionExpiresAt <= new Date())
  ) {
    throw new Error(
      "An active contractor worker requires a future induction expiry date."
    );
  }

  return prisma.$transaction(async (tx) => {
    const worker = await tx.contractorWorker.create({ data: {
      contractorId: contractor.id,
      firstName: input.firstName,
      lastName: input.lastName,
      employeeNumber: input.employeeNumber,
      email: input.email,
      phone: input.phone,
      jobTitle: input.jobTitle,
      status: input.status,
      inductionCompletedAt: input.inductionCompletedAt,
      inductionExpiresAt: input.inductionExpiresAt,
      medicalExpiresAt: input.medicalExpiresAt,
      competencySummary: input.competencySummary,
      notes: input.notes,
    } });
    await tx.activityLog.create({ data: {
      organizationId: input.organizationId,
      userId: input.userId,
      action: ActivityAction.CREATE,
      entityType: "ContractorWorker",
      entityId: worker.id,
      title: "Contractor worker registered",
      description: `${worker.firstName} ${worker.lastName} — ${contractor.name}`,
      metadata: { contractorId: contractor.id, status: worker.status },
    } });
    return worker;
  });
}

export async function completeContractorFormsService(input: {
  organizationId: string;
  userId: string;
  contractorId: string;
  submissions: PreparedSubmission[];
}) {
  const contractor = await prisma.contractor.findFirst({
    where: { id: input.contractorId, organizationId: input.organizationId },
    select: { id: true },
  });

  if (!contractor) {
    throw new Error("Contractor not found in this organization.");
  }

  await completeMissingEntityForms({
    organizationId: input.organizationId,
    userId: input.userId,
    module: ConfigurableFormModule.CONTRACTOR,
    entityId: contractor.id,
    activityEntityType: "Contractor",
    activityTitle: "Contractor forms captured",
    formLabel: "contractor",
    submissions: input.submissions,
  });
}

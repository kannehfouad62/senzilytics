import { logActivity } from "@/core/activity-log/activity-log.service";
import { prisma } from "@/lib/prisma";
import {
  archiveTenantAuditProgram,
  createTenantAuditProgram,
  findTenantAuditProgram,
  findTenantAuditProgramByCode,
  findTenantAuditProgramByName,
  getAuditProgramFormOptions,
  listTenantAuditPrograms,
  updateTenantAuditProgram,
} from "@/modules/audit-v2/audit-program.repository";
import {
  ActivityAction,
  EnterpriseAuditFrequency,
  EnterpriseAuditProgramStatus,
  EnterpriseAuditProtocolStatus,
  EnterpriseAuditRiskPriority,
} from "@prisma/client";

type AuditProgramInput = {
  organizationId: string;
  userId: string;

  name: string;
  description?: string | null;
  code?: string | null;

  standardName?: string | null;
  standardVersion?: string | null;
  framework?: string | null;
  objectives?: string | null;
  scope?: string | null;

  status: EnterpriseAuditProgramStatus;
  frequency: EnterpriseAuditFrequency;
  riskPriority: EnterpriseAuditRiskPriority;

  effectiveFrom?: Date | null;
  effectiveTo?: Date | null;

  ownerId?: string | null;
  defaultProtocolId?: string | null;

  isActive: boolean;

  siteIds: string[];
  primarySiteId?: string | null;

  departmentIds: string[];
  primaryDepartmentId?: string | null;
};

function normalizeOptionalText(
  value?: string | null
) {
  return value?.trim() || null;
}

function uniqueIds(
  values: string[]
) {
  return [
    ...new Set(
      values
        .map((value) =>
          value.trim()
        )
        .filter(Boolean)
    ),
  ];
}

function validateEffectiveDates(
  effectiveFrom?: Date | null,
  effectiveTo?: Date | null
) {
  if (
    effectiveFrom &&
    Number.isNaN(
      effectiveFrom.getTime()
    )
  ) {
    throw new Error(
      "The effective start date is invalid."
    );
  }

  if (
    effectiveTo &&
    Number.isNaN(
      effectiveTo.getTime()
    )
  ) {
    throw new Error(
      "The effective end date is invalid."
    );
  }

  if (
    effectiveFrom &&
    effectiveTo &&
    effectiveTo < effectiveFrom
  ) {
    throw new Error(
      "The effective end date cannot be earlier than the effective start date."
    );
  }
}

async function validateProgramOwner(
  input: {
    organizationId: string;
    ownerId?: string | null;
  }
) {
  if (!input.ownerId) {
    return;
  }

  const owner =
    await prisma.user.findFirst({
      where: {
        id: input.ownerId,
        organizationId:
          input.organizationId,
      },

      select: {
        id: true,
      },
    });

  if (!owner) {
    throw new Error(
      "The selected program owner does not belong to this organization."
    );
  }
}

async function validateDefaultProtocol(
  input: {
    organizationId: string;
    protocolId?: string | null;
  }
) {
  if (!input.protocolId) {
    return;
  }

  const protocol =
    await prisma.auditProtocol.findFirst({
      where: {
        id: input.protocolId,

        organizationId:
          input.organizationId,

        status: {
          not:
            EnterpriseAuditProtocolStatus.ARCHIVED,
        },

        isActive: true,
      },

      select: {
        id: true,
      },
    });

  if (!protocol) {
    throw new Error(
      "The selected default protocol is unavailable or does not belong to this organization."
    );
  }
}

async function validateProgramSites(
  input: {
    organizationId: string;
    siteIds: string[];
    primarySiteId?: string | null;
  }
) {
  const siteIds =
    uniqueIds(input.siteIds);

  if (
    input.primarySiteId &&
    !siteIds.includes(
      input.primarySiteId
    )
  ) {
    throw new Error(
      "The primary site must also be included in the program site scope."
    );
  }

  if (siteIds.length === 0) {
    return siteIds;
  }

  const validSites =
    await prisma.site.findMany({
      where: {
        organizationId:
          input.organizationId,

        id: {
          in: siteIds,
        },
      },

      select: {
        id: true,
      },
    });

  if (
    validSites.length !==
    siteIds.length
  ) {
    throw new Error(
      "One or more selected sites are invalid or belong to another organization."
    );
  }

  return siteIds;
}

async function validateProgramDepartments(
  input: {
    organizationId: string;
    departmentIds: string[];
    primaryDepartmentId?: string | null;
    siteIds: string[];
  }
) {
  const departmentIds =
    uniqueIds(
      input.departmentIds
    );

  if (
    input.primaryDepartmentId &&
    !departmentIds.includes(
      input.primaryDepartmentId
    )
  ) {
    throw new Error(
      "The primary department must also be included in the program department scope."
    );
  }

  if (
    departmentIds.length === 0
  ) {
    return departmentIds;
  }

  const validDepartments =
    await prisma.department.findMany({
      where: {
        id: {
          in: departmentIds,
        },

        site: {
          organizationId:
            input.organizationId,
        },
      },

      select: {
        id: true,
        siteId: true,
      },
    });

  if (
    validDepartments.length !==
    departmentIds.length
  ) {
    throw new Error(
      "One or more selected departments are invalid or belong to another organization."
    );
  }

  /*
   * When explicit program sites are selected, every scoped
   * department must belong to one of those sites.
   */
  if (input.siteIds.length > 0) {
    const siteScope =
      new Set(
        input.siteIds
      );

    const outsideSiteScope =
      validDepartments.some(
        (department) =>
          !siteScope.has(
            department.siteId
          )
      );

    if (outsideSiteScope) {
      throw new Error(
        "Each selected department must belong to a site included in the program scope."
      );
    }
  }

  return departmentIds;
}

async function validateUniqueProgramIdentity(
  input: {
    organizationId: string;
    name: string;
    code?: string | null;
    excludeProgramId?: string | null;
  }
) {
  const existingName =
    await findTenantAuditProgramByName({
      organizationId:
        input.organizationId,

      name:
        input.name,

      excludeProgramId:
        input.excludeProgramId,
    });

  if (existingName) {
    throw new Error(
      "An audit program with this name already exists in the organization."
    );
  }

  const normalizedCode =
    normalizeOptionalText(
      input.code
    );

  if (!normalizedCode) {
    return;
  }

  const existingCode =
    await findTenantAuditProgramByCode({
      organizationId:
        input.organizationId,

      code:
        normalizedCode,

      excludeProgramId:
        input.excludeProgramId,
    });

  if (existingCode) {
    throw new Error(
      "An audit program with this code already exists in the organization."
    );
  }
}

async function validateAuditProgramInput(
  input: AuditProgramInput & {
    excludeProgramId?: string | null;
  }
) {
  const name =
    input.name.trim();

  if (!name) {
    throw new Error(
      "Program name is required."
    );
  }

  if (name.length > 200) {
    throw new Error(
      "Program name cannot exceed 200 characters."
    );
  }

  const code =
    normalizeOptionalText(
      input.code
    );

  if (
    code &&
    code.length > 50
  ) {
    throw new Error(
      "Program code cannot exceed 50 characters."
    );
  }

  validateEffectiveDates(
    input.effectiveFrom,
    input.effectiveTo
  );

  await validateUniqueProgramIdentity({
    organizationId:
      input.organizationId,

    name,

    code,

    excludeProgramId:
      input.excludeProgramId,
  });

  await Promise.all([
    validateProgramOwner({
      organizationId:
        input.organizationId,

      ownerId:
        input.ownerId,
    }),

    validateDefaultProtocol({
      organizationId:
        input.organizationId,

      protocolId:
        input.defaultProtocolId,
    }),
  ]);

  const siteIds =
    await validateProgramSites({
      organizationId:
        input.organizationId,

      siteIds:
        input.siteIds,

      primarySiteId:
        input.primarySiteId,
    });

  const departmentIds =
    await validateProgramDepartments({
      organizationId:
        input.organizationId,

      departmentIds:
        input.departmentIds,

      primaryDepartmentId:
        input.primaryDepartmentId,

      siteIds,
    });

  if (
    input.status ===
      EnterpriseAuditProgramStatus.ACTIVE &&
    !input.isActive
  ) {
    throw new Error(
      "An active audit program must have its active setting enabled."
    );
  }

  if (
    input.status ===
      EnterpriseAuditProgramStatus.ARCHIVED &&
    input.isActive
  ) {
    throw new Error(
      "An archived audit program cannot remain active."
    );
  }

  return {
    name,
    code,
    siteIds,
    departmentIds,
  };
}

export async function listAuditProgramsService(
  input: {
    organizationId: string;

    search?: string | null;

    status?:
      | EnterpriseAuditProgramStatus
      | null;

    riskPriority?:
      | EnterpriseAuditRiskPriority
      | null;

    frequency?:
      | EnterpriseAuditFrequency
      | null;

    isActive?: boolean | null;
  }
) {
  return listTenantAuditPrograms(
    input
  );
}

export async function getAuditProgramService(
  input: {
    organizationId: string;
    programId: string;
  }
) {
  const program =
    await findTenantAuditProgram(
      input
    );

  if (!program) {
    throw new Error(
      "Audit program not found in this organization."
    );
  }

  return program;
}

export async function getAuditProgramFormOptionsService(
  organizationId: string
) {
  return getAuditProgramFormOptions(
    organizationId
  );
}

export async function createAuditProgramService(
  input: AuditProgramInput
) {
  const validated =
    await validateAuditProgramInput(
      input
    );

  const program =
    await createTenantAuditProgram({
      organizationId:
        input.organizationId,

      name:
        validated.name,

      description:
        normalizeOptionalText(
          input.description
        ),

      code:
        validated.code,

      standardName:
        normalizeOptionalText(
          input.standardName
        ),

      standardVersion:
        normalizeOptionalText(
          input.standardVersion
        ),

      framework:
        normalizeOptionalText(
          input.framework
        ),

      objectives:
        normalizeOptionalText(
          input.objectives
        ),

      scope:
        normalizeOptionalText(
          input.scope
        ),

      status:
        input.status,

      frequency:
        input.frequency,

      riskPriority:
        input.riskPriority,

      effectiveFrom:
        input.effectiveFrom ||
        null,

      effectiveTo:
        input.effectiveTo ||
        null,

      ownerId:
        input.ownerId ||
        null,

      defaultProtocolId:
        input.defaultProtocolId ||
        null,

      isActive:
        input.isActive,

      siteIds:
        validated.siteIds,

      primarySiteId:
        input.primarySiteId ||
        null,

      departmentIds:
        validated.departmentIds,

      primaryDepartmentId:
        input.primaryDepartmentId ||
        null,
    });

  if (!program) {
    throw new Error(
      "The audit program could not be created."
    );
  }

  await logActivity({
    organizationId:
      input.organizationId,

    userId:
      input.userId,

    action:
      ActivityAction.CREATE,

    entityType:
      "AuditProgram",

    entityId:
      program.id,

    title:
      "Audit program created",

    description:
      `${program.name} was created as an enterprise audit program.`,

    metadata: {
      programId:
        program.id,

      programName:
        program.name,

      programCode:
        program.code,

      status:
        program.status,

      frequency:
        program.frequency,

      riskPriority:
        program.riskPriority,

      siteCount:
        program.sites.length,

      departmentCount:
        program.departments
          .length,

      defaultProtocolId:
        program.defaultProtocol
          ?.id ??
        null,

      createdAt:
        new Date().toISOString(),
    },
  });

  return program;
}

export async function updateAuditProgramService(
  input: AuditProgramInput & {
    programId: string;
  }
) {
  const existing =
    await findTenantAuditProgram({
      organizationId:
        input.organizationId,

      programId:
        input.programId,
    });

  if (!existing) {
    throw new Error(
      "Audit program not found in this organization."
    );
  }

  const validated =
    await validateAuditProgramInput({
      ...input,

      excludeProgramId:
        input.programId,
    });

  const program =
    await updateTenantAuditProgram({
      organizationId:
        input.organizationId,

      programId:
        input.programId,

      name:
        validated.name,

      description:
        normalizeOptionalText(
          input.description
        ),

      code:
        validated.code,

      standardName:
        normalizeOptionalText(
          input.standardName
        ),

      standardVersion:
        normalizeOptionalText(
          input.standardVersion
        ),

      framework:
        normalizeOptionalText(
          input.framework
        ),

      objectives:
        normalizeOptionalText(
          input.objectives
        ),

      scope:
        normalizeOptionalText(
          input.scope
        ),

      status:
        input.status,

      frequency:
        input.frequency,

      riskPriority:
        input.riskPriority,

      effectiveFrom:
        input.effectiveFrom ||
        null,

      effectiveTo:
        input.effectiveTo ||
        null,

      ownerId:
        input.ownerId ||
        null,

      defaultProtocolId:
        input.defaultProtocolId ||
        null,

      isActive:
        input.isActive,

      siteIds:
        validated.siteIds,

      primarySiteId:
        input.primarySiteId ||
        null,

      departmentIds:
        validated.departmentIds,

      primaryDepartmentId:
        input.primaryDepartmentId ||
        null,
    });

  if (!program) {
    throw new Error(
      "The audit program could not be updated."
    );
  }

  await logActivity({
    organizationId:
      input.organizationId,

    userId:
      input.userId,

    action:
      ActivityAction.UPDATE,

    entityType:
      "AuditProgram",

    entityId:
      program.id,

    title:
      "Audit program updated",

    description:
      `${program.name} was updated.`,

    metadata: {
      programId:
        program.id,

      previousStatus:
        existing.status,

      currentStatus:
        program.status,

      previousFrequency:
        existing.frequency,

      currentFrequency:
        program.frequency,

      previousRiskPriority:
        existing.riskPriority,

      currentRiskPriority:
        program.riskPriority,

      siteCount:
        program.sites.length,

      departmentCount:
        program.departments
          .length,

      updatedAt:
        new Date().toISOString(),
    },
  });

  return program;
}

export async function archiveAuditProgramService(
  input: {
    organizationId: string;
    userId: string;
    programId: string;
  }
) {
  const existing =
    await findTenantAuditProgram({
      organizationId:
        input.organizationId,

      programId:
        input.programId,
    });

  if (!existing) {
    throw new Error(
      "Audit program not found in this organization."
    );
  }

  if (
    existing.status ===
      EnterpriseAuditProgramStatus.ARCHIVED &&
    !existing.isActive
  ) {
    throw new Error(
      "This audit program is already archived."
    );
  }

  const activeSchedules =
    existing.schedules.filter(
      (schedule) =>
        schedule.status ===
          "ACTIVE" &&
        schedule.autoGenerate
    );

  if (
    activeSchedules.length > 0
  ) {
    throw new Error(
      "Pause or cancel all active automatic schedules before archiving this audit program."
    );
  }

  const program =
    await archiveTenantAuditProgram({
      organizationId:
        input.organizationId,

      programId:
        input.programId,
    });

  if (!program) {
    throw new Error(
      "The audit program could not be archived."
    );
  }

  await logActivity({
    organizationId:
      input.organizationId,

    userId:
      input.userId,

    action:
      ActivityAction.UPDATE,

    entityType:
      "AuditProgram",

    entityId:
      program.id,

    title:
      "Audit program archived",

    description:
      `${program.name} was archived and removed from active audit planning.`,

    metadata: {
      programId:
        program.id,

      previousStatus:
        existing.status,

      currentStatus:
        program.status,

      archivedAt:
        new Date().toISOString(),
    },
  });

  return program;
}
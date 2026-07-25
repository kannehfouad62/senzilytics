import {
  ActivityAction,
  MobileSessionStatus,
  PermissionKey,
  TenantInvitationStatus,
  UserRole,
  type Prisma,
} from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { getApplicationUrl, sendEmail } from "@/core/email/email.service";
import { prisma } from "@/lib/prisma";
import { validateStructureName } from "@/modules/organization/organization-structure";
import { revokeTenantMobileSessionService } from "@/modules/mobile/mobile-auth.service";

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((value) => value || null);

const tenantRoleSchema = z.enum([
  UserRole.ORG_ADMIN,
  UserRole.EHS_MANAGER,
  UserRole.SUPERVISOR,
  UserRole.EMPLOYEE,
  UserRole.AUDITOR,
]);

export const mobileTenantAdministrationActionSchema = z.discriminatedUnion(
  "action",
  [
    z.object({
      action: z.literal("CREATE_SITE"),
      name: z.string().trim().min(1).max(100),
      address: optionalText(200),
      city: optionalText(100),
      state: optionalText(100),
      country: optionalText(100),
    }),
    z.object({
      action: z.literal("UPDATE_SITE"),
      siteId: z.string().min(1).max(100),
      name: z.string().trim().min(1).max(100),
      address: optionalText(200),
      city: optionalText(100),
      state: optionalText(100),
      country: optionalText(100),
    }),
    z.object({
      action: z.literal("CREATE_DEPARTMENT"),
      siteId: z.string().min(1).max(100),
      name: z.string().trim().min(1).max(100),
    }),
    z.object({
      action: z.literal("UPDATE_DEPARTMENT"),
      departmentId: z.string().min(1).max(100),
      siteId: z.string().min(1).max(100),
      name: z.string().trim().min(1).max(100),
    }),
    z.object({
      action: z.literal("INVITE_USER"),
      name: z.string().trim().min(1).max(150),
      email: z.string().trim().email().max(254),
      role: tenantRoleSchema,
      departmentId: z.string().trim().max(100).nullable().optional(),
    }),
    z.object({
      action: z.literal("UPDATE_USER_ACCESS"),
      userId: z.string().min(1).max(100),
      role: tenantRoleSchema,
      departmentId: z.string().trim().max(100).nullable().optional(),
      jobTitle: optionalText(150),
    }),
    z.object({
      action: z.literal("SET_USER_ACTIVE"),
      userId: z.string().min(1).max(100),
      active: z.boolean(),
    }),
    z.object({
      action: z.literal("REVOKE_MOBILE_SESSION"),
      sessionId: z.string().min(1).max(100),
    }),
    z.object({
      action: z.literal("SET_WORKFLOW_ACTIVE"),
      workflowId: z.string().min(1).max(100),
      active: z.boolean(),
    }),
  ]
);

export type MobileTenantAdministrationAction = z.infer<
  typeof mobileTenantAdministrationActionSchema
>;

export class MobileTenantAdministrationError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);
  }
}

export function mobileTenantAdministrationCapabilities(
  permissions: readonly PermissionKey[]
) {
  const granted = new Set(permissions);
  const canManageOrganization = granted.has(
    PermissionKey.MANAGE_ORGANIZATION
  );
  const canManageUsers = granted.has(PermissionKey.MANAGE_USERS);
  const canManageWorkflows = granted.has(
    PermissionKey.MANAGE_WORKFLOWS
  );
  const canViewActivity = granted.has(PermissionKey.VIEW_ACTIVITY_LOG);
  const canViewIntegrationHealth = granted.has(
    PermissionKey.MANAGE_INTEGRATIONS
  );

  return {
    canManageOrganization,
    canViewConfigurationHealth: canManageOrganization,
    canViewIntegrationHealth,
    canViewUsers:
      canManageUsers || granted.has(PermissionKey.VIEW_USERS),
    canManageUsers,
    canManageWorkflows,
    canViewActivity,
  };
}

export async function getMobileTenantAdministrationWorkspace(input: {
  organizationId: string;
  permissions: readonly PermissionKey[];
}) {
  const capabilities = mobileTenantAdministrationCapabilities(
    input.permissions
  );
  if (!Object.values(capabilities).some(Boolean)) {
    throw new MobileTenantAdministrationError(
      "Your role does not include tenant administration access.",
      403,
      "forbidden"
    );
  }

  const [
    organization,
    directorySites,
    users,
    invitations,
    mobileSessions,
    workflowTemplates,
    workflowInstances,
    activityLogs,
    configurationHealth,
  ] = await Promise.all([
    capabilities.canManageOrganization
      ? prisma.organization.findUnique({
          where: { id: input.organizationId },
          select: {
            id: true,
            name: true,
            industry: true,
            address: true,
            status: true,
            allowedEmailDomains: true,
            subscriptionPlan: true,
            contractedUserMinimum: true,
            sites: {
              select: {
                id: true,
                name: true,
                address: true,
                city: true,
                state: true,
                country: true,
                departments: {
                  select: {
                    id: true,
                    name: true,
                    _count: { select: { users: true } },
                  },
                  orderBy: { name: "asc" },
                },
              },
              orderBy: { name: "asc" },
            },
            identityProviders: {
              select: {
                id: true,
                type: true,
                emailDomain: true,
                isEnabled: true,
                enforceSso: true,
                updatedAt: true,
              },
              orderBy: { type: "asc" },
            },
            _count: { select: { users: true } },
          },
        })
      : Promise.resolve(null),
    capabilities.canViewUsers
      ? prisma.site.findMany({
          where: { organizationId: input.organizationId },
          select: {
            id: true,
            name: true,
            departments: {
              select: { id: true, name: true },
              orderBy: { name: "asc" },
            },
          },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    capabilities.canViewUsers
      ? prisma.user.findMany({
          where: { organizationId: input.organizationId },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            jobTitle: true,
            isActive: true,
            invitedAt: true,
            activatedAt: true,
            lastLoginAt: true,
            department: {
              select: {
                id: true,
                name: true,
                site: { select: { id: true, name: true } },
              },
            },
            _count: {
              select: {
                mobileSessions: {
                  where: {
                    status: MobileSessionStatus.ACTIVE,
                    expiresAt: { gt: new Date() },
                  },
                },
              },
            },
          },
          orderBy: { name: "asc" },
          take: 500,
        })
      : Promise.resolve([]),
    capabilities.canManageUsers
      ? prisma.tenantInvitation.findMany({
          where: {
            organizationId: input.organizationId,
            status: TenantInvitationStatus.PENDING,
          },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            departmentId: true,
            status: true,
            expiresAt: true,
            createdAt: true,
            invitedBy: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 100,
        })
      : Promise.resolve([]),
    capabilities.canManageUsers
      ? prisma.mobileSession.findMany({
          where: {
            organizationId: input.organizationId,
            status: MobileSessionStatus.ACTIVE,
            expiresAt: { gt: new Date() },
          },
          select: {
            id: true,
            deviceName: true,
            platform: true,
            status: true,
            lastUsedAt: true,
            expiresAt: true,
            createdAt: true,
            user: { select: { id: true, name: true, email: true } },
            _count: {
              select: { pushTokens: { where: { enabled: true } } },
            },
          },
          orderBy: { lastUsedAt: "desc" },
          take: 500,
        })
      : Promise.resolve([]),
    capabilities.canManageWorkflows
      ? prisma.workflowTemplate.findMany({
          where: { organizationId: input.organizationId },
          select: {
            id: true,
            name: true,
            description: true,
            entityType: true,
            isActive: true,
            updatedAt: true,
            steps: {
              select: {
                id: true,
                name: true,
                stepType: true,
                sequence: true,
                requiredRole: true,
                slaHours: true,
              },
              orderBy: { sequence: "asc" },
            },
            _count: { select: { instances: true } },
          },
          orderBy: [{ entityType: "asc" }, { name: "asc" }],
          take: 250,
        })
      : Promise.resolve([]),
    capabilities.canManageWorkflows
      ? prisma.workflowInstance.findMany({
          where: { organizationId: input.organizationId },
          select: {
            id: true,
            entityType: true,
            entityId: true,
            status: true,
            createdAt: true,
            updatedAt: true,
            completedAt: true,
            template: { select: { id: true, name: true } },
            steps: {
              where: { status: "IN_PROGRESS" },
              select: {
                id: true,
                name: true,
                status: true,
                dueAt: true,
                assignedRole: true,
                assignedUser: { select: { id: true, name: true } },
              },
              orderBy: { sequence: "asc" },
            },
          },
          orderBy: { updatedAt: "desc" },
          take: 100,
        })
      : Promise.resolve([]),
    capabilities.canViewActivity
      ? prisma.activityLog.findMany({
          where: { organizationId: input.organizationId },
          select: {
            id: true,
            action: true,
            entityType: true,
            entityId: true,
            title: true,
            description: true,
            createdAt: true,
            user: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 200,
        })
      : Promise.resolve([]),
    getConfigurationHealth({
      organizationId: input.organizationId,
      canViewForms: capabilities.canViewConfigurationHealth,
      canViewIntegrations: capabilities.canViewIntegrationHealth,
    }),
  ]);

  return {
    tenantAdministrationGeneratedAt: new Date().toISOString(),
    tenantAdministrationCapabilities: capabilities,
    tenantOrganization: organization,
    tenantDirectorySites: directorySites,
    tenantUsers: users,
    tenantInvitations: invitations,
    tenantMobileSessions: mobileSessions,
    tenantWorkflowTemplates: workflowTemplates,
    tenantWorkflowInstances: workflowInstances,
    tenantActivityLogs: activityLogs,
    tenantConfigurationHealth: configurationHealth,
  };
}

export async function executeMobileTenantAdministrationAction(input: {
  organizationId: string;
  actorId: string;
  currentSessionId: string;
  permissions: readonly PermissionKey[];
  payload: MobileTenantAdministrationAction;
}) {
  const capabilities = mobileTenantAdministrationCapabilities(
    input.permissions
  );
  const { payload } = input;

  switch (payload.action) {
    case "CREATE_SITE":
      requireCapability(
        capabilities.canManageOrganization,
        "organization structure"
      );
      await createSite(input, payload);
      return success("Site created.");
    case "UPDATE_SITE":
      requireCapability(
        capabilities.canManageOrganization,
        "organization structure"
      );
      await updateSite(input, payload);
      return success("Site updated.");
    case "CREATE_DEPARTMENT":
      requireCapability(
        capabilities.canManageOrganization,
        "organization structure"
      );
      await createDepartment(input, payload);
      return success("Department created.");
    case "UPDATE_DEPARTMENT":
      requireCapability(
        capabilities.canManageOrganization,
        "organization structure"
      );
      await updateDepartment(input, payload);
      return success("Department updated.");
    case "INVITE_USER":
      requireCapability(capabilities.canManageUsers, "user access");
      await inviteUser(input, payload);
      return success("Invitation sent. The activation link expires in 72 hours.");
    case "UPDATE_USER_ACCESS":
      requireCapability(capabilities.canManageUsers, "user access");
      await updateUserAccess(input, payload);
      return success("User access updated.");
    case "SET_USER_ACTIVE":
      requireCapability(capabilities.canManageUsers, "user access");
      await setUserActive(input, payload);
      return success(payload.active ? "User restored." : "User suspended.");
    case "REVOKE_MOBILE_SESSION":
      requireCapability(capabilities.canManageUsers, "mobile device access");
      if (payload.sessionId === input.currentSessionId) {
        conflict(
          "Use Sign out to end the current device session. Administrators cannot revoke their active session from this screen."
        );
      }
      await revokeTenantMobileSessionService({
        sessionId: payload.sessionId,
        organizationId: input.organizationId,
        actorId: input.actorId,
      });
      return success("Mobile device session revoked.");
    case "SET_WORKFLOW_ACTIVE":
      requireCapability(capabilities.canManageWorkflows, "workflow governance");
      await setWorkflowActive(input, payload);
      return success(payload.active ? "Workflow activated." : "Workflow paused.");
  }
}

function success(message: string) {
  return { success: true as const, message };
}

function requireCapability(allowed: boolean, area: string) {
  if (!allowed) {
    throw new MobileTenantAdministrationError(
      `Your role cannot manage ${area}.`,
      403,
      "forbidden"
    );
  }
}

async function createSite(
  input: { organizationId: string; actorId: string },
  payload: Extract<MobileTenantAdministrationAction, { action: "CREATE_SITE" }>
) {
  const name = validateStructureName(payload.name, "Site name");
  await assertUniqueSite(input.organizationId, name);
  await prisma.$transaction(async (tx) => {
    const site = await tx.site.create({
      data: {
        organizationId: input.organizationId,
        name,
        address: payload.address,
        city: payload.city,
        state: payload.state,
        country: payload.country,
      },
    });
    await createActivity(tx, input, {
      action: ActivityAction.CREATE,
      entityType: "Site",
      entityId: site.id,
      title: "Site created from mobile administration",
      description: name,
    });
  });
}

async function updateSite(
  input: { organizationId: string; actorId: string },
  payload: Extract<MobileTenantAdministrationAction, { action: "UPDATE_SITE" }>
) {
  const site = await prisma.site.findFirst({
    where: { id: payload.siteId, organizationId: input.organizationId },
    select: { id: true, name: true },
  });
  if (!site) notFound("Site");
  const name = validateStructureName(payload.name, "Site name");
  await assertUniqueSite(input.organizationId, name, site.id);
  await prisma.$transaction(async (tx) => {
    await tx.site.update({
      where: { id: site.id },
      data: {
        name,
        address: payload.address,
        city: payload.city,
        state: payload.state,
        country: payload.country,
      },
    });
    await createActivity(tx, input, {
      action: ActivityAction.UPDATE,
      entityType: "Site",
      entityId: site.id,
      title: "Site updated from mobile administration",
      description: `${site.name} → ${name}`,
    });
  });
}

async function createDepartment(
  input: { organizationId: string; actorId: string },
  payload: Extract<
    MobileTenantAdministrationAction,
    { action: "CREATE_DEPARTMENT" }
  >
) {
  const site = await tenantSite(input.organizationId, payload.siteId);
  const name = validateStructureName(payload.name, "Department name");
  await assertUniqueDepartment(site.id, name);
  await prisma.$transaction(async (tx) => {
    const department = await tx.department.create({
      data: { siteId: site.id, name },
    });
    await createActivity(tx, input, {
      action: ActivityAction.CREATE,
      entityType: "Department",
      entityId: department.id,
      title: "Department created from mobile administration",
      description: `${site.name} — ${name}`,
      metadata: { siteId: site.id },
    });
  });
}

async function updateDepartment(
  input: { organizationId: string; actorId: string },
  payload: Extract<
    MobileTenantAdministrationAction,
    { action: "UPDATE_DEPARTMENT" }
  >
) {
  const [department, site] = await Promise.all([
    prisma.department.findFirst({
      where: {
        id: payload.departmentId,
        site: { organizationId: input.organizationId },
      },
      select: {
        id: true,
        name: true,
        site: { select: { id: true, name: true } },
      },
    }),
    tenantSite(input.organizationId, payload.siteId),
  ]);
  if (!department) notFound("Department");
  const name = validateStructureName(payload.name, "Department name");
  await assertUniqueDepartment(site.id, name, department.id);
  await prisma.$transaction(async (tx) => {
    await tx.department.update({
      where: { id: department.id },
      data: { siteId: site.id, name },
    });
    await createActivity(tx, input, {
      action: ActivityAction.UPDATE,
      entityType: "Department",
      entityId: department.id,
      title: "Department updated from mobile administration",
      description: `${department.site.name} — ${department.name} → ${site.name} — ${name}`,
      metadata: { previousSiteId: department.site.id, siteId: site.id },
    });
  });
}

async function inviteUser(
  input: { organizationId: string; actorId: string },
  payload: Extract<
    MobileTenantAdministrationAction,
    { action: "INVITE_USER" }
  >
) {
  const email = payload.email.toLowerCase();
  const organization = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: {
      id: true,
      name: true,
      status: true,
      allowedEmailDomains: true,
    },
  });
  if (!organization || organization.status !== "ACTIVE") {
    conflict("The tenant is not active.");
  }
  const domain = email.split("@")[1];
  if (
    organization.allowedEmailDomains.length &&
    !organization.allowedEmailDomains.includes(domain)
  ) {
    invalid("The email domain is not approved for this tenant.");
  }
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    conflict("A user with this email already exists.");
  }
  if (
    await prisma.tenantInvitation.findFirst({
      where: {
        email,
        organizationId: input.organizationId,
        status: TenantInvitationStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    })
  ) {
    conflict("An active invitation already exists for this email.");
  }
  const departmentId = payload.departmentId || null;
  if (departmentId) {
    await tenantDepartment(input.organizationId, departmentId);
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 72 * 60 * 60_000);
  await prisma.$transaction(async (tx) => {
    const invitation = await tx.tenantInvitation.create({
      data: {
        organizationId: input.organizationId,
        email,
        name: payload.name,
        role: payload.role,
        departmentId,
        tokenHash,
        expiresAt,
        invitedById: input.actorId,
      },
    });
    await createActivity(tx, input, {
      action: ActivityAction.CREATE,
      entityType: "TenantInvitation",
      entityId: invitation.id,
      title: "Tenant user invited from mobile administration",
      description: `${payload.name} (${email})`,
      metadata: { role: payload.role, departmentId },
    });
  });

  const link = `${getApplicationUrl()}/activate?token=${token}`;
  await sendEmail({
    to: email,
    subject: `You're invited to ${organization.name} on Senzilytics`,
    html: `<p>Hello ${escapeHtml(payload.name)},</p><p>You have been invited to ${escapeHtml(organization.name)} on Senzilytics.</p><p><a href="${link}">Activate your account</a></p><p>This link expires in 72 hours.</p>`,
    text: `Activate your account: ${link}`,
  });
}

async function updateUserAccess(
  input: { organizationId: string; actorId: string },
  payload: Extract<
    MobileTenantAdministrationAction,
    { action: "UPDATE_USER_ACCESS" }
  >
) {
  const user = await tenantUser(input.organizationId, payload.userId);
  if (user.id === input.actorId && user.role !== payload.role) {
    conflict("You cannot change your own tenant role.");
  }
  const departmentId = payload.departmentId || null;
  if (departmentId) {
    await tenantDepartment(input.organizationId, departmentId);
  }
  if (
    user.role === UserRole.ORG_ADMIN &&
    payload.role !== UserRole.ORG_ADMIN &&
    user.isActive
  ) {
    await assertAnotherActiveAdministrator(input.organizationId, user.id);
  }
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        role: payload.role,
        departmentId,
        jobTitle: payload.jobTitle,
        sessionVersion:
          user.role === payload.role ? undefined : { increment: 1 },
      },
    });
    if (user.role !== payload.role) {
      await revokeUserSessions(tx, input.organizationId, user.id);
    }
    await createActivity(tx, input, {
      action: ActivityAction.UPDATE,
      entityType: "User",
      entityId: user.id,
      title: "Tenant user access updated from mobile administration",
      description: `${user.name}: ${user.role} → ${payload.role}`,
      metadata: { departmentId, jobTitle: payload.jobTitle },
    });
  });
}

async function setUserActive(
  input: { organizationId: string; actorId: string },
  payload: Extract<
    MobileTenantAdministrationAction,
    { action: "SET_USER_ACTIVE" }
  >
) {
  const user = await tenantUser(input.organizationId, payload.userId);
  if (user.id === input.actorId) {
    conflict("You cannot suspend or restore your own account.");
  }
  if (!payload.active && user.role === UserRole.ORG_ADMIN && user.isActive) {
    await assertAnotherActiveAdministrator(input.organizationId, user.id);
  }
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        isActive: payload.active,
        ...(!payload.active
          ? { sessionVersion: { increment: 1 } }
          : {}),
      },
    });
    if (!payload.active) {
      await revokeUserSessions(tx, input.organizationId, user.id);
    }
    await createActivity(tx, input, {
      action: ActivityAction.STATUS_CHANGE,
      entityType: "User",
      entityId: user.id,
      title: payload.active
        ? "Tenant user restored from mobile administration"
        : "Tenant user suspended from mobile administration",
      description: user.name,
    });
  });
}

async function setWorkflowActive(
  input: { organizationId: string; actorId: string },
  payload: Extract<
    MobileTenantAdministrationAction,
    { action: "SET_WORKFLOW_ACTIVE" }
  >
) {
  const workflow = await prisma.workflowTemplate.findFirst({
    where: { id: payload.workflowId, organizationId: input.organizationId },
    select: { id: true, name: true, entityType: true, isActive: true },
  });
  if (!workflow) notFound("Workflow template");
  if (workflow.isActive === payload.active) return;

  await prisma.$transaction(async (tx) => {
    if (payload.active) {
      await tx.workflowTemplate.updateMany({
        where: {
          organizationId: input.organizationId,
          entityType: workflow.entityType,
          isActive: true,
        },
        data: { isActive: false },
      });
    }
    await tx.workflowTemplate.update({
      where: { id: workflow.id },
      data: { isActive: payload.active },
    });
    await createActivity(tx, input, {
      action: ActivityAction.STATUS_CHANGE,
      entityType: "WorkflowTemplate",
      entityId: workflow.id,
      title: payload.active
        ? "Workflow activated from mobile administration"
        : "Workflow paused from mobile administration",
      description: workflow.name,
      metadata: { entityType: workflow.entityType },
    });
  });
}

async function assertUniqueSite(
  organizationId: string,
  name: string,
  excludeId?: string
) {
  if (
    await prisma.site.findFirst({
      where: {
        organizationId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        name: { equals: name, mode: "insensitive" },
      },
      select: { id: true },
    })
  ) {
    conflict("A site with this name already exists.");
  }
}

async function assertUniqueDepartment(
  siteId: string,
  name: string,
  excludeId?: string
) {
  if (
    await prisma.department.findFirst({
      where: {
        siteId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        name: { equals: name, mode: "insensitive" },
      },
      select: { id: true },
    })
  ) {
    conflict("This site already has a department with that name.");
  }
}

async function tenantSite(organizationId: string, id: string) {
  const site = await prisma.site.findFirst({
    where: { id, organizationId },
    select: { id: true, name: true },
  });
  if (!site) notFound("Site");
  return site;
}

async function tenantDepartment(organizationId: string, id: string) {
  const department = await prisma.department.findFirst({
    where: { id, site: { organizationId } },
    select: { id: true },
  });
  if (!department) notFound("Department");
  return department;
}

async function tenantUser(organizationId: string, id: string) {
  const user = await prisma.user.findFirst({
    where: { id, organizationId },
    select: { id: true, name: true, role: true, isActive: true },
  });
  if (!user) notFound("User");
  return user;
}

async function assertAnotherActiveAdministrator(
  organizationId: string,
  excludedUserId: string
) {
  const count = await prisma.user.count({
    where: {
      organizationId,
      id: { not: excludedUserId },
      role: UserRole.ORG_ADMIN,
      isActive: true,
    },
  });
  if (!count) {
    conflict(
      "Assign another active organization administrator before changing this account."
    );
  }
}

async function revokeUserSessions(
  tx: Prisma.TransactionClient,
  organizationId: string,
  userId: string
) {
  await tx.mobileSession.updateMany({
    where: {
      organizationId,
      userId,
      status: MobileSessionStatus.ACTIVE,
    },
    data: {
      status: MobileSessionStatus.REVOKED,
      revokedAt: new Date(),
    },
  });
  await tx.mobilePushToken.updateMany({
    where: { organizationId, userId },
    data: { enabled: false },
  });
}

async function getConfigurationHealth(input: {
  organizationId: string;
  canViewForms: boolean;
  canViewIntegrations: boolean;
}) {
  const [activeForms, publishedVersions, draftVersions] = input.canViewForms
    ? await Promise.all([
        prisma.configurableFormDefinition.count({
          where: { organizationId: input.organizationId, isActive: true },
        }),
        prisma.configurableFormVersion.count({
          where: {
            definition: { organizationId: input.organizationId },
            status: "PUBLISHED",
          },
        }),
        prisma.configurableFormVersion.count({
          where: {
            definition: { organizationId: input.organizationId },
            status: "DRAFT",
          },
        }),
      ])
    : [0, 0, 0];
  const [activeApiCredentials, activeWebhooks, failedWebhookDeliveries] =
    input.canViewIntegrations
      ? await Promise.all([
          prisma.integrationApiCredential.count({
            where: {
              organizationId: input.organizationId,
              status: "ACTIVE",
            },
          }),
          prisma.integrationWebhookEndpoint.count({
            where: {
              organizationId: input.organizationId,
              status: "ACTIVE",
            },
          }),
          prisma.integrationWebhookDelivery.count({
            where: {
              organizationId: input.organizationId,
              status: { in: ["FAILED", "ABANDONED"] },
            },
          }),
        ])
      : [0, 0, 0];

  return {
    activeForms,
    publishedVersions,
    draftVersions,
    activeApiCredentials,
    activeWebhooks,
    failedWebhookDeliveries,
  };
}

async function createActivity(
  tx: Prisma.TransactionClient,
  input: { organizationId: string; actorId: string },
  data: {
    action: ActivityAction;
    entityType: string;
    entityId?: string | null;
    title: string;
    description?: string | null;
    metadata?: Prisma.InputJsonValue;
  }
) {
  await tx.activityLog.create({
    data: {
      organizationId: input.organizationId,
      userId: input.actorId,
      ...data,
    },
  });
}

function invalid(message: string): never {
  throw new MobileTenantAdministrationError(message, 400, "invalid_request");
}

function notFound(entity: string): never {
  throw new MobileTenantAdministrationError(
    `${entity} not found in this tenant.`,
    404,
    "not_found"
  );
}

function conflict(message: string): never {
  throw new MobileTenantAdministrationError(message, 409, "conflict");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character];
  });
}

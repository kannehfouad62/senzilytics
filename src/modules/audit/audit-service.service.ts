import { logActivity } from "@/core/activity-log/activity-log.service";
import { prisma } from "@/lib/prisma";
import {
  ActivityAction,
  AuditServiceClientStatus,
  AuditServiceEngagementKind,
  AuditServiceEngagementStatus,
} from "@prisma/client";
import { assertAuditServiceEngagementTransition } from "./audit-service-engagement-lifecycle";

const clean = (value: string | null | undefined, maximum = 500) => {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, maximum) : null;
};

const required = (value: string, label: string, maximum = 500) => {
  const normalized = clean(value, maximum);
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
};

const reference = (value: string | null | undefined, prefix: string) =>
  clean(value, 80)?.toUpperCase() ??
  `${prefix}-${Date.now().toString(36).toUpperCase()}`;

export async function createAuditServiceClientRecord(input: {
  organizationId: string;
  userId: string;
  reference?: string | null;
  name: string;
  legalName?: string | null;
  industry?: string | null;
  country?: string | null;
  address?: string | null;
  website?: string | null;
  notes?: string | null;
}) {
  const website = clean(input.website, 300);
  if (website && !/^https:\/\//i.test(website)) {
    throw new Error("Client website must use HTTPS.");
  }
  const client = await prisma.auditServiceClient.create({
    data: {
      organizationId: input.organizationId,
      reference: reference(input.reference, "CLIENT"),
      name: required(input.name, "Client name", 160),
      legalName: clean(input.legalName, 200),
      industry: clean(input.industry, 120),
      country: clean(input.country, 100),
      address: clean(input.address, 500),
      website,
      notes: clean(input.notes, 2000),
      createdById: input.userId,
      updatedById: input.userId,
    },
  });
  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.CREATE,
    entityType: "AuditServiceClient",
    entityId: client.id,
    title: "Audit service client created",
    description: `${client.reference} · ${client.name}`,
  });
  return client;
}

export async function addAuditServiceClientContact(input: {
  organizationId: string;
  userId: string;
  clientId: string;
  name: string;
  email: string;
  jobTitle?: string | null;
  phone?: string | null;
  isPrimary: boolean;
  isAuthorizedRepresentative: boolean;
}) {
  const client = await prisma.auditServiceClient.findFirst({
    where: { id: input.clientId, organizationId: input.organizationId },
    select: { id: true, name: true },
  });
  if (!client) throw new Error("Audit client not found.");
  const email = required(input.email, "Contact email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid contact email address.");
  }
  const contact = await prisma.$transaction(async (transaction) => {
    if (input.isPrimary) {
      await transaction.auditServiceClientContact.updateMany({
        where: { clientId: client.id },
        data: { isPrimary: false },
      });
    }
    return transaction.auditServiceClientContact.create({
      data: {
        clientId: client.id,
        name: required(input.name, "Contact name", 160),
        email,
        jobTitle: clean(input.jobTitle, 120),
        phone: clean(input.phone, 50),
        isPrimary: input.isPrimary,
        isAuthorizedRepresentative: input.isAuthorizedRepresentative,
      },
    });
  });
  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.CREATE,
    entityType: "AuditServiceClientContact",
    entityId: contact.id,
    title: "Audit client contact added",
    description: `${client.name} · ${contact.name}`,
    metadata: {
      clientId: client.id,
      isPrimary: contact.isPrimary,
      isAuthorizedRepresentative: contact.isAuthorizedRepresentative,
    },
  });
  return contact;
}

export async function createAuditServiceEngagementRecord(input: {
  organizationId: string;
  userId: string;
  reference?: string | null;
  title: string;
  kind: AuditServiceEngagementKind;
  clientId?: string | null;
  purpose: string;
  scope: string;
  objectives?: string | null;
  criteria?: string | null;
  externalContractReference?: string | null;
  ownerId?: string | null;
  managerId?: string | null;
  leadAuditorId?: string | null;
  plannedStartDate?: Date | null;
  plannedEndDate?: Date | null;
  dueDate?: Date | null;
}) {
  const clientId = clean(input.clientId, 100);
  if (input.kind === AuditServiceEngagementKind.EXTERNAL && !clientId) {
    throw new Error("External engagements require an audit client.");
  }
  if (input.kind === AuditServiceEngagementKind.INTERNAL && clientId) {
    throw new Error(
      "Internal engagements cannot be assigned to an external client.",
    );
  }
  if (
    clientId &&
    !(await prisma.auditServiceClient.findFirst({
      where: {
        id: clientId,
        organizationId: input.organizationId,
        status: { not: "ARCHIVED" },
      },
      select: { id: true },
    }))
  )
    throw new Error("Select an active audit client in this tenant.");

  const userIds = [input.ownerId, input.managerId, input.leadAuditorId].filter(
    Boolean,
  ) as string[];
  if (userIds.length) {
    const matched = await prisma.user.count({
      where: {
        id: { in: [...new Set(userIds)] },
        organizationId: input.organizationId,
        isActive: true,
      },
    });
    if (matched !== new Set(userIds).size)
      throw new Error("Select active team members in this tenant.");
  }
  if (
    input.plannedStartDate &&
    input.plannedEndDate &&
    input.plannedEndDate < input.plannedStartDate
  ) {
    throw new Error("Planned end date cannot precede the start date.");
  }

  const engagement = await prisma.auditServiceEngagement.create({
    data: {
      organizationId: input.organizationId,
      clientId,
      reference: reference(input.reference, "ENG"),
      title: required(input.title, "Engagement title", 200),
      kind: input.kind,
      purpose: required(input.purpose, "Engagement purpose", 2000),
      scope: required(input.scope, "Engagement scope", 4000),
      objectives: clean(input.objectives, 4000),
      criteria: clean(input.criteria, 4000),
      externalContractReference: clean(input.externalContractReference, 160),
      ownerId: clean(input.ownerId, 100),
      managerId: clean(input.managerId, 100),
      leadAuditorId: clean(input.leadAuditorId, 100),
      plannedStartDate: input.plannedStartDate,
      plannedEndDate: input.plannedEndDate,
      dueDate: input.dueDate,
      createdById: input.userId,
      updatedById: input.userId,
    },
  });
  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.CREATE,
    entityType: "AuditServiceEngagement",
    entityId: engagement.id,
    title: "Audit service engagement created",
    description: `${engagement.reference} · ${engagement.title}`,
    metadata: { kind: engagement.kind, clientId: engagement.clientId },
  });
  return engagement;
}

export async function changeAuditServiceEngagementStatus(input: {
  organizationId: string;
  userId: string;
  engagementId: string;
  status: AuditServiceEngagementStatus;
  cancellationReason?: string | null;
}) {
  const engagement = await prisma.auditServiceEngagement.findFirst({
    where: { id: input.engagementId, organizationId: input.organizationId },
    include: { _count: { select: { teamMembers: true } } },
  });
  if (!engagement) throw new Error("Audit engagement not found.");
  assertAuditServiceEngagementTransition(engagement.status, input.status);
  if (input.status === AuditServiceEngagementStatus.READY) {
    if (engagement.planningStatus !== "APPROVED")
      throw new Error(
        "Approve the governed audit plan before engagement readiness.",
      );
    if (
      !engagement.managerId ||
      !engagement.leadAuditorId ||
      !engagement.plannedStartDate ||
      !engagement.dueDate
    ) {
      throw new Error(
        "Ready engagements require a manager, lead auditor, planned start date, and due date.",
      );
    }
    if (engagement._count.teamMembers < 1)
      throw new Error(
        "Assign at least one engagement team member before readiness.",
      );
  }
  const cancellationReason = clean(input.cancellationReason, 1000);
  if (
    input.status === AuditServiceEngagementStatus.CANCELLED &&
    !cancellationReason
  ) {
    throw new Error("A cancellation reason is required.");
  }
  const now = new Date();
  const updated = await prisma.auditServiceEngagement.update({
    where: { id: engagement.id },
    data: {
      status: input.status,
      updatedById: input.userId,
      startedAt:
        input.status === AuditServiceEngagementStatus.IN_PROGRESS &&
        !engagement.startedAt
          ? now
          : undefined,
      completedAt:
        input.status === AuditServiceEngagementStatus.COMPLETED
          ? now
          : undefined,
      cancelledAt:
        input.status === AuditServiceEngagementStatus.CANCELLED
          ? now
          : undefined,
      cancellationReason:
        input.status === AuditServiceEngagementStatus.CANCELLED
          ? cancellationReason
          : undefined,
    },
  });
  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.UPDATE,
    entityType: "AuditServiceEngagement",
    entityId: engagement.id,
    title: "Audit engagement status changed",
    description: `${engagement.status} → ${updated.status}`,
    metadata: { from: engagement.status, to: updated.status },
  });
  return updated;
}

export async function addAuditServiceEngagementTeamMember(input: {
  organizationId: string;
  userId: string;
  engagementId: string;
  memberUserId: string;
  role: import("@prisma/client").AuditServiceEngagementTeamRole;
}) {
  const [engagement, member] = await Promise.all([
    prisma.auditServiceEngagement.findFirst({
      where: { id: input.engagementId, organizationId: input.organizationId },
      select: { id: true, status: true },
    }),
    prisma.user.findFirst({
      where: {
        id: input.memberUserId,
        organizationId: input.organizationId,
        isActive: true,
      },
      select: { id: true, name: true },
    }),
  ]);
  if (!engagement) throw new Error("Audit engagement not found.");
  if (!member) throw new Error("Select an active tenant user.");
  if (
    engagement.status === AuditServiceEngagementStatus.COMPLETED ||
    engagement.status === AuditServiceEngagementStatus.CANCELLED
  ) {
    throw new Error("A terminal engagement team cannot be changed.");
  }
  const assignment = await prisma.auditServiceEngagementTeamMember.upsert({
    where: {
      engagementId_userId: { engagementId: engagement.id, userId: member.id },
    },
    create: {
      engagementId: engagement.id,
      userId: member.id,
      role: input.role,
    },
    update: { role: input.role, declinedAt: null },
  });
  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.UPDATE,
    entityType: "AuditServiceEngagementTeamMember",
    entityId: assignment.id,
    title: "Audit engagement team updated",
    description: `${member.name} · ${assignment.role}`,
    metadata: { engagementId: engagement.id, memberUserId: member.id },
  });
  return assignment;
}

export async function findAuditServiceWorkspace(
  organizationId: string,
  query?: string,
) {
  const search = clean(query, 120);
  const [clients, engagements] = await Promise.all([
    prisma.auditServiceClient.findMany({
      where: {
        organizationId,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { reference: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: {
        contacts: {
          where: { isActive: true },
          orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
        },
        _count: { select: { engagements: true } },
      },
      orderBy: { name: "asc" },
      take: 100,
    }),
    prisma.auditServiceEngagement.findMany({
      where: {
        organizationId,
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: "insensitive" } },
                { reference: { contains: search, mode: "insensitive" } },
                { client: { name: { contains: search, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: {
        client: true,
        manager: { select: { name: true } },
        leadAuditor: { select: { name: true } },
        teamMembers: { include: { user: { select: { name: true } } } },
        _count: { select: { audits: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  ]);
  return { clients, engagements };
}

export async function changeAuditServiceClientStatus(input: {
  organizationId: string;
  userId: string;
  clientId: string;
  status: AuditServiceClientStatus;
}) {
  const client = await prisma.auditServiceClient.findFirst({
    where: { id: input.clientId, organizationId: input.organizationId },
  });
  if (!client) throw new Error("Audit client not found.");
  if (client.status === AuditServiceClientStatus.ARCHIVED)
    throw new Error("An archived audit client cannot be reopened.");
  if (input.status === AuditServiceClientStatus.ARCHIVED) {
    const open = await prisma.auditServiceEngagement.count({
      where: {
        clientId: client.id,
        organizationId: input.organizationId,
        status: {
          notIn: [
            AuditServiceEngagementStatus.COMPLETED,
            AuditServiceEngagementStatus.CANCELLED,
          ],
        },
      },
    });
    if (open)
      throw new Error(
        "Complete or cancel all open client engagements before archival.",
      );
  }
  const updated = await prisma.auditServiceClient.update({
    where: { id: client.id },
    data: { status: input.status, updatedById: input.userId },
  });
  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.UPDATE,
    entityType: "AuditServiceClient",
    entityId: client.id,
    title: "Audit client status changed",
    description: `${client.status} → ${updated.status}`,
  });
  return updated;
}

export async function linkEnterpriseAuditToEngagement(input: {
  organizationId: string;
  userId: string;
  engagementId: string;
  auditId: string;
}) {
  const [engagement, audit] = await Promise.all([
    prisma.auditServiceEngagement.findFirst({
      where: { id: input.engagementId, organizationId: input.organizationId },
      select: { id: true, reference: true, status: true },
    }),
    prisma.enterpriseAudit.findFirst({
      where: { id: input.auditId, organizationId: input.organizationId },
      select: { id: true, reference: true, engagementId: true },
    }),
  ]);
  if (!engagement) throw new Error("Audit engagement not found.");
  if (!audit) throw new Error("Enterprise audit not found.");
  if (
    engagement.status === AuditServiceEngagementStatus.COMPLETED ||
    engagement.status === AuditServiceEngagementStatus.CANCELLED
  )
    throw new Error("Audits cannot be linked to a terminal engagement.");
  if (audit.engagementId && audit.engagementId !== engagement.id)
    throw new Error("This audit is already linked to another engagement.");
  await prisma.enterpriseAudit.update({
    where: { id: audit.id },
    data: { engagementId: engagement.id, updatedById: input.userId },
  });
  await logActivity({
    organizationId: input.organizationId,
    userId: input.userId,
    action: ActivityAction.UPDATE,
    entityType: "AuditServiceEngagement",
    entityId: engagement.id,
    title: "Enterprise audit linked to engagement",
    description: `${audit.reference} → ${engagement.reference}`,
    metadata: { auditId: audit.id },
  });
}

export function findAuditServiceClient(
  organizationId: string,
  clientId: string,
) {
  return prisma.auditServiceClient.findFirst({
    where: { id: clientId, organizationId },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { name: "asc" }] },
      engagements: {
        include: {
          manager: { select: { name: true } },
          leadAuditor: { select: { name: true } },
          _count: { select: { audits: true } },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });
}

export function findAuditServiceEngagement(
  organizationId: string,
  engagementId: string,
) {
  return prisma.auditServiceEngagement.findFirst({
    where: { id: engagementId, organizationId },
    include: {
      client: {
        include: {
          contacts: {
            where: { isActive: true },
            orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
          },
        },
      },
      owner: { select: { name: true } },
      manager: { select: { name: true } },
      leadAuditor: { select: { name: true } },
      teamMembers: {
        include: { user: { select: { name: true, email: true } } },
        orderBy: { assignedAt: "asc" },
      },
      audits: {
        include: {
          site: { select: { name: true } },
          sections: {
            orderBy: { sequence: "asc" },
            include: {
              questions: {
                orderBy: { sequence: "asc" },
                select: { id: true, sequence: true, questionText: true },
              },
            },
          },
          findings: {
            select: { id: true, reference: true, title: true, status: true },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      independenceDeclarations: {
        include: {
          user: { select: { name: true, email: true } },
          reviewedBy: { select: { name: true } },
        },
        orderBy: { declaredAt: "desc" },
      },
      informationRequests: {
        include: {
          contact: { select: { name: true, email: true } },
          owner: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      meetings: {
        include: {
          chairedBy: { select: { name: true } },
          attendees: {
            include: {
              user: { select: { name: true } },
              contact: { select: { name: true } },
            },
          },
        },
        orderBy: { scheduledAt: "desc" },
      },
      externalAccesses: {
        include: {
          contact: { select: { name: true, email: true } },
          informationRequest: { select: { reference: true, title: true } },
          decision: true,
          findingResponse: {
            include: {
              reviewedBy: { select: { name: true } },
              correctiveAction: { select: { id: true, title: true, status: true } },
            },
          },
          _count: { select: { comments: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      deliverables: {
        include: {
          createdBy: { select: { name: true } },
          reviewedBy: { select: { name: true } },
          approvedBy: { select: { name: true } },
          releasedBy: { select: { name: true } },
          sourceAudit: { select: { reference: true, title: true } },
        },
        orderBy: [{ reference: "asc" }, { version: "desc" }],
      },
    },
  });
}

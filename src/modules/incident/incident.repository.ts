import { prisma } from "@/lib/prisma";
import {
  IncidentType,
  RiskLevel,
  Status,
  Prisma,
} from "@prisma/client";

export async function findTenantIncidentById(
  incidentId: string,
  organizationId: string
) {
  return prisma.incident.findFirst({
    where: {
      id: incidentId,
      site: {
        organizationId,
      },
    },
    include: {
      site: true,
      reportedBy: true,
      investigation: {
        include: {
          assignedTo: true,
        },
      },
      actions: {
        include: {
          assignedTo: true,
        },
        orderBy: {
          dueDate: "asc",
        },
      },
    },
  });
}

export async function createTenantIncident(input: {
  title: string;
  description: string;
  type: IncidentType;
  riskLevel: RiskLevel;
  location: string;
  siteId: string;
  reportedById: string;
},db:Pick<Prisma.TransactionClient,"incident">=prisma) {
  return db.incident.create({
    data: {
      title: input.title,
      description: input.description,
      type: input.type,
      riskLevel: input.riskLevel,
      status: Status.OPEN,
      location: input.location,
      occurredAt: new Date(),
      siteId: input.siteId,
      reportedById: input.reportedById,
    },
  });
}

export async function updateTenantIncidentStatus(input: {
  incidentId: string;
  status: Status;
}) {
  return prisma.incident.update({
    where: {
      id: input.incidentId,
    },
    data: {
      status: input.status,
    },
  });
}

export async function createTenantCorrectiveAction(input: {
  title: string;
  description: string;
  riskLevel: RiskLevel;
  dueDate: Date;
  incidentId: string;
  assignedToId: string;
}) {
  return prisma.correctiveAction.create({
    data: {
      title: input.title,
      description: input.description,
      riskLevel: input.riskLevel,
      status: Status.OPEN,
      dueDate: input.dueDate,
      incidentId: input.incidentId,
      assignedToId: input.assignedToId,
    },
  });
}

export async function findTenantCorrectiveAction(input: {
  actionId: string;
  incidentId: string;
  organizationId: string;
}) {
  return prisma.correctiveAction.findFirst({
    where: {
      id: input.actionId,
      incident: {
        id: input.incidentId,
        site: {
          organizationId: input.organizationId,
        },
      },
    },
  });
}

export async function updateTenantCorrectiveActionStatus(input: {
  actionId: string;
  status: Status;
}) {
  return prisma.correctiveAction.update({
    where: {
      id: input.actionId,
    },
    data: {
      status: input.status,
    },
  });
}

export async function upsertTenantInvestigation(input: {
  incidentId: string;
  summary: string;
  rootCause: string;
  immediateCause: string;
  contributingFactors: string;
  assignedToId: string;
  dueDate: Date;
}) {
  return prisma.investigation.upsert({
    where: {
      incidentId: input.incidentId,
    },
    update: {
      summary: input.summary,
      rootCause: input.rootCause,
      immediateCause: input.immediateCause,
      contributingFactors:
        input.contributingFactors,
      status: Status.IN_PROGRESS,
      assignedToId: input.assignedToId,
      dueDate: input.dueDate,
    },
    create: {
      incidentId: input.incidentId,
      summary: input.summary,
      rootCause: input.rootCause,
      immediateCause: input.immediateCause,
      contributingFactors:
        input.contributingFactors,
      status: Status.IN_PROGRESS,
      assignedToId: input.assignedToId,
      dueDate: input.dueDate,
    },
  });
}

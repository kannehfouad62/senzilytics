import {
  PermissionKey,
  Status,
  UserRole,
  WorkflowEntityType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

const capaPermissions = [
  PermissionKey.CREATE_CAPA,
  PermissionKey.UPDATE_CAPA,
  PermissionKey.CLOSE_CAPA,
  PermissionKey.VIEW_REPORTS,
] as const;

export function mobileWorkflowEntityHref(
  entityType: WorkflowEntityType,
  entityId: string
) {
  const prefix: Partial<Record<WorkflowEntityType, string>> = {
    [WorkflowEntityType.INCIDENT]: "/incidents",
    [WorkflowEntityType.CORRECTIVE_ACTION]: "/actions",
    [WorkflowEntityType.AUDIT]: "/audits",
    [WorkflowEntityType.INSPECTION]: "/inspections",
    [WorkflowEntityType.COMPLIANCE]: "/compliance",
    [WorkflowEntityType.DOCUMENT]: "/documents",
    [WorkflowEntityType.PERMIT]: "/compliance/permits",
    [WorkflowEntityType.CHEMICAL]: "/chemicals",
    [WorkflowEntityType.MOC]: "/moc",
    [WorkflowEntityType.OBSERVATION]: "/observations",
    [WorkflowEntityType.RISK]: "/risks",
  };
  const base = prefix[entityType];
  if (!base) return entityType === WorkflowEntityType.TRAINING ? "/training" : null;
  return `${base}/${entityId}`;
}

export function mobileCapaCapabilities(permissions: readonly PermissionKey[]) {
  const granted = new Set(permissions);
  const canUpdate = granted.has(PermissionKey.UPDATE_CAPA);
  const canClose = granted.has(PermissionKey.CLOSE_CAPA);
  return {
    canView: capaPermissions.some((permission) => granted.has(permission)),
    canUpdate,
    canClose,
    allowedStatuses: canClose
      ? Object.values(Status)
      : canUpdate
        ? Object.values(Status).filter(
            (status) => status !== Status.COMPLETED && status !== Status.CLOSED
          )
        : [],
  };
}

export async function getMobileActionCenter(input: {
  organizationId: string;
  userId: string;
  userRole: UserRole;
  permissions: readonly PermissionKey[];
}) {
  const capabilities = mobileCapaCapabilities(input.permissions);
  const [taskRecords, capaRecords] = await Promise.all([
    prisma.workflowInstanceStep.findMany({
      where: {
        status: "IN_PROGRESS",
        instance: {
          organizationId: input.organizationId,
          status: "ACTIVE",
        },
        OR: [
          { assignedUserId: input.userId },
          { assignedUserId: null, assignedRole: input.userRole },
          { assignedUserId: null, assignedRole: null },
        ],
      },
      select: {
        id: true,
        name: true,
        stepType: true,
        assignedRole: true,
        dueAt: true,
        status: true,
        startedAt: true,
        instance: {
          select: {
            entityType: true,
            entityId: true,
            template: { select: { name: true } },
          },
        },
      },
      orderBy: { dueAt: { sort: "asc", nulls: "last" } },
      take: 50,
    }),
    capabilities.canView
      ? prisma.correctiveAction.findMany({
          where: { assignedTo: { organizationId: input.organizationId } },
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            riskLevel: true,
            dueDate: true,
            assignedToId: true,
            assignedTo: { select: { id: true, name: true } },
            incident: { select: { id: true, title: true } },
            auditFinding: {
              select: {
                audit: { select: { id: true, title: true } },
              },
            },
            inspectionFinding: {
              select: {
                inspection: { select: { id: true, title: true } },
              },
            },
            enterpriseAuditFindingLinks: {
              select: {
                finding: {
                  select: {
                    audit: { select: { id: true, title: true } },
                  },
                },
              },
              take: 1,
            },
            criticalControlVerifications: {
              select: { controlId: true, control: { select: { name: true } } },
              take: 1,
            },
            certificationReviewActions: {
              select: {
                reviewId: true,
                review: { select: { program: { select: { name: true } } } },
              },
              take: 1,
            },
            assetDefects: {
              select: {
                assetId: true,
                title: true,
                asset: { select: { reference: true } },
              },
              take: 1,
            },
            behaviorSessions: {
              select: {
                id: true,
                reference: true,
                program: { select: { name: true } },
              },
              take: 1,
            },
            regulatoryChangeLinks: {
              select: {
                changeId: true,
                change: { select: { reference: true, title: true } },
              },
              take: 1,
            },
          },
          orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
          take: 50,
        })
      : Promise.resolve([]),
  ]);

  return {
    capabilities,
    tasks: taskRecords.map((task) => ({
      ...task,
      href: mobileWorkflowEntityHref(
        task.instance.entityType,
        task.instance.entityId
      ),
    })),
    correctiveActions: capaRecords.map((action) => ({
      id: action.id,
      title: action.title,
      description: action.description,
      status: action.status,
      riskLevel: action.riskLevel,
      dueDate: action.dueDate,
      assignedTo: action.assignedTo,
      isAssignedToCurrentUser: action.assignedToId === input.userId,
      source: mobileCapaSource(action),
    })),
  };
}

type MobileCapaSourceInput = {
  incident: { id: string; title: string } | null;
  auditFinding: { audit: { id: string; title: string } } | null;
  inspectionFinding: {
    inspection: { id: string; title: string };
  } | null;
  enterpriseAuditFindingLinks: Array<{
    finding: { audit: { id: string; title: string } };
  }>;
  criticalControlVerifications: Array<{
    controlId: string;
    control: { name: string };
  }>;
  certificationReviewActions: Array<{
    reviewId: string;
    review: { program: { name: string } };
  }>;
  assetDefects: Array<{
    assetId: string;
    title: string;
    asset: { reference: string };
  }>;
  behaviorSessions: Array<{
    id: string;
    reference: string;
    program: { name: string };
  }>;
  regulatoryChangeLinks: Array<{
    changeId: string;
    change: { reference: string; title: string };
  }>;
};

export function mobileCapaSource(action: MobileCapaSourceInput) {
  if (action.incident) {
    return {
      type: "Incident",
      label: action.incident.title,
      href: `/incidents/${action.incident.id}`,
    };
  }
  if (action.auditFinding) {
    return {
      type: "Audit",
      label: action.auditFinding.audit.title,
      href: `/audits/${action.auditFinding.audit.id}`,
    };
  }
  if (action.inspectionFinding) {
    return {
      type: "Inspection",
      label: action.inspectionFinding.inspection.title,
      href: `/inspections/${action.inspectionFinding.inspection.id}`,
    };
  }
  const enterpriseAudit = action.enterpriseAuditFindingLinks[0];
  if (enterpriseAudit) {
    return {
      type: "Audit",
      label: enterpriseAudit.finding.audit.title,
      href: `/audits/${enterpriseAudit.finding.audit.id}`,
    };
  }
  const criticalControl = action.criticalControlVerifications[0];
  if (criticalControl) {
    return {
      type: "Critical control",
      label: criticalControl.control.name,
      href: `/assurance/sif/controls/${criticalControl.controlId}`,
    };
  }
  const managementReview = action.certificationReviewActions[0];
  if (managementReview) {
    return {
      type: "Management review",
      label: managementReview.review.program.name,
      href: `/assurance/certification/reviews/${managementReview.reviewId}`,
    };
  }
  const assetDefect = action.assetDefects[0];
  if (assetDefect) {
    return {
      type: "Asset defect",
      label: `${assetDefect.asset.reference} — ${assetDefect.title}`,
      href: `/assets/${assetDefect.assetId}`,
    };
  }
  const behaviorSession = action.behaviorSessions[0];
  if (behaviorSession) {
    return {
      type: "Behavior coaching",
      label: `${behaviorSession.reference} — ${behaviorSession.program.name}`,
      href: `/behavior-safety/sessions/${behaviorSession.id}`,
    };
  }
  const regulatoryChange = action.regulatoryChangeLinks[0];
  if (regulatoryChange) {
    return {
      type: "Regulatory change",
      label: `${regulatoryChange.change.reference} — ${regulatoryChange.change.title}`,
      href: `/compliance/regulatory/changes/${regulatoryChange.changeId}`,
    };
  }
  return { type: "Standalone", label: "Standalone CAPA", href: "/actions" };
}

import { PermissionKey } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function hasAny(permissions: readonly PermissionKey[], required: readonly PermissionKey[]) {
  const granted = new Set(permissions);
  return required.some((permission) => granted.has(permission));
}

function pathParts(link: string) {
  try {
    const pathname = /^https?:\/\//i.test(link) ? new URL(link).pathname : link;
    return pathname.split("?")[0].split("#")[0].split("/").filter(Boolean).map(decodeURIComponent);
  } catch {
    return [];
  }
}

export async function canOpenMobileNotificationDestination(input: {
  link: string | null;
  organizationId: string;
  userId: string;
  permissions: readonly PermissionKey[];
}) {
  const parts = pathParts(input.link ?? "");
  if (!parts.length) return false;
  const id = parts.at(-1);
  if (!id || id === "new") return false;
  const { organizationId, permissions } = input;

  switch (parts[0]) {
    case "incidents":
      return hasAny(permissions, [PermissionKey.VIEW_INCIDENT, PermissionKey.UPDATE_INCIDENT]) &&
        Boolean(await prisma.incident.findFirst({ where: { id, site: { organizationId } }, select: { id: true } }));
    case "observations":
      return hasAny(permissions, [PermissionKey.VIEW_OBSERVATIONS, PermissionKey.MANAGE_OBSERVATIONS]) &&
        Boolean(await prisma.safetyObservation.findFirst({ where: { id, organizationId }, select: { id: true } }));
    case "actions":
      return hasAny(permissions, [PermissionKey.UPDATE_CAPA, PermissionKey.CLOSE_CAPA, PermissionKey.VIEW_REPORTS]) &&
        Boolean(await prisma.correctiveAction.findFirst({ where: { id, assignedTo: { organizationId } }, select: { id: true } }));
    case "audits":
      return permissions.includes(PermissionKey.VIEW_AUDITS) &&
        Boolean(await prisma.enterpriseAudit.findFirst({ where: { id, organizationId }, select: { id: true } }));
    case "inspections":
      return permissions.includes(PermissionKey.VIEW_INSPECTIONS) &&
        Boolean(await prisma.inspection.findFirst({ where: { id, site: { organizationId } }, select: { id: true } }));
    case "risks":
      if (parts[1] === "jsa" || parts[1] === "jha") {
        return permissions.includes(PermissionKey.VIEW_RISKS) &&
          Boolean(await prisma.jobSafetyAnalysis.findFirst({ where: { id, organizationId }, select: { id: true } }));
      }
      return permissions.includes(PermissionKey.VIEW_RISKS) &&
        Boolean(await prisma.risk.findFirst({ where: { id, organizationId }, select: { id: true } }));
    case "jsa":
    case "jha":
      return permissions.includes(PermissionKey.VIEW_RISKS) &&
        Boolean(await prisma.jobSafetyAnalysis.findFirst({ where: { id, organizationId }, select: { id: true } }));
    case "moc":
      return permissions.includes(PermissionKey.VIEW_MOC) &&
        Boolean(await prisma.managementOfChange.findFirst({ where: { id, organizationId }, select: { id: true } }));
    case "permits-to-work":
      return permissions.includes(PermissionKey.VIEW_PERMITS_TO_WORK) &&
        Boolean(await prisma.permitToWork.findFirst({ where: { id, organizationId }, select: { id: true } }));
    case "assets":
      return permissions.includes(PermissionKey.VIEW_ASSETS) &&
        Boolean(await prisma.asset.findFirst({ where: { id, organizationId }, select: { id: true } }));
    case "contractors":
      return permissions.includes(PermissionKey.VIEW_CONTRACTORS) &&
        Boolean(await prisma.contractor.findFirst({ where: { id, organizationId }, select: { id: true } }));
    case "industrial-hygiene":
      return permissions.includes(PermissionKey.VIEW_INDUSTRIAL_HYGIENE) &&
        Boolean(await prisma.exposureAssessment.findFirst({ where: { id, organizationId }, select: { id: true } }));
    case "occupational-health":
      return permissions.includes(PermissionKey.VIEW_OCCUPATIONAL_HEALTH) &&
        Boolean(await prisma.medicalSurveillanceProgram.findFirst({ where: { id, organizationId }, select: { id: true } }));
    case "chemicals":
      return permissions.includes(PermissionKey.VIEW_CHEMICALS) &&
        Boolean(await prisma.chemical.findFirst({ where: { id, organizationId }, select: { id: true } }));
    case "esg":
      if (parts[1] === "initiatives") {
        return permissions.includes(PermissionKey.VIEW_ESG) &&
          Boolean(await prisma.esgInitiative.findFirst({ where: { id, organizationId }, select: { id: true } }));
      }
      return permissions.includes(PermissionKey.VIEW_ESG) &&
        Boolean(await prisma.esgDisclosurePeriod.findFirst({ where: { id, organizationId }, select: { id: true } }));
    case "regulatory":
      if (parts[1] === "sources") {
        return permissions.includes(PermissionKey.VIEW_COMPLIANCE) &&
          Boolean(await prisma.regulatorySource.findFirst({ where: { id, organizationId }, select: { id: true } }));
      }
      return permissions.includes(PermissionKey.VIEW_COMPLIANCE) &&
        Boolean(await prisma.regulatoryChange.findFirst({ where: { id, organizationId }, select: { id: true } }));
    case "compliance":
      if (parts[1] === "calendar") {
        return permissions.includes(PermissionKey.VIEW_COMPLIANCE) &&
          Boolean(await prisma.complianceCalendarOccurrence.findFirst({ where: { id, organizationId }, select: { id: true } }));
      }
      if (parts[1] === "permits") {
        return permissions.includes(PermissionKey.VIEW_PERMITS_TO_WORK) &&
          Boolean(await prisma.permitToWork.findFirst({ where: { id, organizationId }, select: { id: true } }));
      }
      if (parts[1] === "regulatory" && parts[2] === "changes") {
        return permissions.includes(PermissionKey.VIEW_COMPLIANCE) &&
          Boolean(await prisma.regulatoryChange.findFirst({ where: { id, organizationId }, select: { id: true } }));
      }
      if (parts[1] === "regulatory" && parts[2] === "sources") {
        return permissions.includes(PermissionKey.VIEW_COMPLIANCE) &&
          Boolean(await prisma.regulatorySource.findFirst({ where: { id, organizationId }, select: { id: true } }));
      }
      return permissions.includes(PermissionKey.VIEW_COMPLIANCE) &&
        Boolean(await prisma.complianceItem.findFirst({ where: { id, site: { organizationId } }, select: { id: true } }));
    case "training":
      return permissions.includes(PermissionKey.VIEW_TRAINING) &&
        Boolean(await prisma.trainingRecord.findFirst({ where: { id, user: { organizationId } }, select: { id: true } }));
    case "documents":
      return permissions.includes(PermissionKey.MANAGE_DOCUMENTS) &&
        Boolean(await prisma.document.findFirst({ where: { id, organizationId, deletedAt: null }, select: { id: true } }));
    default:
      return false;
  }
}

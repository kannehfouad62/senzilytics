import { hasAuditServicesEntitlement } from "@/core/navigation/tenant-module-catalog";
import { prisma } from "@/lib/prisma";

export async function organizationHasAuditServices(organizationId: string) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      industryCategory: true,
      moduleAssignments: {
        where: { moduleKey: "AUDIT_SERVICES" },
        select: { moduleKey: true, enabled: true },
      },
    },
  });

  return Boolean(
    organization &&
      hasAuditServicesEntitlement(
        organization.industryCategory,
        organization.moduleAssignments,
      ),
  );
}

export async function requireAuditServicesEntitlement(organizationId: string) {
  if (!(await organizationHasAuditServices(organizationId))) {
    throw new Error("Audit & Assurance Services is not assigned to this tenant.");
  }
}

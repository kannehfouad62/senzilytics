import { getCurrentUserPermissions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { ConfigurableFormModule, PermissionKey } from "@prisma/client";
import { redirect } from "next/navigation";

export async function requireFormDefinitionManagement(definitionId: string) {
  const [{ organizationId, user }, permissions] = await Promise.all([getCurrentUserTenant(), getCurrentUserPermissions()]);
  const definition = await prisma.configurableFormDefinition.findFirst({ where: { id: definitionId, organizationId }, select: { id: true, module: true } });
  if (!definition) throw new Error("Form not found.");
  const allowed = permissions.includes(PermissionKey.MANAGE_ORGANIZATION) || (definition.module === ConfigurableFormModule.RESEARCH && permissions.includes(PermissionKey.DESIGN_RESEARCH_QUESTIONNAIRES));
  if (!allowed) redirect("/unauthorized");
  return { organizationId, user, permissions, definition };
}

"use server";

import type { FormActionState } from "@/core/actions/action-state";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { validateStructureName } from "@/modules/organization/organization-structure";
import { ActivityAction, PermissionKey } from "@prisma/client";
import { revalidatePath } from "next/cache";

const field = (data: FormData, key: string) =>
  String(data.get(key) || "").trim();

const requiredId = (data: FormData, key: string) => {
  const value = field(data, key);
  if (!value) throw new Error(`${key} is required.`);
  return value;
};

const optionalField = (data: FormData, key: string, maxLength = 200) => {
  const value = field(data, key);
  if (value.length > maxLength) {
    throw new Error(`${key} must be ${maxLength} characters or fewer.`);
  }
  return value || null;
};

const failure = (cause: unknown, fallback: string): FormActionState => ({
  status: "ERROR",
  message: cause instanceof Error ? cause.message : fallback,
});

function revalidateStructurePages() {
  revalidatePath("/organizations");
  revalidatePath("/users");
}

export async function createTenantSite(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_ORGANIZATION);
  const { organizationId, user } = await getCurrentUserTenant();

  try {
    const name = validateStructureName(field(data, "name"), "Site name");
    const duplicate = await prisma.site.findFirst({
      where: { organizationId, name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    if (duplicate) throw new Error("A site with this name already exists.");

    await prisma.$transaction(async (tx) => {
      const site = await tx.site.create({
        data: {
          organizationId,
          name,
          address: optionalField(data, "address"),
          city: optionalField(data, "city", 100),
          state: optionalField(data, "state", 100),
          country: optionalField(data, "country", 100),
        },
      });
      await tx.activityLog.create({
        data: {
          organizationId,
          userId: user.id,
          action: ActivityAction.CREATE,
          entityType: "Site",
          entityId: site.id,
          title: "Site created",
          description: name,
        },
      });
    });
  } catch (cause) {
    return failure(cause, "The site could not be created.");
  }

  revalidateStructurePages();
  return { status: "SUCCESS", message: "Site created." };
}

export async function updateTenantSite(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_ORGANIZATION);
  const { organizationId, user } = await getCurrentUserTenant();

  try {
    const siteId = requiredId(data, "siteId");
    const site = await prisma.site.findFirst({
      where: { id: siteId, organizationId },
      select: { id: true, name: true },
    });
    if (!site) throw new Error("The selected site is not part of your organization.");

    const name = validateStructureName(field(data, "name"), "Site name");
    const duplicate = await prisma.site.findFirst({
      where: {
        organizationId,
        id: { not: site.id },
        name: { equals: name, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (duplicate) throw new Error("A site with this name already exists.");

    await prisma.$transaction([
      prisma.site.update({
        where: { id: site.id },
        data: {
          name,
          address: optionalField(data, "address"),
          city: optionalField(data, "city", 100),
          state: optionalField(data, "state", 100),
          country: optionalField(data, "country", 100),
        },
      }),
      prisma.activityLog.create({
        data: {
          organizationId,
          userId: user.id,
          action: ActivityAction.UPDATE,
          entityType: "Site",
          entityId: site.id,
          title: "Site updated",
          description: `${site.name} → ${name}`,
        },
      }),
    ]);
  } catch (cause) {
    return failure(cause, "The site could not be updated.");
  }

  revalidateStructurePages();
  return { status: "SUCCESS", message: "Site updated." };
}

export async function createTenantDepartment(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_ORGANIZATION);
  const { organizationId, user } = await getCurrentUserTenant();

  try {
    const siteId = requiredId(data, "siteId");
    const site = await prisma.site.findFirst({
      where: { id: siteId, organizationId },
      select: { id: true, name: true },
    });
    if (!site) throw new Error("Select a site within your organization.");

    const name = validateStructureName(
      field(data, "name"),
      "Department name",
    );
    const duplicate = await prisma.department.findFirst({
      where: { siteId: site.id, name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    if (duplicate) {
      throw new Error("This site already has a department with that name.");
    }

    await prisma.$transaction(async (tx) => {
      const department = await tx.department.create({
        data: { siteId: site.id, name },
      });
      await tx.activityLog.create({
        data: {
          organizationId,
          userId: user.id,
          action: ActivityAction.CREATE,
          entityType: "Department",
          entityId: department.id,
          title: "Department created",
          description: `${site.name} — ${name}`,
          metadata: { siteId: site.id },
        },
      });
    });
  } catch (cause) {
    return failure(cause, "The department could not be created.");
  }

  revalidateStructurePages();
  return { status: "SUCCESS", message: "Department created." };
}

export async function updateTenantDepartment(
  _state: FormActionState,
  data: FormData,
): Promise<FormActionState> {
  await requirePermission(PermissionKey.MANAGE_ORGANIZATION);
  const { organizationId, user } = await getCurrentUserTenant();

  try {
    const departmentId = requiredId(data, "departmentId");
    const department = await prisma.department.findFirst({
      where: { id: departmentId, site: { organizationId } },
      include: { site: { select: { id: true, name: true } } },
    });
    if (!department) {
      throw new Error("The selected department is not part of your organization.");
    }

    const siteId = requiredId(data, "siteId");
    const destinationSite = await prisma.site.findFirst({
      where: { id: siteId, organizationId },
      select: { id: true, name: true },
    });
    if (!destinationSite) throw new Error("Select a site within your organization.");

    const name = validateStructureName(
      field(data, "name"),
      "Department name",
    );
    const duplicate = await prisma.department.findFirst({
      where: {
        siteId: destinationSite.id,
        id: { not: department.id },
        name: { equals: name, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new Error("The selected site already has a department with that name.");
    }

    await prisma.$transaction([
      prisma.department.update({
        where: { id: department.id },
        data: { siteId: destinationSite.id, name },
      }),
      prisma.activityLog.create({
        data: {
          organizationId,
          userId: user.id,
          action: ActivityAction.UPDATE,
          entityType: "Department",
          entityId: department.id,
          title: "Department updated",
          description: `${department.site.name} — ${department.name} → ${destinationSite.name} — ${name}`,
          metadata: {
            previousSiteId: department.site.id,
            siteId: destinationSite.id,
          },
        },
      }),
    ]);
  } catch (cause) {
    return failure(cause, "The department could not be updated.");
  }

  revalidateStructurePages();
  return { status: "SUCCESS", message: "Department updated." };
}

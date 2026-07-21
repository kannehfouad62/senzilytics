import { ConfigurableFormModule, PermissionKey, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateMobileRequest, MobileAuthError } from "@/modules/mobile/mobile-auth.service";
import { getPublishedRuntimeForms } from "@/modules/forms/runtime-form.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { user, organization } = await authenticateMobileRequest(request);
    const [assigned, sites, forms, notifications, tasks] = await Promise.all([
      user.role === UserRole.SUPER_ADMIN ? Promise.resolve(Object.values(PermissionKey)) : prisma.rolePermission.findMany({ where: { role: user.role }, select: { permission: true } }).then((rows) => rows.map((row) => row.permission)),
      prisma.site.findMany({ where: { organizationId: organization.id }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      getPublishedRuntimeForms(organization.id, ConfigurableFormModule.OBSERVATION),
      prisma.notification.findMany({ where: { organizationId: organization.id, userId: user.id }, select: { id: true, type: true, title: true, message: true, link: true, readAt: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 25 }),
      prisma.workflowInstanceStep.findMany({ where: { status: "IN_PROGRESS", instance: { organizationId: organization.id, status: "ACTIVE" }, OR: [{ assignedUserId: user.id }, { assignedRole: user.role }, { assignedUserId: null, assignedRole: null }] }, select: { id: true, name: true, dueAt: true, status: true, instance: { select: { entityType: true, entityId: true, template: { select: { name: true } } } } }, orderBy: { dueAt: { sort: "asc", nulls: "last" } }, take: 25 }),
    ]);
    const observationForms = forms.map((form) => ({ id: form.id, name: form.name, description: form.description, version: { id: form.version.id, version: form.version.version, instructions: form.version.instructions, fields: form.version.fields.map((field) => ({ id: field.id, key: field.key, label: field.label, description: field.description, placeholder: field.placeholder, fieldType: field.fieldType, isRequired: field.isRequired, options: field.options, visibilityRule: field.visibilityRule, sequence: field.sequence })) } }));
    return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, organization: { id: organization.id, name: organization.name, subscriptionPlan: organization.subscriptionPlan }, permissions: assigned, sites, observationForms, notifications, tasks }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return mobileError(error, "Mobile workspace could not be loaded."); }
}

function mobileError(error: unknown, fallback: string) { if (!(error instanceof MobileAuthError)) console.error(fallback, error); return NextResponse.json({ error: error instanceof MobileAuthError ? error.code : "internal_error", errorDescription: error instanceof MobileAuthError ? error.message : fallback }, { status: error instanceof MobileAuthError ? error.status : 500, headers: { "cache-control": "no-store" } }); }

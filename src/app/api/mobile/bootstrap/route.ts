import { ConfigurableFormModule, PermissionKey, Status, UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateMobileRequest, MobileAuthError } from "@/modules/mobile/mobile-auth.service";
import { getPublishedRuntimeForms } from "@/modules/forms/runtime-form.service";
import { getMobileModuleCatalog } from "@/modules/mobile/mobile-module-catalog";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { user, organization } = await authenticateMobileRequest(request);
    const assigned = user.role === UserRole.SUPER_ADMIN
      ? Object.values(PermissionKey)
      : await prisma.rolePermission.findMany({
          where: { role: user.role },
          select: { permission: true },
        }).then((rows) => rows.map((row) => row.permission));
    const canExecuteInspections = assigned.includes(PermissionKey.MANAGE_INSPECTIONS);

    const [sites, observationRuntimeForms, incidentRuntimeForms, notifications, tasks, inspectionRecords] = await Promise.all([
      prisma.site.findMany({
        where: { organizationId: organization.id },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      getPublishedRuntimeForms(organization.id, ConfigurableFormModule.OBSERVATION),
      getPublishedRuntimeForms(organization.id, ConfigurableFormModule.INCIDENT),
      prisma.notification.findMany({
        where: { organizationId: organization.id, userId: user.id },
        select: { id: true, type: true, title: true, message: true, link: true, readAt: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
      prisma.workflowInstanceStep.findMany({
        where: {
          status: "IN_PROGRESS",
          instance: { organizationId: organization.id, status: "ACTIVE" },
          OR: [
            { assignedUserId: user.id },
            { assignedRole: user.role },
            { assignedUserId: null, assignedRole: null },
          ],
        },
        select: {
          id: true,
          name: true,
          dueAt: true,
          status: true,
          instance: {
            select: {
              entityType: true,
              entityId: true,
              template: { select: { name: true } },
            },
          },
        },
        orderBy: { dueAt: { sort: "asc", nulls: "last" } },
        take: 25,
      }),
      canExecuteInspections
        ? prisma.inspection.findMany({
            where: {
              site: { organizationId: organization.id },
              status: { notIn: [Status.COMPLETED, Status.CLOSED] },
              ...(user.role === UserRole.SUPER_ADMIN
                ? {}
                : {
                    OR: [
                      { leadInspectorId: user.id },
                      { teamMembers: { some: { userId: user.id } } },
                    ],
                  }),
            },
            select: {
              id: true,
              title: true,
              reference: true,
              description: true,
              area: true,
              type: true,
              status: true,
              scheduledAt: true,
              dueDate: true,
              site: { select: { id: true, name: true } },
              leadInspector: { select: { id: true, name: true } },
              checklistItems: {
                select: {
                  id: true,
                  sectionName: true,
                  questionText: true,
                  guidance: true,
                  questionType: true,
                  isRequired: true,
                  weight: true,
                  sequence: true,
                  response: {
                    select: {
                      result: true,
                      responseText: true,
                      numericValue: true,
                      booleanValue: true,
                      score: true,
                      comments: true,
                      answeredAt: true,
                      finding: {
                        select: {
                          id: true,
                          title: true,
                          riskLevel: true,
                          status: true,
                        },
                      },
                    },
                  },
                },
                orderBy: { sequence: "asc" },
              },
            },
            orderBy: [
              { dueDate: { sort: "asc", nulls: "last" } },
              { scheduledAt: { sort: "asc", nulls: "last" } },
            ],
            take: 20,
          })
        : Promise.resolve([]),
    ]);

    const modules = getMobileModuleCatalog({
      permissions: assigned,
      user: {
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        isPlatformAdmin: user.isPlatformAdmin,
      },
    });
    const inspections = inspectionRecords.map((inspection) => ({
      ...inspection,
      checklistItems: inspection.checklistItems.map((item) => ({
        ...item,
        response: item.response
          ? {
              ...item.response,
              numericValue: item.response.numericValue === null ? null : Number(item.response.numericValue),
              score: item.response.score === null ? null : Number(item.response.score),
            }
          : null,
      })),
    }));

    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      organization: {
        id: organization.id,
        name: organization.name,
        subscriptionPlan: organization.subscriptionPlan,
      },
      permissions: assigned,
      sites,
      observationForms: serializeRuntimeForms(observationRuntimeForms),
      incidentForms: serializeRuntimeForms(incidentRuntimeForms),
      inspections,
      notifications,
      tasks,
      modules,
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return mobileError(error, "Mobile workspace could not be loaded.");
  }
}

function serializeRuntimeForms(forms: Awaited<ReturnType<typeof getPublishedRuntimeForms>>) {
  return forms.map((form) => ({
    id: form.id,
    name: form.name,
    description: form.description,
    version: {
      id: form.version.id,
      version: form.version.version,
      instructions: form.version.instructions,
      fields: form.version.fields.map((field) => ({
        id: field.id,
        key: field.key,
        label: field.label,
        description: field.description,
        placeholder: field.placeholder,
        fieldType: field.fieldType,
        isRequired: field.isRequired,
        options: field.options,
        visibilityRule: field.visibilityRule,
        sequence: field.sequence,
      })),
    },
  }));
}

function mobileError(error: unknown, fallback: string) {
  if (!(error instanceof MobileAuthError)) console.error(fallback, error);
  return NextResponse.json({
    error: error instanceof MobileAuthError ? error.code : "internal_error",
    errorDescription: error instanceof MobileAuthError ? error.message : fallback,
  }, {
    status: error instanceof MobileAuthError ? error.status : 500,
    headers: { "cache-control": "no-store" },
  });
}

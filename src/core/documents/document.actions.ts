"use server";

import {
  archiveDocument,
  deleteDocument,
  restoreDocument,
} from "@/core/documents/document.service";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { PermissionKey } from "@prisma/client";
import { del } from "@vercel/blob";
import { redirect } from "next/navigation";

function getSafeReturnPath(
  value: FormDataEntryValue | null
) {
  const path =
    typeof value === "string"
      ? value.trim()
      : "/documents";

  if (
    !path.startsWith("/") ||
    path.startsWith("//")
  ) {
    return "/documents";
  }

  return path;
}

function getRequiredDocumentId(
  formData: FormData
) {
  const documentId = String(
    formData.get("documentId") || ""
  ).trim();

  if (!documentId) {
    throw new Error(
      "Document ID is required."
    );
  }

  return documentId;
}

export async function archiveDocumentAction(
  formData: FormData
) {
  await requirePermission(
    PermissionKey.MANAGE_DOCUMENTS
  );

  const {
    organizationId,
    user,
  } = await getCurrentUserTenant();

  const documentId =
    getRequiredDocumentId(formData);

  const returnTo = getSafeReturnPath(
    formData.get("returnTo")
  );

  await archiveDocument({
    organizationId,
    userId: user.id,
    documentId,
  });

  redirect(returnTo);
}

export async function restoreDocumentAction(
  formData: FormData
) {
  await requirePermission(
    PermissionKey.MANAGE_DOCUMENTS
  );

  const {
    organizationId,
    user,
  } = await getCurrentUserTenant();

  const documentId =
    getRequiredDocumentId(formData);

  const returnTo = getSafeReturnPath(
    formData.get("returnTo")
  );

  await restoreDocument({
    organizationId,
    userId: user.id,
    documentId,
  });

  redirect(returnTo);
}

export async function deleteDocumentAction(
  formData: FormData
) {
  await requirePermission(
    PermissionKey.MANAGE_DOCUMENTS
  );

  const {
    organizationId,
    user,
  } = await getCurrentUserTenant();

  const documentId =
    getRequiredDocumentId(formData);

  const returnTo = getSafeReturnPath(
    formData.get("returnTo")
  );

  const document =
    await prisma.document.findFirst({
      where: {
        id: documentId,
        organizationId,
        status: {
          not: "DELETED",
        },
      },
      select: {
        id: true,
        storageKey: true,
        storageUrl: true,
      },
    });

  if (!document) {
    throw new Error(
      "Document not found."
    );
  }

  try {
    await del(document.storageKey);
  } catch (error) {
    console.error(
      "Blob deletion failed:",
      error
    );

    throw new Error(
      "The file could not be removed from storage. The document record was not deleted."
    );
  }

  await deleteDocument({
    organizationId,
    userId: user.id,
    documentId,
  });

  redirect(returnTo);
}
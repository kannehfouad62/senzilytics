"use server";

import { del } from "@vercel/blob";
import { redirect } from "next/navigation";

import {
  archiveDocument,
  deleteDocument,
  restoreDocument,
} from "@/core/documents/document.service";
import { getCurrentUserTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

export async function archiveDocumentAction(formData: FormData) {
  const { organizationId, user } = await getCurrentUserTenant();

  const documentId = String(formData.get("documentId"));
  const returnTo = getSafeReturnPath(formData.get("returnTo"));

  await archiveDocument({
    organizationId,
    userId: user.id,
    documentId,
  });

  redirect(returnTo);
}

export async function deleteDocumentAction(formData: FormData) {
  const { organizationId, user } = await getCurrentUserTenant();

  const documentId = String(formData.get("documentId"));
  const returnTo = String(formData.get("returnTo") || "/dashboard");

  const document = await prisma.document.findFirst({
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
    throw new Error("Document not found.");
  }

  try {
    await del(document.storageKey);
  } catch (error) {
    console.error("Blob deletion failed:", error);

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

function getSafeReturnPath(value: FormDataEntryValue | null) {
  const path = typeof value === "string" ? value : "/documents";

  if (!path.startsWith("/") || path.startsWith("//")) {
    return "/documents";
  }

  return path;
}

export async function restoreDocumentAction(formData: FormData) {
  const { organizationId, user } = await getCurrentUserTenant();

  const documentId = String(formData.get("documentId") || "");
  const returnTo = getSafeReturnPath(formData.get("returnTo"));

  if (!documentId) {
    throw new Error("Document ID is required.");
  }

  await restoreDocument({
    organizationId,
    userId: user.id,
    documentId,
  });

  redirect(returnTo);
}
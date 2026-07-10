"use server";

import { del } from "@vercel/blob";
import { redirect } from "next/navigation";

import {
  archiveDocument,
  deleteDocument,
} from "@/core/documents/document.service";
import { getCurrentUserTenant } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

export async function archiveDocumentAction(formData: FormData) {
  const { organizationId, user } = await getCurrentUserTenant();

  const documentId = String(formData.get("documentId"));
  const returnTo = String(formData.get("returnTo") || "/dashboard");

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
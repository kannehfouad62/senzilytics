"use server";

import {
  getApplicationUrl,
  sendEmail,
} from "@/core/email/email.service";
import { createSenzilyticsEmailTemplate } from "@/core/email/email-template";
import { requirePermission } from "@/lib/permissions";
import { getCurrentUserTenant } from "@/lib/tenant";
import { PermissionKey } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function sendTestEmailAction() {
  await requirePermission(
    PermissionKey.MANAGE_USERS
  );

  const { user } = await getCurrentUserTenant();

  if (!user.email) {
    throw new Error(
      "Your account does not have an email address."
    );
  }

  const applicationUrl = getApplicationUrl();

  const result = await sendEmail({
    to: user.email,
    subject: "Senzilytics email delivery test",
    html: createSenzilyticsEmailTemplate({
      preheader:
        "Your Senzilytics email configuration is working.",
      heading: "Email delivery is working",
      body:
        "This test confirms that Senzilytics can send production email notifications from your configured domain.",
      actionLabel: "Open Senzilytics",
      actionUrl: `${applicationUrl}/dashboard`,
      details: [
        {
          label: "Recipient",
          value: user.email,
        },
        {
          label: "Status",
          value: "Configuration verified",
        },
      ],
    }),
    text:
      "Senzilytics email delivery is working. " +
      `Open the platform: ${applicationUrl}/dashboard`,
  });

  if (!result.success) {
    throw new Error(
      result.error || "The test email could not be sent."
    );
  }

  revalidatePath("/settings");
}
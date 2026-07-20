import { Resend } from "resend";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

export type SendEmailResult = {
  success: boolean;
  messageId: string | null;
  error: string | null;
};

function getRequiredEnvironmentVariable(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `${name} is not configured in the environment.`
    );
  }

  return value;
}

export async function sendTenantNotificationEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const { prisma } = await import("@/lib/prisma");
  const { planEntitlements } = await import("@/lib/subscription");
  const recipients = Array.isArray(input.to) ? input.to : [input.to];
  const users = await prisma.user.findMany({ where: { email: { in: recipients.map(email => email.toLowerCase()) }, organizationId: { not: null } }, select: { email: true, organization: { select: { subscriptionPlan: true } } } });
  const blocked = new Set(users.filter(user => user.organization && !planEntitlements[user.organization.subscriptionPlan].EMAIL_NOTIFICATIONS).map(user => user.email.toLowerCase()));
  const allowedRecipients = recipients.filter(email => !blocked.has(email.toLowerCase()));
  if (!allowedRecipients.length) return { success: true, messageId: null, error: null };
  return sendEmail({ ...input, to: Array.isArray(input.to) ? allowedRecipients : allowedRecipients[0] });
}

function getResendClient() {
  return new Resend(
    getRequiredEnvironmentVariable("RESEND_API_KEY")
  );
}

export async function sendEmail(
  input: SendEmailInput
): Promise<SendEmailResult> {
  const from = getRequiredEnvironmentVariable(
    "EMAIL_FROM"
  );

  const defaultReplyTo =
    process.env.EMAIL_REPLY_TO?.trim();

  try {
    const resend = getResendClient();

    const { data, error } = await resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo:
        input.replyTo?.trim() ||
        defaultReplyTo ||
        undefined,
    });

    if (error) {
      console.error("Email delivery failed:", error);

      return {
        success: false,
        messageId: null,
        error: error.message,
      };
    }

    return {
      success: true,
      messageId: data?.id ?? null,
      error: null,
    };
  } catch (error) {
    console.error("Email service failed:", error);

    return {
      success: false,
      messageId: null,
      error:
        error instanceof Error
          ? error.message
          : "Email delivery failed.",
    };
  }
}

export function getApplicationUrl() {
  return (
    process.env.APP_URL?.trim().replace(/\/+$/, "") ||
    "http://localhost:3000"
  );
}

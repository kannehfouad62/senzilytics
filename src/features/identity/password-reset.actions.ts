"use server";

import { createSenzilyticsEmailTemplate } from "@/core/email/email-template";
import { getApplicationUrl, sendEmail } from "@/core/email/email.service";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { redirect } from "next/navigation";

const digest = (token: string) => createHash("sha256").update(token).digest("hex");

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const user = email ? await prisma.user.findUnique({ where: { email }, include: { organization: true } }) : null;

  if (user?.isActive && user.organization?.status === "ACTIVE" && user.password) {
    const token = randomBytes(32).toString("hex");
    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
      prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: digest(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) } }),
    ]);
    const url = `${getApplicationUrl()}/reset-password?token=${token}`;
    await sendEmail({
      to: user.email,
      subject: "Reset your Senzilytics password",
      html: createSenzilyticsEmailTemplate({ preheader: "Your password reset request", heading: "Reset your password", body: "A password reset was requested for your Senzilytics account. This secure link expires in one hour. If you did not request it, no action is required.", actionLabel: "Reset Password", actionUrl: url }),
      text: `Reset your Senzilytics password: ${url}\nThis link expires in one hour.`,
    });
  }

  redirect("/forgot-password?sent=true");
}

export async function resetPassword(formData: FormData) {
  const token = String(formData.get("token") || "");
  const password = String(formData.get("password") || "");
  const confirmation = String(formData.get("confirmation") || "");
  if (password.length < 12) throw new Error("Password must contain at least 12 characters.");
  if (password !== confirmation) throw new Error("Passwords do not match.");
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: digest(token) }, include: { user: true } });
  if (!record || record.usedAt || record.expiresAt <= new Date() || !record.user.isActive) throw new Error("This password-reset link is invalid or expired.");
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { password: passwordHash, sessionVersion: { increment: 1 } } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: record.userId, id: { not: record.id } } }),
  ]);
  redirect("/login?reset=success");
}

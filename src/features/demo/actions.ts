"use server";

import bcrypt from "bcryptjs";
import { randomBytes, randomUUID } from "node:crypto";
import { UserRole } from "@prisma/client";
import { signIn } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sendEmail } from "@/core/email/email.service";
import { countries } from "@/lib/countries";

const DEMO_ORGANIZATION_ID = "org_senzilytics_public_demo";
const DEMO_DURATION_HOURS = 2;

const demoRequestSchema = z.object({
  name: z.string().trim().min(2).max(100),
  workEmail: z.string().trim().toLowerCase().email().max(254),
  company: z.string().trim().min(2).max(150),
  jobTitle: z.string().trim().max(120).optional(),
  country: z.enum(countries),
  topicUpdatesConsent: z.boolean(),
  productContactConsent: z.literal(true),
  consent: z.literal("on"),
});

export async function startDemo(formData: FormData) {
  const parsed = demoRequestSchema.safeParse({
    name: formData.get("name"),
    workEmail: formData.get("workEmail"),
    company: formData.get("company"),
    jobTitle: String(formData.get("jobTitle") || "").trim() || undefined,
    country: formData.get("country"),
    topicUpdatesConsent: formData.get("topicUpdatesConsent") === "on",
    productContactConsent: formData.get("productContactConsent") === "on",
    consent: formData.get("consent"),
  });

  if (!parsed.success) redirect("/demo?error=invalid");

  const organization = await prisma.organization.findFirst({
    where: { id: DEMO_ORGANIZATION_ID, isDemo: true, status: "ACTIVE" },
    include: { sites: { include: { departments: true }, take: 1 } },
  });

  const department = organization?.sites[0]?.departments[0];
  if (!organization || !department) redirect("/demo?error=unavailable");

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentAttempts = await prisma.demoLead.count({
    where: { workEmail: parsed.data.workEmail, createdAt: { gte: oneDayAgo } },
  });
  if (recentAttempts >= 3) redirect("/demo?error=limit");

  await prisma.user.deleteMany({
    where: { role: UserRole.DEMO_VIEWER, demoExpiresAt: { lt: new Date() } },
  });

  const expiresAt = new Date(Date.now() + DEMO_DURATION_HOURS * 60 * 60 * 1000);
  const password = randomBytes(32).toString("base64url");
  const email = `demo+${randomUUID()}@senzilytics.cloud`;

  await prisma.user.create({
    data: {
      name: parsed.data.name,
      email,
      password: await bcrypt.hash(password, 12),
      role: UserRole.DEMO_VIEWER,
      jobTitle: parsed.data.jobTitle || "Demo Visitor",
      activatedAt: new Date(),
      demoExpiresAt: expiresAt,
      organizationId: organization.id,
      departmentId: department.id,
      demoLead: {
        create: {
          name: parsed.data.name,
          workEmail: parsed.data.workEmail,
          company: parsed.data.company,
          jobTitle: parsed.data.jobTitle,
          country: parsed.data.country,
          topicUpdatesConsent: parsed.data.topicUpdatesConsent,
          productContactConsent: parsed.data.productContactConsent,
          consentedAt: new Date(),
          expiresAt,
          organizationId: organization.id,
        },
      },
    },
  });

  const safeName = escapeHtml(parsed.data.name);
  const safeCompany = escapeHtml(parsed.data.company);
  const safeTitle = escapeHtml(parsed.data.jobTitle || "Not provided");
  const safeCountry = escapeHtml(parsed.data.country);
  const salesRecipient = process.env.DEMO_LEAD_RECIPIENT?.trim();
  const messages = [
    sendEmail({
      to: parsed.data.workEmail,
      subject: "Your Senzilytics interactive demo is ready",
      html: `<p>Hello ${safeName},</p><p>Your two-hour, read-only Senzilytics demo session has started.</p><p>Explore the Global Executive Dashboard and the connected EHS, audit, risk, compliance, environmental and ESG workspaces.</p><p>Your session expires at ${expiresAt.toISOString()}.</p>`,
      text: `Your two-hour Senzilytics demo has started and expires at ${expiresAt.toISOString()}.`,
    }),
  ];
  if (salesRecipient) {
    messages.push(sendEmail({
      to: salesRecipient,
      subject: `New Senzilytics demo lead — ${safeCompany}`,
      html: `<p><strong>Name:</strong> ${safeName}</p><p><strong>Email:</strong> ${escapeHtml(parsed.data.workEmail)}</p><p><strong>Company:</strong> ${safeCompany}</p><p><strong>Job title:</strong> ${safeTitle}</p><p><strong>Country:</strong> ${safeCountry}</p><p><strong>Topic updates:</strong> ${parsed.data.topicUpdatesConsent ? "Yes" : "No"}</p><p><strong>Product contact:</strong> Yes</p>`,
      text: `${parsed.data.name} (${parsed.data.workEmail}) from ${parsed.data.company}, ${parsed.data.country} started a demo. Topic updates: ${parsed.data.topicUpdatesConsent ? "Yes" : "No"}. Product contact: Yes.`,
    }));
  }
  await Promise.allSettled(messages);

  await signIn("credentials", {
    email,
    password,
    redirectTo: "/dashboard?demo=welcome",
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!);
}

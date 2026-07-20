"use server";

import { sendEmail } from "@/core/email/email.service";
import { prisma } from "@/lib/prisma";
import { SubscriptionPlan } from "@prisma/client";
import { redirect } from "next/navigation";
import { z } from "zod";
import { countries } from "@/lib/countries";

const schema = z.object({ fullName: z.string().trim().min(2).max(100), company: z.string().trim().min(2).max(160), jobTitle: z.string().trim().min(2).max(120), workEmail: z.string().trim().toLowerCase().email().max(254), phoneNumber: z.string().trim().max(40).optional(), country: z.enum(countries), requestedPlan: z.nativeEnum(SubscriptionPlan), website: z.string().max(0) });
export async function submitPricingInquiry(data: FormData) {
  const parsed = schema.safeParse({ fullName: data.get("fullName"), company: data.get("company"), jobTitle: data.get("jobTitle"), workEmail: data.get("workEmail"), phoneNumber: String(data.get("phoneNumber") || "").trim() || undefined, country: data.get("country"), requestedPlan: data.get("requestedPlan"), website: String(data.get("website") || "") });
  if (!parsed.success) redirect("/?pricing=invalid#pricing-contact");
  const since = new Date(Date.now() - 86_400_000); const recent = await prisma.pricingInquiry.count({ where: { workEmail: parsed.data.workEmail, createdAt: { gte: since } } });
  if (recent >= 3) redirect("/?pricing=limit#pricing-contact");
  const { website: _website, ...inquiry } = parsed.data;
  await prisma.pricingInquiry.create({ data: inquiry });
  const safe = (value: string) => value.replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!);
  await sendEmail({ to: "admin@senzilytics.com", replyTo: parsed.data.workEmail, subject: `Senzilytics pricing inquiry — ${parsed.data.requestedPlan}`, html: `<p>A potential tenant requested pricing information.</p><p><strong>Plan:</strong> ${parsed.data.requestedPlan}</p><p><strong>Full name:</strong> ${safe(parsed.data.fullName)}</p><p><strong>Company:</strong> ${safe(parsed.data.company)}</p><p><strong>Job title:</strong> ${safe(parsed.data.jobTitle)}</p><p><strong>Work email:</strong> ${safe(parsed.data.workEmail)}</p><p><strong>Country:</strong> ${safe(parsed.data.country)}</p><p><strong>Phone:</strong> ${safe(parsed.data.phoneNumber || "Not provided")}</p>`, text: `${parsed.data.fullName} from ${parsed.data.company}, ${parsed.data.country} requested ${parsed.data.requestedPlan} pricing. Email: ${parsed.data.workEmail}. Phone: ${parsed.data.phoneNumber || "Not provided"}.` });
  redirect("/?pricing=success#pricing-contact");
}

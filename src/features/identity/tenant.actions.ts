"use server";
import { sendEmail, getApplicationUrl } from "@/core/email/email.service";
import { requirePermission } from "@/lib/permissions";
import { requirePlatformAdministrator } from "@/lib/platform-admin";
import { prisma } from "@/lib/prisma";
import { getCurrentUserTenant } from "@/lib/tenant";
import { PermissionKey, SubscriptionPlan, TenantInvitationStatus, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const value=(d:FormData,k:string)=>{const x=String(d.get(k)||"").trim();if(!x)throw new Error(`${k} is required.`);return x};
const hash=(token:string)=>createHash("sha256").update(token).digest("hex");

async function sendInvitation(input:{organizationId:string;email:string;name:string;role:UserRole;departmentId:string|null;invitedById:string}) {
  const email=input.email.toLowerCase();
  const domain=email.split("@")[1];
  const organization=await prisma.organization.findUnique({where:{id:input.organizationId}});
  if(!organization||organization.status!=="ACTIVE")throw new Error("The tenant is not active.");
  if(organization.allowedEmailDomains.length&&!organization.allowedEmailDomains.includes(domain))throw new Error("The email domain is not approved for this tenant.");
  if(await prisma.user.findUnique({where:{email}}))throw new Error("A user with this email already exists.");
  if(input.role===UserRole.SUPER_ADMIN)throw new Error("Platform roles cannot be assigned through tenant invitations.");
  if(input.departmentId&&!await prisma.department.findFirst({where:{id:input.departmentId,site:{organizationId:input.organizationId}}}))throw new Error("Select a department within this tenant.");
  const token=randomBytes(32).toString("hex");
  await prisma.tenantInvitation.create({data:{...input,email,tokenHash:hash(token),expiresAt:new Date(Date.now()+72*3600000)}});
  const link=`${getApplicationUrl()}/activate?token=${token}`;
  await sendEmail({to:email,subject:`You're invited to ${organization.name} on Senzilytics`,html:`<p>Hello ${input.name},</p><p>You have been invited to ${organization.name} on Senzilytics.</p><p><a href="${link}">Activate your account</a></p><p>This link expires in 72 hours.</p>`,text:`Activate your account: ${link}`});
}

export async function inviteTenantUser(d:FormData){await requirePermission(PermissionKey.MANAGE_USERS);const{organizationId,user}=await getCurrentUserTenant();await sendInvitation({organizationId,invitedById:user.id,email:value(d,"email"),name:value(d,"name"),role:value(d,"role") as UserRole,departmentId:String(d.get("departmentId")||"").trim()||null});revalidatePath("/users")}

export async function setTenantUserActive(d:FormData){await requirePermission(PermissionKey.MANAGE_USERS);const{organizationId,user}=await getCurrentUserTenant();const id=value(d,"id");if(id===user.id)throw new Error("You cannot suspend your own account.");await prisma.user.updateMany({where:{id,organizationId},data:{isActive:value(d,"active")==="true"}});revalidatePath("/users")}

export async function createTenant(d:FormData){const admin=await requirePlatformAdministrator();const name=value(d,"name"),email=value(d,"adminEmail").toLowerCase(),domain=value(d,"domain").toLowerCase(),subscriptionPlan=value(d,"subscriptionPlan") as SubscriptionPlan;if(!Object.values(SubscriptionPlan).includes(subscriptionPlan))throw new Error("Select a valid subscription plan.");const requestedMinimum=Number(String(d.get("contractedUserMinimum")||"")),contractedUserMinimum=Number.isInteger(requestedMinimum)&&requestedMinimum>0?requestedMinimum:subscriptionPlan===SubscriptionPlan.ESSENTIAL?25:subscriptionPlan===SubscriptionPlan.ENTERPRISE?20:null;const organization=await prisma.organization.create({data:{name,industry:String(d.get("industry")||"").trim()||null,allowedEmailDomains:[domain],subscriptionPlan,contractedUserMinimum,subscriptionNotes:String(d.get("subscriptionNotes")||"").trim()||null}});await sendInvitation({organizationId:organization.id,invitedById:admin.id,email,name:value(d,"adminName"),role:UserRole.ORG_ADMIN,departmentId:null});revalidatePath("/platform/tenants")}

export async function updateTenantSubscription(d:FormData){await requirePlatformAdministrator();const id=value(d,"organizationId"),subscriptionPlan=value(d,"subscriptionPlan") as SubscriptionPlan;if(!Object.values(SubscriptionPlan).includes(subscriptionPlan))throw new Error("Select a valid subscription plan.");const raw=String(d.get("contractedUserMinimum")||"").trim(),minimum=raw?Number(raw):null;if(minimum!==null&&(!Number.isInteger(minimum)||minimum<1))throw new Error("Contracted users must be a positive whole number.");await prisma.organization.update({where:{id},data:{subscriptionPlan,contractedUserMinimum:minimum,subscriptionNotes:String(d.get("subscriptionNotes")||"").trim()||null}});revalidatePath("/platform/tenants")}

export async function activateInvitation(d:FormData){const token=value(d,"token"),password=value(d,"password");if(password.length<12)throw new Error("Password must contain at least 12 characters.");const invitation=await prisma.tenantInvitation.findUnique({where:{tokenHash:hash(token)},include:{organization:true}});if(!invitation||invitation.status!==TenantInvitationStatus.PENDING||invitation.expiresAt<=new Date()||invitation.organization.status!=="ACTIVE")throw new Error("This invitation is invalid or expired.");const user=await prisma.$transaction(async tx=>{const created=await tx.user.create({data:{name:invitation.name,email:invitation.email,password:await bcrypt.hash(password,12),role:invitation.role,organizationId:invitation.organizationId,departmentId:invitation.departmentId,isActive:true,invitedAt:invitation.createdAt,activatedAt:new Date()}});await tx.tenantInvitation.update({where:{id:invitation.id},data:{status:TenantInvitationStatus.ACCEPTED,acceptedById:created.id,acceptedAt:new Date()}});return created});redirect(`/login?activated=${user.id}`)}

export async function configureTenantIdentityProvider(d:FormData){await requirePermission(PermissionKey.MANAGE_ORGANIZATION);const{organizationId}=await getCurrentUserTenant();const type=value(d,"type") as "MICROSOFT_ENTRA"|"OKTA",issuer=value(d,"issuer");if(!["MICROSOFT_ENTRA","OKTA"].includes(type))throw new Error("Select a supported identity provider.");const data={issuer,directoryId:String(d.get("directoryId")||"").trim()||null,emailDomain:String(d.get("emailDomain")||"").trim().toLowerCase()||null,isEnabled:true,enforceSso:d.get("enforceSso")==="on"};const existing=await prisma.organizationIdentityProvider.findFirst({where:{organizationId,type}});if(existing)await prisma.organizationIdentityProvider.update({where:{id:existing.id},data});else await prisma.organizationIdentityProvider.create({data:{organizationId,type,...data}});revalidatePath("/organizations")}

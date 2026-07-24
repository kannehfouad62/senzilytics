import { createNotification } from "@/core/notifications/notifications.service";
import { prisma } from "@/lib/prisma";
import { addCompetencyMonths, classifyCompetencyGap, competencyLevelRank, meetsCompetencyLevel } from "@/modules/training/competency-level";
import { ActivityAction, CompetencyAssessmentStatus, CompetencyCategory, CompetencyEvidenceType, CompetencyProficiency, NotificationType, Status, UserRole } from "@prisma/client";

export async function createCompetencyService(input: { organizationId: string; userId: string; code: string; name: string; description?: string | null; category: CompetencyCategory; validityMonths?: number | null; isCritical: boolean }) {
  if (input.validityMonths !== null && input.validityMonths !== undefined && (!Number.isInteger(input.validityMonths) || input.validityMonths < 1 || input.validityMonths > 120)) throw new Error("Competency validity must be between 1 and 120 months.");
  return prisma.$transaction(async tx => {
    const competency = await tx.competencyDefinition.create({ data: { organizationId: input.organizationId, createdById: input.userId, code: input.code.toUpperCase(), name: input.name, description: input.description, category: input.category, validityMonths: input.validityMonths, isCritical: input.isCritical } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: input.userId, action: ActivityAction.CREATE, entityType: "CompetencyDefinition", entityId: competency.id, title: "Competency created", description: `${competency.code} — ${competency.name}`, metadata: { category: competency.category, isCritical: competency.isCritical } } });
    return competency;
  });
}

export async function linkCourseCompetencyService(input: { organizationId: string; userId: string; competencyId: string; courseId: string; achievedLevel: CompetencyProficiency; minimumScore?: number | null; isPrimary: boolean }) {
  if (input.minimumScore !== null && input.minimumScore !== undefined && (!Number.isFinite(input.minimumScore) || input.minimumScore < 0 || input.minimumScore > 100)) throw new Error("Minimum score must be between 0 and 100.");
  const [competency, course] = await Promise.all([
    prisma.competencyDefinition.findFirst({ where: { id: input.competencyId, organizationId: input.organizationId, isActive: true } }),
    prisma.trainingCourse.findFirst({ where: { id: input.courseId, organizationId: input.organizationId, isActive: true } }),
  ]);
  if (!competency || !course) throw new Error("Select a valid active competency and course.");
  return prisma.$transaction(async tx => {
    const link = await tx.competencyCourseLink.upsert({ where: { competencyId_courseId: { competencyId: competency.id, courseId: course.id } }, update: { achievedLevel: input.achievedLevel, minimumScore: input.minimumScore, isPrimary: input.isPrimary }, create: { competencyId: competency.id, courseId: course.id, achievedLevel: input.achievedLevel, minimumScore: input.minimumScore, isPrimary: input.isPrimary } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: input.userId, action: ActivityAction.UPDATE, entityType: "CompetencyDefinition", entityId: competency.id, title: "Course mapped to competency", description: `${course.name} → ${competency.name}`, metadata: { courseId: course.id, achievedLevel: input.achievedLevel } } });
    return link;
  });
}

export async function createCompetencyRequirementService(input: { organizationId: string; userId: string; competencyId: string; role?: UserRole | null; jobTitle?: string | null; siteId?: string | null; departmentId?: string | null; requiredLevel: CompetencyProficiency; dueWithinDays: number; isMandatory: boolean }) {
  if (!Number.isInteger(input.dueWithinDays) || input.dueWithinDays < 1 || input.dueWithinDays > 365) throw new Error("Gap closure due days must be between 1 and 365.");
  const [competency, site, department] = await Promise.all([
    prisma.competencyDefinition.findFirst({ where: { id: input.competencyId, organizationId: input.organizationId, isActive: true } }),
    input.siteId ? prisma.site.findFirst({ where: { id: input.siteId, organizationId: input.organizationId } }) : null,
    input.departmentId ? prisma.department.findFirst({ where: { id: input.departmentId, site: { organizationId: input.organizationId } } }) : null,
  ]);
  if (!competency || (input.siteId && !site) || (input.departmentId && !department)) throw new Error("Select a valid tenant competency, site, and department.");
  if (site && department && department.siteId !== site.id) throw new Error("The selected department does not belong to the selected site.");
  const jobTitle = input.jobTitle?.trim() || null;
  const duplicate = await prisma.competencyRequirement.findFirst({ where: { organizationId: input.organizationId, competencyId: competency.id, role: input.role ?? null, jobTitle, siteId: input.siteId ?? null, departmentId: input.departmentId ?? null, isActive: true } });
  if (duplicate) throw new Error("An active competency requirement already exists for this scope.");
  return prisma.$transaction(async tx => {
    const requirement = await tx.competencyRequirement.create({ data: { organizationId: input.organizationId, competencyId: competency.id, role: input.role, jobTitle, siteId: input.siteId, departmentId: input.departmentId, requiredLevel: input.requiredLevel, dueWithinDays: input.dueWithinDays, isMandatory: input.isMandatory } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: input.userId, action: ActivityAction.CREATE, entityType: "CompetencyRequirement", entityId: requirement.id, title: "Competency requirement created", description: competency.name, metadata: { requiredLevel: requirement.requiredLevel, role: requirement.role, siteId: requirement.siteId, departmentId: requirement.departmentId } } });
    return requirement;
  });
}

export async function submitCompetencyAssessmentService(input: { organizationId: string; userId: string; learnerId: string; competencyId: string; assessedLevel: CompetencyProficiency; assessedAt: Date; evidenceType: CompetencyEvidenceType; evidenceReference?: string | null; notes?: string | null }) {
  const [learner, assessor, competency, pending] = await Promise.all([
    prisma.user.findFirst({ where: { id: input.learnerId, organizationId: input.organizationId, isActive: true } }),
    prisma.user.findFirst({ where: { id: input.userId, organizationId: input.organizationId, isActive: true } }),
    prisma.competencyDefinition.findFirst({ where: { id: input.competencyId, organizationId: input.organizationId, isActive: true } }),
    prisma.competencyAssessment.findFirst({ where: { organizationId: input.organizationId, userId: input.learnerId, competencyId: input.competencyId, status: CompetencyAssessmentStatus.PENDING_VERIFICATION } }),
  ]);
  if (!learner || !assessor || !competency) throw new Error("Select a valid tenant learner and competency.");
  if (pending) throw new Error("This learner already has a competency assessment awaiting verification.");
  if (input.assessedAt > new Date()) throw new Error("Assessment date cannot be in the future.");
  if ((input.evidenceType === CompetencyEvidenceType.LICENSE || input.evidenceType === CompetencyEvidenceType.CERTIFICATION) && !input.evidenceReference) throw new Error("Record the license or certification reference.");
  const expiresAt = competency.validityMonths ? addCompetencyMonths(input.assessedAt, competency.validityMonths) : null;
  return prisma.$transaction(async tx => {
    const assessment = await tx.competencyAssessment.create({ data: { organizationId: input.organizationId, competencyId: competency.id, userId: learner.id, assessorId: assessor.id, assessedLevel: input.assessedLevel, assessedAt: input.assessedAt, expiresAt, evidenceType: input.evidenceType, evidenceReference: input.evidenceReference, notes: input.notes } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: input.userId, action: ActivityAction.CREATE, entityType: "CompetencyAssessment", entityId: assessment.id, title: "Competency evidence submitted", description: competency.name, metadata: { learnerId: learner.id, assessedLevel: assessment.assessedLevel, evidenceType: assessment.evidenceType } } });
    return assessment;
  });
}

export async function decideCompetencyAssessmentService(input: { organizationId: string; userId: string; assessmentId: string; decision: "VERIFIED" | "REJECTED"; rejectionReason?: string | null }) {
  const [assessment, verifier] = await Promise.all([
    prisma.competencyAssessment.findFirst({ where: { id: input.assessmentId, organizationId: input.organizationId }, include: { competency: true, user: true } }),
    prisma.user.findFirst({ where: { id: input.userId, organizationId: input.organizationId, isActive: true } }),
  ]);
  if (!assessment || !verifier) throw new Error("Competency assessment not found in this organization.");
  if (assessment.status !== CompetencyAssessmentStatus.PENDING_VERIFICATION) throw new Error("Only pending competency evidence can be verified or rejected.");
  if (assessment.assessorId === verifier.id) throw new Error("A different training manager must verify this competency evidence.");
  if (input.decision === "REJECTED" && !input.rejectionReason) throw new Error("Record the reason the competency evidence was rejected.");
  const status = input.decision === "VERIFIED" ? CompetencyAssessmentStatus.VERIFIED : CompetencyAssessmentStatus.REJECTED;
  const updated = await prisma.$transaction(async tx => {
    const record = await tx.competencyAssessment.update({ where: { id: assessment.id }, data: { status, verifiedById: verifier.id, verifiedAt: new Date(), rejectionReason: status === CompetencyAssessmentStatus.REJECTED ? input.rejectionReason : null } });
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: verifier.id, action: ActivityAction.STATUS_CHANGE, entityType: "CompetencyAssessment", entityId: assessment.id, title: `Competency evidence ${status.toLowerCase()}`, description: assessment.competency.name, metadata: { learnerId: assessment.userId, status } } });
    return record;
  });
  await createNotification({ organizationId: input.organizationId, userId: assessment.userId, type: status === CompetencyAssessmentStatus.VERIFIED ? NotificationType.SUCCESS : NotificationType.WARNING, title: `Competency evidence ${status.toLowerCase()}`, message: `${assessment.competency.name} was ${status.toLowerCase()}.`, link: "/training/competencies/matrix" }).catch(() => undefined);
  return updated;
}

type MatrixUser = { id: string; name: string; role: UserRole; jobTitle: string | null; departmentId: string | null; createdAt: Date; department: { id: string; name: string; siteId: string; site: { id: string; name: string } } | null };
const requirementApplies = (requirement: { role: UserRole | null; jobTitle: string | null; siteId: string | null; departmentId: string | null }, user: MatrixUser) => (!requirement.role || requirement.role === user.role) && (!requirement.jobTitle || requirement.jobTitle.toLowerCase() === (user.jobTitle || "").toLowerCase()) && (!requirement.siteId || requirement.siteId === user.department?.siteId) && (!requirement.departmentId || requirement.departmentId === user.departmentId);
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);

export async function getCompetencyMatrixService(organizationId: string, now = new Date()) {
  const expiryHorizon = new Date(now.getTime() + 60 * 86400000);
  const [requirements, users, assessments] = await Promise.all([
    prisma.competencyRequirement.findMany({ where: { organizationId, isActive: true, competency: { isActive: true } }, include: { competency: { include: { courseLinks: { include: { course: true } } } }, site: true, department: true }, orderBy: { competency: { name: "asc" } } }),
    prisma.user.findMany({ where: { organizationId, isActive: true }, select: { id: true, name: true, role: true, jobTitle: true, departmentId: true, createdAt: true, department: { select: { id: true, name: true, siteId: true, site: { select: { id: true, name: true } } } } }, orderBy: { name: "asc" } }),
    prisma.competencyAssessment.findMany({ where: { organizationId, status: { in: [CompetencyAssessmentStatus.VERIFIED, CompetencyAssessmentStatus.EXPIRED] } }, include: { competency: true }, orderBy: { assessedAt: "desc" } }),
  ]);
  const rows = requirements.flatMap(requirement => users.filter(user => requirementApplies(requirement, user)).map(user => {
    const evidence = assessments.filter(item => item.userId === user.id && item.competencyId === requirement.competencyId);
    const current = evidence.filter(item => item.status === CompetencyAssessmentStatus.VERIFIED && (!item.expiresAt || item.expiresAt >= now)).sort((a, b) => competencyLevelRank(b.assessedLevel) - competencyLevelRank(a.assessedLevel) || b.assessedAt.getTime() - a.assessedAt.getTime())[0] ?? null;
    const expiredEvidence = evidence.filter(item => meetsCompetencyLevel(item.assessedLevel, requirement.requiredLevel) && (item.status === CompetencyAssessmentStatus.EXPIRED || Boolean(item.expiresAt && item.expiresAt < now))).sort((a, b) => (b.expiresAt?.getTime() ?? b.assessedAt.getTime()) - (a.expiresAt?.getTime() ?? a.assessedAt.getTime()))[0] ?? null;
    const status = classifyCompetencyGap({ actualLevel: current?.assessedLevel ?? null, requiredLevel: requirement.requiredLevel, expiresAt: current?.expiresAt ?? null, hadExpiredEvidence: Boolean(expiredEvidence), now, expiryHorizon });
    const initialAnchor = new Date(Math.max(requirement.createdAt.getTime(), user.createdAt.getTime()));
    const gapAnchor = status === "EXPIRED" ? expiredEvidence?.expiresAt ?? initialAnchor : initialAnchor;
    const gapDueAt = status === "GAP" || status === "EXPIRED" ? addDays(gapAnchor, requirement.dueWithinDays) : null;
    return { id: `${requirement.id}:${user.id}`, requirement, user, actualLevel: current?.assessedLevel ?? null, expiresAt: current?.expiresAt ?? null, status, gapDueAt, isOverdue: Boolean(gapDueAt && gapDueAt < now), recommendedCourses: requirement.competency.courseLinks.map(link => link.course) };
  }));
  return { rows, total: rows.length, satisfied: rows.filter(row => row.status === "SATISFIED").length, expiring: rows.filter(row => row.status === "EXPIRING").length, gaps: rows.filter(row => row.status === "GAP" || row.status === "EXPIRED").length, overdueGaps: rows.filter(row => row.isOverdue).length, criticalGaps: rows.filter(row => row.requirement.competency.isCritical && (row.status === "GAP" || row.status === "EXPIRED")).length };
}

export async function completeTrainingWithCompetenciesService(input: {
  organizationId: string;
  userId: string;
  recordId: string;
  completedAt: Date;
  certificateNumber?: string | null;
  score?: number | null;
  notes?: string | null;
  offlineSubmission?: {
    id: string;
    capturedAt: Date;
    payloadHash: string;
  };
}) {
  const [record, actor] = await Promise.all([
    prisma.trainingRecord.findFirst({ where: { id: input.recordId, user: { organizationId: input.organizationId } }, include: { course: { include: { competencyLinks: { include: { competency: true } } } }, user: true } }),
    prisma.user.findFirst({ where: { id: input.userId, organizationId: input.organizationId, isActive: true } }),
  ]);
  if (!record || !actor) throw new Error("Training assignment not found in this organization.");
  if (record.status === Status.COMPLETED) throw new Error("This training assignment is already completed.");
  if (input.completedAt > new Date()) throw new Error("Completion date cannot be in the future.");
  if (input.score !== null && input.score !== undefined && (!Number.isFinite(input.score) || input.score < 0 || input.score > 100)) throw new Error("Training score must be between 0 and 100.");
  const expiresAt = record.course?.validityMonths ? addCompetencyMonths(input.completedAt, record.course.validityMonths) : null;
  const result = await prisma.$transaction(async tx => {
    const updated = await tx.trainingRecord.update({ where: { id: record.id }, data: { status: Status.COMPLETED, completedAt: input.completedAt, expiresAt, certificateNumber: input.certificateNumber, score: input.score, notes: input.notes } });
    let competenciesVerified = 0;
    for (const link of record.course?.competencyLinks ?? []) {
      if (link.minimumScore !== null && (input.score === null || input.score === undefined || input.score < link.minimumScore)) continue;
      const competencyExpiresAt = link.competency.validityMonths ? addCompetencyMonths(input.completedAt, link.competency.validityMonths) : expiresAt;
      await tx.competencyAssessment.upsert({ where: { sourceTrainingRecordId_competencyId: { sourceTrainingRecordId: record.id, competencyId: link.competencyId } }, update: { status: CompetencyAssessmentStatus.VERIFIED, assessedLevel: link.achievedLevel, assessedAt: input.completedAt, expiresAt: competencyExpiresAt, evidenceReference: input.certificateNumber, verifiedById: actor.id, verifiedAt: new Date(), rejectionReason: null }, create: { organizationId: input.organizationId, competencyId: link.competencyId, userId: record.userId, assessorId: actor.id, status: CompetencyAssessmentStatus.VERIFIED, assessedLevel: link.achievedLevel, assessedAt: input.completedAt, expiresAt: competencyExpiresAt, evidenceType: CompetencyEvidenceType.TRAINING, evidenceReference: input.certificateNumber, sourceTrainingRecordId: record.id, verifiedById: actor.id, verifiedAt: new Date() } });
      competenciesVerified++;
    }
    if (input.offlineSubmission) {
      await tx.offlineSubmission.create({
        data: {
          id: input.offlineSubmission.id,
          organizationId: input.organizationId,
          userId: input.userId,
          recordType: "TRAINING_COMPLETION",
          recordId: record.id,
          capturedAt: input.offlineSubmission.capturedAt,
          payloadHash: input.offlineSubmission.payloadHash,
        },
      });
    }
    await tx.activityLog.create({ data: { organizationId: input.organizationId, userId: actor.id, action: ActivityAction.UPDATE, entityType: "TrainingRecord", entityId: record.id, title: "Training completion recorded", description: record.courseName, metadata: { learnerId: record.userId, completedAt: input.completedAt, competenciesVerified } } });
    return { record: updated, competenciesVerified };
  });
  if (result.competenciesVerified > 0) await createNotification({ organizationId: input.organizationId, userId: record.userId, type: NotificationType.SUCCESS, title: "Competency evidence verified", message: `${result.competenciesVerified} mapped competenc${result.competenciesVerified === 1 ? "y was" : "ies were"} awarded from ${record.courseName}.`, link: "/training/competencies/matrix" }).catch(() => undefined);
  return result;
}

export async function processCompetencyMonitoring(now = new Date()) {
  const horizon = new Date(now.getTime() + 30 * 86400000);
  const assessments = await prisma.competencyAssessment.findMany({ where: { status: CompetencyAssessmentStatus.VERIFIED, expiresAt: { lte: horizon } }, include: { competency: true } });
  const result = { checked: assessments.length, remindersSent: 0, expired: 0 };
  for (const assessment of assessments) {
    const expired = Boolean(assessment.expiresAt && assessment.expiresAt < now);
    if (expired) {
      await prisma.$transaction([
        prisma.competencyAssessment.update({ where: { id: assessment.id }, data: { status: CompetencyAssessmentStatus.EXPIRED } }),
        prisma.activityLog.create({ data: { organizationId: assessment.organizationId, userId: null, action: ActivityAction.SYSTEM, entityType: "CompetencyAssessment", entityId: assessment.id, title: "Competency evidence expired", description: assessment.competency.name, metadata: { learnerId: assessment.userId, expiresAt: assessment.expiresAt } } }),
      ]);
      result.expired++;
    }
    if (!assessment.reminderSentAt) {
      const created = await createNotification({ organizationId: assessment.organizationId, userId: assessment.userId, type: expired ? NotificationType.WARNING : NotificationType.DUE_DATE, title: expired ? "Competency expired" : "Competency renewal approaching", message: `${assessment.competency.name} ${expired ? "has expired" : `expires ${assessment.expiresAt?.toLocaleDateString("en-US")}`}.`, link: "/training/competencies/matrix" }).catch(() => null);
      await prisma.competencyAssessment.update({ where: { id: assessment.id }, data: { reminderSentAt: now } });
      if (created) result.remindersSent++;
    }
  }
  return result;
}

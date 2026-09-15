# Audit Service Expansion Certification

Date: 2026-09-14  
Scope: governed internal and external audit-service delivery without client accounts or financial transactions.

## Certified implementation scope

- Tenant provisioning and manual `AUDIT_SERVICES` module assignment.
- Audit-service clients, contacts, engagements, ownership, and teams.
- Risk-based planning, independence declarations, approval controls, information requests, and meetings.
- Expiring token and passcode-protected external access without tenant accounts.
- External acknowledgement, approval, denial, comments, finding responses, and governed internal review.
- Controlled conversion of accepted remediation into the existing CAPA engine.
- Versioned deliverables, independent review and approval, secure publication, download evidence, and executive analytics.
- Workflow events, SLA reminders, escalations, in-app/email/push notification delivery, and unified compliance-calendar deadlines.
- Entitlement-aware native mobile delivery overview for authorized internal users.

## Security and governance boundaries

- Every persistent read and write derives or requires an organization identifier.
- Ordinary mobile auditors see engagements they own, lead, manage, or are assigned to; governed tenant management roles may see the tenant portfolio.
- External clients never receive a Senzilytics tenant account. External access is expiring, passcode protected, attempt limited, revocable, and resource scoped.
- Mobile coordination is read-only while offline. Mutations and external-access administration return to authenticated online server controls.
- No invoice, payment, billing, pricing, revenue, contract settlement, or other monetary transaction capability is included.
- Formal audit opinions remain human-controlled; dashboards and automation do not replace qualified auditor judgment.

## Automated certification gates

- Prisma schema formatting, validation, generation, and migration integrity.
- Root and mobile TypeScript compilation.
- Root automated regression suite.
- ESLint with zero errors.
- Optimized Next.js production build.
- Expo Doctor dependency and configuration checks.
- Tenant-entitlement, permission, assigned-engagement, secure external-access, lifecycle, audit-trail, export, workflow, SLA, calendar, and absence-of-finance regression checks.

## Operational acceptance still required after deployment

1. Apply all production migrations and confirm `prisma migrate status` reports the database is current.
2. Verify the Vercel deployment health and authenticated Audit Services routes with an entitled staging tenant.
3. Test manager and assigned-auditor views against a second tenant to confirm isolation.
4. Exercise one complete external link flow using a non-tenant email: delivery, passcode verification, decision/comment, expiry, lockout, revocation, and download evidence.
5. Confirm SLA notifications, email, push, escalation, workflow, and compliance-calendar evidence using controlled near-due records.
6. Install fresh Android and iOS production candidates and complete the Audit Services mobile acceptance cases in `apps/mobile/README.md`.
7. Record signed build IDs, device evidence, reviewer, date, production commit, migration status, and final release decision in the governed release-candidate register.

Certification status: **CODE CANDIDATE — operational evidence and signed mobile builds pending.**

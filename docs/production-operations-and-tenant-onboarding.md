# Production Operations and Tenant Onboarding

This runbook governs the transition from a commercially provisioned tenant to
an approved production tenant. It complements the in-product implementation
workspace; it does not replace contractual, security, or infrastructure
evidence.

## Access boundaries

- `/implementation` is tenant-scoped and requires `MANAGE_ORGANIZATION`.
- `/platform/tenants/[id]` and `/platform/operations` require an active
  `SUPER_ADMIN` who is explicitly marked as a platform administrator and uses a
  `senzilytics.com` email address.
- `/platform/releases` applies the same platform-administrator boundary and
  records software certification and pilot decisions separately from tenant
  onboarding approval.
- Tenant actions always derive the organization from the authenticated session.
  A tenant-supplied organization identifier is never trusted.
- Internal Senzilytics implementation notes are not selected or rendered in the
  tenant workspace.
- Passwords, invitation tokens, reset links, OAuth secrets, API credentials,
  and environment-variable values must never be entered in onboarding notes.

## Tenant launch sequence

1. Provision the tenant, subscription, contracted user minimum, approved email
   domain, and initial Organization Administrator invitation.
2. Assign a tenant implementation owner and Senzilytics implementation owner.
3. Configure at least one site and department.
4. Confirm Microsoft Entra ID or Okta, or record an approved SSO waiver.
5. Activate at least one tenant Organization Administrator.
6. Establish governance responsibilities and escalation paths.
7. Validate initial data, controlled imports, and retention expectations.
8. Complete workflow and notification acceptance testing.
9. For Premium tenants, verify at least one active native mobile session.
10. Resolve every blocker and submit the completed plan for platform review.
11. A Senzilytics platform administrator records the final go-live approval.

The application enforces system-derived gates for tenant status/domain,
organization structure, SSO, administrator access, Premium mobile readiness,
and final approval. Manual governance, data, and workflow steps require
documented human evidence.

## Scheduled job monitoring

`/platform/operations` displays durable heartbeats for the six jobs configured
in `vercel.json`. An authorized scheduler invocation creates a `RUNNING` record
and then records `SUCCEEDED` or `FAILED`. Unauthorized requests do not create
records. Error records contain a generic message; protected deployment logs
remain the source for technical details.

- Hourly jobs are stale after 150 minutes.
- Daily jobs are stale after 36 hours.
- A `FAILED`, `STALE`, or `NEVER RUN` state requires platform review.
- Confirm `CRON_SECRET` is configured in production and that Vercel cron
  requests receive HTTP 200 responses.

## Backup and recovery verification

The application can verify database connectivity but cannot prove that the
database provider created a restorable backup. Before the first customer
go-live and at the organization-defined test interval:

1. Confirm automated backup retention in the database-provider console.
2. Restore the latest backup into an isolated non-production environment.
3. Verify schema migrations, tenant counts, representative records, and
   encrypted integration configuration.
4. Record start/end time, recovery-point age, recovery-time result, tester, and
   evidence reference in the controlled deployment record.
5. Remove the isolated restore according to the approved data-handling process.
6. Escalate missed recovery objectives before approving another tenant go-live.

Never paste database URLs, credentials, backup download links, or restored
customer data into onboarding notes.

## Deployment order

1. Create the exact release candidate in `/platform/releases`, including its
   version, commit SHA, candidate deployment URL, risk summary and rollback
   plan.
2. Apply the candidate release in the controlled validation environment.
3. Run `npx prisma generate`.
4. Run `npx prisma migrate deploy`.
5. Run `npm run check`.
6. Confirm `/api/health`.
7. Complete all eight release-certification checks against the candidate
   deployment and attach controlled evidence references.
8. Confirm `/platform/operations` and wait for each scheduled job to establish
   its expected production heartbeat.
9. Assign at least one tenant whose latest Production Assurance review is
   approved and whose onboarding plan is ready for review or live.
10. Submit and approve the release candidate. Pilot start remains blocked until
    every assigned tenant is formally live.
11. Record a final outcome for every pilot tenant. Any failed or rolled-back
    pilot closes the candidate as `ROLLED_BACK`; all passed pilots close it as
    `RELEASED`.

Release approval does not replace tenant go-live approval. Tenant onboarding,
Production Assurance, release certification and pilot outcome are independent,
auditable decisions.

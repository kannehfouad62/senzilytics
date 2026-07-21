# Senzilytics

Senzilytics is a multi-tenant EHS and ESG compliance, risk, and operational-governance platform built with Next.js, Prisma, and PostgreSQL.

## Local development

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Required local variables are stored in `.env` and must never be committed. At minimum configure `DATABASE_URL`, `AUTH_SECRET`, `CRON_SECRET`, `APP_URL`, and `INTEGRATION_ENCRYPTION_KEY`. Generate the integration key with `openssl rand -base64 32`; it encrypts webhook signing secrets and must remain stable across deployments. Document uploads require `BLOB_READ_WRITE_TOKEN`; email delivery requires the configured provider credentials; AI features require `OPENAI_API_KEY`.

## Production release

1. Take a verified database backup and record the currently deployed commit.
2. Configure production secrets. Generate independent random values for `AUTH_SECRET`, `CRON_SECRET`, and the 32-byte `INTEGRATION_ENCRYPTION_KEY`.
3. Run `npm run verify:production` against the intended production environment.
4. Run `npm ci`, `npx prisma generate`, `npm test`, and `npm run build`.
5. Review pending migrations, then run `npm run db:deploy` once against the production database.
6. Deploy the exact validated commit. Never run `prisma migrate dev` in production.
7. Confirm `/api/health` returns HTTP 200 and `status: ready`.
8. Verify login, tenant isolation, role access, uploads, email, and one non-destructive scheduled-job invocation.
9. Monitor deployment logs, database connections, scheduled jobs, and error rates during the release window.

## Scheduled jobs

Vercel schedules are defined in `vercel.json`. Every cron request must send `Authorization: Bearer $CRON_SECRET`; handlers fail closed when the secret is absent. Monitor non-2xx results for audit generation, workflow SLA, training, compliance, chemical, and environmental processing.

## Rollback

Roll back application code to the recorded prior commit first. Prisma migrations are forward-only by default; do not manually reverse a production migration unless a reviewed recovery migration exists. Restore the pre-release database backup only when data compatibility requires it and the operational owner has approved the data-loss window.

## Quality gate

```bash
npm run check
```

This runs linting, automated tests, and the optimized production build.

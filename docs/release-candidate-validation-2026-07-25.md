# Release candidate validation and remediation

Date: 2026-07-25  
Baseline: `af05d7e` (`feat: add governed release candidate certification`)  
Target branch: `main`  
Mobile version: `1.1.0`  
Production: `https://www.senzilytics.cloud`

## Decision

The remediated source candidate passes local automated web and mobile validation. It is not yet eligible for final certification or store submission because signed production builds, candidate-database migration evidence, authenticated tenant smoke tests, and physical-device acceptance remain outstanding.

No additional major feature phase is justified by this review.

## Release blockers found and remediated

| Blocker | Evidence | Remediation |
| --- | --- | --- |
| Production dependency advisories | The initial production audits reported critical/high paths through Auth.js, Next.js and transitive packages. | Updated Auth.js, Next.js, Prisma and compatible transitive overrides. Root and mobile `npm audit --omit=dev --audit-level=high` now report zero vulnerabilities. |
| Mobile validation false pass | `expo-doctor` could report an Expo configuration failure while the existing combined check exited successfully in this restricted environment. | Changed the mobile gate to `expo-doctor --verbose`; the complete gate now reports and passes all 21 checks. |
| Store version drift | Runtime and Expo configuration used `1.1.0`, while Apple and Google submission material still named `1.0.0`. | Aligned `store.config.json` and both store worksheets/listing to `1.1.0`; added an automated regression test. |

The full root development audit still reports one high-severity denial-of-service advisory propagated through the ESLint-only `minimatch@3` toolchain. The compatible `brace-expansion@1.1.16` branch has no fix for that newer advisory, while forcing the incompatible 5.x API breaks ESLint. This dependency is absent from the production install, production audits are clean, lint receives repository-controlled paths rather than untrusted runtime input, and the issue is therefore accepted as a development-tooling risk pending an upstream-compatible ESLint stack.

## Automated validation evidence

| Gate | Result |
| --- | --- |
| Root `npm ci` | Pass |
| Root lint | Pass with 0 errors and 7 existing warnings |
| Root tests | Pass, 261/261 |
| Root production build | Pass with `NODE_OPTIONS=--max-old-space-size=4096`; Next.js 16.2.12 generated 116 static pages and all dynamic routes |
| Prisma schema | Pass with Prisma 7.9.0 |
| Root production dependency audit | Pass, 0 vulnerabilities |
| Mobile `npm ci` | Pass |
| Mobile TypeScript | Pass |
| Expo Doctor | Pass, 21/21 |
| Mobile production dependency audit | Pass, 0 vulnerabilities |
| Expo production configuration | Pass: owner `senzilytics-app`, project `fa7f9a49-5c6a-47c4-82d4-33d747c3d241`, version `1.1.0`, Android/iOS identifier `com.senzilytics.mobile`, production notification mode |
| Root `app.json` absence | Pass; `apps/mobile/app.config.ts` remains the only Expo app configuration |

The first production build attempt under the default 2 GB Node heap was terminated for memory pressure after compilation. The same build passed with a 4 GB heap. This is a CI runner capacity requirement, not an application defect; configure at least 4 GB for the release build gate.

## Web and mobile feature parity

The server-owned, permission-filtered mobile catalog contains 41 modules. Thirty-five have native capability, five intentionally hand off to the responsive web application, and tenant provisioning is reserved for approved platform administrators.

| Area | Native coverage | Governed web handoff / restriction |
| --- | --- | --- |
| Command | Executive Dashboard, Operational Assurance, AI Intelligence, My Tasks | EHS Copilot, Predictive Intelligence, Management Reviews |
| Safety | Observations, Behavior-Based Safety, Incidents, CAPA, Risk Register, JSA/JHA, MOC, Assets, Contractors, Permit to Work, Industrial Hygiene, Occupational Health | Emergency Preparedness, Business Continuity |
| Assurance | SIF Prevention, Certification Readiness, Inspections, Audits | None |
| Governance | Compliance Register, Compliance Calendar, Regulatory Intelligence, Training, Environmental, ESG, Chemicals, Reports | None |
| Administration | Documents, Organization, Users, Workflows, Form Studio health, Integration health, Activity Log | Tenant Provisioning is platform-only |

The handoff modules are leadership, analysis, or plan-authoring experiences rather than offline field-capture gaps. Catalog filtering remains permission-aware, native write capabilities remain separately permission-gated, and every authorized catalog entry resolves to a local application route or secure web handoff. No parity release blocker was identified.

## Governed certification status

| Certification control | Current evidence | Status |
| --- | --- | --- |
| Code quality and automated validation | Lint, 261 tests, TypeScript, production build and production audits pass | Pass |
| Database migration safety | Prisma schema validates; release certification migration is present | Conditional: deploy/rollback and retained-data evidence required on the candidate database |
| Security and access controls | Production audits pass; platform release actions reauthorize platform administrators; automated permission tests pass | Conditional: authenticated manual access test required |
| Tenant isolation regression | Automated tenant-scoping, mobile ownership and cross-tenant tests pass | Conditional: two-tenant authenticated smoke evidence required |
| Authentication and recovery journeys | Public login, forgot-password and account-deletion routes respond | Conditional: credentials, configured SSO, reset, invitation expiry and revocation must be exercised |
| Critical EHS workflows | Automated lifecycle, workflow, notification and reporting tests pass | Conditional: representative authenticated end-to-end journeys required |
| Native mobile compatibility | TypeScript, release-contract tests, Expo production config and Expo Doctor pass | Blocked: signed Android/iOS builds and physical-device offline/push acceptance required |
| Operations, monitoring and rollback | Public health and release-policy endpoints are healthy | Conditional: candidate environment verification, scheduler heartbeat, backup and rollback evidence required |

## Production public smoke

At 2026-07-25 21:50 UTC:

- `/`, `/privacy`, `/support`, `/account-deletion`, `/login` and `/forgot-password` returned HTTP 200.
- `/api/health` returned `ready`, database `available`, and configuration `valid`.
- `/api/mobile/release` returned maintenance disabled and minimum-version enforcement disabled, which is the safe pre-store posture.

This is evidence for the currently deployed production site, not a substitute for smoke testing the remediated candidate after deployment.

## Remaining release sequence

1. Commit the remediation and deploy that exact commit to the release-candidate environment.
2. Run `npx prisma migrate deploy` through the approved deployment workflow and attach migration plus recovery evidence.
3. Run `npm run verify:production` with the candidate environment configuration; do not copy secrets into evidence.
4. Execute authenticated two-tenant, RBAC, SSO/recovery, private-file, workflow, notification, reporting, cron-heartbeat and rollback smoke tests.
5. Record all eight governed checks, assign an eligible pilot tenant, and complete review and pilot gates.
6. Configure EAS authentication outside chat, then queue Android and iOS production builds from the clean certified commit.
7. Record both EAS build IDs/URLs and native version codes in the release record.
8. Complete the physical-device and store-testing checklist in `apps/mobile/STORE_RELEASE_CHECKLIST.md`.
9. Submit first to Play Internal testing and TestFlight; publish only after acceptance and pilot approval.
10. Configure trusted store URLs and version policy only after both approved binaries are available. Keep minimum-version enforcement disabled unless retirement of older clients is intentional.

## Build commands

```bash
cd apps/mobile
npm ci
EXPO_NO_TELEMETRY=1 npm run check
npx eas-cli@latest whoami
npx eas-cli@latest config --platform ios --profile production
npx eas-cli@latest config --platform android --profile production
npx eas-cli@latest build --profile production --platform all --non-interactive
```

EAS authentication was not available in the validation workspace (`Not logged in`; no `EXPO_TOKEN`), so no external build was queued. Store submission must remain blocked until both signed production builds complete successfully.

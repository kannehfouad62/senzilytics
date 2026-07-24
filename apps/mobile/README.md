# Senzilytics Mobile

This Expo/React Native application is the Premium native field workspace for iOS and Android. It uses the existing Senzilytics web platform as its API and identity authority, including credentials, Microsoft Entra ID, and Okta sign-in.

## Included foundation

- Browser-based PKCE authorization without sharing passwords with the app
- Explicit current-account confirmation and secure switching between credentials, Microsoft, and Okta users
- Rotating, device-bound mobile sessions stored in iOS Keychain or Android Keystore
- Tenant, role, account-status, session-version, and Premium-entitlement checks
- Searchable, permission-filtered access to every major Senzilytics operational workspace
- Platform tenant provisioning visibility restricted to approved `@senzilytics.com` platform administrators
- Native Action Center for assigned workflow tasks, CAPA execution, and in-app notifications
- Role-aware CAPA progress, completion, and closure controls using the governed web lifecycle
- Offline safety-observation and incident/near-miss capture using a tenant/user-scoped SQLCipher-encrypted outbox
- Native execution of active inspections assigned to the signed-in lead inspector or team member
- Offline checklist responses with optional linked finding creation and idempotent synchronization
- Native offline Audit start and question execution for authorized managers, lead auditors, and editable Audit team members
- Audit response scoring, required comments/evidence, response options, and automatic findings through the same governed web service
- Native Risk Register with field risk capture, current/residual ratings, control visibility, and governed offline risk reviews
- Native active JSA/JHA briefings with complete job-step, hazard, control, PPE, competency, and emergency-requirement visibility
- Offline JSA/JHA worker acknowledgments preserved against the authenticated tenant user and synchronized idempotently
- Native Compliance Calendar with assignee-scoped work, manager-wide oversight, offline completion submissions, and governed approval or rejection
- Native Training assignments with learner progress, due and expiry visibility, and manager-only completion certification that preserves competency-award rules
- Offline compliance and training writes protected by tenant, user, assignment, permission, subscription, and idempotency checks
- Native Management of Change oversight with impact and risk context, assigned approvals, implementation-task evidence, and governed lifecycle decisions
- Native Permit-to-Work execution with critical-control verification, contractor and worker readiness, atmospheric testing, and lifecycle authorization
- Failed atmospheric tests automatically suspend active permits, while every offline MOC and permit action is tenant-, user-, permission-, and idempotency-protected
- Native Asset and Equipment workspace with identity, condition, inspection, defect, maintenance, criticality, permit, ownership, and due-date visibility
- Offline asset safety inspections with published custom forms, automatic unsafe-condition defects, manual defect capture, governed defect verification, equipment lifecycle decisions, and maintenance start, cancellation, and completion
- Native Contractor Safety workspace with qualification, insurance, authorized-site, required-form, worker induction, medical-readiness, and open Permit-to-Work exposure
- Governed offline contractor qualification decisions that revalidate current insurance, site authorization, and published contractor-form completion before approval
- Native Industrial Hygiene workspace with similar-exposure-group context, agent limits, controls, PPE, exposure results, protected worker identity, and governed assessment lifecycle
- Offline exposure sampling with validation, automatic exposure classification, published assessment forms, and privately uploaded field sheets, chain-of-custody records, photos, and documents
- Privacy-controlled Occupational Health workspace with program readiness, self-only worker views, manager roster administration, enrollment, provider-issued fitness outcomes, work restrictions, certificate references, and due-date monitoring
- Occupational Health mobile contracts deliberately exclude diagnoses, symptoms, treatment, clinical test values, and clinical file uploads
- Native camera, photo-library, and document evidence capture for observations, incidents, inspections, Audit questions, corrective actions, asset inspections, defects, and maintenance completion
- Offline CAPA evidence ordering that blocks the related status update until every queued file is securely registered
- Private evidence uploads with a 10 MB per-file limit, tenant/user authorization revalidation, and SQLCipher-encrypted offline file bytes
- Encrypted cached-workspace startup during a bounded 72-hour offline authorization window
- Automatic idempotent synchronization when connectivity returns
- Published configurable observation forms and custom field validation
- Expo push-token registration with tenant/user ownership enforcement
- Production launcher, adaptive, themed, notification and splash assets
- Store-facing privacy, support and account-request links

## Local setup

Requirements: Node.js 20.19 or newer, an Expo account, Xcode for local iOS builds, and Android Studio for local Android builds.

```bash
cd apps/mobile
npm ci
cp .env.example .env
npx eas-cli@latest login
npx eas-cli@latest init
```

Set `EXPO_PUBLIC_API_URL` to the HTTPS Senzilytics deployment. Keep the URL free of a trailing slash. The EAS project ID is already linked in `app.config.ts` and must not be replaced by an `app.json` file.

The checked-in EAS profiles deliberately contain only the public production API URL. They explicitly bind development, preview, and production builds to the matching EAS environment, so remote builds do not depend on an uncommitted local `.env` file. No API keys or server secrets belong in an `EXPO_PUBLIC_` variable.

Create a development client on a physical device. A native build is required because the encrypted SQLCipher database and Android remote push are unavailable in Expo Go:

```bash
npx eas-cli@latest build --profile development --platform ios
npx eas-cli@latest build --profile development --platform android
npx eas-cli@latest build --profile development-simulator --platform ios
npm start
```

Camera, photo-library, document-picker, and file-system modules are native dependencies. Rebuild an existing development client after applying this release; restarting Metro alone will not add them to an older installed binary.

After Android preview acceptance, create the production-like iOS Simulator build. This profile bundles the application and does not require Metro, an Apple signing certificate, or a registered physical device:

```bash
npx eas-cli@latest config --platform ios --profile preview-simulator
npx eas-cli@latest build --profile preview-simulator --platform ios
```

Install the resulting archive from its EAS build page, or allow EAS CLI to open it in an available iOS Simulator. Push notification delivery still requires a signed build on a physical Apple device.

Configure Apple Push Notification service and Firebase Cloud Messaging credentials through EAS before testing push delivery.

## Backend release

Before using the app, deploy the web commit and its Prisma migration, then add a stable secret of at least 32 characters to local and Vercel environments:

```bash
openssl rand -base64 48
```

Save the value as `MOBILE_TOKEN_SECRET`. Do not reuse `AUTH_SECRET`. If Expo Push Service enhanced security is enabled, also add its server access token as `EXPO_ACCESS_TOKEN`.

Native access is deliberately denied for demo, Essential, and Enterprise tenants. The organization must have the Premium `MOBILE_APPS` entitlement.

## Store builds

The initial Apple listing copy is versioned in `store.config.json`. Review it in App Store Connect before submission. EAS Metadata is currently Apple-only, so use `PLAY_STORE_LISTING.md` when completing Google Play Console. Use `APPLE_STORE_SUBMISSION.md` and `GOOGLE_PLAY_SUBMISSION.md` as working disclosure sheets, prepare approved imagery using `store-assets/README.md`, and work through `STORE_RELEASE_CHECKLIST.md` before uploading a production binary.

Before store submission, approve the included production icons, add current screenshots, complete Apple privacy disclosures and Google Play Data safety, provide a dedicated non-production App Review tenant, and verify the public privacy, support and account-request pages. Never commit review credentials to `store.config.json`.

Then build and submit:

```bash
npx eas-cli@latest build --profile production --platform all
npx eas-cli@latest submit --profile production --platform ios
npx eas-cli@latest submit --profile production --platform android
```

`EXPO_PUBLIC_API_URL` is public configuration, not a secret. If you prefer to manage it in the Expo dashboard instead of `eas.json`, create the same value separately for the development, preview, and production environments and retain each profile's explicit `environment` selection. Confirm the active configuration before a release with `eas config --platform ios --profile production` and `eas config --platform android --profile production`.

Release builds should be exercised against a staging tenant first. Verify sign-in and account switching for credentials, Microsoft, and Okta; role-filtered module visibility; tenant isolation; offline observation and incident capture; native Risk Register capture and review; JSA/JHA briefing and acknowledgment; MOC approval, task, and lifecycle gates; permit control verification, passing and failed atmospheric tests, automatic suspension, and lifecycle gates; asset search and identity visibility; safety-critical inspection evidence; custom Asset Safety forms; automatic and manual defects; repair verification; maintenance start, cancellation, completion, downtime, and evidence ordering; asset return-to-service gates; contractor insurance, site, form, worker, and permit readiness; contractor approval and suspension gates; Industrial Hygiene assessment transitions, sample validation, exposure classification, custom forms, protected worker identity, and sample-evidence ordering; Occupational Health manager and self-only views, program lifecycle, enrollment, due dates, fitness outcomes, restrictions, removal, and explicit absence of clinical-detail fields and clinical file uploads; Compliance Calendar completion and manager review; Training learner progress and manager-only certification; camera, photo-library, and document permission handling; encrypted evidence queuing; assigned inspection and Audit execution; native workflow and CAPA visibility; CAPA progress, closure permissions, and evidence ordering; required-photo validation; automatic finding creation; refresh-token rotation; session revocation; notification delivery; and synchronization after connectivity returns.

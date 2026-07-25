# Senzilytics mobile store release checklist

Use this checklist for version 1.1.0. Store rules and questionnaire wording change; verify each answer in App Store Connect and Google Play Console at submission time.

## Candidate identity and evidence

- [ ] Record the exact Git commit SHA in the governed release candidate.
- [ ] Confirm the Git working tree is clean before both production builds are queued.
- [ ] Record the EAS Android build ID, URL and auto-incremented version code.
- [ ] Record the EAS iOS build ID, URL and auto-incremented build number.
- [ ] Confirm both binaries were produced from the same commit and version `1.1.0`.
- [ ] Attach the release-candidate validation report and build links to the governed `MOBILE_COMPATIBILITY` check.
- [ ] Attach migration, authenticated smoke, tenant-isolation, cron-heartbeat, backup and rollback evidence to the matching governed checks.

## Product and account preparation

- [ ] Confirm `com.senzilytics.mobile` is available and registered in both developer accounts.
- [ ] Confirm the Apple Developer Program and Google Play Console accounts use the intended legal entity.
- [ ] Create a dedicated non-production Premium review tenant with realistic fictional data.
- [ ] Create a least-privilege review user and keep its credentials outside Git.
- [ ] Confirm credential, Microsoft and Okta sign-in against production.
- [ ] Verify tenant administrators can revoke the review device from `/users`.
- [ ] Have qualified counsel review the Privacy Policy, customer terms, retention language and cross-border arrangements.

## Public endpoints

- [ ] `https://www.senzilytics.cloud/privacy` is public and current.
- [ ] `https://www.senzilytics.cloud/support` is public and monitored.
- [ ] `https://www.senzilytics.cloud/account-deletion` is public and the mailbox is monitored.
- [ ] `https://www.senzilytics.cloud/api/health` returns a healthy production response.
- [ ] `https://www.senzilytics.cloud/api/mobile/release` returns a no-store release policy.

## Native configuration

- [ ] App icon is legible on light, dark and themed Android launchers.
- [ ] Splash screen is checked in a preview build; development clients do not accurately show it.
- [ ] Android notification icon is white with transparency and renders correctly.
- [ ] APNs credentials are configured through EAS for iOS.
- [ ] FCM v1 credentials are configured through EAS for Android.
- [ ] `MOBILE_TOKEN_SECRET`, `CRON_SECRET` and `EXPO_ACCESS_TOKEN` are configured in Vercel where applicable.
- [ ] No server secret is stored in an `EXPO_PUBLIC_` variable or committed mobile config.
- [ ] `release-metadata.json` matches the intended store version.
- [ ] The iOS and Android store URLs use only `apps.apple.com` and `play.google.com`.
- [ ] Minimum-version enforcement remains disabled until both approved binaries are available from their stores.

## Functional acceptance

- [ ] Test small and large phones plus an iPad or iPad simulator.
- [ ] Sign in, force-close and reopen the app.
- [ ] Sign out, choose **Use another account**, and verify a second credentials or SSO user can authorize the same device.
- [ ] Confirm each test role sees only its permitted modules in **Workspace** and can open the corresponding responsive workspace.
- [ ] Capture an observation offline, restart offline and synchronize after reconnecting.
- [ ] Capture an incident or near miss offline and verify its tenant, site, reporter, occurrence time and configurable-form answers after synchronization.
- [ ] Confirm an assigned lead inspector and team member can execute an active inspection offline, including compliant, noncompliant and not-applicable responses.
- [ ] Create a finding from a noncompliant mobile response and verify the response/finding relationship after synchronization.
- [ ] Confirm unassigned, completed and closed inspections cannot be downloaded or synchronized by a field user.
- [ ] Start an assigned Audit offline, answer multiple question types, reconnect, and verify start/response history is synchronized in order.
- [ ] Confirm required comments, evidence, response options, not-applicable rules, scoring and automatic Audit findings match the web execution workspace.
- [ ] Confirm **Actions** combines only the signed-in user’s authorized workflow tasks, CAPAs and notifications.
- [ ] Record CAPA progress offline, attach evidence, reconnect, and verify every file is registered before the lifecycle status changes.
- [ ] Confirm update-only roles cannot select **Completed** or **Closed**, while an authorized close role can complete and close the CAPA.
- [ ] Confirm read-only CAPA roles see context and source traceability without mutation controls.
- [ ] Capture observation and incident photos offline, force-close/reopen, reconnect, and verify private evidence is linked to the synchronized record.
- [ ] Select a permitted document and verify the 10 MB limit, unsupported-file feedback, encrypted queue count and private download path.
- [ ] Complete an inspection photo question and a required-photo Audit question; verify evidence synchronizes before the dependent response.
- [ ] Decline camera and photo access and confirm the app explains the limitation without crashing or blocking non-evidence workflows.
- [ ] Confirm users without editable Audit membership cannot download or synchronize Audit execution data.
- [ ] Confirm the 72-hour offline authorization policy and session revocation behavior.
- [ ] Confirm one tenant cannot view or synchronize another tenant's cache, outbox, tasks or notifications.
- [ ] Verify `VIEW_COMPLIANCE` can review native obligations and permits while only `MANAGE_COMPLIANCE` can submit a formal online evaluation.
- [ ] Upload, download, archive and restore a controlled document as `MANAGE_DOCUMENTS`; verify a user without that permission cannot list or transfer files.
- [ ] Download a controlled document for offline use, open/share it offline, then verify sign-out and document-permission removal delete the encrypted copy.
- [ ] Replace a document in the web workspace and verify the native version history and integrity-checked current download are accurate.
- [ ] Register push on a physical device, deliver a test alert and tap it into the **Alerts** view inside **Actions**.
- [ ] Test declined notification permission and confirm core app use remains available.
- [ ] Sign out with and without connectivity and verify protected workspace access is removed.
- [ ] Verify Native Tenant Administration is independently gated by organization, user, workflow, integration-health, and activity-log permissions.
- [ ] Create and edit a site and department online; confirm offline mode remains read-only and the changes are tenant-scoped.
- [ ] Invite a user and confirm the 72-hour activation link is delivered by email but never displayed or cached in the app.
- [ ] Change a test user role/department, suspend and restore the account, and confirm role changes or suspension revoke existing native sessions.
- [ ] Confirm an administrator cannot suspend themselves, revoke the current device from the device list, assign `SUPER_ADMIN`, or remove the final active organization administrator.
- [ ] Revoke another test device and confirm its session and push token stop working immediately.
- [ ] Activate and pause a workflow template; confirm only one active template remains for that entity type and the action appears in the tenant activity log.
- [ ] Review form and integration health; confirm the app never receives SSO issuer/directory identifiers, invitation tokens, passwords, API tokens, webhook URLs, or secret material.
- [ ] Remove each administration permission in turn and verify only the matching encrypted cached data slice is removed.
- [ ] Open **Settings**, refresh diagnostics, and verify app version, API version, service state, database state, live-verification time, and offline queue.
- [ ] Background the app for at least five minutes, return to it, and confirm release policy and live authorization are refreshed without duplicate synchronization.
- [ ] Test a recommended update as non-blocking and a minimum-version update as blocking with the correct store destination.
- [ ] Test maintenance mode with and without a valid encrypted offline snapshot; new sign-in and live synchronization must pause while bounded offline work remains available.
- [ ] Trigger a controlled render failure in a non-production build and confirm the recovery screen does not display credentials, tenant content, or a stack trace.

## Apple submission

- [ ] Review every proposed answer in `APPLE_STORE_SUBMISSION.md` against the final binary and production vendor contracts.
- [ ] Create the App Store Connect record and note its App Store Connect app ID.
- [ ] Complete App Privacy answers for contact information, identifiers, user content and diagnostics actually collected.
- [ ] Confirm data is not declared as tracking unless production practices change.
- [ ] Complete the age-rating questionnaire and export-compliance questions.
- [ ] Add screenshots for every required iPhone and iPad display class.
- [ ] Add review contact information, review credentials and concise sign-in instructions in App Store Connect.
- [ ] Upload the production build to TestFlight and resolve any privacy-manifest email from Apple.
- [ ] Complete external TestFlight review before production App Review.

## Google Play submission

- [ ] Review every proposed answer in `GOOGLE_PLAY_SUBMISSION.md` against the final Android App Bundle and production vendor contracts.
- [ ] Create the app in Play Console and complete the first internal release manually if required.
- [ ] Copy the approved listing from `PLAY_STORE_LISTING.md`.
- [ ] Complete Data safety, App access, Ads, Content rating and Target audience declarations.
- [ ] Provide review credentials in App access and explain that a Premium tenant account is required.
- [ ] Add phone and tablet screenshots, the 512×512 store icon and the approved `store-assets/google-play-feature-graphic.png`.
- [ ] Test the Android App Bundle through Internal testing before closed or production rollout.

## Build and release

Use this rollout order:

1. Deploy the compatible backend with `MOBILE_ENFORCE_MINIMUM_VERSION=false`.
2. Build and submit the new binaries to TestFlight and Play Internal testing.
3. Complete functional, offline, account-switching, diagnostics, and update-flow acceptance.
4. Publish the approved binaries and verify their public store URLs.
5. Configure minimum/recommended versions and both trusted store URLs in Vercel.
6. Set `MOBILE_ENFORCE_MINIMUM_VERSION=true` only when retiring older binaries is intentional.
7. Re-run `npm run verify:production` and verify `/api/health` and `/api/mobile/release`.

```bash
cd apps/mobile
npm ci
npm run check
npx eas-cli@latest config --platform ios --profile production
npx eas-cli@latest config --platform android --profile production
npx eas-cli@latest build --profile preview --platform android
npx eas-cli@latest build --profile preview-simulator --platform ios
npx eas-cli@latest build --profile production --platform all
```

The simulator profile validates production-like iOS behavior without Apple signing. Before TestFlight, also test a signed build on a physical iPhone or iPad. Submit only after preview acceptance. The first Play Console upload may require a manual internal-track release before API-driven submissions are accepted.

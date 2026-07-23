# Senzilytics mobile store release checklist

Use this checklist for version 1.0.0. Store rules and questionnaire wording change; verify each answer in App Store Connect and Google Play Console at submission time.

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

## Native configuration

- [ ] App icon is legible on light, dark and themed Android launchers.
- [ ] Splash screen is checked in a preview build; development clients do not accurately show it.
- [ ] Android notification icon is white with transparency and renders correctly.
- [ ] APNs credentials are configured through EAS for iOS.
- [ ] FCM v1 credentials are configured through EAS for Android.
- [ ] `MOBILE_TOKEN_SECRET`, `CRON_SECRET` and `EXPO_ACCESS_TOKEN` are configured in Vercel where applicable.
- [ ] No server secret is stored in an `EXPO_PUBLIC_` variable or committed mobile config.

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
- [ ] Register push on a physical device, deliver a test alert and tap it into the **Alerts** view inside **Actions**.
- [ ] Test declined notification permission and confirm core app use remains available.
- [ ] Sign out with and without connectivity and verify protected workspace access is removed.

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

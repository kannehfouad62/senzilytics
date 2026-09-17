# Senzilytics mobile 1.2.0 release certification

Date: 2026-09-17  
Release scope: Employee Performance, governed user-module assignment, tenant-approved support access, native-only operational navigation, offline collection assurance, and sign-out lifecycle hardening.

## Certification decision

The source candidate is ready for signed preview builds and governed physical-device acceptance. It is not eligible for store submission until the Android and iOS production build identifiers, authenticated tenant-isolation evidence, offline synchronization evidence, push-notification evidence, and physical-device sign-off are attached to the governed release candidate.

No database migration is introduced by the Phase 5 or Phase 6 mobile release patches.

## Automated evidence

| Gate | Result |
| --- | --- |
| Root tests | Pass — 454 tests |
| Root lint | Pass — 0 errors; 7 pre-existing warnings |
| Root TypeScript | Pass with a 4 GB validation heap |
| Next.js production build | Pass — 131 routes |
| Mobile TypeScript | Pass |
| Expo Doctor | Pass — 21/21 checks |
| Native-only operational regression | Pass — module catalog, Audit Services, Action Center, and Executive Command Center expose no internal web-workspace callback |
| Offline contract regression | Pass — representative research, audit, obligation, observation, incident, inspection, MOC, permit, asset, hygiene, environmental, ESG, assurance, and regulatory records exist in the device envelope, encrypted queue, and server sync contract |
| Sign-out regression | Pass — visible progress, local credential revocation, protected-cache removal, offline-safe completion, and signed-out confirmation |
| Patch integrity | Pass — `git diff --check` |

## Release identity

- Marketing version: `1.2.0`
- Bundle identifier: `com.senzilytics.mobile`
- Android package: `com.senzilytics.mobile`
- Expo project: `@senzilytics-app/senzilytics-mobile`
- EAS project ID: `fa7f9a49-5c6a-47c4-82d4-33d747c3d241`
- Version source: EAS remote
- Build numbering: EAS production auto-increment; iOS must be greater than build `11`

## Native boundary

Tenant operational navigation no longer offers a generic **Open workspace** action. Audit-service engagement summaries, assigned-work context, alerts, executive portfolio records, assurance signals, reports, and AI source summaries stay in the native application.

The system browser remains intentionally limited to authentication, public privacy/support/account-deletion documents, trusted app-store update destinations, and official regulatory publications. These are external identity, policy, distribution, or primary-source destinations rather than tenant operational workspaces.

## Offline assurance

Offline records are encrypted with SQLCipher, isolated by organization and user owner key, queued idempotently, permission-revalidated during synchronization, and retained until the server accepts them. Parent records and private evidence synchronize before dependent lifecycle updates. Signing out removes credentials and the cached workspace while preserving owner-isolated unsynchronized field records so a temporary loss of connectivity does not destroy collected evidence.

Manual acceptance must exercise at least one complete offline/reconnect cycle for:

1. Safety observation and incident capture, including evidence.
2. Assigned inspection and Audit execution.
3. Assigned research questionnaire collection and encrypted draft recovery.
4. Compliance-obligation completion or review.
5. One additional operational family used by the pilot tenant, such as MOC, Permit to Work, asset inspection, environmental data, or SIF verification.

## Remaining signed-build gates

- [ ] Record the exact Git commit SHA used by both builds.
- [ ] Confirm `npx eas-cli@latest whoami` returns the intended Expo account.
- [ ] Generate and accept Android preview and iOS simulator builds.
- [ ] Generate Android and iOS production builds from the same clean commit.
- [ ] Record the EAS build IDs, URLs, Android version code, and iOS build number.
- [ ] Install signed builds on physical Android and iOS devices.
- [ ] Complete the functional checklist in `apps/mobile/STORE_RELEASE_CHECKLIST.md`.
- [ ] Verify APNs and FCM delivery and notification deep-link behavior.
- [ ] Complete authenticated two-tenant isolation and least-privilege role tests.
- [ ] Upload first to Play Internal testing and TestFlight; do not release directly to production.
- [ ] Update store screenshots to show current native modules using fictional data.
- [ ] Attach all evidence to the governed `MOBILE_COMPATIBILITY` release check.

## Build commands

Run from `apps/mobile` on a clean, pushed commit:

```bash
npm ci
npm run check
npx eas-cli@latest whoami
npx eas-cli@latest config --platform ios --profile production
npx eas-cli@latest config --platform android --profile production
npx eas-cli@latest build --profile preview --platform android
npx eas-cli@latest build --profile preview-simulator --platform ios
npx eas-cli@latest build --profile production --platform all
```

Do not paste Expo, Apple, or Google credentials into chat, Git, application configuration, or an `EXPO_PUBLIC_` variable.

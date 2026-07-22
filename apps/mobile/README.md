# Senzilytics Mobile

This Expo/React Native application is the Premium native field workspace for iOS and Android. It uses the existing Senzilytics web platform as its API and identity authority, including credentials, Microsoft Entra ID, and Okta sign-in.

## Included foundation

- Browser-based PKCE authorization without sharing passwords with the app
- Rotating, device-bound mobile sessions stored in iOS Keychain or Android Keystore
- Tenant, role, account-status, session-version, and Premium-entitlement checks
- Assigned workflow tasks and in-app notifications
- Offline safety-observation capture using a tenant/user-scoped SQLCipher-encrypted outbox
- Encrypted cached-workspace startup during a bounded 72-hour offline authorization window
- Automatic idempotent synchronization when connectivity returns
- Published configurable observation forms and custom field validation
- Expo push-token registration with tenant/user ownership enforcement

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

Configure Apple Push Notification service and Firebase Cloud Messaging credentials through EAS before testing push delivery.

## Backend release

Before using the app, deploy the web commit and its Prisma migration, then add a stable secret of at least 32 characters to local and Vercel environments:

```bash
openssl rand -base64 48
```

Save the value as `MOBILE_TOKEN_SECRET`. Do not reuse `AUTH_SECRET`. If Expo Push Service enhanced security is enabled, also add its server access token as `EXPO_ACCESS_TOKEN`.

Native access is deliberately denied for demo, Essential, and Enterprise tenants. The organization must have the Premium `MOBILE_APPS` entitlement.

## Store builds

The initial Apple listing copy is versioned in `store.config.json`. Review it in App Store Connect before submission. EAS Metadata is currently Apple-only, so reuse the approved copy manually in Google Play Console.

Before store submission, add approved production icons and screenshots, complete Apple privacy disclosures and Google Play Data safety, provide a dedicated non-production App Review tenant, and verify the public privacy and support pages. Never commit review credentials to `store.config.json`.

Then build and submit:

```bash
npx eas-cli@latest build --profile production --platform all
npx eas-cli@latest submit --profile production --platform ios
npx eas-cli@latest submit --profile production --platform android
```

`EXPO_PUBLIC_API_URL` is public configuration, not a secret. If you prefer to manage it in the Expo dashboard instead of `eas.json`, create the same value separately for the development, preview, and production environments and retain each profile's explicit `environment` selection. Confirm the active configuration before a release with `eas config --platform ios --profile production` and `eas config --platform android --profile production`.

Release builds should be exercised against a staging tenant first. Verify sign-in for credentials, Microsoft, and Okta; tenant isolation; offline capture; refresh-token rotation; session revocation; notification delivery; and synchronization after connectivity returns.

# Senzilytics Mobile

This Expo/React Native application is the Premium native field workspace for iOS and Android. It uses the existing Senzilytics web platform as its API and identity authority, including credentials, Microsoft Entra ID, and Okta sign-in.

## Included foundation

- Browser-based PKCE authorization without sharing passwords with the app
- Rotating, device-bound mobile sessions stored in iOS Keychain or Android Keystore
- Tenant, role, account-status, session-version, and Premium-entitlement checks
- Assigned workflow tasks and in-app notifications
- Offline safety-observation capture using a tenant/user-scoped SQLCipher-encrypted outbox
- Published configurable observation forms and custom field validation
- Idempotent synchronization and Expo push-token registration

## Local setup

Requirements: Node.js 20.19 or newer, an Expo account, Xcode for local iOS builds, and Android Studio for local Android builds.

```bash
cd apps/mobile
npm ci
cp .env.example .env
npx eas-cli@latest login
npx eas-cli@latest init
```

Set `EXPO_PUBLIC_API_URL` to the HTTPS Senzilytics deployment and copy the EAS project ID created by `eas init` into `EXPO_PUBLIC_EAS_PROJECT_ID`. Keep the URL free of a trailing slash.

Create a development client on a physical device. A native build is required because the encrypted SQLCipher database and Android remote push are unavailable in Expo Go:

```bash
npx eas-cli@latest build --profile development --platform ios
npx eas-cli@latest build --profile development --platform android
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

After replacing placeholder store metadata and adding approved icons, screenshots, privacy disclosures, support URLs, and legal text:

```bash
npx eas-cli@latest build --profile production --platform all
npx eas-cli@latest submit --profile production --platform ios
npx eas-cli@latest submit --profile production --platform android
```

Release builds should be exercised against a staging tenant first. Verify sign-in for credentials, Microsoft, and Okta; tenant isolation; offline capture; refresh-token rotation; session revocation; notification delivery; and synchronization after connectivity returns.

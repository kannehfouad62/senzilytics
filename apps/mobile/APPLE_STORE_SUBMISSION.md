# Apple App Store submission worksheet — Senzilytics 1.0.0

This is an engineering working sheet, not legal advice. Confirm every answer against the final signed binary, production infrastructure, vendor contracts and current App Store Connect wording before submission.

Official references:

- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [App Store Connect Help](https://developer.apple.com/help/app-store-connect/)
- [App privacy details](https://developer.apple.com/app-store/app-privacy-details/)

## App identity

| Field | Proposed value |
| --- | --- |
| App name | Senzilytics |
| Bundle ID | `com.senzilytics.mobile` |
| Version | `1.0.0` |
| Primary category | Business |
| Secondary category | Productivity |
| Privacy Policy URL | `https://www.senzilytics.cloud/privacy` |
| Support URL | `https://www.senzilytics.cloud/support` |
| Marketing URL | `https://www.senzilytics.cloud/` |
| Account/data request URL | `https://www.senzilytics.cloud/account-deletion` |
| Business model | Organization-provisioned enterprise account; no in-app purchase or public account creation |

The listing copy is maintained in `store.config.json`. Screenshots must use only fictional review-tenant information.

## Review account preparation

Create a dedicated non-production Premium tenant and a least-privilege review user. Do not commit its password, recovery details or session tokens.

Before submission, verify that the account:

- remains active for the entire review period;
- has permission to view tasks and notifications and create observations;
- has at least two fictional sites, assigned tasks, notifications and published observation form fields;
- contains no employee, customer, medical, incident or operational production data;
- is excluded from ordinary password-expiry or automated cleanup during review;
- can be revoked immediately after review from the tenant user administration workflow.

## Notes for App Review

Copy this into App Store Connect and replace bracketed values. Keep credentials only in App Store Connect.

```text
Senzilytics is an enterprise EHS, ESG, audit, risk and compliance field workspace. A provisioned Premium organization account is required; users cannot create accounts or buy subscriptions in the app.

Review account
Email: [REVIEW_EMAIL]
Password: [REVIEW_PASSWORD]
Organization: [FICTIONAL_REVIEW_ORGANIZATION]

Sign-in steps
1. Open Senzilytics and select “Sign in securely.”
2. The app opens the Senzilytics browser authorization page.
3. Sign in with the review credentials above.
4. Approve “Authorize Senzilytics Mobile” if prompted.
5. The browser returns to the app through the senzilytics://auth callback.

Suggested review flow
- Home: review fictional assigned workflow tasks and workspace metrics.
- Capture: select a fictional site and save a safety observation.
- Offline behavior: saved records remain encrypted on device and synchronize when connectivity returns.
- Alerts: review fictional tenant notifications.
- Settings: inspect privacy, support, account/data deletion and sign-out controls.

All review data is fictional. The app has no in-app purchases, advertisements, tracking or public account-registration flow. Contact [REVIEW_CONTACT_EMAIL] or [REVIEW_CONTACT_PHONE] if assistance is required.
```

Apple requires complete reviewer access for account-based features. Keep the production backend available during review and explain any non-obvious workflow in the notes.

## App Privacy working map

The current first-party mobile code sends the following information to the Senzilytics service. “Linked” means it is associated with the tenant user account. Proposed selections must be reconfirmed in App Store Connect.

| Apple data type | Current examples | Collected | Linked | Tracking | Purposes |
| --- | --- | --- | --- | --- | --- |
| Contact Info — Name | Provisioned user display name | Yes | Yes | No | App Functionality; Account Management |
| Contact Info — Email Address | Provisioned work email | Yes | Yes | No | App Functionality; Account Management |
| Identifiers — User ID | Tenant-scoped user and organization IDs | Yes | Yes | No | App Functionality; Account Management; Security |
| Identifiers — Device ID | Random app-generated device identifier; push token if enabled | Yes | Yes | No | App Functionality; Security; Notifications |
| User Content — Other User Content | Observation descriptions, configured answers and immediate actions | Yes, when submitted | Yes | No | App Functionality |
| Usage Data — Product Interaction | Notification read state and synchronization actions | Yes | Yes | No | App Functionality |

Items requiring final vendor and production-log verification:

- whether hosting, email, database, Expo push or identity providers retain IP addresses, user agents, diagnostics or support records that must be represented in App Privacy;
- whether any production crash-reporting, analytics or observability SDK is added after this worksheet was prepared;
- whether tenant-specific configurable forms collect additional categories such as health, sensitive, precise location or photos;
- whether any vendor is a service provider or an independent third party under applicable contracts.

Current mobile code does not request contacts, location, camera, microphone, photo library, health, payment or advertising permissions. It contains no advertising SDK and does not use data for cross-company tracking. Change these answers if the final binary or tenant-configured collection changes.

## Security and encryption

- API traffic uses HTTPS.
- Refresh credentials use iOS protected storage with `WHEN_UNLOCKED_THIS_DEVICE_ONLY` accessibility.
- Offline workspace data and the outbox use a SQLCipher database with a random protected key.
- Access and refresh tokens are device-bound, expiring and server-revocable.
- Offline cached access is bounded to 72 hours after server verification.
- The privacy manifest is configured in `app.config.ts`; it does not replace App Privacy questionnaire answers.

The current configuration declares use of exempt standard encryption through `usesNonExemptEncryption: false`. Confirm the export-compliance answer with qualified counsel and against the final dependency graph.

## Final Apple acceptance gate

- [ ] App name, icon, subtitle, description and screenshots consistently represent the app.
- [ ] Screenshot content shows the app in use, not only login or splash screens.
- [ ] Review credentials and contact information are valid.
- [ ] Backend and identity providers are available to App Review.
- [ ] Privacy answers match the signed binary and all third-party SDKs.
- [ ] Age rating and content answers reflect possible tenant-entered EHS records.
- [ ] A signed physical-device build has tested APNs, browser sign-in return and revocation.
- [ ] External TestFlight review succeeds before production submission.

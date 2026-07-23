# Google Play submission worksheet — Senzilytics 1.0.0

This is an engineering working sheet, not legal advice. Confirm every response against the final Android App Bundle, production vendors, tenant configuration and current Play Console form before submitting.

Official references:

- [Google Play Data safety requirements](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111)
- [User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311)

Use `PLAY_STORE_LISTING.md` for listing copy and `store-assets/README.md` for imagery.

## App identity and access

| Field | Proposed value |
| --- | --- |
| App name | Senzilytics |
| Package name | `com.senzilytics.mobile` |
| Category | Business |
| Contact email | `info@senzilytics.com` |
| Website | `https://www.senzilytics.cloud/` |
| Privacy policy | `https://www.senzilytics.cloud/privacy` |
| Account/data deletion | `https://www.senzilytics.cloud/account-deletion` |
| Ads | No |
| Public account creation | No — organizations provision users |
| In-app purchases | No |

## App access instructions

Select that all or some functionality is restricted and provide an active fictional Premium review account in Play Console. Do not commit credentials.

```text
Senzilytics requires an organization-provisioned Premium account.

Email: [REVIEW_EMAIL]
Password: [REVIEW_PASSWORD]
Organization: [FICTIONAL_REVIEW_ORGANIZATION]

Tap “Sign in securely,” enter the credentials in the Senzilytics browser authorization page, approve mobile authorization if prompted, and allow the browser to return to the app. No one-time password, VPN, QR code, paid subscription or external hardware is required for this review account.

The account contains only fictional data. Review Home, Workspace, Capture, Actions and Settings. Actions contains the workflow inbox, corrective actions and alerts. Contact [REVIEW_CONTACT_EMAIL] if access assistance is required.
```

## Data Safety proposed app-level answers

| Question | Proposed answer | Basis |
| --- | --- | --- |
| Does the app collect or share required user data types? | Yes, collects | Account, device and user-submitted workflow data is transmitted to Senzilytics |
| Is all collected data encrypted in transit? | Yes | Production API is HTTPS-only |
| Can users request deletion? | Yes | Public request pathway is provided below |
| Is data used for tracking or advertising? | No | No ads, advertising ID or tracking SDK |
| Is collected data shared with third parties? | Proposed: No | Assumes contracted infrastructure and notification vendors qualify as service providers; legal review required |

Google defines collection as transmitting data off device. Locally encrypted data that later synchronizes still becomes collected when transmitted.

## Data type working map

| Google Play data type | Examples | Handling | Required or optional | Purposes |
| --- | --- | --- | --- | --- |
| Personal info — Name | Provisioned user display name | Collected; linked | Required for signed-in use | App functionality; Account management |
| Personal info — Email address | Provisioned work email | Collected; linked | Required for signed-in use | App functionality; Account management |
| Personal info — User IDs | Tenant user and organization identifiers | Collected; linked | Required | App functionality; Account management; Fraud prevention, security and compliance |
| Device or other IDs | Random app device ID; Expo push token when enabled | Collected; linked | Device ID required; push token optional | App functionality; Fraud prevention, security and compliance |
| App activity — App interactions | Notification read state and synchronization actions | Collected; linked | Required for affected features | App functionality |
| User-generated content — Other user-generated content | Observation descriptions, configured answers, immediate actions and corrective-action progress | Collected; linked | Optional submission | App functionality |
| Photos and videos — Photos / Videos | Evidence captured or selected for authorized tenant records | Collected; linked | Optional unless a tenant Audit or inspection question requires it | App functionality |
| Files and docs — Files and docs | Evidence documents selected for authorized tenant records | Collected; linked | Optional | App functionality |

Do not declare audio, precise/coarse location, contacts, health, financial data, purchases or advertising identifiers for version 1.0.0 unless the final binary or tenant-configured forms actually collect them. Camera, photo/video and document evidence are present and must be represented in the final Data safety answers.

Before final submission, inspect every included SDK and production vendor. Update this worksheet if crash reporting, analytics, camera evidence, file upload, location capture or other collection is added.

## Account and data deletion

The app does not create accounts. Tenant administrators provision and control workplace accounts. Mobile Settings nevertheless exposes a prominent `Account and data deletion` action that opens:

`https://www.senzilytics.cloud/account-deletion`

The public page identifies Senzilytics, explains the organization-admin route, provides a direct request channel, describes verification and identifies possible lawful retention. Confirm that the mailbox is monitored and requests receive a documented response.

## Other Play Console declarations

| Form | Proposed direction |
| --- | --- |
| Ads | No ads |
| Content rating | Complete honestly for enterprise safety content; the app is not directed to children |
| Target audience | Adults / workplace users; not designed for children |
| News | Not a news app |
| Government | Not a government app |
| Financial features | None |
| Health apps | The app manages workplace EHS records but does not diagnose, treat or provide consumer medical services; re-evaluate if occupational-health mobile collection is added |

## Final Google Play acceptance gate

- [ ] First Android App Bundle is uploaded to Internal testing.
- [ ] App access credentials work without VPN, MFA or external hardware.
- [ ] Data Safety answers match every SDK and production service.
- [ ] Account-deletion URL loads publicly and presents a direct request path.
- [ ] Phone and tablet screenshots contain fictional information only.
- [ ] Store icon and feature graphic use the approved Senzilytics identity.
- [ ] Content rating and target audience are completed accurately.
- [ ] Physical-device push delivery, offline synchronization and sign-out are accepted.
- [ ] Camera, photo selection and document evidence permissions are disclosed and accepted on physical devices.

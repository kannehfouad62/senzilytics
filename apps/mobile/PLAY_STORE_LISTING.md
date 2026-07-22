# Google Play listing — Senzilytics 1.0.0

## Store presence

**App name**  
Senzilytics

**Short description**  
Secure EHS, ESG, audit, risk and compliance intelligence for field teams.

**Full description**

Senzilytics gives authorized users of Premium tenant organizations a secure field workspace for environmental, health, safety, ESG, audit, risk and compliance operations.

Review assigned workflow tasks and alerts, capture governed safety observations, complete organization-configured fields and continue working when connectivity is unreliable. Encrypted offline submissions synchronize with the correct tenant and user workspace when connectivity returns.

Security and governance are built into the experience:

- Organization, account, role, permission and subscription checks
- Browser-based sign-in with Senzilytics credentials, Microsoft or Okta
- Device-bound rotating sessions
- Encrypted credential and offline-record storage
- Tenant- and user-scoped synchronization
- Administrator-controlled mobile-session revocation

A provisioned Senzilytics Premium tenant account is required. The mobile app does not sell subscriptions or create public user accounts.

**Category**  
Business

**Contact email**  
info@senzilytics.com

**Website**  
https://www.senzilytics.cloud/

**Privacy policy**  
https://www.senzilytics.cloud/privacy

**Account and data deletion**  
https://www.senzilytics.cloud/account-deletion

## Data safety working sheet

Confirm the final answers in Google Play Console against the production build and legal review. The current application design processes:

| Data category | Examples | Purpose | Linked to user | Tracking |
| --- | --- | --- | --- | --- |
| Personal information | Name, work email, organization and role | Account management and app functionality | Yes | No |
| User IDs | Tenant user ID and generated device ID | Authentication, security and tenant isolation | Yes | No |
| User-generated content | Safety observations, configured form answers and workflow activity | Core EHS and compliance functionality | Yes | No |
| Device identifiers | Expo push token, device name and platform | Security sessions and requested notifications | Yes | No |
| Diagnostics and security events | Request timestamps, IP address, user agent and failure events | Security, fraud prevention and reliability | Usually | No |

Data is encrypted in transit. Credentials use protected device storage and the offline database uses SQLCipher. The app currently does not request location, contacts, camera, microphone, health, advertising ID or payment permissions. Service-provider processing and any customer-specific configuration must be reflected accurately in the final disclosure.

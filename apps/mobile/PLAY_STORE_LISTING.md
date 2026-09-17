# Google Play listing — Senzilytics 1.2.0

## Store presence

**App name**  
Senzilytics

**Short description**  
Native EHS, ESG, audit, research and compliance intelligence for teams.

**Full description**

Senzilytics gives authorized users of Premium tenant organizations a secure native workspace for environmental, health, safety, ESG, audit-service, research, risk, compliance, employee-performance and executive operations.

Review assigned workflow tasks and alerts, record governed corrective-action progress, capture safety observations and incidents, execute assigned inspections and Audits, collect governed research responses, review operational intelligence, complete organization-configured fields and continue working when connectivity is unreliable. Encrypted offline submissions and evidence synchronize with the correct tenant and user workspace when connectivity returns. Operational module navigation remains inside the native app.

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
| User-generated content | Observations, incidents, inspection and Audit responses, corrective-action progress, configured answers and evidence documents | Core EHS and compliance functionality | Yes | No |
| Photos and videos | Photos captured or selected as authorized EHS evidence | Core EHS and compliance functionality | Yes | No |
| Device identifiers | Expo push token, device name and platform | Security sessions and requested notifications | Yes | No |
| Diagnostics and security events | Request timestamps, IP address, user agent and failure events | Security, fraud prevention and reliability | Usually | No |

Data is encrypted in transit. Credentials use protected device storage and the offline database uses SQLCipher. The app requests camera, photo-library, or document access only when a user chooses the corresponding evidence action. It does not request location, contacts, microphone, health, advertising ID or payment permissions. Service-provider processing and any customer-specific configuration must be reflected accurately in the final disclosure.

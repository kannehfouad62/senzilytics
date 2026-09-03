# Research Data Collection Release

## Included in this increment

- Collection waves locked to an immutable published questionnaire version.
- Tenant-user respondent/enumerator assignments with due dates.
- Permission-filtered **My Questionnaires** workspace.
- Consent enforcement, server-side field validation and final submission.
- In-app and eligible mobile-push assignment notifications.
- Collection progress and assignment register.
- Permission-controlled CSV export that opens in Excel.
- Identified, pseudonymized and anonymous export behavior.
- Formula-injection protection for spreadsheet exports.
- Activity-log records for wave creation, assignment, lifecycle changes and submission.

## Governed operating sequence

1. Complete the questionnaire draft and select **Publish**.
2. Move the research project through approval to **Active**.
3. Open the questionnaire list and select **Data Collection**.
4. Create a collection wave. The currently published questionnaire version is locked to it.
5. Assign tenant users who have `COLLECT_RESEARCH_DATA` permission.
6. Activate the wave after at least one assignment exists.
7. Respondents open **Research & Analytics → My Questionnaires** and submit their response.
8. Monitor completion from the collection page and export the governed dataset when authorized.
9. Pause or close the wave when collection is suspended or complete.

## Deliberately deferred security increments

Public anonymous-link collection, external participant invitations, encrypted offline mobile questionnaires, response correction/query workflows, automated SLA reminders, advanced statistical analysis, Excel workbook generation and PowerPoint chart export require their own controlled implementation and validation. The current release does not expose an unauthenticated response endpoint.

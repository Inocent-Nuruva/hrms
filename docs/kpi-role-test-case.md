# KPI end-to-end UAT test case

Use this after the updated frontend and backend have been deployed to UAT and backend migrations have run. A Git push alone does not deploy UAT. In particular, the backend must have migration `1797900040000-KpiAchievementActivities`; otherwise **Add Activity** still fails with `relation "phase3_kpi_achievement_activities" does not exist`. Browser system alerts also need VAPID keys configured on the backend and notification permission enabled in each test browser.

## Accounts and test data

Use four test accounts in **the same active company**:

| Account | Required role or permissions | Purpose |
| --- | --- | --- |
| HR | `HR_MANAGER` or `COMPANY_ADMIN`, with company scope | Create the reporting period; configure time zones; create and publish a KPI. |
| Manager | `DEPARTMENT_MANAGER` or `BRANCH_MANAGER`, with access to the test employee | Assign a KPI, revise its target, review the employee's result. |
| Employee | `EMPLOYEE`, linked to an active employee record | Receive the assignment; record activities and submit the final actual. |
| Custom | A separate role with the explicit permissions in the role matrix below | Check permission-based KPI creation and assignment. |

Choose one dedicated test employee whom the manager can see in the employee directory. Write down the employee name and employee number. Use a fresh suffix each time you repeat this case; this example uses `QA1120A`. The KPI code must be unique within the company.

The copyable dates below assume a test on **20 November 2026**. If testing later, use an unused date range that includes the day on which you will record activities. Keep the activity date between the period's start and end dates. If the exact period date range already exists, choose another unused range or reuse the existing period for later steps.

## 1. HR: create and check a reporting period

Open **KPI & Performance → Reporting Periods** (`/dashboard/kpi/periods`) and select **Create period**.

| Field | Enter | Meaning |
| --- | --- | --- |
| Period name | `QA Nov 20–30 2026 QA1120A` | Human-readable label shown on assignments and scorecards. |
| Frequency | `Monthly` | Must match the KPI's reporting frequency. |
| Start date | `2026-11-20` | First allowed activity date. |
| End date | `2026-11-30` | Last allowed activity date. |
| Time zone | `Africa/Dar_es_Salaam` | IANA time zone stored with this period. |

Continue, review, and select **Create period**. Expected: a success message; on **Return to list**, the row appears without a browser refresh and displays `Africa/Dar_es_Salaam`. For an older row showing **Not configured**, select **Configure**, enter `Africa/Dar_es_Salaam`, and save. Expected: the row updates without a refresh.

The period announcement may also appear in employees' notification bells. It says a period is available; it does **not** mean a KPI has been assigned.

## 2. HR or manager: create and publish a KPI definition

Open **KPI Library** (`/dashboard/kpi`), select **Create KPI**, then use the guided form.

| Field | Enter | Meaning |
| --- | --- | --- |
| KPI name | `QA Policy Renewals QA1120A` | Name employees and reviewers see. |
| KPI code | `QA_POLICY_RENEWALS_QA1120A` | Unique, stable identifier; use letters, digits, and underscores. |
| Category | `Operations` | Grouping for the library and reports. |
| Strategic objective or purpose | `Complete more policy renewals` | Why this measure exists. |
| Description | `Count policies renewed by the assigned employee during this reporting period.` | Tells the employee exactly what to count. |
| Measurement type | `Number or count` | The actual and target will be numbers. |
| Performance direction | `Higher is better` | More renewals are better. |
| Measurement unit | `policies` | Label displayed beside target and actual. |
| Reporting frequency | `Monthly` | Must match the period selected in step 1. |
| Period for the next assignment | `QA Nov 20–30 2026 QA1120A` | Carries the selection into the assignment form; it does not create an assignment. |

Review and select **Save & Publish**. Expected: the KPI appears as **Published** in the library; clicking its row opens its details. If you choose **Save Draft** instead, publish it before assignment. A duplicate KPI code should be rejected; change the suffix rather than retrying the same code.

## 3. Manager or HR: assign it to the test employee

Open **KPI Assignments** (`/dashboard/kpi/assignments`) and select **Assign a KPI**.

| Field | Enter | Meaning |
| --- | --- | --- |
| Subject type | `Employee` | This test creates a personal KPI assignment. |
| Authorized subject | Search for and **select** the test employee | The recipient; typing a name without selecting a result does not set the employee ID. |
| Responsible manager | Select the test manager, if offered | Optional reviewer responsible for the assignment. |
| Published KPI | `QA_POLICY_RENEWALS_QA1120A` | The immutable published definition. |
| Reporting period | `QA Nov 20–30 2026 QA1120A` | Dates used for this assignment. |
| Target | `10` | Goal for this employee in this period: 10 policies. |

Review and select **Create assignment**. Expected: one active assignment appears with target `10`, and the employee receives **KPI assigned to you** with a link to **My KPIs**. The employee should see the assignment at `/dashboard/me/kpi`. Creating the same KPI for the same employee in an overlapping active period should be rejected; do not keep retrying it.

### Notification channel checks

On the employee account, open **Notification settings → KPI & Performance → KPI Assigned**. For each channel you want to test, turn it on. The system must also have that channel enabled and configured: email needs mail delivery, SMS needs its gateway, and mobile push needs a registered mobile device. Desktop browser alerts need **Desktop notifications → Enable**, browser permission, backend VAPID configuration, and the in-app channel enabled.

For an **in-app** check, keep the employee tab focused while a *new* assignment is created; expect a popup and an item in the notification bell. For a **minimized or closed** check, minimize or close the employee tab before another *new* assignment is created; expect a system notification. Use a different KPI code or a non-overlapping period for each additional assignment. Reusing the same assignment will not send a fresh notification.

## 4. Manager: revise the target

In **KPI Assignments**, open the row's **Actions → Revise target** (or use **Target Revisions**). Select this assignment and enter:

| Field | Enter | Meaning |
| --- | --- | --- |
| New target | `12` | Replaces the current goal but keeps the original in history. |
| Reason | `QA test: two additional accounts allocated` | Required explanation for the change. |

Save. Expected: current target becomes `12`, with a second target revision and its reason visible in the assignment's history.

## 5. Employee: record activities and submit

Sign in as the assigned employee. Open **My KPIs** (`/dashboard/me/kpi`), select **QA Policy Renewals QA1120A**, then **Add Activity**. Enter the first record:

| Field | Enter | Meaning |
| --- | --- | --- |
| Activity date | `2026-11-20` | Date work happened; must be within the reporting period. |
| Activity title | `Renewal batch A` | Short name for the work. |
| Work performed | `Contacted customers and completed three policy renewals.` | Supporting account of the activity. |
| Result | `3` | Measurable result for this activity, in policies. |
| Comments | `QA test activity 1 of 2` | Optional context for reviewer. |
| Evidence attachment | Optional small PDF or PNG containing test data, under 10 MB | Private supporting file; reviewers can access it. |

Save. Expected: the activity appears without `relation ... does not exist`; any attachment shows on the activity. Add a second activity on `2026-11-20` titled `Renewal batch B`, work performed `Completed five more policy renewals.`, result `5`, and comments `QA test activity 2 of 2`.

Choose **Submit Achievement** or **Review & Submit**. Enter **Final actual** `8` and supporting comments `Eight renewals completed: three in batch A and five in batch B.` Review the summary, then select **Submit for manager review**. The activity results are supporting details; the app does not automatically add them to the final actual. Expected: the revision becomes **Submitted**, and editing is locked while it awaits review.

## 6. Manager: review and decide

Sign in as the responsible manager. Open **Achievement Reviews** (`/dashboard/kpi/reviews`), find the employee and period, then open the submission. Check the target `12`, final actual `8`, both activities, comments, and evidence. Select **Start review** if shown. Enter review comments `QA test: activities and evidence support eight renewals.` and select **Approve**. Expected: status becomes **Approved** and the approved actual can be used by scorecards.

For a separate negative path, create another assignment and submission, then select **Return for correction** with a reason. Expected: the employee sees the feedback and can use **Prepare correction**. Do this on separate test data so the approved example stays available for the scorecard check.

## 7. Manager or HR: optional scorecard check

Open **Scorecards → Create scorecard** (`/dashboard/kpi/scorecards/new`). Enter identifier `QA_CARD_QA1120A`, name `QA Renewal Scorecard QA1120A`, description `QA approved-result check`, **Scorecard for** `Employee`, select the same employee and reporting period, set **Scorecard mode** to **Strategic status only**, and add the active KPI assignment. Leave **Scoring policy** blank and **Weight** at `0` for strategic mode. Save the draft, open its details, then publish the configuration. Expected: the approved actual `8` is visible; strategic mode does not calculate an overall weighted score. If testing **Weighted evaluation**, choose a published scoring policy and make weights total exactly 100% before publishing.

## Role and permission checks

| Action | HR / company admin | Department or branch manager | Normal employee | Custom role with permissions |
| --- | --- | --- | --- | --- |
| Create period or set its time zone | Yes, with company scope | No | No | No; the API still requires `HR_MANAGER` or `COMPANY_ADMIN`. |
| Create/publish KPI definition | Yes | Yes | No | Yes with `kpi_definitions:create` in an active company. |
| Assign KPI / revise target | Yes | Yes, within authorized scope | No | Yes with `kpi_assignments:create` / `kpi_targets:revise` **and** a matching `data_scope:company`, `data_scope:department`, `data_scope:branch`, or `data_scope:team`. |
| Search employees in assignment form | With directory access | With directory access | Not applicable | Also needs `employees:read`; department/branch searches need `departments:read` / `branches:read`. |
| See own assignment and submit activities | If also the assigned employee | If also the assigned employee | Yes, for own active assignment | The activity endpoints require the `EMPLOYEE` role and the assigned employee identity; KPI management permissions alone do not grant this. |
| Review an employee achievement | Yes, within scope | Yes, within scope | No | The review endpoints require an HR/admin or manager role; assignment permissions alone do not grant review. |
| Create/publish scorecard | Yes | Yes, within scope | No | Requires an HR/admin or manager role. |

Check denial as well as success: an employee should not see another person's assignment or activity, a manager should not assign someone outside their scope, and a custom role without the relevant permission should not be able to perform that action. A missing menu item and an API **403 Forbidden** are both valid access-control results; **500** is not.

## Record your result

For each step, record account/role, browser, period ID, KPI code, assignment ID, expected result, actual result, and any error text or request ID. If Add Activity still reports a missing relation after deployment, check the UAT migration ledger for `KpiAchievementActivities1797900040000` before retrying. If a notification is absent, check the employee's preference, global channel setting, and the channel's delivery configuration before creating another assignment.

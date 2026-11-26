# KPI workflow test data — QA1126B

Use this data in the running HRMS to test the complete manager-led KPI flow. The date set assumes testing on **26 November 2026** in **Africa/Dar_es_Salaam**. Keep every record in one active company. The suffix `QA1126B` keeps these records separate from earlier QA runs. The records below have now been created through the local API; use their IDs to inspect the same data in the UI.

The manager creates and manages KPI definitions, assignments, scorecards, and achievement decisions. HR creates the reporting periods, scoring policy, scorecard template, and evaluation setup. Employees record work and submit their own results. This matches the roles enforced by the running API: the manager received HTTP 403 when attempting to create a scoring policy.

## People and record sheet

| Role | Test account | Record ID / observation |
| --- | --- | --- |
| HR | HR test account, user ID 3 | Company 1 |
| Manager | Jasson Kalemera, user ID 4 | Employee ID 2; company 1 |
| Bosco | Bosco Odillo (AIC-EMP-1003), user ID 5 | Employee ID 3; company 1 |
| Second-period employee | Bosco Odillo again, in the separate correction period | Employee ID 3 |

Record the actual period ID, KPI codes and IDs, assignment IDs, policy ID, scorecard IDs, cycle ID, and evaluation ID as you go. Use the employee directory to select each person rather than typing a name without selecting a result.

## 1. HR — reporting period

Open **KPI management → Reporting periods**. Create:

| Field | Value |
| --- | --- |
| Name | `KPI workflow QA · 26–30 Nov 2026 · QA1126B` |
| Frequency | Monthly |
| Start | `2026-11-26` |
| End | `2026-11-30` |
| Time zone | `Africa/Dar_es_Salaam` |

Expected: the dialog closes after creation; the period is immediately selectable in KPI creation without refreshing. Its time zone is readable in the list. If the exact period already exists, reuse it and note its ID instead of making a duplicate.

Created period **#5** for 26–30 November and second period **#6** for 26 November–1 December. Dialog behavior still needs a browser check.

## 2. Manager — KPI Library

Create each KPI with **Save & Publish**, selecting the period above on the planning step. Codes are generated from names; use the codes below to make this run easy to locate. Set **Reporting frequency** to **Monthly** for all four.

| Field | KPI A | KPI B | KPI C | KPI D |
| --- | --- | --- | --- | --- |
| Name | `QA1126B Policy renewals` | `QA1126B On-time case handling` | `QA1126B Claim turnaround` | `QA1126B Complaint closures` |
| Code | `QA1126B_POLICY_RENEWALS` | `QA1126B_ON_TIME_CASE_HANDLING` | `QA1126B_CLAIM_TURNAROUND` | `QA1126B_COMPLAINT_CLOSURES` |
| Category | Operations | Service | Claims | Service |
| Strategic objective | Renew policies accurately | Resolve cases on time | Shorten claim handling | Close customer complaints |
| Description | Count completed policy renewals in this period. | Percentage of assigned cases completed by their due date. | Average hours from claim receipt to resolution. | Count complaints resolved with a recorded outcome. |
| Measurement type | Number or count | Percentage | Time or duration | Number or count |
| Direction | Higher is better | Higher is better | Lower is better | Higher is better |
| Unit | policies | % | hours | complaints |

Expected: four **Published** rows appear immediately, with the correct category filter and definition details. A manager sees their own definitions; another manager should not see these definitions unless permitted by scope. Do not assign anything during this step.

Created and published KPI definitions **#18 A**, **#19 B**, **#20 C**, and **#21 D**. C and D were revised to use period #6 (published revision IDs **#23** and **#24**). Immediate UI refresh and cross-manager visibility remain to verify in the browser.

## 3. HR — scoring policy

Open **Scoring policies → Create scoring policy**, complete all five steps, then **Save & publish**.

| Field | Value |
| --- | --- |
| Policy name | `QA1126B Weighted KPI policy` |
| Identifier | `QA1126B_WEIGHTED_KPI_POLICY` |
| Scoring method | Weighted score |
| Minimum score / Maximum score / Score cap | `0` / `100` / `100` |
| Decimal places / Exact target tolerance | `2` / `0` |
| Missing result / Not applicable | Block scoring / Block scoring |
| Rating bands | Unsatisfactory `0–60`; Needs Improvement `60–70`; Satisfactory `70–80`; Good `80–90`; Excellent `90–100` |
| Qualitative rubric | Leave empty; these KPIs are numeric |

Expected: the policy is Published and available in scorecard creation. The contiguous rating bands should be accepted without gaps or overlaps.

Manager creation returned HTTP 403, `KPI role and active company are required`. HR created and published policy **#3**, version **#3**. This role restriction is enforced by the API and reflected in the frontend.

## 4. Manager — assignments and target history

Open **KPI Assignments → Assign a KPI**. Assign KPI A and B to Bosco; KPI C and D to Bosco. Use the preferred reporting period saved with each KPI.

| Employee | KPI | Initial target | Responsible manager |
| --- | --- | --- | --- |
| A | A: Policy renewals | `10` policies | Test manager |
| A | B: On-time case handling | `90`% | Test manager |
| B | C: Claim turnaround | `48` hours | Test manager |
| B | D: Complaint closures | `8` complaints | Test manager |

Then use **Revise target** on A: new target `12`, reason `QA1126B: two additional renewal accounts allocated`.

Expected: four active rows are searchable; each shows the employee name, assigner and assignment date. Bosco sees two KPIs with target 12 and 90. Target history retains 10 and the reason. Bosco sees only their own two KPIs. The employee receives the assignment and target revision notifications in enabled channels; a missed in-app event appears after login.

Created assignments **#14 A**, **#15 B**, **#16 C**, **#17 D** for Bosco. A target revision 2 changed 10 to 12 and retained two history entries. Bosco has four QA assignments across the two periods, so the expected UI result is four total, grouped or filtered by period.

## 5. Bosco — activity journal and official results

In **My Performance → My KPIs**, open A and record two separate activities:

| Field | Activity 1 | Activity 2 |
| --- | --- | --- |
| Date | `2026-11-26` | `2026-11-26` |
| Title | `QA1126B renewal batch one` | `QA1126B renewal batch two` |
| Work performed | `Renewed four motor policies after customer confirmation.` | `Renewed five property policies after document checks.` |
| Measurable result | `4` | `5` |
| Comments | `Four policy references checked.` | `Five policy references checked.` |
| Evidence | Optional private PDF or PNG under 10 MB | Optional private PDF or PNG under 10 MB |

The journal should show **2 activities**. Select **Submit KPI**, enter official final actual `9` policies and comment `Nine renewals completed across the two recorded batches.` Save a draft first, confirm it is still editable, then submit to manager.

Open B and record an activity dated `2026-11-26`: title `QA1126B on-time case audit`, work performed `Reviewed 100 assigned cases; 81 were completed by their due date.`, measured result `81`, comment `Audit denominator: 100 cases.` Submit official final actual `81`% with comment `81 of 100 cases were completed on time.`

Expected: activity totals are supporting work. They do not silently fill or change the official final actual. A's result is 9 and B's is 81; both become Submitted and are no longer editable pending review.

Achievement **#7 A** has two activities and was submitted with official actual 9, then approved. Achievement **#8 B** has one activity and was submitted with official actual 81, then approved. A later approved correction changed A's current actual to 10; revision 1 preserves 9.

## 6. Bosco and manager — return path in the second period

Bosco opens C, records one activity dated `2026-11-26`: title `QA1126B claim timing sample`, work performed `Checked claim receipt and closure timestamps.`, measured result `60`, comment `Initial sample lacks two closure references.` Submit final actual `60` hours with the same comment.

Manager opens **Achievement Reviews**, searches for Bosco, opens C, selects **Start review**, then **Return for correction** with reason `QA1126B: attach the missing closure references and correct the average.`

Expected: Returned remains visible under the appropriate filter; Bosco sees feedback and a way to prepare and resubmit a correction. Bosco corrects the result to `44` hours, adds comment `Recalculated after checking all closure timestamps.`, and resubmits. Manager approves the corrected revision with feedback `QA1126B: corrected timing and evidence verified.` The original 60-hour revision and return reason remain in history.

Achievement **#9 C** was submitted at 60, returned, then revised by Bosco to 44 and approved. API history retains revision 1 as returned and revision 2 as approved. Assignment #17 D remains without an achievement.

Leave D **without a submission**. This is the genuine missing-data case; it must not appear as zero or approved.

## 7. Manager — approve Bosco

In **Achievement Reviews**, find A and B for Bosco. Inspect target, official actual, comments, activities and any evidence. Start review if offered, then approve each:

| KPI | Manager feedback |
| --- | --- |
| A | `QA1126B: nine renewals match the activity journal.` |
| B | `QA1126B: on-time audit supports 81 of 100 cases.` |

Expected: both approved records remain findable in **All** or **Approved**, even though **Awaiting review** becomes zero. Bosco receives decision notifications. Bosco's D remains missing.

## 8. HR template, manager scorecards

HR opens **Scorecard Templates → Create template**. Enter name `QA1126B weighted employee template`, identifier `QA1126B_WEIGHTED_EMPLOYEE_TEMPLATE`, mode **Weighted score**, published KPI A weight `60` and KPI B weight `40`, and the published QA1126B scoring policy. Save and publish the template. Verify that weights `60 + 40 = 100` are accepted and `60 + 30` is rejected.

Manager selects **Use template**. Set new scorecard identifier `QA1126B_BOSCO_PERFORMANCE`, subject type **Employee**, Bosco, and the QA1126B reporting period. This creates a scorecard draft; open it and publish its configuration. Check that the generated scorecard contains the two matching assignments and policy.

If the template flow fails, record the failure, then use **Scorecards → Create scorecard** with the same values below so the remaining checks can continue:

| Field | Value |
| --- | --- |
| Name / identifier | `QA1126B Bosco performance` / `QA1126B_BOSCO_PERFORMANCE` |
| Description | `Weighted result from two approved November QA KPIs.` |
| Scorecard for | Bosco |
| Reporting period | QA1126B period |
| Responsible manager | Test manager |
| Mode / policy | Weighted evaluation / published QA1126B policy |
| A: Policy renewals | Required, weight `60`% |
| B: On-time case handling | Required, weight `40`% |

Expected before approval: incomplete or awaiting approved data. Expected after both approvals: **100% data complete** and, for the standard higher-is-better policy, A contributes `45.00` points (`9 / 12 × 60`), B contributes `36.00` points (`81 / 90 × 40`), giving a live score of **81.00%** and the **Good** band. Compare the UI with the authoritative score returned by the API; the API is the source of truth if the configured policy differs.

HR created and published template **#1**. Manager used it to create and publish scorecard **#3**. API initially returned **81**, **Good**, **100% complete**, with contributions 45 and 36. After the approved correction, it returns **86**, contributions 50 and 36.

Create a second scorecard manually in **Strategic status only** mode for Bosco with both C and D, weight `0` on each and no scoring policy. Expected: C shows its approved result, D shows missing data, and no combined weighted score is invented.

Manager created and published strategic scorecard **#4**. C is `scored`, D is `awaiting_data`, and `overallScore` is null. The API returns `completenessPercent: "0"` because strategic entries have zero weight and the scoring function calculates completeness by applicable weight. The frontend now labels this scorecard **Status only** and shows **Approved results: 1 of 2** instead of presenting the API's weight-based 0% as data completeness.

## 9. HR, employee, manager — evaluation

HR creates and publishes a review template:

| Field | Value |
| --- | --- |
| Name / identifier | `QA1126B monthly review` / `QA1126B_MONTHLY_REVIEW` |
| Competencies, one per line | `Job knowledge` / `Quality of work` / `Communication` |
| Scale, one per line | `1:Below Expectations` / `2:Needs Improvement` / `3:Meets Expectations` / `4:Exceeds Expectations` / `5:Outstanding` |
| Require HR review | On |

HR creates a **cycle draft** with name `QA1126B November review`, identifier `QA1126B_NOVEMBER_REVIEW`, Monthly frequency, the QA1126B reporting period and published template. Use start `2026-11-26`, end `2026-11-30`, employee deadline `2026-11-27`, manager deadline `2026-11-28`, HR deadline `2026-11-29`, acknowledgement deadline `2026-11-30`. Keep soft deadlines. Open the cycle, then enroll Bosco with the test manager and Bosco's **published** scorecard.

Bosco completes self-assessment:

| Field | Value |
| --- | --- |
| Key achievements | `Completed nine policy renewals and handled 81 of 100 cases on time.` |
| Challenges | `Two renewal cases required extra document checks.` |
| Observations | `Batch tracking made renewal evidence easier to review.` |
| Development needs | `Improve early escalation of cases approaching due dates.` |
| Future goals | `Reach twelve renewals and at least 90% on-time handling next period.` |
| Overall comments | `QA1126B employee self-assessment.` |
| Competency ratings | Job knowledge `3`, Quality of work `4`, Communication `3` |

Save a draft, then submit. Manager reviews the approved KPI snapshot and enters Strengths `Accurate renewal tracking`, Development needs `Earlier overdue-case escalation`, Feedback `Good performance with room to improve on-time handling`, Recommendations `Use weekly due-date checks`, and competency ratings `3`, `4`, `3`. Save draft, then submit manager review.

HR records review comment `QA1126B: KPI data and reviews checked.`, records the required HR review, approves, then finalizes. Bosco acknowledges receipt with `QA1126B: received.` Expected: the finalized evaluation retains its scorecard snapshot and history.

HR created and published evaluation template **#1**, version **#1**, and opened cycle **#1**. Bosco was enrolled in evaluation **#1** against scorecard #3. Bosco saved and submitted self-assessment; Jasson saved and submitted manager review; HR reviewed, approved, and finalized; Bosco acknowledged. Final snapshot score is **81**.

## 10. Manager — approved correction after finalization

Return to Bosco's approved KPI A in **Achievement Reviews**. Select **Create correction draft** and confirm. Bosco should receive a notification, see a draft revision, change the official actual from `9` to `10`, add comment `One additional completed renewal was verified.`, and submit it. Manager approves with `QA1126B: additional renewal verified.`

Expected: the **live** scorecard updates to `50.00 + 36.00 = 86.00%` for the same standard policy. The **finalized evaluation** stays at its recorded `81.00%` snapshot. The approved 9, correction draft, submitted 10, and final approval remain in history.

Confirmed through API: achievement #7 revision 2 is approved at **10**; scorecard #3 live score is **86**; finalized evaluation #1 snapshot remains **81**. The evaluation endpoint also presents its embedded scorecard snapshot as 81.

## 11. Insights, reports, permissions and notifications

- Manager **Insights**: filter Bosco and both reporting periods. Check approved, returned, and missing status counts at the intermediate checkpoints. Select a person to open their details; close and return without losing filters.
- **Reports**: generate the KPI report for this period and permitted scope. Confirm names instead of `employee #id`, assignment counts, approved actuals, and scorecards. Check PDF and Excel if enabled.
- Bosco: verify My KPIs, My scorecards, individual scorecard detail, My evaluations and notification links. Bosco should see only his own records.
- Manager: verify Bosco is visible in the manager's scope and an unrelated employee is not. HR may see assignments in authorized scope but another manager's private definitions should stay hidden.
- Notification checks: assignment, target revision, submitted achievement, approval, return, approved correction draft, evaluation stages. Inspect in-app bell and any configured email, SMS or browser push channels. Test one event while signed out, then sign in and verify it is not lost.
- Negative checks: duplicate KPI code, duplicate assignment for the same KPI and overlapping period, publish without a selected period, scorecard weights not totaling 100%, missing required results at evaluation finalization, and unauthorized cross-company access. Record the exact UI and API error; a 500 is a defect.

## Findings log

| Step | Role | Record ID | Expected | Actual | Issue / screenshot |
| --- | --- | --- | --- | --- | --- |
| Periods | HR | 5, 6 | Created and selectable without refresh | API created; UI refresh unverified | |
| KPI definitions | Manager | 18–21 | Four published | Four published through API | |
| Policy | HR | 3 | Published and selectable | Published; manager creation blocked by role | API 403 for manager |
| Scorecard template | HR | 1 | Published and creates a matching draft | Published; manager used it to create #3 | |
| Assignments | Manager | 14–17 | Four active with names and assigner | Four active; A target revised 10 → 12; Bosco's My KPIs shows QA results | Manager table unverified |
| Activities and submissions | Bosco | 7–9 | A and B approved; C returned then approved; D missing | Confirmed via API | |
| Reviews | Manager | 7–9 | History and filters accurate | Revision history intact; manager UI lists all three QA reviews as Approved | Filter interactions unverified |
| Scorecards | Manager / Bosco | 3, 4 | Live 81%, later 86%; second card missing D | Bosco's UI shows both; detail shows 86 and 50.00/36.00 contributions; status-only card now shows 1 of 2 approved | |
| Evaluation | HR / Manager / Bosco | 1 | Finalized snapshot remains 81% | Finalized, acknowledged; live card now 86, snapshot 81; employee UI shows history | |
| Reports and notifications | All | | Authorized data and delivery | Individual API report shows Bosco and correct counts; 8 QA bell items for Bosco, 6 for manager | Email/SMS/push, report UI, and notification links unverified |

The local frontend and backend were running for the UI checks. The manager's Achievement Reviews page also contained two older, unrelated submissions awaiting review. This QA run did not alter them. Browser checks covered the employee scorecard collection and detail, My KPIs, evaluation history, and the manager's review list. Creation dialogs, manual filters, external delivery channels, and PDF/Excel downloads still require hands-on verification.

Stop at the first unexpected result in a dependent chain, note the record ID and screenshot, and continue independent checks. Do not change official values merely to make the displayed score match this example.

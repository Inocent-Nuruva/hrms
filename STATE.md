# HRMS State

## KPI employee achievement flow

- My KPIs cards provide assignment-scoped **Add Activity** and **Record Achievement** actions for active assignments without a locked submission. Add Activity opens the detailed activity form directly; Record Achievement opens the Quick Entry / Detailed Activity Log selector.
- Pending and approved achievements open read-only submission details. Returned and rejected achievements route to the existing correction workflow.
- The KPI details screen supports the same actions. Activity evidence, draft activities, final actuals, submission revisions, manager decisions, and approved scorecard behavior continue to use the existing assignment-bound achievement API and review lifecycle.
- Quick Entry remains available when activities exist. Activity values are not treated as an approved KPI result and are not aggregated unless a supported configured rule exists; the current sample KPI requires an explicit final actual.
- No schema migration or employee performance data mutation was made for this UI refinement.

## Verification

- ESLint on the changed KPI screens and production build: passed.
- Existing achievement, KPI, route, and personal-performance API tests: 4 files / 14 tests passed.
- Read-only signed-in browser check: My KPIs shows both contextual actions; Add Activity opens that assignment's activity form directly; Record Achievement opens the method selector; choosing Detailed Activity Log immediately opens the activity form.
- End-to-end evidence upload, manager decisions, cross-assignment isolation, and scorecard updates were not exercised against the local HRMS database because doing so could create or change employee performance records. Use isolated synthetic data for that workflow verification.

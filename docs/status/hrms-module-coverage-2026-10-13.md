# HRMS module coverage

HRMS module coverage

Fluent UI and UX refactoring • Review draft • 13 October 2026

## Scope and status rules

This first draft tracks the current Fluent UI conversion and workflow-clarity work. Scope is assumed from the ongoing discussion and awaits confirmation. It is not a certification of overall frontend/backend completeness or production readiness.

Covered: the stated scope has been implemented and checked. Not yet completed: work has started, but requests or verification remain. Not covered: completion of this refactoring scope has not been established in this cycle. Existing routes and business functionality may already be present.

Partially covered modules are always marked Not yet completed. Navigation configuration, current source files, earlier refactoring reports, and the work recorded in this conversation form the evidence. A route or shared Fluent component alone does not qualify a whole module as covered.

## Current position

26 module/workspace entries: 0 fully covered, 3 not yet completed, and 23 not covered in this cycle. Shared UI work is tracked separately. This measures confirmed refactoring coverage, not the amount of application functionality already implemented.

## Covered work within ongoing modules

| Bounded area | Completed scope |
| --- | --- |
| Performance setup navigation | Nine-step wizard, compact top navigation, progress and create actions. |
| Financial years and periods | Multiple-year UI, year filtering, clearer period actions, guides, row separators. |
| KPI categories | Fluent flyout, add/edit/delete flows, category search and KPI category filter; backend category support. |
| KPI table and forms | Action styling, field help, Comfortaa, readable version labels and version help. |
| Sidebar icons | Different single colors per icon; regular Fluent icons retained. |

These completed slices do not mark the parent modules complete. The icon-color switch and full KPI details redesign remain outstanding.

## Module register • business workspaces

Submodules identify the scope to finish. Not covered means unconfirmed for this refactoring cycle, not absent from the product.

| Module | Submodules / remaining scope | Status |
| --- | --- | --- |
| Dashboard | Home overview and role-specific summaries. | Not covered |
| Access Control | Devices, doors, templates, week plans, organizations, groups, credentials, roles, permissions and logs. | Not covered |
| Attendance | Self attendance, corrections, daily summaries, punch review, exceptions, device logs, shifts, timetables and setup. | Not covered |
| Branches | Branch administration. | Not covered |
| Companies | Company administration. | Not covered |
| Departments | Department administration. | Not covered |
| Employees | Directory, registration, profiles, onboarding, offboarding, profile approvals, employee requests and team views. | Not covered |
| Promotion | Employee promotion workspace. | Not covered |
| Leave Management | Types, requests, balances, imports, transactions, trips, holidays, policies, workflows and self-service. Conversion requested; not yet applied. | Not covered |
| Performance Management | Setup, overview, plans, reviews, improvement, reports, employee and manager workspaces. Details dialog and full journey review remain. | Not yet completed |
| Activities | Self/team work, overview, reports, reviews, exceptions and setup. Earlier workflow safeguards exist; complete UI review remains. | Not yet completed |
| Probation | Overview, policies, cases, team and employee workspace. | Not covered |
| Field | Overview, visits, map, parties, setup, employee plans and follow-ups. | Not covered |

## Module register • operations and support

| Module | Submodules / remaining scope | Status |
| --- | --- | --- |
| Finance | Products, applications, accounts, reports and employee loans/payroll. Earlier workflow fixes exist; complete UI review remains. | Not yet completed |
| Movements | Overview, cases, operations, employee and team movement views. | Not covered |
| Positions | Position administration. | Not covered |
| Structure | Cost centers, grades and numbering. | Not covered |
| Invite & Register | Employee invitation and registration workspace. Also linked from Employees. | Not covered |
| Payroll | Payroll operations; employee payroll is linked through Finance. | Not covered |
| Reports & Analytics | Reports, scheduled reporting and SMTP settings. | Not covered |
| Notifications | Notification operations. Shared notification controls are not module-wide sign-off. | Not covered |
| SMS | Overview, registry, logs and platform workspace. | Not covered |
| Insights | HR, management, manager, sales/field, readiness and identity audit views. | Not covered |
| Platform administration | Company administration, access governance, notifications and SMS platform. Reuses some tenant modules. | Not covered |
| Settings | Settings and default-avatar administration. | Not covered |
| Help & support | Help page and support experience. | Not covered |

Counting convention: Performance and Activities are separate workstreams under one sidebar group. Platform administration, Settings and Help are included. Shared links are listed for visibility and are not additional backend modules.

## Performance setup • completion checklist

The wizard shell covers all nine steps. Completion of the shell does not demonstrate that every catalog, form and lifecycle has been fully reviewed.

| Step | Current evidence / next work | Status |
| --- | --- | --- |
| Financial years | Creation, multiple records, aggregation help and layout refined. Finish full create/edit/error journey acceptance. | Not yet completed |
| Review periods | Year filter, guides, action styling, notifications and separators refined. Finish action lifecycle acceptance. | Not yet completed |
| KPI definitions | Category support, filters, field help, actions and version labels covered. Redesign raw record-details display. | Not yet completed |
| KPI templates | Wizard entry and existing logic present. Complete form, validation and UI review. | Not yet completed |
| Assignment rules | Wizard entry and existing logic present. Complete rule creation and application review. | Not yet completed |
| Competencies | Wizard entry and existing logic present. Complete catalog and form review. | Not yet completed |
| Rating scales | Wizard entry and existing logic present. Complete scale editing and validation review. | Not yet completed |
| Scorecards | Wizard entry and existing logic present. Complete weights, forms and UI review. | Not yet completed |
| Approval workflow | Wizard entry and existing logic present. Complete setup and review-transition acceptance. | Not yet completed |

Plans, reviews, calibration/approval, publication, improvement and reports also remain within the parent module’s completion scope. Earlier backend validation work does not replace current UI acceptance.

## Outstanding requests and completion gate

| Priority | Outstanding item | Status |
| --- | --- | --- |
| Next | Add a saved switch to enable/disable sidebar icon colors. | Not yet completed |
| Next | Convert Leave Types controls, list, actions and related forms to Fluent UI. | Not covered |
| Next | Replace the KPI details technical field dump with readable sections and appropriate actions. | Not yet completed |
| Then | Review the remaining Performance setup steps and employee/manager journeys. | Not yet completed |
| Then | Review Activities and Finance across all affected views. | Not yet completed |
| Planned | Work through the other modules in the register and record acceptance evidence. | Not covered |

## When a module can be marked Covered

All listed submodules must be reviewed. Controls must follow the agreed Fluent UI design, with clear workflows and useful empty, loading, validation and permission states. Related create/edit/delete and lifecycle actions must work with existing APIs. Keyboard access, responsive layouts and relevant checks must pass. Any unresolved requested work keeps the module Not yet completed.

## Evidence and limits

Inventory: src/components/app-sidebar.tsx; src/lib/dashboard-sections.ts; page routes under src/app/dashboard. The register includes tenant, employee and platform surfaces; permission rules determine which ones a user sees.

Current implementation: performance-management-view.tsx, performance-setup-wizard.tsx, kpi-categories-view.tsx, kpi-categories-flyout.tsx, nav-main.tsx, and leave-types-catalog.tsx under src/components. The Leave Types catalog still imports mixed UI controls.

Earlier work: docs/activities-performance-refactoring-plan.md and docs/batch-3-refactored-files.md. Their results describe the earlier scope and date; the original project-health-gap-report.md is a historical baseline, not a current open-defect list.

Recent targeted TypeScript and ESLint checks passed for the UI changes recorded in this conversation. This document preparation did not run a fresh whole-application end-to-end audit. Modules without completion evidence stay Not covered; no claim is made that they lack working business logic.

Source root: /home/innocent/systems/hrms. Adjacent backend: /home/innocent/systems/hrms_backend. Status snapshot: 13 October 2026.

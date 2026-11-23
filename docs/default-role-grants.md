# Default role grants

These tables show the grants given to a newly provisioned role. In HRMS, open Roles, choose a role and open Permissions to inspect the grants stored for your installation. Direct permissions and active company membership also affect an individual user’s access.

## Platform roles

### Platform Super Admin

Full access to platform administration, tenant provisioning, permissions, and scoped RBAC management.

23 assigned permissions.

| Module | Assigned permissions |
| --- | --- |
| companies | `companies:create`, `companies:delete`, `companies:read`, `companies:update` |
| company_administrators | `company_administrators:create` |
| notifications | `notifications:delivery-logs-read`, `notifications:mail-logs-read`, `notifications:mail-logs-retry`, `notifications:settings-read`, `notifications:settings-update` |
| permissions | `permissions:create`, `permissions:delete`, `permissions:read`, `permissions:update` |
| roles | `roles:create`, `roles:delete`, `roles:read`, `roles:update` |
| sms | `sms:logs-read`, `sms:logs-retry`, `sms:settings-read`, `sms:settings-update`, `sms:test` |

### Platform Administrator

Manages tenant provisioning and platform-wide RBAC visibility without destructive permission mutation.

21 assigned permissions.

| Module | Assigned permissions |
| --- | --- |
| companies | `companies:create`, `companies:read`, `companies:update` |
| company_administrators | `company_administrators:create` |
| notifications | `notifications:delivery-logs-read`, `notifications:mail-logs-read`, `notifications:mail-logs-retry`, `notifications:settings-read`, `notifications:settings-update` |
| permissions | `permissions:read` |
| roles | `roles:assign-permission`, `roles:create`, `roles:delete`, `roles:read`, `roles:revoke-permission`, `roles:update` |
| sms | `sms:logs-read`, `sms:logs-retry`, `sms:settings-read`, `sms:settings-update`, `sms:test` |

### Platform Support

Handles tenant support and troubleshooting with read access plus limited company status maintenance.

12 assigned permissions.

| Module | Assigned permissions |
| --- | --- |
| companies | `companies:read`, `companies:update` |
| notifications | `notifications:delivery-logs-read`, `notifications:mail-logs-read`, `notifications:mail-logs-retry`, `notifications:settings-read` |
| permissions | `permissions:read` |
| roles | `roles:read` |
| sms | `sms:logs-read`, `sms:logs-retry`, `sms:settings-read`, `sms:test` |

### Platform Auditor

Read-only visibility into platform companies, roles, and permissions for governance and audit work.

8 assigned permissions.

| Module | Assigned permissions |
| --- | --- |
| companies | `companies:read` |
| notifications | `notifications:delivery-logs-read`, `notifications:mail-logs-read`, `notifications:settings-read` |
| permissions | `permissions:read` |
| roles | `roles:read` |
| sms | `sms:logs-read`, `sms:settings-read` |

## Company roles

### Company Admin

Manages company setup, users, branches, departments, roles, and all settings within the company.

491 assigned permissions.

| Module | Assigned permissions |
| --- | --- |
| access_control_sync | `access_control_sync:execute` |
| access_doors | `access_doors:create`, `access_doors:delete`, `access_doors:read`, `access_doors:update` |
| access_groups | `access_groups:create`, `access_groups:delete`, `access_groups:read`, `access_groups:update` |
| access_organizations | `access_organizations:create`, `access_organizations:delete`, `access_organizations:read`, `access_organizations:update` |
| access_schedule_templates | `access_schedule_templates:create`, `access_schedule_templates:delete`, `access_schedule_templates:read`, `access_schedule_templates:update` |
| access_week_plans | `access_week_plans:create`, `access_week_plans:delete`, `access_week_plans:read`, `access_week_plans:update` |
| action_items | `action_items:read-own` |
| analytics | `analytics:audit-read`, `analytics:dashboards-hr`, `analytics:dashboards-management`, `analytics:dashboards-manager`, `analytics:dashboards-sales-field`, `analytics:datasets-read`, `analytics:exports`, `analytics:location`, `analytics:metrics-read`, `analytics:reconciliation`, `analytics:refresh`, `analytics:reports`, `analytics:sensitive`, `analytics:sources-read`, `analytics:statutory-reports` |
| attendance_business_trips | `attendance_business_trips:approve`, `attendance_business_trips:cancel`, `attendance_business_trips:create`, `attendance_business_trips:delete`, `attendance_business_trips:read`, `attendance_business_trips:update` |
| attendance_checkpoints | `attendance_checkpoints:create`, `attendance_checkpoints:delete`, `attendance_checkpoints:read`, `attendance_checkpoints:update` |
| attendance_device_sync_logs | `attendance_device_sync_logs:create`, `attendance_device_sync_logs:read` |
| attendance_devices | `attendance_devices:create`, `attendance_devices:delete`, `attendance_devices:read`, `attendance_devices:update` |
| attendance_geofences | `attendance_geofences:create`, `attendance_geofences:delete`, `attendance_geofences:read`, `attendance_geofences:update` |
| attendance_holiday_groups | `attendance_holiday_groups:create`, `attendance_holiday_groups:delete`, `attendance_holiday_groups:read`, `attendance_holiday_groups:update` |
| attendance_holidays | `attendance_holidays:create`, `attendance_holidays:delete`, `attendance_holidays:read`, `attendance_holidays:update` |
| attendance_mobile_punches | `attendance_mobile_punches:create`, `attendance_mobile_punches:read`, `attendance_mobile_punches:update` |
| attendance_policies | `attendance_policies:create`, `attendance_policies:delete`, `attendance_policies:read`, `attendance_policies:update` |
| attendance_processing | `attendance_processing:execute`, `attendance_processing:read` |
| attendance_recalculation | `attendance_recalculation:execute` |
| attendance_summaries | `attendance_summaries:read` |
| attendance_wifi_networks | `attendance_wifi_networks:create`, `attendance_wifi_networks:delete`, `attendance_wifi_networks:read`, `attendance_wifi_networks:update` |
| branches | `branches:create`, `branches:delete`, `branches:manage-access`, `branches:read`, `branches:update` |
| companies | `companies:read` |
| company_accounts | `company_accounts:create`, `company_accounts:delete`, `company_accounts:update` |
| company_dashboard | `company_dashboard:read` |
| company_data | `company_data:read`, `company_data:update` |
| company_users | `company_users:create`, `company_users:delete`, `company_users:manage`, `company_users:read`, `company_users:update` |
| contract_signatories | `contract_signatories:manage` |
| cost_centers | `cost_centers:create`, `cost_centers:delete`, `cost_centers:read`, `cost_centers:update` |
| dashboard | `dashboard:employee`, `dashboard:hr`, `dashboard:management`, `dashboard:manager` |
| data_scope | `data_scope:company` |
| default_avatars | `default_avatars:create`, `default_avatars:delete`, `default_avatars:read`, `default_avatars:update` |
| departments | `departments:create`, `departments:delete`, `departments:manage-access`, `departments:read`, `departments:update` |
| employee_access_credentials | `employee_access_credentials:create`, `employee_access_credentials:delete`, `employee_access_credentials:read`, `employee_access_credentials:update` |
| employee_assignments | `employee_assignments:read`, `employee_assignments:update` |
| employee_compensation | `employee_compensation:read` |
| employee_device_assignments | `employee_device_assignments:create`, `employee_device_assignments:delete`, `employee_device_assignments:read`, `employee_device_assignments:update` |
| employee_finance | `employee_finance:accounts-read`, `employee_finance:adjustments`, `employee_finance:adjustments-approve`, `employee_finance:applications-finance-approve`, `employee_finance:applications-hr-approve`, `employee_finance:applications-management-approve`, `employee_finance:applications-manager-review`, `employee_finance:applications-read`, `employee_finance:applications-self`, `employee_finance:delegations`, `employee_finance:disbursements`, `employee_finance:disbursements-approve`, `employee_finance:integrations`, `employee_finance:migration`, `employee_finance:payroll`, `employee_finance:products`, `employee_finance:products-read`, `employee_finance:reconciliation`, `employee_finance:repayments`, `employee_finance:repayments-approve`, `employee_finance:reports`, `employee_finance:settlements`, `employee_finance:settlements-approve`, `employee_finance:templates` |
| employee_grades | `employee_grades:create`, `employee_grades:delete`, `employee_grades:read`, `employee_grades:update` |
| employee_import | `employee_import:download-result`, `employee_import:download-template`, `employee_import:execute`, `employee_import:preview`, `employee_import:read-history` |
| employee_movements | `employee_movements:acknowledge-own`, `employee_movements:apply`, `employee_movements:approve`, `employee_movements:backdate`, `employee_movements:cancel`, `employee_movements:create`, `employee_movements:finance-approve`, `employee_movements:generate-letter`, `employee_movements:management-approve`, `employee_movements:read`, `employee_movements:read-own`, `employee_movements:retry`, `employee_movements:submit` |
| employee_numbering | `employee_numbering:read`, `employee_numbering:update` |
| employee_positions | `employee_positions:correct-history` |
| employee_timetables | `employee_timetables:create`, `employee_timetables:delete`, `employee_timetables:read`, `employee_timetables:update` |
| employees | `employees:change-status`, `employees:create`, `employees:delete`, `employees:force-exit-status`, `employees:override-number`, `employees:read`, `employees:update` |
| employment_contracts | `employment_contracts:manage`, `employment_contracts:read` |
| field_locations | `field_locations:export`, `field_locations:read` |
| field_visits | `field_visits:config`, `field_visits:hr-read`, `field_visits:manager-read`, `field_visits:manager-review`, `field_visits:self-service-read`, `field_visits:self-service-update` |
| forms_feedback | `forms_feedback:manage` |
| hikvision_attendance | `hikvision_attendance:read`, `hikvision_attendance:sync` |
| holidays | `holidays:create`, `holidays:delete`, `holidays:read`, `holidays:update` |
| hrms_launch_readiness | `hrms_launch_readiness:read` |
| identity_audit | `identity_audit:read`, `identity_audit:rollback` |
| kpi_assignments | `kpi_assignments:create`, `kpi_assignments:read`, `kpi_assignments:update` |
| kpi_targets | `kpi_targets:revise` |
| leave_balance_recalculation | `leave_balance_recalculation:approve`, `leave_balance_recalculation:bulk`, `leave_balance_recalculation:employee`, `leave_balance_recalculation:history`, `leave_balance_recalculation:preview` |
| leave_balances | `leave_balances:adjust-manually`, `leave_balances:carry-forward`, `leave_balances:export`, `leave_balances:generate`, `leave_balances:import`, `leave_balances:import-partial`, `leave_balances:list`, `leave_balances:manage`, `leave_balances:override_cap`, `leave_balances:read`, `leave_balances:read-import-history`, `leave_balances:read-own` |
| leave_encashment | `leave_encashment:finance_confirm`, `leave_encashment:override_amount` |
| leave_operations | `leave_operations:execute`, `leave_operations:read` |
| leave_policies | `leave_policies:approve`, `leave_policies:create`, `leave_policies:delete`, `leave_policies:read`, `leave_policies:update` |
| leave_requests | `leave_requests:approve`, `leave_requests:cancel`, `leave_requests:create`, `leave_requests:override`, `leave_requests:read`, `leave_requests:update` |
| leave_rollover | `leave_rollover:approve`, `leave_rollover:manage`, `leave_rollover:read` |
| leave_statutory | `leave_statutory:approve`, `leave_statutory:manage`, `leave_statutory:read` |
| leave_types | `leave_types:create`, `leave_types:delete`, `leave_types:read`, `leave_types:update` |
| leave_workflows | `leave_workflows:create`, `leave_workflows:delete`, `leave_workflows:read`, `leave_workflows:update` |
| location_privacy | `location_privacy:manage` |
| manager_self_service | `manager_self_service:read` |
| manager_team | `manager_team:read` |
| notification_preferences | `notification_preferences:manage-own` |
| notifications | `notifications:delete`, `notifications:delivery-logs-read`, `notifications:mail-logs-read`, `notifications:mail-logs-retry`, `notifications:read`, `notifications:send`, `notifications:settings-read`, `notifications:settings-update`, `notifications:test`, `notifications:update` |
| offboarding_access | `offboarding_access:emergency-terminate`, `offboarding_access:read`, `offboarding_access:retry` |
| offboarding_approvals | `offboarding_approvals:delegate`, `offboarding_approvals:delegate-any` |
| offboarding_assets | `offboarding_assets:verify`, `offboarding_assets:waive` |
| offboarding_clearances | `offboarding_clearances:complete`, `offboarding_clearances:create`, `offboarding_clearances:read` |
| offboarding_documents | `offboarding_documents:create`, `offboarding_documents:delete`, `offboarding_documents:read`, `offboarding_documents:update` |
| offboarding_letters | `offboarding_letters:read` |
| offboarding_requests | `offboarding_requests:approve`, `offboarding_requests:cancel`, `offboarding_requests:complete`, `offboarding_requests:create`, `offboarding_requests:finalize`, `offboarding_requests:read`, `offboarding_requests:submit`, `offboarding_requests:update` |
| offboarding_settlements | `offboarding_settlements:verify`, `offboarding_settlements:waive` |
| offboarding_tasks | `offboarding_tasks:complete`, `offboarding_tasks:create`, `offboarding_tasks:read`, `offboarding_tasks:reject` |
| offboarding_workflows | `offboarding_workflows:create`, `offboarding_workflows:delete`, `offboarding_workflows:read`, `offboarding_workflows:update` |
| onboarding_documents | `onboarding_documents:create`, `onboarding_documents:delete`, `onboarding_documents:read`, `onboarding_documents:update`, `onboarding_documents:verify` |
| onboarding_requests | `onboarding_requests:approve`, `onboarding_requests:cancel`, `onboarding_requests:complete`, `onboarding_requests:create`, `onboarding_requests:read`, `onboarding_requests:update` |
| onboarding_tasks | `onboarding_tasks:complete`, `onboarding_tasks:create`, `onboarding_tasks:read`, `onboarding_tasks:update` |
| onboarding_workflows | `onboarding_workflows:create`, `onboarding_workflows:delete`, `onboarding_workflows:read`, `onboarding_workflows:update` |
| payroll | `payroll:accounting`, `payroll:banking`, `payroll:config`, `payroll:config-read`, `payroll:final-settlements`, `payroll:inputs`, `payroll:inputs-approve`, `payroll:inputs-read`, `payroll:payments-confirm`, `payroll:payslips`, `payroll:payslips-read`, `payroll:payslips-self`, `payroll:periods`, `payroll:periods-read`, `payroll:profiles`, `payroll:profiles-read`, `payroll:recoveries-approve`, `payroll:recoveries-manage`, `payroll:reports`, `payroll:runs`, `payroll:runs-approve`, `payroll:runs-cancel`, `payroll:runs-close`, `payroll:runs-lock`, `payroll:runs-process`, `payroll:runs-read`, `payroll:runs-reverse`, `payroll:salary-approve`, `payroll:statutory-approve` |
| permissions | `permissions:read` |
| positions | `positions:assign-department`, `positions:create`, `positions:delete`, `positions:read`, `positions:update` |
| probation_cases | `probation_cases:create`, `probation_cases:delete`, `probation_cases:read`, `probation_cases:read-team`, `probation_cases:update` |
| probation_letters | `probation_letters:generate` |
| probation_objectives | `probation_objectives:create` |
| probation_policies | `probation_policies:create`, `probation_policies:delete`, `probation_policies:read`, `probation_policies:update` |
| probation_reviews | `probation_reviews:hr-decision`, `probation_reviews:manager-review`, `probation_reviews:manager-review-any`, `probation_reviews:self-assess` |
| profile_change_request | `profile_change_request:approve`, `profile_change_request:reject`, `profile_change_request:request_correction`, `profile_change_request:review`, `profile_change_request:view_all`, `profile_change_request:view_audit`, `profile_change_request:view_pending_files` |
| roles | `roles:assign-permission`, `roles:create`, `roles:delete`, `roles:read`, `roles:revoke-permission`, `roles:update` |
| scheduled_reports | `scheduled_reports:create`, `scheduled_reports:delete`, `scheduled_reports:download`, `scheduled_reports:manage_smtp`, `scheduled_reports:read`, `scheduled_reports:run`, `scheduled_reports:test_smtp`, `scheduled_reports:update`, `scheduled_reports:view_history` |
| security_events | `security_events:read` |
| self_service_requests | `self_service_requests:approve`, `self_service_requests:final_approve` |
| shift_assignments | `shift_assignments:create`, `shift_assignments:delete`, `shift_assignments:read`, `shift_assignments:update` |
| shift_attendance_rules | `shift_attendance_rules:create`, `shift_attendance_rules:delete`, `shift_attendance_rules:read`, `shift_attendance_rules:update` |
| shift_breaks | `shift_breaks:create`, `shift_breaks:delete`, `shift_breaks:read`, `shift_breaks:update` |
| shift_change_requests | `shift_change_requests:create`, `shift_change_requests:delete`, `shift_change_requests:read`, `shift_change_requests:update` |
| shift_overtime_rules | `shift_overtime_rules:create`, `shift_overtime_rules:delete`, `shift_overtime_rules:read`, `shift_overtime_rules:update` |
| shift_rotation_groups | `shift_rotation_groups:create`, `shift_rotation_groups:delete`, `shift_rotation_groups:read`, `shift_rotation_groups:update` |
| shift_rotation_rules | `shift_rotation_rules:create`, `shift_rotation_rules:delete`, `shift_rotation_rules:read`, `shift_rotation_rules:update` |
| shift_schedules | `shift_schedules:create`, `shift_schedules:delete`, `shift_schedules:read`, `shift_schedules:update` |
| shift_templates | `shift_templates:create`, `shift_templates:delete`, `shift_templates:read`, `shift_templates:update` |
| shifts | `shifts:create`, `shifts:delete`, `shifts:read`, `shifts:update` |
| sms | `sms:logs-read`, `sms:logs-retry`, `sms:settings-read`, `sms:settings-update`, `sms:test` |
| team_attendance | `team_attendance:read` |
| timetable_attendance_rules | `timetable_attendance_rules:create`, `timetable_attendance_rules:delete`, `timetable_attendance_rules:read`, `timetable_attendance_rules:update` |
| timetable_days | `timetable_days:create`, `timetable_days:delete`, `timetable_days:read`, `timetable_days:update` |
| timetable_generated_schedules | `timetable_generated_schedules:create`, `timetable_generated_schedules:delete`, `timetable_generated_schedules:read`, `timetable_generated_schedules:update` |
| timetable_holiday_rules | `timetable_holiday_rules:create`, `timetable_holiday_rules:delete`, `timetable_holiday_rules:read`, `timetable_holiday_rules:update` |
| timetable_rotation_rules | `timetable_rotation_rules:create`, `timetable_rotation_rules:delete`, `timetable_rotation_rules:read`, `timetable_rotation_rules:update` |
| timetable_rotations | `timetable_rotations:create`, `timetable_rotations:delete`, `timetable_rotations:read`, `timetable_rotations:update` |
| timetable_shift_rules | `timetable_shift_rules:create`, `timetable_shift_rules:delete`, `timetable_shift_rules:read`, `timetable_shift_rules:update` |
| timetables | `timetables:create`, `timetables:delete`, `timetables:read`, `timetables:update` |
| users | `users:assign-role`, `users:create`, `users:delete`, `users:disable-2fa`, `users:enable-2fa`, `users:manage-2fa`, `users:read`, `users:revoke-role`, `users:update` |
| work_activities | `work_activities:config`, `work_activities:hr-read`, `work_activities:manager-read`, `work_activities:manager-review`, `work_activities:self-service-read`, `work_activities:self-service-update` |

### HR Manager

Manages HR operations: employees, leave, attendance, onboarding, offboarding, shifts, and reports.

292 assigned permissions.

| Module | Assigned permissions |
| --- | --- |
| attendance_business_trips | `attendance_business_trips:approve`, `attendance_business_trips:cancel`, `attendance_business_trips:create`, `attendance_business_trips:delete`, `attendance_business_trips:read`, `attendance_business_trips:update` |
| attendance_checkpoints | `attendance_checkpoints:create`, `attendance_checkpoints:delete`, `attendance_checkpoints:read`, `attendance_checkpoints:update` |
| attendance_device_sync_logs | `attendance_device_sync_logs:read` |
| attendance_geofences | `attendance_geofences:create`, `attendance_geofences:delete`, `attendance_geofences:read`, `attendance_geofences:update` |
| attendance_holiday_groups | `attendance_holiday_groups:create`, `attendance_holiday_groups:delete`, `attendance_holiday_groups:read`, `attendance_holiday_groups:update` |
| attendance_holidays | `attendance_holidays:create`, `attendance_holidays:delete`, `attendance_holidays:read`, `attendance_holidays:update` |
| attendance_mobile_punches | `attendance_mobile_punches:create`, `attendance_mobile_punches:read`, `attendance_mobile_punches:update` |
| attendance_policies | `attendance_policies:create`, `attendance_policies:delete`, `attendance_policies:read`, `attendance_policies:update` |
| attendance_processing | `attendance_processing:execute`, `attendance_processing:read` |
| attendance_recalculation | `attendance_recalculation:execute` |
| attendance_summaries | `attendance_summaries:read` |
| attendance_wifi_networks | `attendance_wifi_networks:create`, `attendance_wifi_networks:delete`, `attendance_wifi_networks:read`, `attendance_wifi_networks:update` |
| branches | `branches:read` |
| company_dashboard | `company_dashboard:read` |
| company_data | `company_data:read` |
| contract_signatories | `contract_signatories:manage` |
| cost_centers | `cost_centers:create`, `cost_centers:delete`, `cost_centers:read`, `cost_centers:update` |
| data_scope | `data_scope:company` |
| departments | `departments:read` |
| employee_assignments | `employee_assignments:read`, `employee_assignments:update` |
| employee_finance | `employee_finance:applications-hr-approve`, `employee_finance:applications-read`, `employee_finance:applications-self`, `employee_finance:delegations`, `employee_finance:products-read`, `employee_finance:templates` |
| employee_grades | `employee_grades:create`, `employee_grades:delete`, `employee_grades:read`, `employee_grades:update` |
| employee_import | `employee_import:download-result`, `employee_import:download-template`, `employee_import:execute`, `employee_import:preview`, `employee_import:read-history` |
| employee_numbering | `employee_numbering:read`, `employee_numbering:update` |
| employee_timetables | `employee_timetables:create`, `employee_timetables:delete`, `employee_timetables:read`, `employee_timetables:update` |
| employees | `employees:change-status`, `employees:create`, `employees:delete`, `employees:force-exit-status`, `employees:override-number`, `employees:read`, `employees:update` |
| employment_contracts | `employment_contracts:manage`, `employment_contracts:read`, `employment_contracts:self` |
| field_locations | `field_locations:read` |
| field_visits | `field_visits:config`, `field_visits:hr-read`, `field_visits:manager-read`, `field_visits:manager-review`, `field_visits:self-service-read`, `field_visits:self-service-update` |
| forms_feedback | `forms_feedback:manage` |
| holidays | `holidays:create`, `holidays:delete`, `holidays:read`, `holidays:update` |
| hrms_launch_readiness | `hrms_launch_readiness:read` |
| identity_audit | `identity_audit:read` |
| kpi_assignments | `kpi_assignments:create`, `kpi_assignments:read`, `kpi_assignments:update` |
| kpi_targets | `kpi_targets:revise` |
| leave_balance_recalculation | `leave_balance_recalculation:approve`, `leave_balance_recalculation:bulk`, `leave_balance_recalculation:employee`, `leave_balance_recalculation:history`, `leave_balance_recalculation:preview` |
| leave_balances | `leave_balances:adjust`, `leave_balances:adjust-manually`, `leave_balances:carry-forward`, `leave_balances:export`, `leave_balances:generate`, `leave_balances:import`, `leave_balances:import-partial`, `leave_balances:list`, `leave_balances:manage`, `leave_balances:override_cap`, `leave_balances:read`, `leave_balances:read-import-history`, `leave_balances:read-own` |
| leave_encashment | `leave_encashment:override_amount` |
| leave_operations | `leave_operations:execute`, `leave_operations:read` |
| leave_policies | `leave_policies:approve`, `leave_policies:create`, `leave_policies:delete`, `leave_policies:read`, `leave_policies:update` |
| leave_requests | `leave_requests:approve`, `leave_requests:cancel`, `leave_requests:create`, `leave_requests:override`, `leave_requests:read`, `leave_requests:update` |
| leave_rollover | `leave_rollover:approve`, `leave_rollover:manage`, `leave_rollover:read` |
| leave_statutory | `leave_statutory:approve`, `leave_statutory:manage`, `leave_statutory:read` |
| leave_types | `leave_types:create`, `leave_types:delete`, `leave_types:read`, `leave_types:update` |
| leave_workflows | `leave_workflows:create`, `leave_workflows:delete`, `leave_workflows:read`, `leave_workflows:update` |
| location_privacy | `location_privacy:manage` |
| notifications | `notifications:delete`, `notifications:delivery-logs-read`, `notifications:mail-logs-read`, `notifications:mail-logs-retry`, `notifications:read`, `notifications:send`, `notifications:settings-read`, `notifications:settings-update`, `notifications:test`, `notifications:update` |
| offboarding_clearances | `offboarding_clearances:complete`, `offboarding_clearances:create`, `offboarding_clearances:read` |
| offboarding_documents | `offboarding_documents:create`, `offboarding_documents:delete`, `offboarding_documents:read`, `offboarding_documents:update` |
| offboarding_requests | `offboarding_requests:approve`, `offboarding_requests:cancel`, `offboarding_requests:complete`, `offboarding_requests:create`, `offboarding_requests:read`, `offboarding_requests:submit`, `offboarding_requests:update` |
| offboarding_tasks | `offboarding_tasks:complete`, `offboarding_tasks:create`, `offboarding_tasks:read`, `offboarding_tasks:reject` |
| offboarding_workflows | `offboarding_workflows:create`, `offboarding_workflows:delete`, `offboarding_workflows:read`, `offboarding_workflows:update` |
| onboarding_documents | `onboarding_documents:create`, `onboarding_documents:delete`, `onboarding_documents:read`, `onboarding_documents:update`, `onboarding_documents:verify` |
| onboarding_requests | `onboarding_requests:approve`, `onboarding_requests:cancel`, `onboarding_requests:complete`, `onboarding_requests:create`, `onboarding_requests:read`, `onboarding_requests:update` |
| onboarding_tasks | `onboarding_tasks:complete`, `onboarding_tasks:create`, `onboarding_tasks:read`, `onboarding_tasks:update` |
| onboarding_workflows | `onboarding_workflows:create`, `onboarding_workflows:delete`, `onboarding_workflows:read`, `onboarding_workflows:update` |
| payroll | `payroll:payslips-self` |
| positions | `positions:read` |
| profile_change_request | `profile_change_request:approve`, `profile_change_request:reject`, `profile_change_request:request_correction`, `profile_change_request:review`, `profile_change_request:view_all`, `profile_change_request:view_audit`, `profile_change_request:view_pending_files` |
| roles | `roles:assign-permission`, `roles:revoke-permission` |
| self_service_requests | `self_service_requests:approve`, `self_service_requests:final_approve` |
| shift_assignments | `shift_assignments:create`, `shift_assignments:delete`, `shift_assignments:read`, `shift_assignments:update` |
| shift_attendance_rules | `shift_attendance_rules:create`, `shift_attendance_rules:delete`, `shift_attendance_rules:read`, `shift_attendance_rules:update` |
| shift_breaks | `shift_breaks:create`, `shift_breaks:delete`, `shift_breaks:read`, `shift_breaks:update` |
| shift_change_requests | `shift_change_requests:create`, `shift_change_requests:delete`, `shift_change_requests:read`, `shift_change_requests:update` |
| shift_overtime_rules | `shift_overtime_rules:create`, `shift_overtime_rules:delete`, `shift_overtime_rules:read`, `shift_overtime_rules:update` |
| shift_rotation_groups | `shift_rotation_groups:create`, `shift_rotation_groups:delete`, `shift_rotation_groups:read`, `shift_rotation_groups:update` |
| shift_rotation_rules | `shift_rotation_rules:create`, `shift_rotation_rules:delete`, `shift_rotation_rules:read`, `shift_rotation_rules:update` |
| shift_schedules | `shift_schedules:create`, `shift_schedules:delete`, `shift_schedules:read`, `shift_schedules:update` |
| shift_templates | `shift_templates:create`, `shift_templates:delete`, `shift_templates:read`, `shift_templates:update` |
| shifts | `shifts:create`, `shifts:delete`, `shifts:read`, `shifts:update` |
| sms | `sms:logs-read`, `sms:logs-retry`, `sms:settings-read`, `sms:settings-update`, `sms:test` |
| team_attendance | `team_attendance:read` |
| timetable_attendance_rules | `timetable_attendance_rules:create`, `timetable_attendance_rules:delete`, `timetable_attendance_rules:read`, `timetable_attendance_rules:update` |
| timetable_days | `timetable_days:create`, `timetable_days:delete`, `timetable_days:read`, `timetable_days:update` |
| timetable_generated_schedules | `timetable_generated_schedules:create`, `timetable_generated_schedules:delete`, `timetable_generated_schedules:read`, `timetable_generated_schedules:update` |
| timetable_holiday_rules | `timetable_holiday_rules:create`, `timetable_holiday_rules:delete`, `timetable_holiday_rules:read`, `timetable_holiday_rules:update` |
| timetable_rotation_rules | `timetable_rotation_rules:create`, `timetable_rotation_rules:delete`, `timetable_rotation_rules:read`, `timetable_rotation_rules:update` |
| timetable_rotations | `timetable_rotations:create`, `timetable_rotations:delete`, `timetable_rotations:read`, `timetable_rotations:update` |
| timetable_shift_rules | `timetable_shift_rules:create`, `timetable_shift_rules:delete`, `timetable_shift_rules:read`, `timetable_shift_rules:update` |
| timetables | `timetables:create`, `timetables:delete`, `timetables:read`, `timetables:update` |
| users | `users:read`, `users:update` |
| work_activities | `work_activities:self-service-read`, `work_activities:self-service-update` |

### HR Officer

Handles daily HR activities: employee records, documents, leave review, attendance, and onboarding tasks.

118 assigned permissions.

| Module | Assigned permissions |
| --- | --- |
| attendance_business_trips | `attendance_business_trips:approve`, `attendance_business_trips:cancel`, `attendance_business_trips:create`, `attendance_business_trips:read`, `attendance_business_trips:update` |
| attendance_holiday_groups | `attendance_holiday_groups:read` |
| attendance_holidays | `attendance_holidays:read` |
| attendance_mobile_punches | `attendance_mobile_punches:create`, `attendance_mobile_punches:update` |
| attendance_policies | `attendance_policies:read` |
| attendance_processing | `attendance_processing:read` |
| attendance_summaries | `attendance_summaries:read` |
| branches | `branches:read` |
| company_data | `company_data:read` |
| cost_centers | `cost_centers:read` |
| data_scope | `data_scope:company` |
| departments | `departments:read` |
| employee_assignments | `employee_assignments:read`, `employee_assignments:update` |
| employee_finance | `employee_finance:applications-read`, `employee_finance:applications-self` |
| employee_grades | `employee_grades:read` |
| employee_import | `employee_import:download-result`, `employee_import:download-template`, `employee_import:execute`, `employee_import:preview`, `employee_import:read-history` |
| employee_numbering | `employee_numbering:read` |
| employees | `employees:read`, `employees:update` |
| employment_contracts | `employment_contracts:manage`, `employment_contracts:read`, `employment_contracts:self` |
| field_visits | `field_visits:hr-read`, `field_visits:self-service-read`, `field_visits:self-service-update` |
| forms_feedback | `forms_feedback:manage` |
| holidays | `holidays:read` |
| hrms_launch_readiness | `hrms_launch_readiness:read` |
| leave_balance_recalculation | `leave_balance_recalculation:employee`, `leave_balance_recalculation:history`, `leave_balance_recalculation:preview` |
| leave_balances | `leave_balances:adjust`, `leave_balances:export`, `leave_balances:import`, `leave_balances:list`, `leave_balances:manage`, `leave_balances:read`, `leave_balances:read-import-history`, `leave_balances:read-own` |
| leave_operations | `leave_operations:read` |
| leave_policies | `leave_policies:read` |
| leave_requests | `leave_requests:approve`, `leave_requests:cancel`, `leave_requests:create`, `leave_requests:override`, `leave_requests:read`, `leave_requests:update` |
| leave_rollover | `leave_rollover:manage`, `leave_rollover:read` |
| leave_statutory | `leave_statutory:read` |
| leave_types | `leave_types:read` |
| leave_workflows | `leave_workflows:read` |
| notifications | `notifications:delete`, `notifications:read`, `notifications:update` |
| offboarding_clearances | `offboarding_clearances:complete`, `offboarding_clearances:read` |
| offboarding_documents | `offboarding_documents:create`, `offboarding_documents:read` |
| offboarding_requests | `offboarding_requests:cancel`, `offboarding_requests:create`, `offboarding_requests:read`, `offboarding_requests:submit`, `offboarding_requests:update` |
| offboarding_tasks | `offboarding_tasks:complete`, `offboarding_tasks:read`, `offboarding_tasks:reject` |
| offboarding_workflows | `offboarding_workflows:read` |
| onboarding_documents | `onboarding_documents:create`, `onboarding_documents:read`, `onboarding_documents:verify` |
| onboarding_requests | `onboarding_requests:approve`, `onboarding_requests:read`, `onboarding_requests:update` |
| onboarding_tasks | `onboarding_tasks:complete`, `onboarding_tasks:read` |
| onboarding_workflows | `onboarding_workflows:read` |
| payroll | `payroll:payslips-self` |
| positions | `positions:read` |
| probation_cases | `probation_cases:create`, `probation_cases:read`, `probation_cases:read-team`, `probation_cases:update` |
| probation_letters | `probation_letters:generate` |
| probation_objectives | `probation_objectives:create` |
| probation_policies | `probation_policies:read` |
| probation_reviews | `probation_reviews:hr-decision`, `probation_reviews:manager-review-any` |
| profile_change_request | `profile_change_request:approve`, `profile_change_request:reject`, `profile_change_request:request_correction`, `profile_change_request:review`, `profile_change_request:view_all`, `profile_change_request:view_audit`, `profile_change_request:view_pending_files` |
| self_service_requests | `self_service_requests:approve`, `self_service_requests:final_approve` |
| shift_assignments | `shift_assignments:read` |
| shift_change_requests | `shift_change_requests:create`, `shift_change_requests:read`, `shift_change_requests:update` |
| shift_schedules | `shift_schedules:read` |
| shifts | `shifts:read` |
| users | `users:read`, `users:update` |
| work_activities | `work_activities:self-service-read`, `work_activities:self-service-update` |

### Department Manager

Manages employees within their department. Approves leave, shift changes, and workflow steps. No HR lifecycle powers.

79 assigned permissions.

| Module | Assigned permissions |
| --- | --- |
| attendance_holiday_groups | `attendance_holiday_groups:read` |
| attendance_holidays | `attendance_holidays:read` |
| attendance_mobile_punches | `attendance_mobile_punches:create` |
| attendance_policies | `attendance_policies:read` |
| attendance_summaries | `attendance_summaries:read` |
| branches | `branches:read` |
| company_dashboard | `company_dashboard:read` |
| company_data | `company_data:read` |
| cost_centers | `cost_centers:read` |
| data_scope | `data_scope:department` |
| departments | `departments:read` |
| employee_assignments | `employee_assignments:read` |
| employee_finance | `employee_finance:applications-manager-review`, `employee_finance:applications-self`, `employee_finance:delegations` |
| employee_grades | `employee_grades:read` |
| employee_numbering | `employee_numbering:read` |
| employees | `employees:read` |
| employment_contracts | `employment_contracts:self` |
| field_locations | `field_locations:read` |
| field_visits | `field_visits:manager-read`, `field_visits:manager-review`, `field_visits:self-service-read`, `field_visits:self-service-update` |
| holidays | `holidays:read` |
| kpi_assignments | `kpi_assignments:create`, `kpi_assignments:read`, `kpi_assignments:update` |
| kpi_targets | `kpi_targets:revise` |
| leave_balances | `leave_balances:list`, `leave_balances:read`, `leave_balances:read-own` |
| leave_requests | `leave_requests:approve`, `leave_requests:cancel`, `leave_requests:create`, `leave_requests:read` |
| leave_types | `leave_types:read` |
| manager | `manager:read` |
| manager_self_service | `manager_self_service:read` |
| manager_team | `manager_team:read` |
| notifications | `notifications:delete`, `notifications:read`, `notifications:update` |
| offboarding_clearances | `offboarding_clearances:complete` |
| offboarding_requests | `offboarding_requests:approve`, `offboarding_requests:cancel`, `offboarding_requests:create`, `offboarding_requests:read`, `offboarding_requests:submit`, `offboarding_requests:update` |
| offboarding_tasks | `offboarding_tasks:complete`, `offboarding_tasks:reject` |
| offboarding_workflows | `offboarding_workflows:read` |
| onboarding_documents | `onboarding_documents:create`, `onboarding_documents:read`, `onboarding_documents:verify` |
| onboarding_requests | `onboarding_requests:approve`, `onboarding_requests:read`, `onboarding_requests:update` |
| onboarding_tasks | `onboarding_tasks:complete`, `onboarding_tasks:read` |
| payroll | `payroll:payslips-self` |
| positions | `positions:read` |
| probation_cases | `probation_cases:read-team` |
| probation_reviews | `probation_reviews:manager-review` |
| self_service_requests | `self_service_requests:manager_review` |
| shift_assignments | `shift_assignments:read` |
| shift_change_requests | `shift_change_requests:create`, `shift_change_requests:delete`, `shift_change_requests:read`, `shift_change_requests:update` |
| shift_schedules | `shift_schedules:read` |
| shifts | `shifts:read` |
| team_attendance | `team_attendance:read` |
| users | `users:update` |
| work_activities | `work_activities:manager-read`, `work_activities:manager-review`, `work_activities:self-service-read`, `work_activities:self-service-update` |

### Branch Manager

Manages employees, attendance, and approvals for their branch. Branch-scoped equivalent of Department Manager.

80 assigned permissions.

| Module | Assigned permissions |
| --- | --- |
| attendance_holiday_groups | `attendance_holiday_groups:read` |
| attendance_holidays | `attendance_holidays:read` |
| attendance_mobile_punches | `attendance_mobile_punches:create`, `attendance_mobile_punches:read` |
| attendance_policies | `attendance_policies:read` |
| attendance_summaries | `attendance_summaries:read` |
| branches | `branches:read` |
| company_dashboard | `company_dashboard:read` |
| company_data | `company_data:read` |
| cost_centers | `cost_centers:read` |
| data_scope | `data_scope:branch` |
| departments | `departments:read` |
| employee_assignments | `employee_assignments:read` |
| employee_finance | `employee_finance:applications-manager-review`, `employee_finance:applications-self`, `employee_finance:delegations` |
| employee_grades | `employee_grades:read` |
| employee_numbering | `employee_numbering:read` |
| employees | `employees:read` |
| employment_contracts | `employment_contracts:self` |
| field_locations | `field_locations:read` |
| field_visits | `field_visits:manager-read`, `field_visits:manager-review`, `field_visits:self-service-read`, `field_visits:self-service-update` |
| holidays | `holidays:read` |
| kpi_assignments | `kpi_assignments:create`, `kpi_assignments:read`, `kpi_assignments:update` |
| kpi_targets | `kpi_targets:revise` |
| leave_balances | `leave_balances:list`, `leave_balances:read`, `leave_balances:read-own` |
| leave_requests | `leave_requests:approve`, `leave_requests:cancel`, `leave_requests:create`, `leave_requests:read` |
| leave_types | `leave_types:read` |
| manager | `manager:read` |
| manager_self_service | `manager_self_service:read` |
| manager_team | `manager_team:read` |
| notifications | `notifications:delete`, `notifications:read`, `notifications:update` |
| offboarding_clearances | `offboarding_clearances:complete` |
| offboarding_requests | `offboarding_requests:approve`, `offboarding_requests:cancel`, `offboarding_requests:create`, `offboarding_requests:read`, `offboarding_requests:submit`, `offboarding_requests:update` |
| offboarding_tasks | `offboarding_tasks:complete`, `offboarding_tasks:reject` |
| offboarding_workflows | `offboarding_workflows:read` |
| onboarding_documents | `onboarding_documents:create`, `onboarding_documents:read`, `onboarding_documents:verify` |
| onboarding_requests | `onboarding_requests:approve`, `onboarding_requests:read`, `onboarding_requests:update` |
| onboarding_tasks | `onboarding_tasks:complete`, `onboarding_tasks:read` |
| payroll | `payroll:payslips-self` |
| positions | `positions:read` |
| probation_cases | `probation_cases:read-team` |
| probation_reviews | `probation_reviews:manager-review` |
| self_service_requests | `self_service_requests:manager_review` |
| shift_assignments | `shift_assignments:read` |
| shift_change_requests | `shift_change_requests:create`, `shift_change_requests:delete`, `shift_change_requests:read`, `shift_change_requests:update` |
| shift_schedules | `shift_schedules:read` |
| shifts | `shifts:read` |
| team_attendance | `team_attendance:read` |
| users | `users:update` |
| work_activities | `work_activities:manager-read`, `work_activities:manager-review`, `work_activities:self-service-read`, `work_activities:self-service-update` |

### Employee

Self-service role. Can view profile, attendance, leave balance, and submit requests. Data is scoped to own records.

38 assigned permissions.

| Module | Assigned permissions |
| --- | --- |
| attendance_holiday_groups | `attendance_holiday_groups:read` |
| attendance_holidays | `attendance_holidays:read` |
| attendance_mobile_punches | `attendance_mobile_punches:create` |
| attendance_policies | `attendance_policies:read` |
| attendance_summaries | `attendance_summaries:read` |
| data_scope | `data_scope:self` |
| employee_finance | `employee_finance:applications-self` |
| employees | `employees:read` |
| employment_contracts | `employment_contracts:self` |
| field_visits | `field_visits:self-service-read`, `field_visits:self-service-update` |
| holidays | `holidays:read` |
| leave_balances | `leave_balances:read`, `leave_balances:read-own` |
| leave_requests | `leave_requests:cancel`, `leave_requests:create`, `leave_requests:read` |
| leave_types | `leave_types:read` |
| notifications | `notifications:delete`, `notifications:read`, `notifications:update` |
| offboarding_requests | `offboarding_requests:cancel`, `offboarding_requests:create`, `offboarding_requests:read`, `offboarding_requests:submit`, `offboarding_requests:update` |
| offboarding_workflows | `offboarding_workflows:read` |
| onboarding_documents | `onboarding_documents:create`, `onboarding_documents:read` |
| onboarding_requests | `onboarding_requests:read`, `onboarding_requests:update` |
| onboarding_tasks | `onboarding_tasks:complete`, `onboarding_tasks:read` |
| payroll | `payroll:payslips-self` |
| shift_change_requests | `shift_change_requests:create`, `shift_change_requests:read` |
| work_activities | `work_activities:self-service-read`, `work_activities:self-service-update` |

### Finance

Processes payroll, staff loan deductions and repayments, and salary payment reports.

77 assigned permissions.

| Module | Assigned permissions |
| --- | --- |
| attendance_holiday_groups | `attendance_holiday_groups:read` |
| attendance_holidays | `attendance_holidays:read` |
| attendance_mobile_punches | `attendance_mobile_punches:create` |
| attendance_policies | `attendance_policies:read` |
| attendance_summaries | `attendance_summaries:read` |
| company_dashboard | `company_dashboard:read` |
| company_data | `company_data:read` |
| data_scope | `data_scope:company` |
| employee_finance | `employee_finance:accounts-read`, `employee_finance:applications-finance-approve`, `employee_finance:applications-read`, `employee_finance:applications-self`, `employee_finance:disbursements`, `employee_finance:disbursements-approve`, `employee_finance:payroll`, `employee_finance:repayments`, `employee_finance:repayments-approve`, `employee_finance:reports`, `employee_finance:settlements`, `employee_finance:settlements-approve` |
| employees | `employees:read` |
| employment_contracts | `employment_contracts:self` |
| field_visits | `field_visits:self-service-read`, `field_visits:self-service-update` |
| holidays | `holidays:read` |
| leave_balances | `leave_balances:read`, `leave_balances:read-own` |
| leave_encashment | `leave_encashment:finance_confirm` |
| leave_requests | `leave_requests:cancel`, `leave_requests:create`, `leave_requests:read` |
| leave_rollover | `leave_rollover:read` |
| leave_types | `leave_types:read` |
| notifications | `notifications:delete`, `notifications:read`, `notifications:update` |
| offboarding_requests | `offboarding_requests:cancel`, `offboarding_requests:create`, `offboarding_requests:read`, `offboarding_requests:submit`, `offboarding_requests:update` |
| offboarding_workflows | `offboarding_workflows:read` |
| onboarding_documents | `onboarding_documents:create`, `onboarding_documents:read` |
| onboarding_requests | `onboarding_requests:read`, `onboarding_requests:update` |
| onboarding_tasks | `onboarding_tasks:complete`, `onboarding_tasks:read` |
| payroll | `payroll:accounting`, `payroll:banking`, `payroll:config-read`, `payroll:inputs`, `payroll:inputs-approve`, `payroll:inputs-read`, `payroll:payments-confirm`, `payroll:payslips`, `payroll:payslips-read`, `payroll:payslips-self`, `payroll:periods`, `payroll:periods-read`, `payroll:recoveries-approve`, `payroll:recoveries-manage`, `payroll:reports`, `payroll:runs`, `payroll:runs-approve`, `payroll:runs-cancel`, `payroll:runs-close`, `payroll:runs-lock`, `payroll:runs-process`, `payroll:runs-read`, `payroll:runs-reverse`, `payroll:statutory-approve` |
| shift_change_requests | `shift_change_requests:create`, `shift_change_requests:read` |
| users | `users:update` |
| work_activities | `work_activities:self-service-read`, `work_activities:self-service-update` |

### Management

Company-wide read-only access to management dashboards, productivity and reports.

13 assigned permissions.

| Module | Assigned permissions |
| --- | --- |
| analytics | `analytics:dashboards-management`, `analytics:datasets-read`, `analytics:metrics-read`, `analytics:reports` |
| company_dashboard | `company_dashboard:read` |
| company_data | `company_data:read` |
| dashboard | `dashboard:management` |
| data_scope | `data_scope:company` |
| field_locations | `field_locations:read` |
| field_visits | `field_visits:hr-read` |
| kpi_assignments | `kpi_assignments:read` |
| payroll | `payroll:reports` |
| work_activities | `work_activities:hr-read` |

### IT Administrator

Manages user accounts, authentication, access-control devices and technical security configuration.

28 assigned permissions.

| Module | Assigned permissions |
| --- | --- |
| access_control_sync | `access_control_sync:execute` |
| attendance_devices | `attendance_devices:create`, `attendance_devices:read`, `attendance_devices:update` |
| branches | `branches:read` |
| company_users | `company_users:create`, `company_users:read`, `company_users:update` |
| data_scope | `data_scope:company` |
| departments | `departments:read` |
| employee_access_credentials | `employee_access_credentials:read`, `employee_access_credentials:update` |
| employee_device_assignments | `employee_device_assignments:create`, `employee_device_assignments:delete`, `employee_device_assignments:read`, `employee_device_assignments:update` |
| permissions | `permissions:read` |
| positions | `positions:read` |
| roles | `roles:read` |
| security_events | `security_events:read` |
| users | `users:assign-role`, `users:create`, `users:disable-2fa`, `users:enable-2fa`, `users:manage-2fa`, `users:read`, `users:revoke-role`, `users:update` |

### Attendance Administrator

Manages attendance policies, shifts, devices, corrections and attendance processing.

23 assigned permissions.

| Module | Assigned permissions |
| --- | --- |
| attendance_device_sync_logs | `attendance_device_sync_logs:read` |
| attendance_devices | `attendance_devices:read` |
| attendance_mobile_punches | `attendance_mobile_punches:update` |
| attendance_policies | `attendance_policies:create`, `attendance_policies:read`, `attendance_policies:update` |
| attendance_processing | `attendance_processing:execute`, `attendance_processing:read` |
| attendance_recalculation | `attendance_recalculation:execute` |
| attendance_summaries | `attendance_summaries:read` |
| branches | `branches:read` |
| data_scope | `data_scope:company` |
| departments | `departments:read` |
| employee_timetables | `employee_timetables:create`, `employee_timetables:read`, `employee_timetables:update` |
| employees | `employees:read` |
| shift_assignments | `shift_assignments:create`, `shift_assignments:read`, `shift_assignments:update` |
| shifts | `shifts:read` |
| team_attendance | `team_attendance:read` |
| timetables | `timetables:read` |

### Leave Administrator

Manages leave types, policies, balances, workflows and HR leave approvals.

30 assigned permissions.

| Module | Assigned permissions |
| --- | --- |
| branches | `branches:read` |
| data_scope | `data_scope:company` |
| departments | `departments:read` |
| employees | `employees:read` |
| leave_balance_recalculation | `leave_balance_recalculation:history`, `leave_balance_recalculation:preview` |
| leave_balances | `leave_balances:adjust`, `leave_balances:export`, `leave_balances:import`, `leave_balances:import-partial`, `leave_balances:read`, `leave_balances:read-import-history` |
| leave_operations | `leave_operations:read` |
| leave_policies | `leave_policies:create`, `leave_policies:read`, `leave_policies:update` |
| leave_requests | `leave_requests:approve`, `leave_requests:cancel`, `leave_requests:override`, `leave_requests:read`, `leave_requests:update` |
| leave_rollover | `leave_rollover:manage`, `leave_rollover:read` |
| leave_statutory | `leave_statutory:read` |
| leave_types | `leave_types:create`, `leave_types:read`, `leave_types:update` |
| leave_workflows | `leave_workflows:create`, `leave_workflows:read`, `leave_workflows:update` |

### Auditor

Read-only access to reports, logs, HR data, and compliance records. Cannot create, update, or approve anything.

57 assigned permissions.

| Module | Assigned permissions |
| --- | --- |
| attendance_device_sync_logs | `attendance_device_sync_logs:read` |
| attendance_holiday_groups | `attendance_holiday_groups:read` |
| attendance_holidays | `attendance_holidays:read` |
| attendance_policies | `attendance_policies:read` |
| attendance_processing | `attendance_processing:read` |
| attendance_summaries | `attendance_summaries:read` |
| branches | `branches:read` |
| company_dashboard | `company_dashboard:read` |
| company_data | `company_data:read` |
| cost_centers | `cost_centers:read` |
| data_scope | `data_scope:company` |
| departments | `departments:read` |
| employee_assignments | `employee_assignments:read` |
| employee_grades | `employee_grades:read` |
| employee_import | `employee_import:download-result`, `employee_import:read-history` |
| employee_numbering | `employee_numbering:read` |
| employee_timetables | `employee_timetables:read` |
| employees | `employees:read` |
| holidays | `holidays:read` |
| identity_audit | `identity_audit:read` |
| leave_balances | `leave_balances:list`, `leave_balances:read`, `leave_balances:read-import-history` |
| leave_policies | `leave_policies:read` |
| leave_requests | `leave_requests:read` |
| leave_rollover | `leave_rollover:read` |
| leave_statutory | `leave_statutory:read` |
| leave_types | `leave_types:read` |
| leave_workflows | `leave_workflows:read` |
| offboarding_documents | `offboarding_documents:read` |
| offboarding_requests | `offboarding_requests:read` |
| offboarding_workflows | `offboarding_workflows:read` |
| onboarding_documents | `onboarding_documents:read` |
| onboarding_requests | `onboarding_requests:read` |
| onboarding_workflows | `onboarding_workflows:read` |
| positions | `positions:read` |
| security_events | `security_events:read` |
| shift_assignments | `shift_assignments:read` |
| shift_attendance_rules | `shift_attendance_rules:read` |
| shift_breaks | `shift_breaks:read` |
| shift_change_requests | `shift_change_requests:read` |
| shift_overtime_rules | `shift_overtime_rules:read` |
| shift_rotation_groups | `shift_rotation_groups:read` |
| shift_rotation_rules | `shift_rotation_rules:read` |
| shift_schedules | `shift_schedules:read` |
| shift_templates | `shift_templates:read` |
| shifts | `shifts:read` |
| timetable_attendance_rules | `timetable_attendance_rules:read` |
| timetable_days | `timetable_days:read` |
| timetable_generated_schedules | `timetable_generated_schedules:read` |
| timetable_holiday_rules | `timetable_holiday_rules:read` |
| timetable_rotation_rules | `timetable_rotation_rules:read` |
| timetable_rotations | `timetable_rotations:read` |
| timetable_shift_rules | `timetable_shift_rules:read` |
| timetables | `timetables:read` |
| users | `users:read` |

# Backend implementation prompt: employee invitations

Implement a production-ready employee invitation module in the existing HRMS backend. The backend is multi-tenant, uses Bearer authentication and permission guards, and already has configured email, SMS, employee, company-user, onboarding, notification-log, and SMS-log services.

The frontend is ready to call `POST /api/employee-invitations`. Do not use `/api/notifications/test`, `/api/sms/test`, or the email-verification endpoint for this feature.

## Required behavior

1. An authorized HR user submits an employee invitation with personal details, work assignment, an optional onboarding workflow, and both delivery channels.
2. Create one pending invitation in the active company. Do not create a user or employee yet.
3. Generate a cryptographically secure, single-use token. Store only its hash. The invitation must expire after 72 hours by default.
4. Build one HTTPS acceptance URL containing the raw token and send that same URL by email and SMS using the company's existing delivery configuration.
5. Queue delivery through the existing job/outbox infrastructure. A temporary provider failure must not lose the invitation.
6. On acceptance, validate the token, company, expiry, and status; let the recipient set their password; then atomically create or link the user, company membership, employee profile, primary department/position, and onboarding request. Mark the invitation accepted and invalidate the token.
7. Record separate email and SMS delivery states and provider message IDs so HR can see partial failures and resend only failed channels.

## Create endpoint

`POST /api/employee-invitations`

Permission: accept `employees:create` (or introduce `employee_invitations:create` and grant it to the same HR roles).

Request:

```json
{
  "first_name": "Amina",
  "last_name": "Moshi",
  "gender": "female",
  "email": "amina.moshi@example.com",
  "phone": "+255712345678",
  "primary_branch_id": 2,
  "primary_department_id": 5,
  "primary_position_id": 9,
  "employment_type": "full_time",
  "reports_to": 14,
  "hire_date": "2026-09-15",
  "onboarding_workflow_id": 3,
  "channels": ["EMAIL", "SMS"]
}
```

Validate email format, E.164 phone format, assignment IDs within the active company, manager visibility, employment type, workflow access, and that both `EMAIL` and `SMS` are requested. Normalize email to lowercase and phone to E.164 before duplicate checks.

Return `201`:

```json
{
  "data": {
    "id": 44,
    "status": "pending",
    "email": "amina.moshi@example.com",
    "phone": "+255712345678",
    "expires_at": "2026-09-11T12:00:00.000Z",
    "delivery": {
      "email": { "status": "queued", "message_id": null },
      "sms": { "status": "queued", "message_id": null }
    }
  }
}
```

Use `409` when an unexpired pending invitation already exists for the same company and normalized email or phone. Return the existing invitation ID and a safe message. Never return the invitation token in list or log responses.

## Supporting endpoints

- `GET /api/employee-invitations?page=1&limit=20&status=pending&search=...` — HR list with delivery status.
- `POST /api/employee-invitations/{id}/resend` with `{ "channels": ["EMAIL", "SMS"] }` — rotate the token, extend expiry, and queue selected channels.
- `POST /api/employee-invitations/{id}/cancel` — mark cancelled and invalidate the token.
- `GET /api/employee-invitations/accept/{token}` — public, rate-limited invitation preview with only safe company/invitee fields.
- `POST /api/employee-invitations/accept/{token}` with `{ "password": "...", "password_confirmation": "..." }` — public, rate-limited, atomic acceptance.

## Data model

Create an `employee_invitations` table scoped by `company_id`, including the submitted draft fields, `token_hash`, `status` (`pending`, `accepted`, `expired`, `cancelled`), `expires_at`, `accepted_at`, `cancelled_at`, `created_by_company_user_id`, timestamps, and per-channel delivery state. Prefer a child delivery table when existing notification/SMS logs cannot represent invitation attempts cleanly.

Add indexes for `(company_id, status)`, normalized email, normalized phone, expiry, and token hash. Enforce one live pending invitation per company/contact using transaction-safe checks.

## Delivery and security

- Reuse the existing company email and SMS configuration and logging services.
- Templates must include company name, inviter name, expiry, and the same acceptance URL.
- Make delivery idempotent with a key such as `employee-invitation:{id}:{token-version}:{channel}`.
- Do not log raw tokens, passwords, full message bodies, or provider credentials.
- Apply rate limits to create, resend, preview, and accept operations.
- Audit create, resend, cancel, accept, provider failure, and expiry events.
- A failure in one channel must not roll back or suppress the other channel. Return/record each outcome independently.

## Acceptance transaction

Within one database transaction: lock the invitation, verify it is pending and unexpired, ensure email/phone uniqueness in the active company, create or link the user, create company membership, create the employee with status `onboarding`, add the primary work contact and assignment, create the configured/default onboarding request, mark the invitation accepted, and invalidate all outstanding tokens for that invitation. Roll back everything if any required step fails.

## Documentation and tests

Add OpenAPI DTOs, response schemas, permission annotations, and error examples. Add unit/integration tests for tenant isolation, permission denial, duplicate invitations, email-only provider failure, SMS-only provider failure, resend idempotency, expiry, cancellation, replay prevention, concurrent acceptance, assignment validation, onboarding creation, and rollback on partial acceptance failure.

Definition of done: the existing frontend request above receives `201`, both delivery jobs appear in their existing logs, the recipient gets the same secure link by email and SMS, the link can be used only once, and successful acceptance creates exactly one company user, employee, primary assignment, and onboarding request.

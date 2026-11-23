# Role, probation and access-device administration

## Users and roles

In a company workspace, open **Access Control → Users** with `users:read`. Bookmarks to `/dashboard/users` continue to work. Open **Access Control → Roles** to inspect a role. A System role has a read-only permission list. To grant a different set of permissions, create or edit a custom role, select the action permissions and data scopes, review the selection and confirm.

HRMS combines the current company's role assignments and direct permissions. A protected employee operation requires the action and a scope covering that employee. Changes take effect on the next protected API request. Switching company loads that company's membership and grants. The seed appendix shows the permissions assigned to each default role. [Default role grants](default-role-grants.md)

## Probation

1. Open **Probation → Policies → New policy**. Set the period, score, effective dates, priority and target branch, department, position or grade. Leave a target at **Any** for a broader match. Specificity takes precedence over priority. For equal matches at the same priority, the default policy takes precedence, followed by the newest policy ID.
2. Set the required stages, confirmation letter requirement and extension limits. Enter criterion weights totaling 100 when using criteria. The form displays installation defaults. A new case retains a snapshot of its policy.
3. When a case reaches **Manager review pending**, the assigned reviewer opens **My team → Open → Manager review**. Provide a rating between zero and the displayed maximum for every criterion in this cycle. Add comments, choose the recommendation and save. **Further review** sends the recorded scores and comments to **HR review pending**. HR makes the final decision.
4. With `probation_letters:generate`, open **Probation → Letter templates**, select Confirmation, Extension or Non-confirmation, and save the letterhead, body, signatory name and title. Each company manages its own templates.

The standard installation defaults are a 180-day period, two extensions, 90 days per default extension, a 180-day maximum extension and a 365-day total limit. Reminder offsets default to 30, 14, 7, 3 and 1 days before the due date. The installation administrator manages these defaults through server configuration. HR can override the fields exposed on the individual policy.

## Access devices

Attendance ingestion uses **PULL**. In **Devices → Employees**, open **Credentials** for a linked employee. Card is available when the reader's saved verification mode permits it. The existing **Add card** shortcut remains available. Fingerprint, password and PIN also depend on the verification mode. **Command Logs**, **Sync Logs** and **Audit Logs** require `access_control_sync:execute` within the active company.

Open **Schedule history** on a week plan or template to see its recent saved revisions. A manual device sync compares the requested schedule with the configuration read back from the device. A mismatch leaves the revision unverified. Automatic schedule deployment is off by default. An administrator with company scope, synchronization and the applicable schedule-update permission may enable it for a schedule on its assigned device. The worker checks the authorizing membership before each attempt. Use **Pause automatic deployment** to stop future updates.

On a device’s **Details** tab, **Automatic access reconciliation** enables processing of subsequent changes on that reader. HRMS checks the active authorization, reads the employee’s door rights, preserves independent grants and verifies the resulting configuration. Removal or transfer can leave manual rights that need review. Open **Access Control → Groups** for the operation and its outcome. Previously queued changes retain their review status.

For device-bound standard cards, a change to inactive, lost, blocked or deleted removes the card after confirming its owner. Returning the status to active can restore a card previously suspended by HRMS. Newly issued cards use the enrollment flow. Ambiguous identities, special card configurations and other credential types require the reader-specific procedure. Check the operation’s verified status before recording a completed revocation.

Physical reader acceptance is pending. Face and QR enrollment require a supported model and integration. Test enrollment with a disposable employee and verify the reader response, door behavior and resulting attendance event on an isolated reader.

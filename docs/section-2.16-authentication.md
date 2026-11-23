# 2.16 Company sign-in and session management

### Sign in and recover access

Use **Sign in with SSO** on the web sign-in page after linking your company identity. Enter the company sign-in code supplied by your administrator, sign in with your identity provider in the same browser tab, and complete your HRMS authenticator challenge if prompted. HRMS opens the linked account in that company. Your assigned memberships and permissions control access when you switch company.

For first-time linking, sign in with your HRMS password. Open **Settings → Security → Devices → My company sign-in**, enter your current HRMS password and choose **Link company identity**. Complete the provider sign-in in the same tab. HRMS binds that provider identity to your existing account. Matching email addresses alone do not create a link. Use **Unlink identity** with your HRMS password to remove the link.

If the provider is unavailable, use your HRMS password and existing authenticator or backup code. Use **Forgot password?** for password recovery. If the SSO request expires, start again in the same tab. Ask your administrator to check the company code, registration and membership if the provider accepts your credentials but HRMS cannot finish sign-in. Signing out ends the HRMS session. On a shared device, sign out of the identity provider as well.

### Configure and test a company provider

1. Have the deployment administrator approve the exact HTTPS issuer in `OIDC_ALLOWED_ISSUERS`, configure the server field-encryption keyring and set `APP_FRONTEND_URL` to the public HTTPS frontend URL. For Microsoft Entra, use the tenant-specific v2.0 issuer. If discovery advertises an endpoint on another host, the deployment administrator must approve its HTTPS origin in `OIDC_ENDPOINT_ORIGINS`.
2. In the selected company, an administrator with `manage_company_users` opens **Settings → Security → Devices → Company identity provider**. Register the displayed redirect URI as a web application callback at the provider. Enter the issuer URL, client ID and client secret, then choose **Save registration**. HRMS encrypts the secret on the server. The settings screen never returns a saved secret.
3. Choose **Test provider sign-in** and complete the provider sign-in. HRMS checks the callback and signed identity token before recording a successful test. Choose **Enable SSO** and distribute the displayed company code. Changing registration details pauses SSO until a new test succeeds and an administrator enables it again.
4. Test password recovery and a linked, non-production account before rollout. A real provider registration, its credentials in the authorized environment and a successful live sign-in are deployment-specific prerequisites. A successful automated provider test does not establish that a particular Entra tenant is configured.

### Session limits, warnings and devices

**Settings → Security → Devices** shows the policy for your current sign-in and your active devices. **Revoke session** signs out a selected device. **Sign out all** revokes every HRMS session for your account.

- Access tokens renew automatically while the session is valid. Each refresh token is single-use. The absolute lifetime runs from sign-in and a renewal cannot extend it.
- Interaction with the application updates the inactivity deadline. An open, unattended tab can time out while background updates continue. A warning appears during the final minute. Choose **Stay signed in** to extend an idle session. At the absolute deadline, save your work and sign in again.
- A platform owner can open **Session policy** under **Settings → Security → Devices**. The form accepts access lifetimes of 60–3,600 seconds, refresh lifetimes of 300–7,776,000 seconds, absolute lifetimes of 3,600–7,776,000 seconds, inactivity timeouts of 300–86,400 seconds and 1–50 simultaneous sessions per account. The access lifetime must fit within the refresh lifetime.
- Saved policies take effect at the next sign-in. Existing sessions retain the settings issued to them. When a new sign-in reaches the device limit, HRMS revokes the oldest active sign-ins for that account. Before an administrator saves a policy, the installation supplies the token and absolute lifetimes. The initial inactivity timeout is 30 minutes and the initial device limit is five.
- An administrator with `manage_company_users` can open **Manage active sessions** and confirm revocation of a device in their authorized scope. Company administrators manage company-user sessions in their active company. Users with `security_events:read` can open **Authentication events** to review sign-ins, failed attempts, identity links, policy changes and revocations within their scope.

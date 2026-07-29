# Microsoft Entra ID (SSO) — Frontend & Backend Setup

**Audience:** frontend agents, backend agents, and IT admins  
**Goal:** Employees sign in with Microsoft 365 work accounts and receive the same HRMS session tokens as password login.  
**Status:** Spec for implementation. Backend SSO routes do **not** exist yet (probed 404). Frontend SSO UI is not shipped yet.

---

## 1. Summary for backend agents (read this first)

| Item | Value |
|------|--------|
| New endpoint | `POST /api/auth/sso/microsoft` |
| Auth on this route | **None** (public, like `/api/auth/login`) |
| Request body | `{ "idToken": "<Microsoft ID token JWT>" }` |
| Success response | Same shape as successful password login: HRMS `accessToken` + `refreshToken` + optional `user` |
| What you must do | Validate Microsoft ID token → find existing HRMS user by email (or `azure_oid`) → issue normal HRMS JWTs |
| What you must **not** do | Auto-create privileged users; accept personal Microsoft accounts if tenant is single-tenant; skip signature validation |

Password login, 2FA, refresh, and logout stay unchanged.

---

## 2. Current auth (as of this frontend repo)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/auth/login` | Email + password → tokens or 2FA temp token |
| `POST` | `/api/auth/2fa/complete-login` | `{ tempToken, code }` → tokens |
| `POST` | `/api/auth/refresh` | `{ refresh_token }` → new tokens |
| `POST` | `/api/auth/logout` | Bearer access + `{ refresh_token }` |
| `GET` | `/api/users/me` | Current user (Bearer access token) |

Frontend base URL: `NEXT_PUBLIC_API_BASE_URL` (dev often `http://192.168.1.30:8888`).  
Paths already include `/api/...` — do not double-prefix `/api`.

Session storage (frontend):

- `ess.auth.tokens` — `{ accessToken, refreshToken }`
- `ess.auth.user` — normalized user profile
- Also mirrored for dashboard admin token keys where used

SSO success **must** produce the same token pair so existing refresh/guards work with no dashboard changes.

---

## 3. Target architecture

```
┌─────────────┐     1. Sign in with Microsoft      ┌──────────────────┐
│  Browser    │ ─────────────────────────────────► │ Microsoft Entra  │
│  Next.js    │ ◄───────────────────────────────── │ (login + MFA)    │
│  /login     │     2. ID token (via MSAL PKCE)    └──────────────────┘
│             │
│             │     3. POST /api/auth/sso/microsoft
│             │        { idToken }
│             ▼
│      ┌──────────────┐
│      │ HRMS Backend │  4. Validate JWT (JWKS)
│      │              │  5. Map to HRMS user
│      │              │  6. Issue access + refresh
│      └──────────────┘
│             │
│             ▼
│      7. Store tokens → /dashboard
└─────────────┘
```

**Local dev is supported.** Entra redirect URI can be `http://localhost:3000/login`. The API can stay on a LAN IP (`http://192.168.x.x:8888`). The browser must reach both the Next app and the API.

Public internet hosting is **not** required for local/pilot SSO. Production company-wide access usually wants HTTPS + a stable hostname.

---

## 4. Microsoft Entra app registration (IT / either team)

1. [Entra admin center](https://entra.microsoft.com) → **Applications** → **App registrations** → **New registration**.
2. Name: e.g. `Alliance HRMS`.
3. Supported accounts: **Accounts in this organizational directory only** (single tenant).
4. Redirect URI:
   - Platform: **Single-page application (SPA)**
   - Dev: `http://localhost:3000/login`
   - Prod (later): `https://hrms.your-domain.com/login`
5. Copy:
   - **Application (client) ID** → shared with frontend + backend validation `aud`
   - **Directory (tenant) ID** → authority / issuer
6. **API permissions** (delegated): `openid`, `profile`, `email` (optional: `User.Read`).
7. **Grant admin consent** for the tenant.
8. No client secret required for SPA + PKCE. Backend only needs tenant + client ID to validate the ID token (public keys from Microsoft JWKS).

### Entra env (shared names)

| Variable | Who uses it | Example |
|----------|-------------|---------|
| `AZURE_AD_TENANT_ID` / `NEXT_PUBLIC_AZURE_AD_TENANT_ID` | Backend / Frontend | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `AZURE_AD_CLIENT_ID` / `NEXT_PUBLIC_AZURE_AD_CLIENT_ID` | Backend / Frontend | SPA application (client) ID |
| `NEXT_PUBLIC_AZURE_AD_REDIRECT_URI` | Frontend | `http://localhost:3000/login` |
| `NEXT_PUBLIC_SSO_MICROSOFT_ENABLED` | Frontend | `true` when ready to show the button |

Frontend values that are public may use `NEXT_PUBLIC_*`. Backend should use server-only env (no `NEXT_PUBLIC_`).

---

## 5. Backend API contract (implement this)

### 5.1 Endpoint

```
POST /api/auth/sso/microsoft
Content-Type: application/json
```

No `Authorization` header.

### 5.2 Request

```json
{
  "idToken": "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIs..."
}
```

**Accepted aliases (optional, for robustness):** `id_token`, `token`  
Prefer documenting and testing **`idToken`** as the primary field.

### 5.3 Success response (200)

Mirror whatever successful password login already returns so the frontend can reuse the same normalizer.

**Preferred explicit shape (camelCase; snake_case also accepted by frontend normalizers):**

```json
{
  "accessToken": "<hr ms jwt>",
  "refreshToken": "<hr ms refresh>",
  "user": {
    "id": 123,
    "email": "jane.doe@company.com",
    "first_name": "Jane",
    "last_name": "Doe",
    "fullName": "Jane Doe"
  }
}
```

Also fine if tokens are nested under `data` / `tokens` — frontend already unwraps several shapes (`normalizeTokens` / `normalizeUser` in `src/services/authService.ts`).

**Do not** return only a Microsoft token. Downstream APIs expect **HRMS** Bearer tokens.

### 5.4 Error responses

Use consistent JSON: `{ "message": "..." }` or `{ "error": "..." }` (frontend reads both).

| HTTP | When | Example message |
|------|------|-----------------|
| `400` | Missing/empty `idToken` | `idToken is required` |
| `401` | Invalid signature, expired, wrong `aud`/`iss`/`tid` | `Invalid Microsoft token` |
| `403` | Valid Microsoft identity, no matching active HRMS user | `No HRMS account for this Microsoft user. Contact HR.` |
| `403` | User suspended / terminated | `Account is not active` |
| `500` | Unexpected server error | generic safe message |

### 5.5 Validation steps (backend must implement)

1. Parse JWT; reject if malformed.
2. Fetch/cache JWKS from:
   - `https://login.microsoftonline.com/{tenantId}/discovery/v2.0/keys`
3. Verify signature (RS256), `exp`, `nbf` if present.
4. Assert:
   - `iss` is `https://login.microsoftonline.com/{tenantId}/v2.0` (or the v1 issuer your tokens use — stick to one)
   - `aud` equals your SPA **Application (client) ID**
   - `tid` equals your tenant ID (if present)
5. Read identity claims (try in order):
   - Email: `email`, `preferred_username`, `upn`
   - Name: `name`, `given_name` + `family_name`
   - Object ID: `oid`
6. Normalize email to lowercase trim.
7. Resolve HRMS user:
   - Prefer match on stored `azure_oid` / `entra_oid` if column exists and claim present
   - Else match `users.email` (or company membership email) case-insensitive
8. Reject if user missing or not allowed to sign in.
9. Optionally on first SSO success: persist `azure_oid` for stable linking.
10. Issue the **same** access + refresh tokens as a successful password login for that user (same claims, expiry, refresh store).
11. **2FA product decision:** recommended for v1 — **skip app-level TOTP** when SSO succeeds (Entra Conditional Access / MFA already applied). Document if you still require `/api/auth/2fa/complete-login`.

### 5.6 Logging / security

- Log: success/failure, user id if known, `oid` (not full token), reason code.
- Never log raw ID tokens or HRMS refresh tokens.
- Rate-limit this endpoint like login (brute force / token stuffing).
- CORS: allow the frontend origin (`http://localhost:3000` in dev).

### 5.7 Backend env example

```env
AZURE_AD_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_AD_CLIENT_ID=yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy
# Optional clock skew seconds
AZURE_AD_CLOCK_SKEW_SEC=60
```

### 5.8 Suggested NestJS-style pseudocode

```ts
// POST /api/auth/sso/microsoft
async microsoftSso(@Body() body: { idToken?: string }) {
  const idToken = body.idToken?.trim()
  if (!idToken) throw new BadRequestException('idToken is required')

  const claims = await this.entra.validateIdToken(idToken) // jwks, aud, iss, exp
  const email = (claims.email || claims.preferred_username || claims.upn || '')
    .toLowerCase()
    .trim()
  if (!email) throw new UnauthorizedException('Invalid Microsoft token')

  let user = claims.oid
    ? await this.users.findByAzureOid(claims.oid)
    : null
  if (!user) user = await this.users.findByEmail(email)
  if (!user || !user.canLogin) {
    throw new ForbiddenException(
      'No HRMS account for this Microsoft user. Contact HR.'
    )
  }

  if (claims.oid && !user.azureOid) {
    await this.users.setAzureOid(user.id, claims.oid)
  }

  // Same helper as password login success path
  return this.auth.issueSessionTokens(user)
}
```

### 5.9 Manual test for backend (no frontend)

1. Obtain a real ID token (browser MSAL test page, or temporary frontend).
2. Curl:

```bash
curl -s -X POST "http://192.168.1.30:8888/api/auth/sso/microsoft" \
  -H "Content-Type: application/json" \
  -d "{\"idToken\":\"PASTE_ID_TOKEN_HERE\"}"
```

3. Expect 200 + access/refresh; then:

```bash
curl -s "http://192.168.1.30:8888/api/users/me" \
  -H "Authorization: Bearer PASTE_ACCESS_TOKEN"
```

---

## 6. Frontend setup (this repo)

### 6.1 Library

- `@azure/msal-browser` (auth code + PKCE)

### 6.2 Env (`.env.local` for local Next.js)

```env
NEXT_PUBLIC_API_BASE_URL=http://192.168.1.30:8888
NEXT_PUBLIC_SSO_MICROSOFT_ENABLED=true
NEXT_PUBLIC_AZURE_AD_CLIENT_ID=yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy
NEXT_PUBLIC_AZURE_AD_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
NEXT_PUBLIC_AZURE_AD_REDIRECT_URI=http://localhost:3000/login
```

### 6.3 Client flow

1. User clicks **Sign in with Microsoft**.
2. MSAL `loginPopup` (desktop) or `loginRedirect` (mobile fallback).
3. Authority: `https://login.microsoftonline.com/{TENANT_ID}`
4. Scopes: `openid profile email`
5. Read `idToken` from authentication result.
6. `POST {API}/api/auth/sso/microsoft` with `{ idToken }`.
7. Reuse existing token normalizers + `persistSessionTokens` + redirect `/dashboard`.
8. Keep password form; do not remove it (break-glass).

### 6.4 Files to touch (frontend implementation checklist)

| File | Responsibility |
|------|----------------|
| `src/utils/constants.ts` or `src/lib/microsoft-sso.ts` | Config + MSAL instance |
| `src/services/authService.ts` | `loginWithMicrosoftSso(idToken)` → API |
| `src/hooks/useAuth.ts` | Session save wrapper |
| `src/components/auth/LoginFlow.tsx` | Button + error UX |
| `src/pages/login.tsx` | Optional redirect-promise bootstrap |

### 6.5 Feature flag

If `NEXT_PUBLIC_SSO_MICROSOFT_ENABLED` is not `true`, or client/tenant IDs missing → hide Microsoft button.

### 6.6 Error UX mapping

| Condition | User-facing message |
|-----------|---------------------|
| Popup closed | `Microsoft sign-in was cancelled.` |
| MSAL config missing | `Microsoft sign-in is not configured.` |
| API 401 | `Microsoft sign-in failed. Try again or use password.` |
| API 403 | Show backend `message` if present |
| API 404 | `SSO is not available on the server yet.` |
| Network | Existing API error handling |

---

## 7. Local testing plan (dev server)

### Order of work

1. **IT:** Entra app + redirect `http://localhost:3000/login`.
2. **Backend:** implement `POST /api/auth/sso/microsoft` + CORS for `http://localhost:3000`.
3. **Frontend:** MSAL button + exchange call.
4. **Test** on same machine: `npm run dev` → open `http://localhost:3000/login`.

### Checklist

- [ ] Entra SPA redirect includes `http://localhost:3000/login`
- [ ] API reachable from browser (`NEXT_PUBLIC_API_BASE_URL`)
- [ ] CORS allows `http://localhost:3000`
- [ ] Work account **exists** in HRMS with same email as Entra UPN/email
- [ ] SSO → 200 → dashboard APIs work with returned Bearer token
- [ ] Unknown Microsoft user → 403, no session
- [ ] Password login still works
- [ ] Refresh token still works after SSO session

### Local network notes

- Next: `localhost:3000`
- API: may be `http://192.168.1.30:8888` (LAN)
- Mixed “localhost app + LAN API” is fine if CORS is open for the Next origin
- Microsoft login pages are on the public internet; the developer machine needs outbound HTTPS to `login.microsoftonline.com`

---

## 8. User provisioning rules

| Rule | Recommendation |
|------|----------------|
| Who can SSO | Existing active HRMS users only |
| Match key | Email (required); `azure_oid` after first login (recommended) |
| JIT create | **Out of scope** for v1 |
| Personal MSA | Blocked by single-tenant app |
| Admins | Keep password login for break-glass |

---

## 9. Out of scope (v1)

- Google / Okta / generic SAML
- Replacing all API auth with raw Entra access tokens
- Auto-provisioning new employees from Entra alone
- Teams app packaging / M365 admin deploy (can follow after SSO works)

---

## 10. Acceptance criteria

**Backend done when:**

1. `POST /api/auth/sso/microsoft` with valid ID token returns HRMS tokens for a known user.
2. Invalid token → 401; unknown user → 403; missing body → 400.
3. Returned access token works on `GET /api/users/me` and normal HR routes.
4. Documented env vars are set on the API process.

**Frontend done when:**

1. With flag + Entra IDs, login page shows **Sign in with Microsoft**.
2. Successful path lands on `/dashboard` with the same session storage as password login.
3. Failures show clear messages; password login remains available.

**E2E done when:** local dev user completes Microsoft login without typing HRMS password and can use the app.

---

## 11. Handoff: what each agent owns

### Backend agent

1. Implement `POST /api/auth/sso/microsoft` per §5.
2. JWKS validation for single tenant.
3. User lookup + optional `azure_oid` column/migration.
4. Reuse existing “issue tokens after successful login” code path.
5. CORS + env + rate limit.
6. Unit/integration tests for 400/401/403/200.

### Frontend agent

1. Add MSAL + env config.
2. Login button + call backend contract exactly (`idToken`).
3. Reuse token persistence and dashboard redirect.
4. Feature flag for safe rollout.

### Human / IT

1. Create Entra app registration.
2. Provide tenant ID + client ID to both teams.
3. Ensure test users exist in both Entra and HRMS with matching email.

---

## 12. Open product questions (confirm once)

1. Skip HRMS 2FA after SSO? **Default: yes.**
2. Email vs UPN mismatch policy? **Default: try email, preferred_username, upn.**
3. Multi-company users: which company membership after SSO? **Default: same as password login default company.**

Update this doc if the backend chooses a different path (e.g. auth-code server exchange). Keep the **success response = HRMS tokens** invariant.

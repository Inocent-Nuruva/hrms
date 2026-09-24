# ESS Onboarding Portal

Production starter for the Employee Self-Service onboarding portal.

## Stack

- Next.js 16 (Pages Router for portal screens)
- React 19 + TypeScript
- CSS in `src/styles/globals.css`

## Project structure

```text
src/
  components/
    common/
    auth/
    layout/
  pages/
    _app.tsx
    login.tsx
    change-password.tsx
    dashboard.tsx
    onboarding/
      index.tsx
      [step].tsx
  hooks/
  services/
  types/
  utils/
  styles/
  App.tsx
```

## Environment

Copy `.env.example` to `.env.local` and set:

```env
# Use same-origin API proxy in deployed builds so both public and private URLs work.
NEXT_PUBLIC_API_BASE_URL=/api
# Next.js rewrite target when /api reaches the frontend process directly.
# UAT: http://127.0.0.1:9999, production/local default: http://127.0.0.1:8888
BACKEND_ORIGIN=http://127.0.0.1:8888

# Local development can point directly at the backend instead.
# NEXT_PUBLIC_API_BASE_URL=http://192.168.1.30:8888
```

## API integration points

Auth API methods are centralized in:

- `src/services/api.ts`
- `src/services/authService.ts`

Replace endpoint contracts there as soon as backend APIs are provided.

## Scripts

```bash
npm run dev
npm run lint
npm run build
```

## Deployment architecture

The existing release model is retained for both environments:

```text
GitHub Actions artifact
  -> /opt/apps/hrms-v2/{prod|uat}/frontend/releases/<commit-sha>
  -> atomic current symlink
  -> PM2 startOrReload using shared/ecosystem.config.js
  -> local readiness and asset checks
```

Runtime configuration is held outside releases in `shared/.env`. Logs are in `shared/logs`, and only the configured number of immutable releases is retained. A failed application deployment invokes the existing rollback logic.

Every release artifact contains the complete `deploy/hrms-frontend` bundle. After deployment, the setup script, production edge helper, and Nginx template are available under `$BASE_DIR/current/deploy/hrms-frontend`; staging fails if any required deployment file is missing.

Environment behavior:

| Environment | Trigger | GitHub environment | Directory | Local port | Edge automation |
| --- | --- | --- | --- | --- | --- |
| UAT | Push to `uat`, or manual UAT dispatch | `hrms-frontend-uat` | `/opt/apps/hrms-v2/uat/frontend` | `9990` | None |
| Production | Manual production dispatch from `master` | `hrms-frontend-production` | `/opt/apps/hrms-v2/prod/frontend` | `8880` | Nginx and Certbot |

Production is selected by the workflow input and cross-checked against `APP_ENV=production`; the Nginx/SSL step requires both values. UAT never invokes the edge helper and continues to use port `9990` unchanged.

Production traffic is:

```text
https://hrms.alliance.co.tz
  -> Ubuntu Nginx on ports 80/443
  -> http://127.0.0.1:8880
  -> PM2-managed Next.js production process
```

The repository template is `deploy/hrms-frontend/nginx/hrms.alliance.co.tz.conf`. Certbot adds the HTTPS server configuration and HTTP-to-HTTPS redirect to the installed copy.

## GitHub environment configuration

Keep the existing environment-scoped variables. The following values are significant:

| Setting | UAT | Production |
| --- | --- | --- |
| `APP_ENV` | `uat` | `production` |
| `APP_PORT` | `9990` | `8880` |
| `BASE_DIR` | `/opt/apps/hrms-v2/uat/frontend` | `/opt/apps/hrms-v2/prod/frontend` |
| `PM2_APP_NAME` | Existing UAT name | Existing production name |
| `APP_HOST` | Existing value | Existing value |
| `HEALTH_PATH` | `/api/health/ready` | `/api/health/ready` |

Add these only to the `hrms-frontend-production` GitHub environment:

- Secret `SSL_EMAIL`: Let's Encrypt registration and expiry-notification email. It is passed to the root helper over standard input and is not committed or placed in a command argument.
- Variable `FRONTEND_PUBLIC_IP`: public IPv4 or IPv6 address to which `hrms.alliance.co.tz` must resolve before initial certificate issuance.
- Variable `REQUIRE_SSL`: `false` by default. Set to `true` only when DNS, NAT, and firewall readiness must be a hard deployment requirement.

`DEPLOY_PUBLIC_URL` may remain the existing environment-scoped value. A temporary production public-route failure no longer rolls back an otherwise healthy PM2 release before the edge step can repair Nginx. UAT public validation remains strict.

## One-time Ubuntu setup

Run the setup script from the deployed production release once as root, and rerun it after changing the committed edge helper or Nginx template. No server-side Git checkout or pull is required:

```bash
DEPLOY_USER=hrms-deploy \
  APP_ROOT=/opt/apps/hrms-v2 \
  bash /opt/apps/hrms-v2/prod/frontend/current/deploy/hrms-frontend/server-setup.sh
```

The setup is idempotent and:

- installs `nginx`, `certbot`, `python3-certbot-nginx`, `openssl`, `sudo`, and the existing deployment prerequisites through `apt`;
- installs the helper as root-owned `/usr/local/sbin/hrms-frontend-edge`;
- installs the root-owned template under `/usr/local/share/hrms-frontend/nginx/`;
- validates and installs `/etc/sudoers.d/hrms-frontend-edge`;
- preserves the existing `releases/current/shared` application layout.

The deployment user is deliberately not added to `sudo` or `wheel`. Its passwordless sudo permission is restricted to these exact root-owned helper actions:

```text
/usr/local/sbin/hrms-frontend-edge configure false
/usr/local/sbin/hrms-frontend-edge configure true
/usr/local/sbin/hrms-frontend-edge preflight false
/usr/local/sbin/hrms-frontend-edge status false
```

The helper has fixed domain, port, template, and target paths, so workflow input cannot be used to run arbitrary root commands.
The production workflow compares the installed root-owned files with the checked-out versions and stops with a bootstrap instruction if they are stale.

## DNS and network prerequisites

Before initial certificate issuance:

1. Create/update the public A or AAAA record for `hrms.alliance.co.tz` so it matches `FRONTEND_PUBLIC_IP`.
2. Route inbound TCP ports `80` and `443` through any cloud firewall, host firewall, router, or NAT device to this Ubuntu server.
3. Confirm the production app is healthy at `http://127.0.0.1:8880/api/health/ready`.
4. Run the Production deployment preflight workflow, then manually dispatch the Production deployment from `master`.

The first eligible production deployment creates `/etc/nginx/sites-available/hrms.alliance.co.tz`, enables only that site, validates Nginx, and attempts certificate issuance. Existing unrelated Nginx sites are not changed or removed.

## Safety, retries, and rollback

- The production frontend must pass its local readiness check before Nginx changes.
- The helper backs up an existing HRMS site, runs `nginx -t`, and reloads only after validation succeeds.
- A failed Nginx or local reverse-proxy validation restores the previous HRMS site configuration.
- A valid existing certificate is reused. Certbot is invoked only when a certificate/configuration install is needed.
- Before a first certificate request, DNS must resolve to `FRONTEND_PUBLIC_IP`. A failed server-to-public-IP probe is treated as a possible NAT-loopback limitation; Certbot performs the authoritative external HTTP validation, and failed Certbot attempts are rate-limited locally for six hours.
- If Certbot fails, the last working SSL site is restored when available; on a first install the working HTTP proxy remains available.
- DNS/network/SSL failures are warnings when `REQUIRE_SSL=false` and fail the edge step when `REQUIRE_SSL=true`. They do not roll back the already healthy PM2 release.
- `certbot.timer` is enabled and checked after successful SSL configuration. Each production deployment reports PM2, port `8880`, Nginx validation/service, certificate, and local HTTPS health status; a separate GitHub-hosted job then verifies the domain externally.

To inspect production state on the server:

```bash
sudo /usr/local/sbin/hrms-frontend-edge status false
sudo nginx -t
systemctl status nginx certbot.timer
sudo certbot certificates
```

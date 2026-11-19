# HRMS frontend deployment

The frontend mirrors the backend's immutable release layout at
`/opt/apps/hrms-v2/{uat,prod}/frontend`: `releases/<git-sha>`, `current`,
`shared/.env`, `shared/ecosystem.config.js`, `shared/logs`, and `tmp`.

- Pushes to `uat` validate, build, and checksum. UAT deployment remains manual
  while repository variable `KPI_UAT_AUTO_DEPLOY_ENABLED` is unset or `false`.
  After the first approved KPI release, setting it to `true` permits the
  existing deploy job to run automatically after required CI checks pass.
- Pushes to `master` validate and package only. Production is deployed manually
  from `master` with the `production` input and protected environment approval.
- Pull requests to either branch run validation without publishing an artifact.
- The environment-specific `NEXT_PUBLIC_*` values are supplied to the build job
  from the matching GitHub Environment because Next.js embeds them at build time.
  UAT talks to the API on port **9999**; production talks to the API on port **8888**.
  Unit tests stay isolated on `http://localhost:8888`.
- The standalone artifact contains all traced production dependencies; servers do
  not run `npm install` or compile source.
- Deployment atomically switches `current`, reloads PM2, checks
  `/api/health/ready`, verifies the JavaScript/CSS referenced by `/login` and
  `/offline` plus public images, and restores the prior symlink on failure.
  Set the optional GitHub Environment variable `DEPLOY_PUBLIC_URL` to the frontend
  origin (for example `https://hrms.example.com`) to also test reverse-proxy routing.

Run `server-setup.sh` as root once. The runner itself must run as a non-sudo
deployment user. Configure environments `hrms-frontend-uat` and
`hrms-frontend-production`; require reviewers for production.

The self-hosted runner currently uses the labels `self-hosted`, `Linux`, and
`X64`. GitHub matches jobs using labels; the `hrms-frontend` runner name is not
a label. If another runner with the same labels is later added to this repository,
add a unique custom `hrms-frontend` label to this runner and to all three
workflow `runs-on` lists.

## Environment URLs

| Environment | Browser URL | Browser API base | PM2 (server) |
|---|---|---|---|
| UAT | `http://196.41.62.162:9990` | `http://196.41.62.162:9999` | frontend `9990`, backend `9999` |
| Production | `https://hrms.alliance.co.tz` | `https://hrms.alliance.co.tz` (Nginx `/api`, `/uploads`, `/socket.io` -> `127.0.0.1:8888`) | frontend `8880`, backend `8888` (loopback) |

`hrms.alliance.co.tz` belongs to Production only. UAT never configures Nginx and
CI rejects a UAT `NEXT_PUBLIC_API_BASE_URL` that contains the domain.

### UAT (direct public IP)

1. Network: forward TCP `9990` and `9999` on `196.41.62.162` to the UAT host.
   UAT PM2 apps must bind `APP_HOST=0.0.0.0`.
2. GitHub Environment `hrms-frontend-uat`: `NEXT_PUBLIC_API_BASE_URL=http://196.41.62.162:9999`,
   `DEPLOY_PUBLIC_URL=http://196.41.62.162:9990`; delete `CONFIGURE_EDGE`.
3. UAT backend shared `.env`: `APP_URL=http://196.41.62.162:9999`,
   `APP_FRONTEND_URL=http://196.41.62.162:9990`, and
   `APP_ALLOWED_ORIGINS` / `NOTIFICATION_WEBSOCKET_ALLOWED_ORIGINS=http://196.41.62.162:9990`
   (remove any `hrms.alliance.co.tz` entry). Keep `DB_NAME=hrms_uat_db`.

### Production domain and HTTPS (hrms.alliance.co.tz)

1. DNS: `A hrms.alliance.co.tz -> 196.41.62.162`; forward TCP 80 and 443 to the
   Production host. Port 80 must stay open for Let's Encrypt renewals. Do not
   forward `8880`/`8888`.
2. GitHub Environment `hrms-frontend-production`: secret `SSL_EMAIL`; variables
   `FRONTEND_PUBLIC_IP=196.41.62.162`,
   `NEXT_PUBLIC_API_BASE_URL=https://hrms.alliance.co.tz`,
   `DEPLOY_PUBLIC_URL=https://hrms.alliance.co.tz`, `APP_HOST=127.0.0.1`,
   `REQUIRE_SSL=false` for the first issuance, then `true`.
3. Backend production `.env`: `APP_HOST=127.0.0.1`, `APP_URL`, `APP_FRONTEND_URL`,
   `APP_ALLOWED_ORIGINS` and `NOTIFICATION_WEBSOCKET_ALLOWED_ORIGINS` all
   `https://hrms.alliance.co.tz`; keep `APP_TRUST_PROXY=true`.
4. Rerun `server-setup.sh` as root from the new release (it removes the old UAT
   template and UAT sudo rules), then deploy Production from `master`. If the
   site was previously configured for UAT, Production takes it over.

The Production template proxies the domain to frontend `8880` and backend `8888` only.
Certbot adds the 443 block and HTTP->HTTPS redirect. Plain-HTTP requests to the
server IP on port 80 are redirected to `https://hrms.alliance.co.tz`.

## Static assets missing after deployment

Run these on the server, using the affected environment's base directory and port:

```bash
cd /opt/apps/hrms-v2/uat/frontend/current
node deploy/hrms-frontend/check-assets.mjs "http://127.0.0.1:${APP_PORT}"
node deploy/hrms-frontend/check-assets.mjs "https://YOUR_FRONTEND_DOMAIN"
```

On an older release without this checker, copy one failing `/_next/static/...`
URL from the browser Network tab and use `curl -I` with that same path against
both origins. Also check `/icon.png`.

- If direct requests succeed but public requests fail, inspect the reverse proxy.
  Forward `/_next/` and public asset requests to the frontend port. Check for a
  competing regex location for `.js`, `.css`, or images, an outdated filesystem
  `root`/`alias`, or requests routed to the backend. If Nginx serves files directly,
  `/_next/static/` must map to `current/.next/static/`, and `/assets/` must map to
  `current/public/assets/`.
- If direct requests fail too, check `current/.next/static/chunks`,
  `current/public`, and `pm2 describe "$PM2_APP_NAME"`. The running server and its
  assets must belong to the same release. The artifact already copies
  `.next/static` and `public` beside the standalone `server.js`.
- If `/public/favicon.ico` works but `/favicon.ico` fails, the artifact has
  accidentally nested `public/public`. Copy directory contents with
  `cp -a public/. "$release/public/"`, then build and deploy a new release.
  Copy `.next/static/.` the same way to avoid nesting `static/static`.
- If both succeed but an existing browser session fails, reload with cache
  disabled. Inspect Application > Service Workers and Cache Storage for stale
  responses, and check any proxy/CDN HTML cache. Old HTML can reference chunks
  from a previous release.

The deployment checks cover initial page assets and selected public images;
they do not exercise every lazy-loaded dashboard chunk or browser service worker.

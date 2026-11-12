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

## Production domain and HTTPS (hrms.alliance.co.tz)

1. DNS: `A hrms.alliance.co.tz -> 154.72.81.122`; forward TCP 80 and 443 to
   `192.168.1.30`. Port 80 must stay open for Let's Encrypt renewals.
2. GitHub Environment `hrms-frontend-production`: secret `SSL_EMAIL`; variables
   `FRONTEND_PUBLIC_IP=154.72.81.122`,
   `NEXT_PUBLIC_API_BASE_URL=https://hrms.alliance.co.tz`,
   `DEPLOY_PUBLIC_URL=https://hrms.alliance.co.tz`, `REQUIRE_SSL=false` for the
   first issuance, then `true`.
3. Backend production `.env`: add `https://hrms.alliance.co.tz` to
   `APP_ALLOWED_ORIGINS` and `NOTIFICATION_WEBSOCKET_ALLOWED_ORIGINS`; keep
   `APP_TRUST_PROXY=true`.
4. Rerun `server-setup.sh` as root from the new release whenever the template or
   `production-edge.sh` changes, then deploy Production from `master`.

Testing the domain on UAT first: set `CONFIGURE_EDGE=true`, `SSL_EMAIL`,
`FRONTEND_PUBLIC_IP` and `NEXT_PUBLIC_API_BASE_URL=https://hrms.alliance.co.tz`
in `hrms-frontend-uat`, add the origin to the UAT backend `.env`, rerun
`server-setup.sh`, then push to `uat`. The domain then uses
`nginx/hrms.alliance.co.tz.uat.conf` (frontend `9990`, backend `9999`). The first
successful Production configure takes the domain over permanently; later UAT
deploys leave Nginx unchanged (`/var/lib/hrms-frontend-edge/domain-owner`).

The Production template proxies the domain to frontend `8880` and backend `8888` only.
Certbot adds the 443 block and HTTP->HTTPS redirect; direct-IP access stays on
plain HTTP in a separate block and is not a catch-all.

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

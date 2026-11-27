# HRMS frontend deployment

The frontend mirrors the backend's immutable release layout at
`/opt/apps/hrms-v2/{uat,prod}/frontend`: `releases/<git-sha>`, `current`,
`shared/.env`, `shared/ecosystem.config.js`, `shared/logs`, and `tmp`.

- Pushes to `uat` validate, build, checksum and deploy automatically after
  the required CI checks pass.
- Pushes to `master` validate and package only. Production is deployed manually
  from `master` with the `production` input and protected environment approval.
- Pull requests to either branch run validation without publishing an artifact.
- The environment-specific `NEXT_PUBLIC_*` values are supplied to the build job
  from the matching GitHub Environment because Next.js embeds them at build time.
  UAT talks to the API on port **9999**; production talks to the API on port **8888**.
  Unit tests stay isolated on `http://localhost:8888`.
- CI builds and validates one environment-specific standalone artifact. The deployment runner verifies its checksum, revision, build settings, Node ABI, CPU architecture, and glibc compatibility before staging it; the runner does not rebuild the release. UAT and production artifacts are built separately because Next.js embeds public settings and proxy routes at build time.
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

Both environments are reachable directly by port on `196.41.62.162` (public) and
`192.168.1.30` (LAN). Production's frontend is also served at `https://hrms.alliance.co.tz`.

| Environment | Frontend | Backend | Browser API base |
|---|---|---|---|
| UAT | `http://196.41.62.162:9990`, `http://192.168.1.30:9990` | `:9999` on both IPs | `/api` (frontend proxies to `127.0.0.1:9999`) |
| Production | `https://hrms.alliance.co.tz`, `http://196.41.62.162:8880`, `http://192.168.1.30:8880` | `:8888` on both IPs | `/api` (frontend proxies to `localhost:8888`) |

The domain is Production-only and serves the frontend only (Nginx -> `8880`); the
frontend proxies `/api`, `/uploads` and `/socket.io` to its backend. UAT never
configures Nginx, and CI rejects a UAT `NEXT_PUBLIC_API_BASE_URL` containing the domain.
Plain-HTTP requests to either IP on port 80 redirect to `https://hrms.alliance.co.tz`.

### Network

Forward TCP `80`, `443` (domain + Let's Encrypt renewals), `8880`, `8888` (Production)
and `9990`, `9999` (UAT) on `196.41.62.162` to the HRMS host (`192.168.1.30`).
All four PM2 apps bind `APP_HOST=0.0.0.0`.

### GitHub environments

- `hrms-frontend-uat`: `NEXT_PUBLIC_API_BASE_URL=/api`, `APP_HOST=0.0.0.0`.
- `hrms-frontend-production`: secret `SSL_EMAIL`; `NEXT_PUBLIC_API_BASE_URL=/api`
  (an absolute domain URL would make the frontend proxy to itself),
  `APP_HOST=0.0.0.0`, `FRONTEND_PUBLIC_IP=196.41.62.162`, `REQUIRE_SSL=true`.

### Backend shared `.env`

- UAT: `APP_URL=http://196.41.62.162:9999`, `APP_FRONTEND_URL=http://196.41.62.162:9990`,
  `APP_ALLOWED_ORIGINS` and `NOTIFICATION_WEBSOCKET_ALLOWED_ORIGINS` =
  `http://196.41.62.162:9990,http://192.168.1.30:9990`. No domain entry; `DB_NAME=hrms_uat_db`.
- Production: `APP_URL` and `APP_FRONTEND_URL` = `https://hrms.alliance.co.tz`;
  `APP_ALLOWED_ORIGINS` and `NOTIFICATION_WEBSOCKET_ALLOWED_ORIGINS` =
  `https://hrms.alliance.co.tz,http://196.41.62.162:8880,http://192.168.1.30:8880`;
  `APP_TRUST_PROXY=true`.

### Domain setup

Rerun `server-setup.sh` as root from the new release (it removes the old UAT
template and UAT sudo rules), then deploy Production from `master`. If the site was
previously configured for UAT, Production takes it over and keeps the certificate.

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

# HRMS frontend deployment

The frontend mirrors the backend's immutable release layout at
`/opt/apps/hrms-v2/{uat,prod}/frontend`: `releases/<git-sha>`, `current`,
`shared/.env`, `shared/ecosystem.config.js`, `shared/logs`, and `tmp`.

- Pushes to `uat` validate, build, checksum, and deploy UAT automatically.
- Pushes to `master` validate and package only. Production is deployed manually
  from `master` with the `production` input and protected environment approval.
- Pull requests to either branch run validation without publishing an artifact.
- The environment-specific `NEXT_PUBLIC_*` values are supplied to the build job
  from the matching GitHub Environment because Next.js embeds them at build time.
- The standalone artifact contains all traced production dependencies; servers do
  not run `npm install` or compile source.
- Deployment atomically switches `current`, reloads PM2, checks
  `/api/health/ready`, and restores the prior symlink on failure.

Run `server-setup.sh` as root once. The runner itself must run as a non-sudo
deployment user. Configure environments `hrms-frontend-uat` and
`hrms-frontend-production`; require reviewers for production.

The self-hosted runner must have the labels `self-hosted`, `Linux`, `X64`, and
`hrms-frontend`. The last label isolates frontend deployment jobs from backend
runners; the runner name alone is not a label.

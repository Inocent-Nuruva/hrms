#!/usr/bin/env bash
set -Eeuo pipefail
umask 027
DEPLOY_USER="${DEPLOY_USER:-hrms-deploy}"
APP_ROOT="${APP_ROOT:-/opt/apps/hrms-v2}"
[[ "$EUID" -eq 0 ]] || { echo 'Run once as root.' >&2; exit 1; }
id "$DEPLOY_USER" >/dev/null 2>&1 || { echo "Missing deploy user: $DEPLOY_USER" >&2; exit 1; }
id -nG "$DEPLOY_USER" | tr ' ' '\n' | grep -qxE 'sudo|wheel' && { echo 'Deploy user must not have sudo.' >&2; exit 1; }
apt-get update
apt-get install -y ca-certificates curl gzip tar util-linux
for command in node pm2; do command -v "$command" >/dev/null || { echo "Missing $command" >&2; exit 1; }; done
(( $(node -p "process.versions.node.split('.')[0]") >= 22 )) || { echo 'Node.js 22+ required.' >&2; exit 1; }
for env_name in prod uat; do
  base="$APP_ROOT/$env_name/frontend"
  install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 0750 "$APP_ROOT" "$APP_ROOT/$env_name" "$base" "$base/releases" "$base/shared" "$base/shared/logs" "$base/tmp"
  if [[ ! -f "$base/shared/.env" ]]; then install -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 0600 /dev/null "$base/shared/.env"; else chown "$DEPLOY_USER:$DEPLOY_USER" "$base/shared/.env"; chmod 0600 "$base/shared/.env"; fi
done
echo "Frontend server layout created under $APP_ROOT."

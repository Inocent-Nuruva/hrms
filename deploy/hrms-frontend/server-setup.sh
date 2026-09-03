#!/usr/bin/env bash

set -Eeuo pipefail

umask 027

DEPLOY_USER="${DEPLOY_USER:-hrms-deploy}"
APP_ROOT="${APP_ROOT:-/opt/apps/hrms-v2}"

[[ "$EUID" -eq 0 ]] || {
  echo "Run once as root." >&2
  exit 1
}

id "$DEPLOY_USER" >/dev/null 2>&1 || {
  echo "Missing deploy user: $DEPLOY_USER" >&2
  exit 1
}

id -nG "$DEPLOY_USER" |
  tr ' ' '\n' |
  grep -qxE 'sudo|wheel' && {
    echo "Deploy user must not have sudo." >&2
    exit 1
  }

apt-get update

apt-get install -y \
  ca-certificates \
  curl \
  gzip \
  tar \
  util-linux

for command in node npm pm2; do
  command -v "$command" >/dev/null || {
    echo "Missing required command: $command" >&2
    exit 1
  }
done

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"

(( NODE_MAJOR >= 22 )) || {
  echo "Node.js 22+ required." >&2
  exit 1
}

# Parent directories should already exist because backend is deployed here.
for env_name in prod uat; do

  parent="$APP_ROOT/$env_name"
  base="$parent/frontend"

  [[ -d "$parent" ]] || {
    echo "Missing environment directory: $parent" >&2
    exit 1
  }

  install -d \
    -o "$DEPLOY_USER" \
    -g "$DEPLOY_USER" \
    -m 0750 \
    "$base" \
    "$base/releases" \
    "$base/shared" \
    "$base/shared/logs" \
    "$base/tmp"

  env_file="$base/shared/.env"

  if [[ ! -f "$env_file" ]]; then
    install \
      -o "$DEPLOY_USER" \
      -g "$DEPLOY_USER" \
      -m 0600 \
      /dev/null \
      "$env_file"
  else
    chown "$DEPLOY_USER:$DEPLOY_USER" "$env_file"
    chmod 0600 "$env_file"
  fi

done

echo
echo "Frontend server layout created successfully."
echo
echo "Production:"
echo "  $APP_ROOT/prod/frontend"
echo
echo "UAT:"
echo "  $APP_ROOT/uat/frontend"

#!/usr/bin/env bash

set -Eeuo pipefail

umask 027

DEPLOY_USER="${DEPLOY_USER:-hrms-deploy}"
APP_ROOT="${APP_ROOT:-/opt/apps/hrms-v2}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

[[ "$EUID" -eq 0 ]] || {
  echo "Run once as root." >&2
  exit 1
}

id "$DEPLOY_USER" >/dev/null 2>&1 || {
  echo "Missing deploy user: $DEPLOY_USER" >&2
  exit 1
}

[[ "$DEPLOY_USER" =~ ^[a-z_][a-z0-9_-]*[$]?$ ]] || {
  echo "Unsafe deploy user name: $DEPLOY_USER" >&2
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
  certbot \
  curl \
  gzip \
  nginx \
  openssl \
  python3-certbot-nginx \
  sudo \
  tar \
  util-linux

for file in \
  "$SCRIPT_DIR/production-edge.sh" \
  "$SCRIPT_DIR/nginx/hrms.alliance.co.tz.conf"; do
  [[ -f "$file" ]] || {
    echo "Missing production edge deployment file: $file" >&2
    exit 1
  }
done

install -d -o root -g root -m 0755 /usr/local/share/hrms-frontend/nginx
install -o root -g root -m 0755 \
  "$SCRIPT_DIR/production-edge.sh" \
  /usr/local/sbin/hrms-frontend-edge
install -o root -g root -m 0644 \
  "$SCRIPT_DIR/nginx/hrms.alliance.co.tz.conf" \
  /usr/local/share/hrms-frontend/nginx/hrms.alliance.co.tz.conf
# UAT no longer serves the domain (it uses 196.41.62.162:9990/9999 directly);
# remove the stale UAT template left by older setups.
rm -f /usr/local/share/hrms-frontend/nginx/hrms.alliance.co.tz.uat.conf

sudoers_tmp="$(mktemp)"
trap 'rm -f -- "$sudoers_tmp"' EXIT
cat > "$sudoers_tmp" <<EOF
$DEPLOY_USER ALL=(root) NOPASSWD: /usr/local/sbin/hrms-frontend-edge configure false
$DEPLOY_USER ALL=(root) NOPASSWD: /usr/local/sbin/hrms-frontend-edge configure true
$DEPLOY_USER ALL=(root) NOPASSWD: /usr/local/sbin/hrms-frontend-edge preflight false
$DEPLOY_USER ALL=(root) NOPASSWD: /usr/local/sbin/hrms-frontend-edge status false
EOF
chmod 0440 "$sudoers_tmp"
visudo -cf "$sudoers_tmp"
install -o root -g root -m 0440 "$sudoers_tmp" /etc/sudoers.d/hrms-frontend-edge
rm -f -- "$sudoers_tmp"
trap - EXIT

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

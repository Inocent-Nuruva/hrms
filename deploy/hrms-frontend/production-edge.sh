#!/usr/bin/env bash

set -Eeuo pipefail

umask 027

readonly DOMAIN='hrms.alliance.co.tz'
readonly APP_PORT='8880'
readonly HEALTH_PATH='/api/health/ready'
readonly APP_HEALTH_URL="http://127.0.0.1:${APP_PORT}${HEALTH_PATH}"
readonly LOCAL_NGINX_HEALTH_URL="http://127.0.0.1${HEALTH_PATH}"
readonly PUBLIC_HTTP_URL="http://${DOMAIN}${HEALTH_PATH}"
readonly PUBLIC_HTTPS_URL="https://${DOMAIN}${HEALTH_PATH}"
readonly SITE_NAME='hrms.alliance.co.tz'
readonly SITE_AVAILABLE="/etc/nginx/sites-available/${SITE_NAME}"
readonly SITE_ENABLED="/etc/nginx/sites-enabled/${SITE_NAME}"
readonly SITE_CONF_D="/etc/nginx/conf.d/${SITE_NAME}.conf"
readonly TEMPLATE='/usr/local/share/hrms-frontend/nginx/hrms.alliance.co.tz.conf'
readonly STATE_DIR='/var/lib/hrms-frontend-edge'
readonly TEMPLATE_HASH_FILE="${STATE_DIR}/nginx-template.sha256"
readonly CERT_FAILURE_MARKER="${STATE_DIR}/certbot-last-failure"
readonly CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"

log() { printf '[hrms-edge] %s\n' "$*"; }
warn() { printf '[hrms-edge] WARNING: %s\n' "$*" >&2; }
die() { printf '[hrms-edge] ERROR: %s\n' "$*" >&2; exit 1; }

[[ "${EUID}" -eq 0 ]] || die 'This helper must run as root through its restricted sudo rule.'

ACTION="${1:-}"
REQUIRE_SSL="${2:-false}"
[[ "$REQUIRE_SSL" == 'true' || "$REQUIRE_SSL" == 'false' ]] || die 'REQUIRE_SSL must be true or false.'
[[ "$ACTION" == 'configure' || "$ACTION" == 'preflight' || "$ACTION" == 'status' ]] || {
  die 'Usage: hrms-frontend-edge {configure|preflight|status} [true|false]'
}

ssl_failure() {
  warn "$1"
  if [[ "$REQUIRE_SSL" == 'true' ]]; then
    die 'SSL is required for this deployment.'
  fi
  return 0
}

ensure_packages() {
  if command -v nginx >/dev/null 2>&1 &&
    command -v certbot >/dev/null 2>&1 &&
    command -v openssl >/dev/null 2>&1 &&
    dpkg-query -W -f='${Status}' python3-certbot-nginx 2>/dev/null | grep -Fq 'install ok installed'; then
    return 0
  fi

  log 'Installing missing Nginx/Certbot packages.'
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install -y nginx certbot python3-certbot-nginx openssl
}

certificate_valid() {
  [[ -s "${CERT_DIR}/fullchain.pem" && -s "${CERT_DIR}/privkey.pem" ]] || return 1
  openssl x509 -checkend 0 -noout -in "${CERT_DIR}/fullchain.pem" >/dev/null 2>&1 &&
    openssl x509 -checkhost "$DOMAIN" -noout -in "${CERT_DIR}/fullchain.pem" >/dev/null 2>&1
}

template_hash() {
  sha256sum "$TEMPLATE" | awk '{print $1}'
}

configured_hash() {
  [[ -f "$TEMPLATE_HASH_FILE" ]] || return 1
  tr -d '[:space:]' < "$TEMPLATE_HASH_FILE"
}

site_has_expected_base() {
  [[ -f "$SITE_AVAILABLE" ]] || return 1
  grep -Fq 'server_name hrms.alliance.co.tz;' "$SITE_AVAILABLE" &&
    grep -Fq 'proxy_pass http://127.0.0.1:8880;' "$SITE_AVAILABLE"
}

nginx_loads_file() {
  local config_path="$1"
  local config_dump
  config_dump="$(nginx -T 2>&1)" || return 1
  grep -Fq "# configuration file ${config_path}:" <<<"$config_dump"
}

print_status() {
  log "Frontend PM2 target: 127.0.0.1:${APP_PORT}"
  if curl --noproxy '*' --fail --silent --show-error --connect-timeout 3 --max-time 10 "$APP_HEALTH_URL" >/dev/null; then
    log 'Frontend port 8880 status: ready'
  else
    warn 'Frontend port 8880 status: unavailable'
  fi

  if command -v nginx >/dev/null 2>&1 && nginx -t; then
    log 'Nginx configuration status: valid'
  else
    warn 'Nginx configuration status: unavailable or invalid'
  fi

  if systemctl is-active --quiet nginx; then
    log 'Nginx service status: active'
  else
    warn 'Nginx service status: inactive'
  fi

  if certificate_valid; then
    expiry="$(openssl x509 -enddate -noout -in "${CERT_DIR}/fullchain.pem" | cut -d= -f2-)"
    log "SSL certificate status: valid; expires ${expiry}"
  else
    warn 'SSL certificate status: missing or expired'
  fi
}

if [[ "$ACTION" == 'preflight' ]]; then
  ensure_packages
  [[ -r "$TEMPLATE" ]] || die "Missing root-owned Nginx template: ${TEMPLATE}. Rerun server-setup.sh."
  command -v systemctl >/dev/null 2>&1 || die 'systemctl is required.'
  log 'Production edge preflight passed.'
  exit 0
fi

if [[ "$ACTION" == 'status' ]]; then
  print_status
  exit 0
fi

IFS= read -r SSL_EMAIL || SSL_EMAIL=''
IFS= read -r EXPECTED_PUBLIC_IP || EXPECTED_PUBLIC_IP=''
SSL_EMAIL="${SSL_EMAIL//$'\r'/}"
SSL_EMAIL="${SSL_EMAIL//$'\n'/}"
EXPECTED_PUBLIC_IP="${EXPECTED_PUBLIC_IP//$'\r'/}"
EXPECTED_PUBLIC_IP="${EXPECTED_PUBLIC_IP//$'\n'/}"

ensure_packages
for command in curl nginx certbot openssl sha256sum awk grep getent systemctl; do
  command -v "$command" >/dev/null 2>&1 || die "Missing required command: ${command}"
done
[[ -r "$TEMPLATE" ]] || die "Missing root-owned Nginx template: ${TEMPLATE}. Rerun server-setup.sh."
if [[ -e "$SITE_AVAILABLE" || -L "$SITE_AVAILABLE" ]]; then
  [[ -f "$SITE_AVAILABLE" && ! -L "$SITE_AVAILABLE" ]] || {
    die "${SITE_AVAILABLE} exists and is not a regular file; refusing to overwrite it."
  }
fi
for enabled_site in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/*.conf; do
  [[ -e "$enabled_site" || -L "$enabled_site" ]] || continue
  [[ "$enabled_site" == "$SITE_ENABLED" || "$enabled_site" == "$SITE_CONF_D" ]] && continue
  enabled_target="$(readlink -f "$enabled_site" 2>/dev/null || true)"
  [[ "$enabled_target" == "$SITE_AVAILABLE" ]] && continue
  if grep -Eq '^[[:space:]]*server_name[[:space:]][^;]*hrms\.alliance\.co\.tz([[:space:];])' "$enabled_site" 2>/dev/null; then
    die "Another enabled Nginx site already declares ${DOMAIN}: ${enabled_site}"
  fi
done

curl --noproxy '*' --fail --silent --show-error --connect-timeout 3 --max-time 10 "$APP_HEALTH_URL" >/dev/null || {
  die "Production frontend is not healthy at ${APP_HEALTH_URL}; Nginx was not changed."
}
log 'Production frontend local health check passed.'

install -d -o root -g root -m 0750 "$STATE_DIR" "${STATE_DIR}/backups"
expected_hash="$(template_hash)"
installed_hash="$(configured_hash || true)"
config_changed=0
config_update_deferred=0
backup=''
site_created=0
link_created=0
conf_d_link_created=0
conf_d_link_removed=0

if [[ ! -f "$SITE_AVAILABLE" || "$expected_hash" != "$installed_hash" ]] || ! site_has_expected_base; then
  if [[ -f "$SITE_AVAILABLE" ]] && certificate_valid && [[ -z "$SSL_EMAIL" ]]; then
    warn 'The Nginx template changed, but SSL_EMAIL is unavailable. Preserving the current SSL-enabled site.'
    config_update_deferred=1
  else
    if [[ -e "$SITE_AVAILABLE" ]]; then
      backup="${STATE_DIR}/backups/${SITE_NAME}.$(date -u +'%Y%m%dT%H%M%SZ').conf"
      cp -a "$SITE_AVAILABLE" "$backup"
      log "Backed up the existing HRMS site to ${backup}."
    else
      site_created=1
    fi

    site_tmp="$(mktemp "${SITE_AVAILABLE}.tmp.XXXXXX")"
    install -o root -g root -m 0644 "$TEMPLATE" "$site_tmp"
    mv -f "$site_tmp" "$SITE_AVAILABLE"
    config_changed=1
  fi
fi

if [[ -e "$SITE_ENABLED" && ! -L "$SITE_ENABLED" ]]; then
  die "${SITE_ENABLED} exists and is not a symlink; refusing to overwrite it."
fi
if [[ -L "$SITE_ENABLED" && "$(readlink -f "$SITE_ENABLED")" != "$SITE_AVAILABLE" ]]; then
  die "${SITE_ENABLED} points to another site; refusing to overwrite it."
fi
if [[ ! -e "$SITE_ENABLED" ]]; then
  ln -s "$SITE_AVAILABLE" "$SITE_ENABLED"
  link_created=1
  config_changed=1
fi

if [[ -e "$SITE_CONF_D" || -L "$SITE_CONF_D" ]]; then
  [[ -L "$SITE_CONF_D" && "$(readlink "$SITE_CONF_D")" == "$SITE_AVAILABLE" ]] || {
    die "${SITE_CONF_D} belongs to another configuration; refusing to overwrite it."
  }
fi

restore_site() {
  if [[ -n "$backup" && -f "$backup" ]]; then
    cp -a "$backup" "$SITE_AVAILABLE"
  elif [[ "$site_created" == 1 ]]; then
    rm -f "$SITE_AVAILABLE"
  fi
  if [[ "$link_created" == 1 ]]; then
    rm -f "$SITE_ENABLED"
  fi
  if [[ "$conf_d_link_created" == 1 ]]; then
    rm -f "$SITE_CONF_D"
  elif [[ "$conf_d_link_removed" == 1 ]]; then
    ln -s "$SITE_AVAILABLE" "$SITE_CONF_D"
  fi
  nginx -t >/dev/null 2>&1 && systemctl reload nginx >/dev/null 2>&1 || true
}

if nginx_loads_file "$SITE_ENABLED"; then
  if [[ -L "$SITE_CONF_D" ]] && nginx_loads_file "$SITE_CONF_D"; then
    rm -f "$SITE_CONF_D"
    conf_d_link_removed=1
    config_changed=1
    log 'Removed the no-longer-required conf.d compatibility link.'
  fi
else
  if [[ ! -d /etc/nginx/conf.d ]]; then
    restore_site
    die 'Nginx does not load sites-enabled and /etc/nginx/conf.d is unavailable.'
  fi
  if [[ ! -L "$SITE_CONF_D" ]]; then
    ln -s "$SITE_AVAILABLE" "$SITE_CONF_D"
    conf_d_link_created=1
    config_changed=1
  fi
  if ! nginx_loads_file "$SITE_CONF_D"; then
    restore_site
    die 'Nginx does not load the HRMS site from sites-enabled or conf.d. Review the include directives in /etc/nginx/nginx.conf.'
  fi
  log 'Nginx does not load sites-enabled; using the conf.d compatibility link.'
fi

if ! nginx -t; then
  warn 'Nginx validation failed; restoring the previous HRMS site configuration.'
  restore_site
  die 'Nginx configuration was not reloaded.'
fi

systemctl enable nginx >/dev/null || {
  restore_site
  die 'Nginx could not be enabled; the previous HRMS site was restored.'
}
if systemctl is-active --quiet nginx; then
  systemctl reload nginx || {
    restore_site
    die 'Nginx reload failed; the previous HRMS site was restored.'
  }
else
  systemctl start nginx || {
    restore_site
    die 'Nginx failed to start; the previous HRMS site was restored.'
  }
fi
log 'Nginx configuration is valid and the service is active.'

curl --noproxy '*' --fail --silent --show-error --connect-timeout 3 --max-time 10 \
  --header "Host: ${DOMAIN}" "$LOCAL_NGINX_HEALTH_URL" >/dev/null || {
    warn "Local probe details for ${LOCAL_NGINX_HEALTH_URL} with Host ${DOMAIN}:"
    curl --noproxy '*' --silent --show-error --include --connect-timeout 3 --max-time 10 \
      --header "Host: ${DOMAIN}" "$LOCAL_NGINX_HEALTH_URL" >&2 || true
    restore_site
    die 'The local Nginx reverse-proxy health check failed; the previous site was restored.'
  }
log 'Local Nginx reverse-proxy health check passed.'

if [[ "$config_update_deferred" == 1 ]]; then
  ssl_failure 'The Nginx template update was deferred to avoid removing the existing SSL configuration. Configure SSL_EMAIL and deploy again.'
  print_status
  exit 0
fi

certbot_backup=''
restore_certbot_site() {
  if [[ -n "$backup" && -f "$backup" ]]; then
    cp -a "$backup" "$SITE_AVAILABLE"
  elif [[ -n "$certbot_backup" && -f "$certbot_backup" ]]; then
    cp -a "$certbot_backup" "$SITE_AVAILABLE"
  else
    return 0
  fi
  nginx -t >/dev/null 2>&1 && systemctl reload nginx >/dev/null 2>&1 || true
}

needs_certbot=0
if certificate_valid; then
  log 'A valid certificate already exists; it will be reused.'
  if [[ "$config_changed" == 1 ]] || ! grep -Eq 'listen[[:space:]]+443' "$SITE_AVAILABLE"; then
    needs_certbot=1
  fi
else
  needs_certbot=1
  if [[ -z "$SSL_EMAIL" ]]; then
    printf '%s\n' "$expected_hash" > "$TEMPLATE_HASH_FILE"
    ssl_failure 'SSL_EMAIL is not configured; certificate issuance was skipped.'
    print_status
    exit 0
  fi

  if [[ -z "$EXPECTED_PUBLIC_IP" ]]; then
    printf '%s\n' "$expected_hash" > "$TEMPLATE_HASH_FILE"
    ssl_failure 'SSL certificate issuance skipped because FRONTEND_PUBLIC_IP is not configured for DNS verification.'
    print_status
    exit 0
  fi
  [[ "$EXPECTED_PUBLIC_IP" =~ ^[0-9A-Fa-f:.]+$ ]] || {
    printf '%s\n' "$expected_hash" > "$TEMPLATE_HASH_FILE"
    ssl_failure 'FRONTEND_PUBLIC_IP is not a valid IPv4 or IPv6 address.'
    print_status
    exit 0
  }

  if ! getent ahosts "$DOMAIN" >/dev/null 2>&1; then
    printf '%s\n' "$expected_hash" > "$TEMPLATE_HASH_FILE"
    ssl_failure "SSL certificate issuance skipped because ${DOMAIN} does not resolve in DNS."
    print_status
    exit 0
  fi
  if ! getent ahosts "$DOMAIN" | awk '{print $1}' | grep -Fxq "$EXPECTED_PUBLIC_IP"; then
    printf '%s\n' "$expected_hash" > "$TEMPLATE_HASH_FILE"
    ssl_failure "SSL certificate issuance skipped because ${DOMAIN} does not resolve to the configured Production IP ${EXPECTED_PUBLIC_IP}."
    print_status
    exit 0
  fi
  if ! curl --noproxy '*' --fail --silent --show-error --connect-timeout 5 --max-time 20 "$PUBLIC_HTTP_URL" >/dev/null; then
    warn 'This server cannot reach its own public HTTP address. Continuing because NAT loopback may be unavailable; Certbot will perform the authoritative external validation.'
  fi
fi

if [[ "$needs_certbot" == 1 ]]; then
  if find "$CERT_FAILURE_MARKER" -mmin -360 -print -quit 2>/dev/null | grep -q .; then
    restore_certbot_site
    ssl_failure 'A Certbot attempt failed within the last six hours; skipping another attempt.'
    print_status
    exit 0
  fi

  certbot_backup="${STATE_DIR}/backups/${SITE_NAME}.pre-certbot.$(date -u +'%Y%m%dT%H%M%SZ').conf"
  cp -a "$SITE_AVAILABLE" "$certbot_backup"
  certbot_args=(
    --nginx
    -d "$DOMAIN"
    --non-interactive
    --agree-tos
    --redirect
    --keep-until-expiring
  )
  if [[ -n "$SSL_EMAIL" ]]; then
    certbot_args+=(--email "$SSL_EMAIL")
  fi

  if ! certbot "${certbot_args[@]}"; then
    touch "$CERT_FAILURE_MARKER"
    restore_certbot_site
    ssl_failure 'Certbot failed. The prior HRMS Nginx site was restored and the application deployment remains active.'
    print_status
    exit 0
  fi
  rm -f "$CERT_FAILURE_MARKER"
fi

if ! nginx -t; then
  restore_certbot_site
  die 'Certbot left an invalid Nginx configuration; the previous site was restored.'
fi
if ! systemctl reload nginx; then
  restore_certbot_site
  die 'Nginx reload failed after Certbot; the previous HRMS site was restored.'
fi
printf '%s\n' "$expected_hash" > "$TEMPLATE_HASH_FILE"

if systemctl list-unit-files --type=timer --no-legend certbot.timer 2>/dev/null | grep -q '^certbot.timer'; then
  if systemctl enable --now certbot.timer >/dev/null; then
    systemctl is-enabled --quiet certbot.timer || ssl_failure 'Certbot renewal timer is not enabled.'
    systemctl is-active --quiet certbot.timer || ssl_failure 'Certbot renewal timer is not active.'
  else
    ssl_failure 'Certbot renewal timer could not be enabled.'
  fi
else
  ssl_failure 'certbot.timer is unavailable; configure automatic renewal manually.'
fi

certbot certificates || true
if ! curl --noproxy '*' --fail --silent --show-error --location --connect-timeout 5 --max-time 30 \
  --resolve "${DOMAIN}:443:127.0.0.1" "$PUBLIC_HTTPS_URL" >/dev/null; then
  ssl_failure "Local HTTPS health check failed for ${DOMAIN}. Review the certificate and Nginx SSL configuration."
else
  log "Local HTTPS health-check result: ${PUBLIC_HTTPS_URL} is ready."
fi

if ! curl --noproxy '*' --fail --silent --show-error --location --connect-timeout 5 --max-time 30 "$PUBLIC_HTTPS_URL" >/dev/null; then
  warn 'Public HTTPS cannot be checked from this server, possibly because NAT loopback is unavailable. The GitHub-hosted verification job will test it externally.'
else
  log "Server-side public HTTPS check: ${PUBLIC_HTTPS_URL} is ready."
fi

print_status

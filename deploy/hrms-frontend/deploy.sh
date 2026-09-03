#!/usr/bin/env bash
set -Eeuo pipefail

RELEASE_ID="${1:?usage: deploy.sh <release-id>}"
BASE_DIR="${BASE_DIR:?Set BASE_DIR}"
PM2_APP_NAME="${PM2_APP_NAME:?Set PM2_APP_NAME}"
APP_ENV="${APP_ENV:?Set APP_ENV}"
APP_HOST="${APP_HOST:?Set APP_HOST}"
APP_PORT="${APP_PORT:?Set APP_PORT}"
HEALTH_URL="${HEALTH_URL:?Set HEALTH_URL}"
KEEP_RELEASES="${KEEP_RELEASES:-3}"
RELEASES_DIR="$BASE_DIR/releases"
RELEASE_DIR="$RELEASES_DIR/$RELEASE_ID"
SHARED_DIR="$BASE_DIR/shared"
CURRENT_LINK="$BASE_DIR/current"
PREVIOUS_RELEASE="$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)"
CURRENT_SWITCHED=0

log() { printf '[%s] %s\n' "$(date '+%F %T')" "$*"; }
show_logs() { pm2 logs "$PM2_APP_NAME" --lines 120 --nostream || true; }
start_release() {
  export BASE_DIR PM2_APP_NAME APP_ENV APP_HOST APP_PORT
  export APP_REVISION="$(basename "$(readlink -f "$CURRENT_LINK")")"
  pm2 startOrReload "$SHARED_DIR/ecosystem.config.js" --only "$PM2_APP_NAME" --update-env
}
rollback() {
  [[ "$CURRENT_SWITCHED" == 1 ]] || return 0
  if [[ -n "$PREVIOUS_RELEASE" && -d "$PREVIOUS_RELEASE" ]]; then
    log "Rolling back to $PREVIOUS_RELEASE"
    ln -sfn "$PREVIOUS_RELEASE" "$CURRENT_LINK.next"
    mv -Tf "$CURRENT_LINK.next" "$CURRENT_LINK"
    start_release || true
    pm2 save || true
  fi
}
on_error() { status=$?; log "Deployment failed at line ${1:-unknown} (status $status)."; show_logs; rollback; exit "$status"; }
trap 'on_error $LINENO' ERR

[[ "$RELEASE_ID" =~ ^[0-9a-fA-F]{40}$ ]] || { log 'Release ID must be a full Git SHA.'; exit 1; }
[[ "$KEEP_RELEASES" =~ ^[0-9]+$ && "$KEEP_RELEASES" -ge 2 ]] || { log 'KEEP_RELEASES must be at least 2.'; exit 1; }
for command in node pm2 curl flock find sort awk readlink; do command -v "$command" >/dev/null || { log "Missing command: $command"; exit 1; }; done
mkdir -p "$RELEASES_DIR" "$SHARED_DIR" "$SHARED_DIR/logs"
[[ ! -e "$CURRENT_LINK" || -L "$CURRENT_LINK" ]] || { log "$CURRENT_LINK is not a symlink."; exit 1; }
exec 9>"$SHARED_DIR/deploy.lock"
flock -n 9 || { log 'Another deployment or rollback is running.'; exit 1; }
for file in "$RELEASE_DIR/server.js" "$RELEASE_DIR/REVISION" "$SHARED_DIR/.env" "$SHARED_DIR/ecosystem.config.js"; do [[ -f "$file" ]] || { log "Missing deployment file: $file"; exit 1; }; done
[[ "$(tr -d '[:space:]' < "$RELEASE_DIR/REVISION")" == "$RELEASE_ID" ]] || { log 'Artifact revision mismatch.'; exit 1; }
ln -sfn "$SHARED_DIR/.env" "$RELEASE_DIR/.env"
[[ -z "$PREVIOUS_RELEASE" ]] || printf '%s\n' "$PREVIOUS_RELEASE" > "$SHARED_DIR/previous-release"
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK.next"
mv -Tf "$CURRENT_LINK.next" "$CURRENT_LINK"
CURRENT_SWITCHED=1
start_release
pm2 save

HEALTH_OK=0
for attempt in {1..30}; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 3 --max-time 10 "$HEALTH_URL" || true)"
  if [[ "$code" == 200 ]]; then HEALTH_OK=1; break; fi
  log "Health attempt $attempt/30 returned HTTP $code."
  sleep 2
done
[[ "$HEALTH_OK" == 1 ]] || { log 'Health check failed.'; exit 1; }

CURRENT_RELEASE="$(readlink -f "$CURRENT_LINK")"
find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -nr | awk -v keep="$KEEP_RELEASES" 'NR > keep { sub(/^[^ ]+ /, ""); print }' | while IFS= read -r old; do
  [[ -n "$old" && "$old" != "$CURRENT_RELEASE" && "$old" != "$PREVIOUS_RELEASE" ]] || continue
  log "Removing old release: $old"
  rm -rf -- "$old"
done
trap - ERR
log "HRMS frontend deployment completed: $RELEASE_ID"

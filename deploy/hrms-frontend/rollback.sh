#!/usr/bin/env bash
set -Eeuo pipefail
TARGET_ID="${1:-}"
BASE_DIR="${BASE_DIR:?Set BASE_DIR}"
PM2_APP_NAME="${PM2_APP_NAME:?Set PM2_APP_NAME}"
APP_ENV="${APP_ENV:?Set APP_ENV}"
APP_HOST="${APP_HOST:?Set APP_HOST}"
APP_PORT="${APP_PORT:?Set APP_PORT}"
HEALTH_URL="${HEALTH_URL:?Set HEALTH_URL}"
RELEASES_DIR="$BASE_DIR/releases"; SHARED_DIR="$BASE_DIR/shared"; CURRENT_LINK="$BASE_DIR/current"
log() { printf '[%s] %s\n' "$(date '+%F %T')" "$*"; }
health() { for attempt in {1..30}; do curl --fail --silent --show-error --max-time 5 "$HEALTH_URL" >/dev/null && return 0; log "Health attempt $attempt/30 failed."; sleep 2; done; return 1; }
[[ -L "$CURRENT_LINK" ]] || { echo 'No active release.' >&2; exit 1; }
CURRENT_RELEASE="$(readlink -f "$CURRENT_LINK")"
if [[ -z "$TARGET_ID" ]]; then [[ -f "$SHARED_DIR/previous-release" ]] || { echo 'No previous release marker.' >&2; exit 1; }; TARGET_RELEASE="$(tr -d '\r\n' < "$SHARED_DIR/previous-release")"; else [[ "$TARGET_ID" =~ ^[0-9a-fA-F]{40}$ ]] || exit 1; TARGET_RELEASE="$RELEASES_DIR/$TARGET_ID"; fi
TARGET_RELEASE="$(readlink -f "$TARGET_RELEASE")"
[[ "$TARGET_RELEASE" == "$RELEASES_DIR"/* && -f "$TARGET_RELEASE/server.js" ]] || { echo 'Invalid rollback release.' >&2; exit 1; }
[[ "$TARGET_RELEASE" != "$CURRENT_RELEASE" ]] || { log 'Release already active.'; exit 0; }
exec 9>"$SHARED_DIR/deploy.lock"; flock -n 9 || { echo 'Another operation is running.' >&2; exit 1; }
ln -sfn "$TARGET_RELEASE" "$CURRENT_LINK.next"; mv -Tf "$CURRENT_LINK.next" "$CURRENT_LINK"
export BASE_DIR PM2_APP_NAME APP_ENV APP_HOST APP_PORT APP_REVISION="$(basename "$TARGET_RELEASE")"
pm2 startOrReload "$SHARED_DIR/ecosystem.config.js" --only "$PM2_APP_NAME" --update-env
if ! health; then ln -sfn "$CURRENT_RELEASE" "$CURRENT_LINK.next"; mv -Tf "$CURRENT_LINK.next" "$CURRENT_LINK"; APP_REVISION="$(basename "$CURRENT_RELEASE")" pm2 startOrReload "$SHARED_DIR/ecosystem.config.js" --only "$PM2_APP_NAME" --update-env || true; exit 1; fi
printf '%s\n' "$CURRENT_RELEASE" > "$SHARED_DIR/previous-release"; pm2 save
log "Rollback completed: $(basename "$TARGET_RELEASE")"

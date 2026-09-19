#!/usr/bin/env bash
set -Eeuo pipefail
RELEASE_ID="${1:?usage: stage-release.sh <release-id> <archive>}"
ARCHIVE_FILE="${2:?usage: stage-release.sh <release-id> <archive>}"
BASE_DIR="${BASE_DIR:?Set BASE_DIR}"
RELEASES_DIR="$BASE_DIR/releases"
SHARED_DIR="$BASE_DIR/shared"
RELEASE_DIR="$RELEASES_DIR/$RELEASE_ID"
STAGING_DIR=''
cleanup() { status=$?; rm -f -- "$ARCHIVE_FILE" "$0" || true; [[ -z "$STAGING_DIR" || ! -d "$STAGING_DIR" ]] || rm -rf -- "$STAGING_DIR"; exit "$status"; }
trap cleanup EXIT
[[ "$RELEASE_ID" =~ ^[0-9a-fA-F]{40}$ ]] || { echo 'Release ID must be a full Git SHA.' >&2; exit 1; }
[[ -f "$ARCHIVE_FILE" && -d "$RELEASES_DIR" && -d "$SHARED_DIR" ]] || { echo 'Artifact or server layout missing.' >&2; exit 1; }
if [[ -e "$RELEASE_DIR" ]]; then
  [[ -d "$RELEASE_DIR" ]] || exit 1
  CONTENT_DIR="$RELEASE_DIR"
else
  while IFS= read -r path; do case "$path" in /*|../*|*/../*|*/..) echo "Unsafe archive path: $path" >&2; exit 1;; esac; done < <(tar -tzf "$ARCHIVE_FILE")
  STAGING_DIR="$(mktemp -d "$RELEASES_DIR/.staging-$RELEASE_ID.XXXXXX")"
  tar -xzf "$ARCHIVE_FILE" -C "$STAGING_DIR"
  CONTENT_DIR="$STAGING_DIR"
fi
for file in \
  "$CONTENT_DIR/server.js" \
  "$CONTENT_DIR/REVISION" \
  "$CONTENT_DIR/.next/BUILD_ID" \
  "$CONTENT_DIR/public/icon.png" \
  "$CONTENT_DIR/deploy/hrms-frontend/check-assets.mjs" \
  "$CONTENT_DIR/deploy/hrms-frontend/deploy.sh" \
  "$CONTENT_DIR/deploy/hrms-frontend/stage-release.sh" \
  "$CONTENT_DIR/deploy/hrms-frontend/rollback.sh" \
  "$CONTENT_DIR/deploy/hrms-frontend/server-setup.sh" \
  "$CONTENT_DIR/deploy/hrms-frontend/production-edge.sh" \
  "$CONTENT_DIR/deploy/hrms-frontend/ecosystem.config.js" \
  "$CONTENT_DIR/deploy/hrms-frontend/nginx/hrms.alliance.co.tz.conf"; do
  [[ -f "$file" ]] || { echo "Missing release file: $file" >&2; exit 1; }
done
[[ -d "$CONTENT_DIR/.next/static/chunks" ]] || { echo 'Missing release .next/static/chunks directory.' >&2; exit 1; }
for asset in assets/alliance-logo.png favicon.ico; do
  [[ -s "$CONTENT_DIR/public/$asset" ]] || { echo "Missing release public/$asset" >&2; exit 1; }
done
[[ "$(tr -d '[:space:]' < "$CONTENT_DIR/REVISION")" == "$RELEASE_ID" ]] || { echo 'Artifact revision mismatch.' >&2; exit 1; }
if [[ -n "$STAGING_DIR" ]]; then mv "$STAGING_DIR" "$RELEASE_DIR"; STAGING_DIR=''; fi
install -m 0640 "$RELEASE_DIR/deploy/hrms-frontend/ecosystem.config.js" "$SHARED_DIR/ecosystem.config.js"
chmod 0750 "$RELEASE_DIR"/deploy/hrms-frontend/*.sh
bash "$RELEASE_DIR/deploy/hrms-frontend/deploy.sh" "$RELEASE_ID"

#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/opt/apps/hrms/uat/frontend"
ECOSYSTEM_FILE="/opt/apps/hrms/ecosystem.config.js"
BRANCH="master"

WEB_PM2_NAME="hrms-uat-web"
APP_PORT="9990"

TARGET_REF="${GITHUB_SHA:-origin/$BRANCH}"

echo "======================================"
echo "HRMS UAT Frontend Deployment Started"
echo "======================================"
echo "Target directory: $APP_DIR"
echo "Target ref: $TARGET_REF"

cd "$APP_DIR"

git config --global --add safe.directory "$APP_DIR" || true

echo "Fetching latest code from GitHub..."
git fetch origin "$BRANCH"

echo "Resetting frontend code..."
git reset --hard "$TARGET_REF"

echo "Checking Node and npm versions..."
node -v
npm -v

echo "Installing frontend dependencies..."
npm ci

echo "Running frontend lint..."
npm run lint

echo "Building Next.js frontend..."
npm run build

echo "Checking Next.js build output..."
if [ ! -d "$APP_DIR/.next" ]; then
  echo "ERROR: .next build folder was not found."
  exit 1
fi

echo "Reloading PM2 UAT frontend: $WEB_PM2_NAME"
sudo -n pm2 reload "$ECOSYSTEM_FILE" --only "$WEB_PM2_NAME" --update-env

echo "Saving PM2 process list..."
sudo -n pm2 save

echo "Waiting for UAT frontend to become ready on port $APP_PORT..."

HTTP_CODE="000"

for i in {1..60}; do
  HTTP_CODE="$(curl -sS -o /dev/null -w "%{http_code}" "http://127.0.0.1:${APP_PORT}" || true)"

  if [[ "$HTTP_CODE" =~ ^(2|3|4) ]]; then
    echo "UAT frontend is responding. HTTP status: $HTTP_CODE"
    break
  fi

  echo "UAT frontend not ready yet. Attempt $i/60, status=$HTTP_CODE"
  sleep 2
done

if ! [[ "$HTTP_CODE" =~ ^(2|3|4) ]]; then
  echo "UAT frontend health check failed. HTTP status: $HTTP_CODE"
  sudo -n pm2 logs "$WEB_PM2_NAME" --lines 100 --nostream
  exit 1
fi

echo "======================================"
echo "HRMS UAT Frontend Deployment Completed"
echo "======================================"

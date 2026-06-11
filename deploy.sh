#!/bin/bash
set -euo pipefail
#
# Deploy to Vercel production + fix domain aliases.
# Usage: ./deploy.sh
#

# Clear stale Vercel env vars that block CLI
unset VERCEL_PROJECT_ID VERCEL_ORG_ID VERCEL_TEAM_ID VERCEL_TOKEN 2>/dev/null || true
export PATH="/opt/homebrew/bin:$PATH"

cd "$(dirname "$0")"

echo "=== Deploying to Vercel production ==="
rm -rf .vercel

# Deploy and capture the deployment URL from stderr
DEPLOY_OUTPUT=$(vercel --prod --yes 2>&1)
echo "$DEPLOY_OUTPUT"

# Extract the deployment URL (Vercel prints "▲ Production  https://app-xxx.vercel.app")
NEW_URL=$(echo "$DEPLOY_OUTPUT" | grep -oE 'https://[a-zA-Z0-9-]+\.vercel\.app' | head -1)

if [ -z "$NEW_URL" ]; then
    echo "ERROR: Could not extract deployment URL" >&2
    exit 1
fi
echo ""
echo "=== New deployment: $NEW_URL ==="

# Remove any stale aliases pointing to old deployments
echo "Removing old aliases..."
vercel alias rm amafahelectronics.com 2>/dev/null || true
vercel alias rm www.amafahelectronics.com 2>/dev/null || true

# Alias both root and www to the NEW deployment
echo "Aliasing to new deployment..."
vercel alias set "$NEW_URL" amafahelectronics.com
vercel alias set "$NEW_URL" www.amafahelectronics.com

echo ""
echo "=== Done ==="
echo "https://amafahelectronics.com → $NEW_URL"
echo "https://www.amafahelectronics.com → $NEW_URL"

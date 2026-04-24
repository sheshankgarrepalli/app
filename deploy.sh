#!/bin/bash
set -e

echo "Deploying to production..."
npx vercel --prod --yes

echo "Deployment complete."

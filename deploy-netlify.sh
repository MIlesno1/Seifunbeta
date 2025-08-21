#!/usr/bin/env bash
set -euo pipefail

echo "🔧 Preparing Netlify deployment..."

if ! command -v netlify >/dev/null 2>&1; then
  echo "📦 Installing Netlify CLI..."
  npm install -g netlify-cli
fi

echo "🧹 Cleaning build artifacts"
rm -rf dist node_modules/.cache || true

echo "📦 Installing dependencies"
npm ci

echo "🏗️ Building"
npm run build

echo "🚀 Deploying to Netlify (production)"
netlify deploy --prod --dir=dist

echo "✅ Netlify deployment complete"

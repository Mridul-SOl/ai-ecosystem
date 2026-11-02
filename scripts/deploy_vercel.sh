#!/usr/bin/env bash
# Helper script to deploy to Vercel

set -e

echo "=== AI ECOSYSTEM: Vercel Deployment Helper ==="

if ! command -v vercel &> /dev/null; then
    echo "Installing Vercel CLI..."
    npm install -g vercel
fi

echo "Deploying to Vercel production..."
vercel --prod

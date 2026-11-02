#!/usr/bin/env bash
# Helper script to link and push to GitHub

set -e

echo "=== AI ECOSYSTEM: GitHub Deployment Helper ==="

if ! command -v gh &> /dev/null; then
    echo "GitHub CLI (gh) is not installed. You can link remote manually using:"
    echo "  git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO>.git"
    echo "  git push -u origin main"
    exit 0
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "Please log in to GitHub CLI first:"
    echo "  gh auth login"
    echo ""
    echo "After logging in, run this script again or run:"
    echo "  gh repo create ai-ecosystem --public --source=. --remote=origin --push"
    exit 0
fi

echo "Authenticated with GitHub. Creating and pushing repository..."
gh repo create ai-ecosystem --public --source=. --remote=origin --push

echo "Successfully pushed to GitHub!"

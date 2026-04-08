#!/bin/bash
# IAS Hub — Git commit helper
# Usage: bash scripts/commit.sh "your commit message"

cd /Users/ivanavrtunic/Desktop/planet-ias-hub
git add .
git commit -m "$1"
git push origin main
echo "✅ Pushed to GitHub"

#!/usr/bin/env bash
# Day thu muc dist/ len nhanh gh-pages ma KHONG dung toi thu muc lam viec:
# dung mot index tam, tao thang commit roi push. Khong checkout, khong worktree.
set -euo pipefail
cd "$(dirname "$0")/.."

npm run build
touch dist/.nojekyll          # chan Jekyll nuot file/thu muc bat dau bang _

export GIT_INDEX_FILE
GIT_INDEX_FILE=$(mktemp -u)
git --work-tree=dist add -A
TREE=$(git write-tree)
COMMIT=$(git commit-tree "$TREE" -m "deploy: $(git rev-parse --short HEAD)")
rm -f "$GIT_INDEX_FILE"

git push -f origin "$COMMIT:refs/heads/gh-pages"
echo "Da deploy -> https://vqhuy98.github.io/badminton-host/"

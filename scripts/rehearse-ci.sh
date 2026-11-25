#!/usr/bin/env bash
# 本地复演 workflow 里的版本校验 + zip 查找步骤（不联网）
set -euo pipefail
cd "$(dirname "$0")/.."

export GITHUB_REF_NAME="${GITHUB_REF_NAME:-v2.0.4}"
OUT=$(mktemp)

PKG=$(node -pe "JSON.parse(require('fs').readFileSync('package.json','utf8')).version")
DIST=$(node -pe "JSON.parse(require('fs').readFileSync('dist/manifest.json','utf8')).version")
TAG="${GITHUB_REF_NAME#v}"
echo "package.json=$PKG  dist=$DIST  tag=${TAG:-<none>}"
[ "$PKG" = "$DIST" ] || { echo "::error::package.json 与 dist/manifest.json 版本不一致"; exit 1; }
if [ -n "$TAG" ] && [ "$TAG" != "$PKG" ]; then
  echo "::error::tag $TAG 与构建版本 $PKG 不一致，先改 package.json 再打 tag"
  exit 1
fi

V=$(node -pe "JSON.parse(require('fs').readFileSync('package.json','utf8')).version")
ZIP=$(ls -1 release/*-"$V".zip 2>/dev/null | head -1)
[ -n "$ZIP" ] || ZIP=$(ls -1t release/*.zip 2>/dev/null | head -1)
[ -n "$ZIP" ] || { echo "::error::release/ 下没有 zip"; exit 1; }
echo "path=$ZIP" >> "$OUT"
echo "产物: $ZIP"

echo "--- 交给发布脚本 ---"
node scripts/cws-publish.mjs --zip "$ZIP" --check-build
rm -f "$OUT"
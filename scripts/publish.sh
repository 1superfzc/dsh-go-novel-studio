#!/usr/bin/env bash
# scripts/publish.sh —— 一条命令发 npm 并生成市场条目
set -euo pipefail
cd "$(dirname "$0")/.."

PKG=$(node -p "require('./package.json').name")
VER=$(node -p "require('./package.json').version")
echo "包名 $PKG  版本 $VER"

# 1 自检
node /root/.dsh/skills/dsh-go-plugin/kit/bin/check.mjs . --load >/dev/null
node test/self-test.mjs | tail -2

# 2 登录检查
if ! npm whoami >/dev/null 2>&1; then
  echo "还没登录 npm，先跑：npm login --registry=https://registry.npmjs.org"
  exit 1
fi

# 3 发布
npm publish --registry=https://registry.npmjs.org --access public

# 4 生成市场条目
TS=$(node -p "Math.floor(Date.now()/1000)")
node - "$PKG" "$VER" "$TS" <<'EOF'
const fs = require('fs')
const [pkg, version, ts] = process.argv.slice(2)
const entry = {
  name: pkg,
  title: { zh: '写小说', en: 'Novel studio' },
  description: {
    zh: 'dsh-go 手机端 AI 小说工作站：母本风格蒸馏、分块写作、AI 味体检、人物伏笔资料库、WebDAV 备份',
    en: 'AI novel studio for dsh-go: style distillation, chunked writing, AI-flavor lint, story bible, WebDAV backup',
  },
  metadata: { category: 'tools' },
  versions: [{ version, publishTimestamp: Number(ts), source: { type: 'npm', registry: 'https://registry.npmjs.org/' } }],
}
fs.writeFileSync('market-entry.json', JSON.stringify(entry, null, 2) + '\n')
console.log('市场条目已生成：market-entry.json')
EOF

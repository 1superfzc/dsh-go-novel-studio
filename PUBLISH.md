# 发布与分发（local-novel → npm / 市场）

## 0. 已经替你准备好的

- `package.json` 已补齐 `license: MIT`、`keywords`（`dsh` `dsh-plugin` `dsh-go` `deepseek-harness` `dshGo` `novel`）、`files`（只打包 lib/ + cordis.patch.yml + README）、`repository`、`author`
- `npm pack --dry-run` 通过：12 个文件 / 38.2 kB（test/ 与调试产物不会进包）
- 仍需你手动改两处：包名（建议 `dsh-go-novel-studio`）、`repository.url`

## 1. 本地私有分发（不上架也能给别人用）

**A. 发 tgz**

```sh
cd ~/.dsh/dsh-go/plugins/local-novel
npm pack                       # 产出 local-novel-0.6.0.tgz
```
对方：`dsh plugin --profile web add ./local-novel-0.6.0.tgz`

**B. 发 git 仓库**

```sh
git init && git add -A && git commit -m "local-novel 0.6.0"
git remote add origin https://github.com/USER/local-novel.git && git push -u origin main
```
对方：`dsh plugin --profile web add github:USER/local-novel`

## 2. 发到 npm（公开，一条命令装）

```sh
cd ~/.dsh/dsh-go/plugins/local-novel
python3 - <<'EOF'
import json
p='package.json'; d=json.load(open(p,encoding='utf-8'))
d.pop('private', None)                       # 必须去掉
d['name']='dsh-go-novel-studio'              # 换成你的包名；已经占用就加后缀
json.dump(d, open(p,'w',encoding='utf-8'), ensure_ascii=False, indent=2)
EOF
npm login                                    # 首次要登一次
npm publish --access public                  # 作用域包用 --access public
```

装：`dsh plugin --profile web add dsh-go-novel-studio`

注意：
- `private: true` 不去掉会直接 403
- 发布后 24 小时内可 `npm unpublish 包名@版本`；之后只能 `npm deprecate` 发新版本
- 升级：改版本号（`npm version patch|minor|major`）再 publish

## 3. 进 dsh-go「插件市场」

市场列表不在 npm 上，是一份手工维护的索引：`https://dl.dshtui.com/market/index.json`。
每条长这样（照抄格式，改字段）：

```json
{
  "name": "dsh-go-novel-studio",
  "title": { "zh": "写小说", "en": "Novel studio" },
  "description": { "zh": "蒸馏母本语感、分块写作、AI 味体检", "en": "Style distillation and chapter writing" },
  "metadata": { "category": "tools" },
  "versions": [
    { "version": "0.6.0", "publishTimestamp": 1794557772,
      "source": { "type": "npm", "registry": "https://registry.npmjs.org/" } }
  ]
}
```

提交途径：给作者提（GitHub `ccch1mneyyy`，或 App 作者群里 @ 作者）并附上面这段 JSON + npm 链接 + 一张面板截图。索引里现有的 5 个插件都是这样收进去的。

## 4. 发布前自检清单

- [ ] `node ~/.dsh/skills/dsh-go-plugin/kit/bin/check.mjs . --load` → 0 错误
- [ ] `node test/self-test.mjs` → 全绿
- [ ] `package.json` 无 `private`，`version` 已 +1
- [ ] 包里没有测试数据、没有 `~/.dsh/dsh-go/novel` 的内容（`files` 已挡）
- [ ] README 写明数据落在哪、WebDAV 账号是明文存本机
- [ ] 别人能装：`dsh plugin --profile web add <包名>` 后重启引擎可见

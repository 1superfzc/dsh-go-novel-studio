# 提交到 dsh-go 插件市场

市场不是自动收录，索引由作者手工维护：`https://dl.dshtui.com/market/index.json`（现有 5 条：dsh-media / modlens / modsearch / dsh-im / dsh-context）。

## 顺序

1. **发 npm**：`bash scripts/publish.sh`（会自检、发布、并生成 `market-entry.json`）
2. **发 GitHub**：`gh repo create dsh-go-novel-studio --public --source=. --remote=origin --push`
3. **提交收录**：把 `market-entry.json` 的内容 + npm 链接 + 一张面板截图，发给作者
   - GitHub：https://github.com/ccch1mneyyy （提 issue 或 PR 说明「插件市场收录」）
   - 或 App 作者群里 @ 作者

## 可直接复制的投稿文案

```
你好，提交一个插件市场收录申请：

插件名：dsh-go-novel-studio
中文名：写小说
一句话：dsh-go 手机端 AI 小说工作站——母本风格蒸馏、分块写作、AI 味体检、人物/伏笔/世界观资料库、WebDAV 备份
npm：https://www.npmjs.com/package/dsh-go-novel-studio
GitHub：https://github.com/USER/dsh-go-novel-studio
安装：dsh plugin --profile web add dsh-go-novel-studio

市场条目：
<粘贴 market-entry.json 全文>

截图为插件四个面板：写小说 / AI 创作 / 资料库 / 设置。
```

## 审核会看什么

- `check.mjs --load` 是否 0 错误（本仓库已过）
- 面板是否有真实功能（本插件 4 面板 / 30+ 动作全部有 handler）
- 数据落在哪、有没有偷偷联网（本插件只在你主动点备份时连 WebDAV）
- README 是否说明安装与卸载

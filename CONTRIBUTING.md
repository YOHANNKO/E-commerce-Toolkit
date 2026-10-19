# 贡献指南

## 项目原则（请先读这三条）

1. **零构建**：不引入 webpack / vite / npm 依赖。克隆下来双击 `index.html` 就能跑，这是本项目的核心卖点。
2. **纯前端**：不接受任何需要服务器才能运行的功能。云端能力一律通过用户自建 Supabase 实现，且必须是可选的。
3. **本地优先**：所有功能在「本地模式」下必须完整可用，云端只是增强。

## 开发方式

```bash
git clone https://github.com/<你的用户名>/crossborder-toolkit.git
cd crossborder-toolkit
python3 -m http.server 3000      # 或 npx serve .
# 打开 http://localhost:3000
```

> 必须用 HTTP 服务器，不能直接双击。`file://` 协议下浏览器会禁用 IndexedDB。

## 代码结构约定

- 每个功能模块是一个 IIFE，挂到 `window.Xxx`，暴露 `init()` 与 `onShow()`
- 新增模块需要在 `js/app.js` 的 `views` / `mods` 注册，并在 `index.html` 加 `<script>`
- 数据读写统一走 `DS.list / insert / update / remove`，不要直接碰 `sb.from` 或 `IDB`
- 所有界面文案写进 `js/i18n.js` 的字典，中英都要给

## 提交 PR 前检查

```bash
# 1. 语法自检（不需要装任何依赖）
for f in js/*.js; do node --check "$f" || echo "FAIL $f"; done

# 2. 确认没有泄露密钥
grep -rn "eyJhbGciOi\|sk-[A-Za-z0-9]\{20,\}" --include=*.js --include=*.html . | grep -v vendor

# 3. 缓存版本号递增（改了 js/css 就必须做）
grep -o "?v=[0-9]*" index.html | sort -u
```

## 提交信息格式

```
feat: 新增 XX 功能
fix: 修复 XX 问题
docs: 更新文档
style: 样式调整（不影响功能）
refactor: 重构（不改变行为）
```

## 不接受的内容

- 引入框架（React / Vue）或构建工具
- 硬编码的密钥、个人服务器地址
- 破坏「本地模式可独立运行」的改动
- 与跨境电商工具台无关的功能

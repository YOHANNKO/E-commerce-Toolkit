# 跨境百宝囊 · CrossBorder Toolkit

一款面向前端零构建的**跨境电商工具台**：汇率换算、定价计算、图片编辑、翻译、知识库、客户档案、日程待办，全部跑在一个纯静态页面里。

> 纯静态前端 + 可选 Supabase 云端。没有构建步骤、没有 `node_modules`，双击 `index.html` 即可用。

---

## 一、快速开始

### 方式一：纯本地模式（零配置，推荐）

1. 直接双击 `index.html`（或拖进浏览器）。
2. 登录页选择「**本地模式**」→ 进入。
3. 数据保存在浏览器 IndexedDB，**不联网、不上传、不外泄**。

> 建议用 Chrome / Edge / Safari 现代浏览器。局域网或本地文件协议均可运行。

### 方式二：云端协作模式（多人共享）

1. 到 [supabase.com](https://supabase.com) 新建 Project。
2. 控制台 → **Project Settings → API**，复制：
   - Project URL
   - anon public key
3. 填入 `js/config.js`（私钥安全写法见下方提示）：
   ```js
   window.SUPABASE_URL = "https://<你的项目ID>.supabase.co";
   window.SUPABASE_ANON_KEY = "<你的 anon public key>";
   ```

> **如何不把密钥提交到仓库**：`js/config.js` 里只填占位值（比如 `"placeholder"`），
> 真值写进 `js/config.local.js`（从 `config.local.js.example` 复制）。
> `index.html` 检测到 `config.js` 已填值时会额外加载 `config.local.js` 覆盖，
> 而 `config.local.js` 已被 `.gitignore` 忽略，永不入库。
4. 建表：把 `supabase/migrations/0001_init.sql` ~ `0008_todo_priority.sql`
   按顺序在 Supabase **SQL Editor** 里执行一遍。
5. 刷新页面 → 登录页选择「**云端模式**」→ 首次注册的账号自动成为管理员。

---

## 二、功能模块

| 模块 | 说明 |
|---|---|
| **汇率换算** | 多币种实时/离线汇率、批量换算、历史汇率 |
| **定价计算** | 成本 → 售价推演、体积重/实重、利润率、多方案对比 |
| **图片编辑** | 压缩 / 水印 / 裁切，批量处理，URL 导入 |
| **翻译** | 18 种语言一键互译（免费引擎 / 自填 DeepSeek Key 两档），结果可一键存入文案模板库 |
| **知识库** | 官方库 + 私有库，标签独立管理，模板沉淀 |
| **客户档案** | CRM 联系人、跟进记录、标签 |
| **日程待办** | 优先级、标签管理、日期筛选 |
| **用户设置** | 成员管理、批量删除、角色分配、**外观皮肤切换** |

---

## 三、界面外观（三态切换 + 可插拔皮肤）

顶栏的 🎨/🌙/✨ 图标按钮可在三种外观间**一键循环切换**：

| 外观 | 图标 | 说明 |
|---|---|---|
| **经典** | 🎨 | 默认浅色，原有外观 |
| **夜间** | 🌙 | 深色模式 |
| **Lumen** | ✨ | 玻璃拟态极简风（浅色专属） |

- Lumen 以**独立 CSS 文件**形式存在：`css/themes/lumen/lumen.css`
- 全部规则都以 `body[data-skin="lumen"]` 前缀作用域隔离，**不会污染原有样式**
- `index.html` 里该 `<link>` 默认带 `disabled` —— 不启用时浏览器**完全不解析**，对经典界面零影响
- Lumen 与夜间互斥：切到 Lumen 自动回浅色；切到夜间自动回经典
- 完整版的 **设置 → 外观皮肤** 里也可以直接点选（老入口保留）

### 删除一套皮肤

```bash
rm -rf css/themes/lumen/          # 1. 删目录
# 2. 删掉 index.html 里那一行 <link ... id="skinLumen" ...>
```

删完后如果你之前选过 Lumen，会**自动回退到经典**，不会报错。

详见 `css/themes/lumen/README.md`。

---

## 四、目录结构

```
crossborder-toolkit/
├── index.html                 # 单页入口（唯一的 HTML）
├── css/
│   ├── style.css              # 基础样式（经典外观）
│   ├── fonts.css              # Inter 字体声明（自托管，不依赖 Google）
│   └── themes/
│       └── lumen/             # 可选皮肤（整包可删）
│           ├── lumen.css
│           └── README.md
├── fonts/                     # Inter 字体文件（OFL 许可，可替换/删除）
├── js/
│   ├── config.js              # ← Supabase 配置（留空则仅本地模式）
│   ├── config.local.js.example # 私有配置模板（复制为 config.local.js 后已被 git 忽略）
│   ├── app.js                 # 应用引导 + 皮肤注册表
│   ├── store.js               # 数据源抽象（local / cloud 双模式）
│   ├── localdb.js             # IndexedDB 封装
│   ├── supabase.js            # 云端客户端
│   ├── i18n.js                # 中英文案字典
│   ├── auth.js / collab.js    # 登录 + 成员协作
│   ├── rates.js / convert.js  # 汇率 / 单位换算
│   ├── pricing.js / crm.js    # 定价 / 客户
│   ├── editor.js              # 图片编辑
│   ├── translate.js           # 翻译
│   ├── knowledge.js           # 知识库
│   ├── todo.js / clock.js     # 待办 / 世界时钟
│   ├── backup.js / datamgr.js / migrate.js  # 备份 / 数据管理 / 迁移
│   └── vendor/supabase.umd.js # Supabase SDK（已内置，无需 npm）
└── supabase/
    ├── config.toml
    └── migrations/            # 0001 ~ 0008 建表脚本
```

---

## 五、常见问题

**Q：打开是白屏 / 什么都没有？**
A：检查浏览器控制台。如果是 `js/config.js` 未配置的提示，那只是提示信息——选「本地模式」即可正常使用，忽略它。

**Q：数据会上传到服务器吗？**
A：本地模式下不会。所有数据存在你自己的浏览器里。云端模式才会同步到你自己创建的 Supabase 项目。

**Q：怎么备份数据？**
A：设置 → 数据管理 → 导出备份（JSON）。导出的文件可以再导入回来。

**Q：能部署到静态托管吗？**
A：可以。整个目录丢到 GitHub Pages / Vercel / Netlify / 任意静态服务器即可。因为是纯静态，无需 Node 运行时。

---

## 六、本项目不包含什么（重要）

为避免误解，明确列出**没有**的东西：

- ❌ 没有服务端代码。这是一个纯静态前端，`index.html` + `css` + `js` 就是全部。
- ❌ 没有自建数据库。云端模式的数据存在**你自己创建**的 Supabase 项目里。
- ❌ 没有任何预置的 API Key。翻译的 AI 引擎需要你自己填 DeepSeek Key（存在浏览器本地），
  或使用内置的免费翻译源（无需 Key，但有速率限制）。

## 七、数据与隐私

| | 数据在哪 | 谁能看到 |
|---|---|---|
| 本地模式 | 本浏览器 IndexedDB | 只有你（换设备/清缓存需要导出备份） |
| 云端模式 | 你自己的 Supabase 项目 | 你 + 你邀请的成员，RLS 保证互相隔离 |

第三方请求只有三处，且都只在你使用对应功能时发生：
汇率（`open.er-api.com`）、城市搜索（`open-meteo.com`）、免费翻译（`mymemory` / Google 免费端点）。
若要完全离线，不使用这三个模块即可。

## 八、许可

[MIT](LICENSE) —— 可自由用于个人与商业项目，修改、分发、闭源商用均允许。
唯一要求：保留版权声明与许可声明。

字体 [Inter](https://github.com/rsms/inter) 遵循 SIL Open Font License 1.1。

## 九、贡献

欢迎 Issue 与 PR。提 PR 前请确认：

1. 没有提交任何真实密钥（`js/config.js` 保持空白，或使用 `config.local.js`）
2. 不引入构建工具链（本项目刻意保持「零构建、双击即用」）
3. 修改 `js/` 或 `css/` 后，把 `index.html` 中所有 `?v=NN` 统一 +1，避免浏览器缓存旧文件

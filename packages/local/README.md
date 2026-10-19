# 跨境百宝囊 · 纯本地版

纯静态、零构建、零后端。**数据只存在使用者自己的浏览器里**，不联网同步、不需要注册账号。

## 三步跑起来

```bash
cd packages/local
python3 -m http.server 3000    # 或 npx serve .
```

打开 <http://localhost:3000> → 点「💾 进入本地模式」即可。

> ⚠️ 不要直接双击 `index.html`。`file://` 协议下部分浏览器会禁用 IndexedDB，数据存不住。
> 部署到线上（GitHub Pages / Vercel / Netlify / 腾讯云 CloudBase）没有这个问题。

## 部署

把本目录下的全部文件原样上传到任意静态托管即可，**不需要构建命令**：

| 平台 | 做法 |
|---|---|
| GitHub Pages | 本仓库工作流已自动发布 `packages/full`；想发布本版就改 `.github/workflows/ci.yml` 里的 `packages/full` → `packages/local` |
| Vercel / Netlify | 拖拽本目录，构建命令留空，输出目录填 `/` |
| Cloudflare Pages | Upload assets 直接上传本目录 |
| 腾讯云 CloudBase | 静态托管 → 上传本目录全部文件到根目录 |
| 自有服务器 | 丢进 Nginx / Apache 网站根目录 |

## 外观：经典 / 夜间 / Lumen

顶栏的 🎨/🌙/✨ 图标按钮一键循环切换三种外观：

- 🎨 **经典** —— 默认浅色
- 🌙 **夜间** —— 深色模式
- ✨ **Lumen** —— 玻璃拟态极简风（浅色专属，与夜间互斥）

选择会记住，刷新后保持。想删掉 Lumen：删 `css/themes/lumen/` 目录 + `index.html` 里那行 `<link id="skinLumen">` 即可，之前选过它的话会自动回退到经典。

## 与完整版的区别

| | 纯本地版 | [完整版](../full) |
|---|---|---|
| 账号系统 | 无 | 有（邮箱注册） |
| 多人协作 | ❌ | ✅ |
| 云端同步 | ❌ | ✅（自建 Supabase） |
| 数据位置 | 浏览器 IndexedDB | IndexedDB 或你自己的 Supabase |
| 外部依赖 | 无 | 无（Supabase 是托管服务，可选） |

十个功能模块（汇率、世界时钟、定价、客户档案、日程、知识库、计算器、翻译、图片编辑、数据管理）两者的用法完全一致。
从本版升级到完整版时，用「数据管理 → 导出 JSON」再「导入」即可搬数据。

## 数据在哪、怎么备份

- 存储介质：浏览器 **IndexedDB**（不是 Cookie、不是 localStorage）
- 备份：设置 → 数据管理 → 导出 JSON
- 清除：数据管理 → 清空数据；或浏览器里清站点数据
- **换浏览器 / 换设备 / 清浏览器缓存 = 数据丢失**，请定期导出备份

## 第三方请求

只在你用到对应功能时发生，且都做了失败兜底：

- 汇率：`cdn.jsdelivr.net`（currency-api）→ `open.er-api.com`
- 城市搜索：`open-meteo.com`
- 翻译：Google 免费端点 → Lingva → MyMemory

字体已自托管在 `fonts/`，**不请求 Google Fonts**。

## 许可

[MIT](../../LICENSE)。字体 [Inter](https://github.com/rsms/inter) 遵循 SIL OFL 1.1。

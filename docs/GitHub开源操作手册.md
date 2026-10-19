# 上传到 GitHub 并开源 · 操作手册

> 面向第一次开源的人。全程约 15 分钟，不需要买任何东西。

---

## 一、准备工作（只做一次）

### 1. 装 Git

- **Windows**：到 <https://git-scm.com/download/win> 下载安装，一路「下一步」。
  装完在桌面右键能看到「Git Bash」就是成功了。
- **macOS**：终端里敲 `git --version`，如果提示安装命令行工具，点「安装」即可。

验证：

```bash
git --version
# 应输出类似 git version 2.43.0
```

### 2. 告诉 Git 你是谁

```bash
git config --global user.name "Yohan"
git config --global user.email "你的GitHub注册邮箱"
```

> 这两行会写进每一次提交记录，公开可见。想隐藏真实邮箱，可以去
> GitHub → Settings → Emails → 勾选 **Keep my email addresses private**，
> 然后用页面给出的 `xxxxx@users.noreply.github.com` 作为 email。

### 3. 注册 GitHub

已有账号可跳过。没有就去 <https://github.com/signup>。

---

## 二、在 GitHub 上建一个空仓库

1. 点右上角 **+** → **New repository**
2. 填写：

| 字段 | 填什么 |
|---|---|
| Repository name | `crossborder-toolkit`（或你喜欢的好记名字） |
| Description | `跨境电商工具台 · 纯静态零构建 · 汇率/定价/CRM/知识库/翻译` |
| 可见性 | **Public**（开源必须选这个） |
| Add a README file | ❌ **不要勾** |
| Add .gitignore | ❌ **不要选** |
| Choose a license | ❌ **不要选** |

> ⚠️ 后三项一定都留空。你的包里已经带了 README、.gitignore、LICENSE，
> 让 GitHub 再生成一份会导致首次 push 冲突。

3. 点 **Create repository**，会跳到一个「Quick setup」页面，**先别关**，
   后面要用到页面上的仓库地址。

---

## 三、把本地文件推上去

### 1. 解压

把 `跨境百宝囊-GitHub开源仓库.zip` 解压，得到一个 `crossborder-toolkit` 文件夹。
**在这个文件夹里面**打开终端（Windows：在文件夹空白处右键 → Git Bash Here）。

确认位置正确——当前目录下应该能看到 `README.md`、`packages`、`.github`：

```bash
ls -a
```

> Windows 用 `dir /a`。如果只看到一层 `crossborder-toolkit` 文件夹，
> 说明你还在外面一层，`cd` 进去。

### 2. 初始化并提交

逐行执行：

```bash
git init -b main
git add .
git commit -m "feat: 首次开源提交（完整版 + 纯本地版）"
```

### 3. 关联远程仓库并推送

把下面地址换成你自己仓库的（在第二节那个页面上能直接复制）：

```bash
git remote add origin https://github.com/你的用户名/crossborder-toolkit.git
git push -u origin main
```

第一次 push 会弹出浏览器要求登录 GitHub，点「Authorize」授权即可。
（用 HTTPS 地址时，密码那一栏要填 **Personal Access Token**，
不是账号密码。嫌麻烦就直接用 GitHub Desktop，见文末「附录 A」。）

### 4. 检查

刷新你的仓库页面，应该能看到 `README.md` 渲染出的介绍页、
描述里的对照表格、以及 `packages/` 两个目录。

---

## 四、把仓库「装修」一下（很重要，决定别人会不会点进来）

### 1. 右上角 About 齿轮

点仓库页面右侧 About 旁边的 ⚙️：

- **Description**：`跨境电商工具台 · 纯静态零构建 · 汇率/定价/CRM/知识库/翻译`
- **Website**：填你部署好的演示地址（见第六节；没有可先留空）
- **Topics**（标签，最多 20 个，用回车分隔）：

```
cross-border-ecommerce  ecommerce  toolkit  vanilla-javascript  no-build
static-site  supabase  crm  currency-converter  calculator
knowledge-base  translation  github-pages  mit-license  china
```

Topics 会显示在仓库顶部，是别人搜索到你项目的主要途径之一。

### 2. 确认 License 被识别

仓库首页右侧应该出现 **MIT license** 徽章。没有的话，
说明 `LICENSE` 文件名或内容格式有问题——本仓库已处理好，一般不会出错。

---

## 五、开启 GitHub Pages 自动演示站（免费）

本仓库内置了 `.github/workflows/ci.yml`，推上去之后：

1. 进仓库 **Settings** → 左侧 **Pages**
2. **Source** 选 **GitHub Actions**（不要选 Deploy from a branch）
3. 回到仓库首页 → **Actions** 标签页 → 应该能看到一个正在运行（黄点）的
   「检查与部署」工作流
4. 等 1~2 分钟变成绿勾，Pages 地址就是：

```
https://你的用户名.github.io/crossborder-toolkit/
```

5. 把这个地址填回第四节的 **Website** 字段

> 工作流会自动把 `packages/full` 里的 `config.js` 清空后再发布，
> **你的 Supabase 私钥绝不会出现在公开演示站上**。
> 演示站只能走「本地模式」，这是刻意的设计。

### 想改成发布纯本地版？

编辑 `.github/workflows/ci.yml`，把「打包前端产物」那一步里的
`packages/full` 全部换成 `packages/local`，提交即可。

---

## 六、发一个版本（Release）

开源项目打 tag 会让别人更容易「下载某个版本」。

```bash
git tag -a v1.0.0 -m "v1.0.0 首个公开版本"
git push origin v1.0.0
```

然后到 GitHub 仓库 → 右侧 **Releases** → **Create a new release**：

- **Choose a tag**：选 `v1.0.0`
- **Release title**：`v1.0.0 · 首个公开版本`
- **Describe this release**：写清楚这个版本有什么

```markdown
## 包含内容

- `packages/full` — 完整版（含 Supabase 云端协作，可选）
- `packages/local` — 纯本地版（零后端，数据只存浏览器）

## 主要功能

汇率换算 / 世界时钟 / 定价计算器 / 客户档案 / 日程待办 /
知识库 / 单位换算 / 18 语种翻译 / 图片编辑 / 数据备份

## 说明

- 纯静态，零构建，不需要 npm install
- 字体已自托管，不依赖 Google Fonts，国内网络可直接打开
- 无埋点、无统计 SDK、不收集任何用户数据
```

- 勾选 **Set as the latest release**
- 点 **Publish release**

---

## 七、开源之后该做什么

| 事项 | 说明 |
|---|---|
| 加上徽章 | README 顶部已有 MIT / No Build / Backend optional 三个徽章，可再加 GitHub stars 徽章 |
| 写 Issue 模板 | Settings → General → Features → Issues 里可开启模板 |
| 响应 Issue | 别让 Issue 挂着不回。回一句「收到，我看下」也比沉默强 |
| 安全问题走私信 | `SECURITY.md` 里已写明流程，别在公开 Issue 里贴漏洞细节 |
| 定期打 tag | 每次有实质更新就打一个版本号，方便别人取用 |

---

## 八、常见问题

**Q：push 时报 `rejected - non-fast-forward`**
A：建仓库时勾了 README/license，远程已有一个提交。执行：

```bash
git pull origin main --allow-unrelated-histories
git push -u origin main
```

**Q：push 时报 `Authentication failed`**
A：GitHub 早已不支持密码推送。要么用 Personal Access Token
（Settings → Developer settings → Personal access tokens → 生成，权限勾 `repo`），
要么改用 GitHub Desktop（附录 A）。

**Q：不小心把密钥提交上去了怎么办**
A：**立刻去 Supabase 控制台轮换（Rotate）那个 key**，这比清理 git 历史更重要。
清理历史可用 [BFG Repo-Cleaner](https://rtyley.github.io/bfg-repo-cleaner/) 或
`git filter-repo`。本仓库的 `.gitignore` 已提前防住 `js/config.local.js`，
CI 也会扫描并拦截疑似密钥。

**Q：能商用吗**
A：MIT 协议允许商用、修改、闭源再分发，只要保留版权声明。

**Q：别人 clone 下来能不能直接用**
A：能。`cd packages/local && python3 -m http.server 3000` 即可跑起来，
不需要装任何依赖。

---

## 附录 A：不用命令行（图形界面方案）

完全不想碰终端的话：

1. 下载 [GitHub Desktop](https://desktop.github.com/)（免费，Win/Mac 都有）
2. 登录账号 → **File → Add local repository** → 选中解压出来的文件夹
3. 如果提示「这不是一个 git 仓库」，点 **create a repository** 并确认
4. 左下角填一行提交说明 → 点 **Commit to main**
5. 右上角 **Publish repository**
   - ⚠️ **取消勾选** "Keep this code private"（否则就成了私有仓库）
6. 完成，剩下的「装修」按第四~六节在网页上做

---

## 附录 B：一键检查清单

推之前对照一遍：

- [ ] `packages/full/js/config.js` 里 `SUPABASE_URL` / `SUPABASE_ANON_KEY` 是空字符串
- [ ] 没有提交任何 `config.local.js`（只有 `.example`）
- [ ] 仓库可见性是 Public
- [ ] `LICENSE` 里的版权人是自己的名字
- [ ] `README.md` 里的 `<你的用户名>` 已替换成真实用户名
- [ ] 建仓库时没勾 README / .gitignore / license

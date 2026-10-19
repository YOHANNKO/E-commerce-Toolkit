// ============================================================
// Supabase 连接配置（开源包占位模板）
// ------------------------------------------------------------
// 本文件在开源包中故意留空，不包含任何真实密钥。
//
// 两种使用方式：
//
// 【方式一 · 纯本地模式（推荐新手 / 单机使用）】
//   什么都不用填，直接打开 index.html 即可。
//   数据保存在浏览器的 IndexedDB 里，不依赖网络、不上传云端。
//   启动后登录页选择「本地模式」进入。
//
// 【方式二 · 云端协作模式（多人共享数据）】
//   1. 到 https://supabase.com 新建一个 Project（免费版足够）
//   2. 控制台 → Project Settings → API，复制两个值：
//        Project URL      → SUPABASE_URL
//        anon public key  → SUPABASE_ANON_KEY
//   3. 用 Supabase 控制台的 SQL Editor 执行 supabase/migrations/ 下
//      0001 ~ 0008 号脚本（按编号顺序，全部幂等可重复执行）。
//   4. 保存本文件后刷新页面，登录页选择「云端模式」进入。
//
//   ★ 不想让填好的密钥进 Git 仓库？两种做法：
//     A. 前面说的「方案二」本身就可以：本文件里填任意非空值（哪怕只是占位），
//        真正的密钥写进 js/config.local.js
//        （模板见 js/config.local.js.example，该文件已被 .gitignore 忽略）。
//        index.html 检测到本文件已填值时会自动加载 config.local.js 覆盖。
//     B. 直接在本文件里填真值，同时把 .gitignore 中 `# js/config.js` 的注释去掉
//
// 安全说明：
//   - anon public key 可以安全地放在前端，RLS（行级安全策略）是唯一安全边界。
//   - service_role key 拥有管理员权限，绝不要写进前端文件。
// ============================================================

window.SUPABASE_URL = "";
window.SUPABASE_ANON_KEY = "";

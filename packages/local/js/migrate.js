/* ===== 纯本地版 · 迁移占位 =====
 * 原文件负责「云端 Supabase → 本地 IndexedDB」的一次性迁移。
 * 纯本地版没有任何云端数据源，因此这里保留同名接口但恒返回「不可用」，
 * 避免迁移被误触发，也就不需要 Supabase SDK。
 */
window.Migrate = (function () {
  async function run() { return { ok: false, reason: "local-only" }; }
  return { run };
})();

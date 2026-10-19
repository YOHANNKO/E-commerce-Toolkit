/* ===== 云端 → 本地 数据迁移 =====
 * 云端登录成功后触发一次：把 Supabase 上的 todos / tags / knowledge / contacts
 * 拉取并写入浏览器 IndexedDB，之后本地登录即可离线使用。
 * 幂等：以 meta.migrated_from_cloud 标记，避免重复导入覆盖本地新数据。
 */
window.Migrate = (function () {
  const META_KEY = "migrated_from_cloud";
  const RES = ["todos", "tags", "knowledge", "contacts"];

  async function alreadyMigrated() {
    return !!(await LDB.getMeta(META_KEY));
  }

  // 拉取云端某资源的全部行（按 owner 过滤，RLS 亦会限制）
  async function fetchCloud(resource, uid) {
    try {
      const { data, error } = await sb.from(resource === "contacts" ? "contacts" : resource)
        .select("*").eq("owner", uid);
      if (error) return [];
      return data || [];
    } catch (e) { return []; }
  }

  // opts: { force:false }
  async function run(opts) {
    opts = opts || {};
    if (!sb || !sb.from || window.SB_OFFLINE) return { ok: false, reason: "offline" };

    // 会话可能刚建立，getUid 偶发拿不到；重试几次
    let uid = null;
    for (let i = 0; i < 5 && !uid; i++) {
      try { uid = await getUid(); } catch (e) { uid = null; }
      if (!uid) await new Promise((r) => setTimeout(r, 400));
    }
    if (!uid) return { ok: false, reason: "no-uid" };

    const done = await alreadyMigrated();
    if (done && !opts.force) return { ok: true, skipped: true };

    const counts = {};
    for (const res of RES) {
      const rows = await fetchCloud(res, uid);
      // 统一补 id / owner / created_at，便于本地读写
      const norm = rows.map((r) => Object.assign({}, r, {
        id: r.id || (window.U && U.uid ? U.uid() : String(Date.now()) + Math.random().toString(36).slice(2, 6)),
        created_at: r.created_at || new Date().toISOString(),
      }));
      if (opts.merge !== false) await LDB.bulkPut(res, norm);
      else { await LDB.clear(res); if (norm.length) await LDB.bulkPut(res, norm); }
      counts[res] = norm.length;
    }

    await LDB.setMeta(META_KEY, { at: new Date().toISOString(), counts });
    return { ok: true, counts };
  }

  // 手动同步（数据管理页「从云端同步」按钮）
  async function syncNow() { return run({ force: true, merge: true }); }

  async function info() { return await LDB.getMeta(META_KEY); }

  return { run, syncNow, info, alreadyMigrated };
})();

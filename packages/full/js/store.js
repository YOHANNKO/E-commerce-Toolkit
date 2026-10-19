/* ===== 统一数据访问层 DS（DataStore） =====
 * 模块只调用 DS.*，不直接依赖 Supabase 或 IndexedDB。
 * 模式：
 *   DS.mode = "local" → 读写浏览器 IndexedDB（LDB）
 *   DS.mode = "cloud" → 读写 Supabase（sb.from），保持原有行为
 * resource ∈ todos | tags | knowledge | contacts | pricing
 */
window.DS = (function () {
  const TABLES = { todos: "todos", tags: "tags", knowledge: "knowledge", contacts: "contacts", pricing: "pricing" };
  const LOCAL_OWNER = "local-user";

  let mode = "local";

  function setMode(m) { mode = m === "cloud" ? "cloud" : "local"; }
  function getMode() { return mode; }
  function isLocal() { return mode === "local"; }

  function uid() {
    return (window.U && U.uid) ? U.uid() : (Date.now().toString(36) + Math.random().toString(36).slice(2, 7));
  }
  function nowISO() { return new Date().toISOString(); }

  async function ownerLocal() { return LOCAL_OWNER; }

  // ---------- 本地模式 ----------
  function sortLocal(arr, orderBy, asc) {
    const list = (arr || []).slice();
    if (!orderBy) return list;
    list.sort((a, b) => {
      const av = a[orderBy] == null ? "" : a[orderBy];
      const bv = b[orderBy] == null ? "" : b[orderBy];
      if (av < bv) return asc ? -1 : 1;
      if (av > bv) return asc ? 1 : -1;
      return 0;
    });
    return list;
  }

  async function localList(resource, opts) {
    opts = opts || {};
    let arr = await LDB.all(TABLES[resource]);
    if (opts.filter) arr = arr.filter((x) => Object.keys(opts.filter).every((k) => x[k] === opts.filter[k]));
    if (opts.orderBy) arr = sortLocal(arr, opts.orderBy, opts.asc !== false ? false : true);
    // 默认按 created_at 倒序
    if (!opts.orderBy && arr.some((x) => x.created_at)) arr = sortLocal(arr, "created_at", false);
    return arr;
  }
  async function localInsert(resource, row) {
    const obj = Object.assign({}, row);
    if (!obj.id) obj.id = uid();
    if (!obj.owner) obj.owner = await ownerLocal();
    if (!obj.created_at) obj.created_at = nowISO();
    await LDB.put(TABLES[resource], obj);
    if (window.Backup) Backup.notifyChange();
    return obj;
  }
  async function localUpdate(resource, id, patch) {
    const cur = await LDB.get(TABLES[resource], id);
    const merged = Object.assign({}, cur || {}, patch, { id });
    await LDB.put(TABLES[resource], merged);
    if (window.Backup) Backup.notifyChange();
    return merged;
  }
  async function localRemove(resource, id) {
    await LDB.del(TABLES[resource], id);
    if (window.Backup) Backup.notifyChange();
    return true;
  }

  // ---------- 云端模式 ----------
  async function cloudOwner() {
    if (window.getUid) return await getUid();
    return null;
  }

  // 迁移未执行时的容错：从 PostgREST 报错里解析出「不存在的列」，剔除后重试。
  // 典型报错：
  //   { code:"PGRST204", message:"Could not find the 'priority' column of 'todos' in the schema cache" }
  //   { code:"42703",    message:"column todos.priority does not exist" }
  function pickUnknownColumn(error) {
    if (!error) return null;
    const msg = String(error.message || "");
    let m = msg.match(/Could not find the '([^']+)' column/i);
    if (m) return m[1];
    m = msg.match(/column\s+(?:[a-z_]+\.)?([a-z_][a-z0-9_]*)\s+does not exist/i);
    if (m) return m[1];
    return null;
  }

  // 每个表记一份「服务端不存在的列」黑名单，避免每次写入都先撞一次 400。
  // 迁移执行后刷新页面即自动恢复（黑名单只存在于内存）。
  const missingCols = Object.create(null);
  function isMissing(resource, col) {
    return !!(missingCols[resource] && missingCols[resource][col]);
  }
  function markMissing(resource, col) {
    (missingCols[resource] || (missingCols[resource] = {}))[col] = true;
    if (window.console) console.warn("[DS] 云端 " + resource + " 缺少列 '" + col + "'，本次会话内自动跳过（请执行对应迁移）");
    // 只提示一次，且措辞面向使用者而非开发者
    if (!markMissing.notified) {
      markMissing.notified = true;
      if (window.U && U.toast) {
        U.toast("云端数据库尚未升级，该字段暂不会保存（功能可用）。请联系管理员执行迁移脚本。");
      }
    }
  }

  // 按黑名单预剔除字段，再逐步剔除服务端新报告的不识别列；最多重试 5 次
  // 返回 { ok, data, payload }：ok=true 表示服务端已接受写入（data 可能因
  // select 权限为空，此时用 payload 做乐观更新）
  async function cloudWrite(resource, fn, row) {
    const payload = Object.assign({}, row);
    Object.keys(payload).forEach((k) => { if (isMissing(resource, k)) delete payload[k]; });

    let lastErr = null;
    for (let i = 0; i < 5; i++) {
      const { data, error } = await fn(payload);
      if (!error) return { ok: true, data, payload };
      lastErr = error;
      const col = pickUnknownColumn(error);
      // 只处理「列不存在」这一类可降级错误；其余（权限/约束）原样上报
      if (!col || !(col in payload)) break;
      markMissing(resource, col);
      delete payload[col];
    }
    if (window.U) U.toast((lastErr && lastErr.message) || "写入失败");
    return { ok: false, data: null, payload };
  }

  // 说明：不做「预探测」。
  // 用 select(col) 去试一个不存在的列本身就会产生 400 请求，等于把噪声从
  // 写入时搬到登录时，并没有真正消除。这里改为「首次写入时学习」：
  // 第一次遇到缺列 → 记入黑名单并重试一次；此后同一会话内所有写入
  // 都直接按黑名单剔除，不再产生任何多余请求。
  async function probeSchema() { /* 保留接口以兼容调用方，实际无需动作 */ }

  async function cloudList(resource, opts) {
    opts = opts || {};
    let q = sb.from(TABLES[resource]).select("*");
    if (opts.filter) q = q.match(opts.filter);
    if (opts.orderBy) q = q.order(opts.orderBy, { ascending: opts.asc === true });
    const { data, error } = await q;
    if (error) { if (window.U) U.toast(error.message); return []; }
    return data || [];
  }
  async function cloudInsert(resource, row) {
    const owner = await cloudOwner();
    const payload0 = Object.assign({ owner }, row);
    if (!payload0.id) delete payload0.id; // 让数据库生成 uuid
    const { ok, data, payload } = await cloudWrite(
      resource,
      (p) => sb.from(TABLES[resource]).insert(p).select().single(),
      payload0
    );
    if (!ok) return null;
    // 写入已成功；select 受 RLS 限制返回空时，用提交的 payload 兜底（id 由本地补）
    return data || Object.assign({ id: uid(), created_at: nowISO() }, payload);
  }
  async function cloudUpdate(resource, id, patch) {
    const { ok, data, payload } = await cloudWrite(
      resource,
      (p) => sb.from(TABLES[resource]).update(p).eq("id", id).select().single(),
      patch
    );
    if (!ok) return null;
    return data || Object.assign({ id }, payload);
  }
  async function cloudRemove(resource, id) {
    const { error } = await sb.from(TABLES[resource]).delete().eq("id", id);
    if (error) { if (window.U) U.toast(error.message); return false; }
    return true;
  }

  // ---------- 对外统一接口 ----------
  async function list(resource, opts) {
    return isLocal() ? localList(resource, opts) : cloudList(resource, opts);
  }
  async function insert(resource, row) {
    return isLocal() ? localInsert(resource, row) : cloudInsert(resource, row);
  }
  async function update(resource, id, patch) {
    return isLocal() ? localUpdate(resource, id, patch) : cloudUpdate(resource, id, patch);
  }
  async function remove(resource, id) {
    return isLocal() ? localRemove(resource, id) : cloudRemove(resource, id);
  }

  // 云端专属：官方/共享类查询（仅 cloud 模式下有意义）
  async function cloudQuery(builder) {
    if (isLocal()) return [];
    const { data, error } = await builder(sb);
    if (error) { if (window.U) U.toast(error.message); return []; }
    return data || [];
  }

  return {
    setMode, getMode, isLocal,
    get mode() { return mode; },
    list, insert, update, remove,
    cloudQuery, probeSchema,
    missingCols,
    LOCAL_OWNER
  };
})();

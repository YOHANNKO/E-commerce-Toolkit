/* ===== 本地存储层：IndexedDB 封装（含 localStorage 回退） =====
 * 暴露 window.LDB，提供 Promise API。
 * Object stores: todos / tags / knowledge / contacts / pricing / meta
 * 若 IndexedDB 不可用（无痕模式等），自动回退到 localStorage 命名空间 cblocal_<store>。
 */
window.LDB = (function () {
  const DB_NAME = "cb_local";
  const DB_VER = 1;
  const STORES = ["todos", "tags", "knowledge", "contacts", "pricing", "meta"];
  const LS_PREFIX = "cblocal_";

  let dbp = null;         // Promise<IDBDatabase>
  let useFallback = false;

  function openDB() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") { reject(new Error("no-idb")); return; }
      let req;
      try { req = indexedDB.open(DB_NAME, DB_VER); } catch (e) { reject(e); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        STORES.forEach((s) => {
          if (!db.objectStoreNames.contains(s)) {
            db.createObjectStore(s, { keyPath: s === "meta" ? "key" : "id" });
          }
        });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("idb-open-fail"));
      req.onblocked = () => reject(new Error("idb-blocked"));
    }).catch((e) => { useFallback = true; throw e; });
    return dbp;
  }

  // ---- localStorage 回退实现（接口与 IndexedDB 版一致）----
  function lsRead(store) { try { return JSON.parse(localStorage.getItem(LS_PREFIX + store) || "[]"); } catch { return []; } }
  function lsWrite(store, arr) { localStorage.setItem(LS_PREFIX + store, JSON.stringify(arr)); }
  function lsKeyOf(store) { return store === "meta" ? "key" : "id"; }

  function tx(store, mode, fn) {
    return openDB().then((db) => new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const os = t.objectStore(store);
      let out;
      try { out = fn(os); } catch (e) { reject(e); return; }
      t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error("tx-abort"));
    }));
  }

  function idbGet(store, id) {
    return tx(store, "readonly", (os) => os.get(id));
  }
  function idbAll(store) {
    return tx(store, "readonly", (os) => os.getAll());
  }
  function idbPut(store, obj) {
    return tx(store, "readwrite", (os) => { os.put(obj); return obj; });
  }
  function idbBulkPut(store, arr) {
    return tx(store, "readwrite", (os) => { (arr || []).forEach((o) => os.put(o)); return (arr || []).length; });
  }
  function idbDel(store, id) {
    return tx(store, "readwrite", (os) => { os.delete(id); return true; });
  }
  function idbClear(store) {
    return tx(store, "readwrite", (os) => { os.clear(); return true; });
  }

  // ---- 公共 API：先试 IndexedDB，失败则回退 localStorage ----
  function get(store, id) {
    return idbGet(store, id).catch(() => {
      const k = lsKeyOf(store);
      return lsRead(store).find((x) => x && x[k] === id) || undefined;
    });
  }
  function all(store) {
    return idbAll(store).catch(() => lsRead(store));
  }
  function put(store, obj) {
    return idbPut(store, obj).catch(() => {
      const k = lsKeyOf(store);
      const arr = lsRead(store);
      const i = arr.findIndex((x) => x && x[k] === obj[k]);
      if (i >= 0) arr[i] = obj; else arr.push(obj);
      lsWrite(store, arr);
      return obj;
    });
  }
  function bulkPut(store, arr) {
    return idbBulkPut(store, arr).catch(() => {
      const k = lsKeyOf(store);
      const cur = lsRead(store);
      const map = new Map(cur.map((x) => [x[k], x]));
      (arr || []).forEach((o) => map.set(o[k], o));
      lsWrite(store, [...map.values()]);
      return (arr || []).length;
    });
  }
  function del(store, id) {
    return idbDel(store, id).catch(() => {
      const k = lsKeyOf(store);
      lsWrite(store, lsRead(store).filter((x) => !x || x[k] !== id));
      return true;
    });
  }
  function clear(store) {
    return idbClear(store).catch(() => { lsWrite(store, []); return true; });
  }

  // ---- meta 便捷方法（键值对）----
  function getMeta(key) {
    return get("meta", key).then((r) => (r ? r.value : undefined));
  }
  function setMeta(key, value) {
    return put("meta", { key, value });
  }

  // ---- 导出 / 导入 ----
  const DATA_STORES = ["todos", "tags", "knowledge", "contacts", "pricing"];
  async function exportAll() {
    const out = { app: "跨境百宝囊", version: 1, exportedAt: new Date().toISOString() };
    for (const s of DATA_STORES) out[s] = await all(s);
    return out;
  }
  // opts: { merge: true|false }
  async function importAll(payload, opts) {
    const merge = !opts || opts.merge !== false;
    const result = {};
    for (const s of DATA_STORES) {
      const arr = Array.isArray(payload && payload[s]) ? payload[s] : [];
      if (!merge) await clear(s);
      if (arr.length) await bulkPut(s, arr.map((r) => Object.assign({}, r)));
      result[s] = arr.length;
    }
    await setMeta("last_import", new Date().toISOString());
    return result;
  }
  function countSummary(payload) {
    const out = {};
    for (const s of DATA_STORES) out[s] = Array.isArray(payload && payload[s]) ? payload[s].length : 0;
    return out;
  }

  async function isReady() {
    try { await openDB(); return true; } catch { return useFallback ? "fallback" : false; }
  }

  return {
    get, all, put, bulkPut, del, clear,
    getMeta, setMeta,
    exportAll, importAll, countSummary, isReady,
    stores: STORES, dataStores: DATA_STORES,
    get usingFallback() { return useFallback; }
  };
})();

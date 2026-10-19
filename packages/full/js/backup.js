/* ===== 本地自动备份引擎 window.Backup =====
 * 使用 File System Access API：用户授权一个本地文件夹后，
 * 定时（或数据变更 debounce）把 LDB.exportAll() 写入 <folder>/cb-backup.json。
 * 不支持该 API 时自动降级为「仅手动导出」。
 */
window.Backup = (function () {
  const HANDLE_KEY = "backup_dir_handle";
  const CFG_KEY = "backup_cfg";        // { auto:bool, interval:minutes }
  const FILE_NAME = "cb-backup.json";
  const metaName = "cb-backup-meta.json"; // 附带元信息（时间/条数）

  let dirHandle = null;
  let timer = null;
  let debounceTimer = null;

  function supported() {
    return typeof window.showDirectoryPicker === "function";
  }

  async function loadCfg() {
    return (await LDB.getMeta(CFG_KEY)) || { auto: false, interval: 15 };
  }
  async function saveCfg(cfg) { return LDB.setMeta(CFG_KEY, cfg); }

  async function loadHandle() {
    if (dirHandle) return dirHandle;
    try {
      const h = await LDB.getMeta(HANDLE_KEY);
      if (h && h.handle) dirHandle = h.handle;
    } catch (e) { dirHandle = null; }
    return dirHandle;
  }

  async function pickFolder() {
    if (!supported()) { U.toast(I18N.t("datamgr.fsUnsupported")); return false; }
    try {
      const h = await window.showDirectoryPicker({ mode: "readwrite", id: "cb-backup" });
      // 请求写权限
      if (h.requestPermission) await h.requestPermission({ mode: "readwrite" });
      dirHandle = h;
      await LDB.setMeta(HANDLE_KEY, { handle: h });
      return true;
    } catch (e) { return false; }
  }

  async function ensurePermission() {
    const h = await loadHandle();
    if (!h) return null;
    try {
      let perm = "prompt";
      if (h.queryPermission) perm = await h.queryPermission({ mode: "readwrite" });
      if (perm === "granted") return h;
      if (h.requestPermission) perm = await h.requestPermission({ mode: "readwrite" });
      return perm === "granted" ? h : null;
    } catch (e) { return null; }
  }

  async function writeBackup() {
    const h = await ensurePermission();
    if (!h) { return { ok: false, reason: "no-permission" }; }
    try {
      const data = await LDB.exportAll();
      const f = await h.getFileHandle(FILE_NAME, { create: true });
      const w = await f.createWritable();
      await w.write(JSON.stringify(data, null, 2));
      await w.close();

      const meta = { at: new Date().toISOString(), counts: LDB.countSummary(data) };
      const mf = await h.getFileHandle(metaName, { create: true });
      const mw = await mf.createWritable();
      await mw.write(JSON.stringify(meta, null, 2));
      await mw.close();

      await LDB.setMeta("last_backup", meta);
      return { ok: true, at: meta.at };
    } catch (e) {
      return { ok: false, reason: String(e && e.message || e) };
    }
  }

  async function startTimer() {
    stopTimer();
    const cfg = await loadCfg();
    if (!cfg.auto) return;
    const ms = Math.max(1, +cfg.interval || 15) * 60 * 1000;
    timer = setInterval(() => { writeBackup(); }, ms);
  }
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

  // 数据变更后触发（debounce 2s），仅在开启自动备份且有授权文件夹时写
  async function notifyChange() {
    const cfg = await loadCfg();
    if (!cfg.auto) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const h = await ensurePermission();
      if (h) writeBackup();
    }, 2000);
  }

  async function enable(auto, interval) {
    const cfg = await loadCfg();
    cfg.auto = !!auto;
    if (interval != null) cfg.interval = +interval;
    await saveCfg(cfg);
    if (cfg.auto) await startTimer(); else stopTimer();
    return cfg;
  }

  async function lastBackup() { return await LDB.getMeta("last_backup"); }
  async function folderName() {
    const h = await loadHandle();
    return h ? (h.name || "已授权文件夹") : null;
  }

  return {
    supported, pickFolder, writeBackup, notifyChange,
    enable, startTimer, stopTimer, loadCfg, lastBackup, folderName, loadHandle
  };
})();

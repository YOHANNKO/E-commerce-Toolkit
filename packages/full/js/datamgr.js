/* ===== 数据管理视图 window.DataMgr =====
 * 概览 / 导出 / 导入 / 自动备份到本地文件夹 / 从云端同步 / 清空本地数据
 */
window.DataMgr = (function () {
  let lastImportCounts = null;

  // 「标签：值」分隔符随语言变化（中文全角冒号 / 英文半角冒号+空格）
  const SEP = () => I18N.t("common.labelSep");

  function el() { return document.getElementById("view-datamgr"); }

  function fmtTime(iso) {
    if (!iso) return I18N.t("datamgr.never");
    try {
      return new Date(iso).toLocaleString(I18N.getLang() === "zh" ? "zh-CN" : "en-US",
        { year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch (e) { return iso; }
  }

  function dl(name, text) {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
  }

  function stamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
  }

  async function counts() {
    const out = {};
    for (const s of LDB.dataStores) out[s] = (await LDB.all(s)).length;
    return out;
  }

  async function render() {
    const v = el(); if (!v) return;
    const c = await counts();
    const cfg = await Backup.loadCfg();
    const folder = await Backup.folderName();
    const last = await Backup.lastBackup();
    const mig = await LDB.getMeta("migrated_from_cloud");
    const modeLabel = DS.isLocal() ? I18N.t("datamgr.modeLocal") : I18N.t("datamgr.modeCloud");
    const engine = LDB.usingFallback ? I18N.t("datamgr.engineFallback") : "IndexedDB";

    const stat = (label, n) => `
      <div class="dm-stat">
        <div class="dm-stat-num">${n}</div>
        <div class="dm-stat-label">${label}</div>
      </div>`;

    const intervals = [5, 15, 30, 60].map((m) =>
      `<option value="${m}" ${+cfg.interval === m ? "selected" : ""}>${m} min</option>`).join("");

    v.innerHTML = `
      <div class="page-head"><h1>${I18N.t("datamgr.title")}</h1><p>${I18N.t("datamgr.sub")}</p></div>

      <div class="card" style="margin-bottom:16px">
        <div class="card-title">${I18N.t("datamgr.overview")}</div>
        <div class="dm-badges">
          <span class="dm-badge ${DS.isLocal() ? "local" : "cloud"}">${I18N.t("datamgr.mode")}${SEP()}${modeLabel}</span>
          <span class="dm-badge">${I18N.t("datamgr.storage")}${SEP()}${engine}</span>
          <span class="dm-badge ${mig ? "" : "muted"}">${I18N.t("migrate.title")}${SEP()}${mig ? fmtTime(mig.at) : I18N.t("migrate.never")}</span>
        </div>
        <div class="dm-stats">
          ${stat(I18N.t("datamgr.countPricing"), c.pricing || 0)}
          ${stat(I18N.t("datamgr.countTodos"), c.todos || 0)}
          ${stat(I18N.t("datamgr.countTags"), c.tags || 0)}
          ${stat(I18N.t("datamgr.countKnowledge"), c.knowledge || 0)}
          ${stat(I18N.t("datamgr.countContacts"), c.contacts || 0)}
        </div>
      </div>

      <div class="dm-grid">
        <div class="card">
          <div class="card-title">${I18N.t("datamgr.exportImport")}</div>
          <div class="dm-actions">
            <button class="btn block" id="dmExport">⬇️ ${I18N.t("datamgr.export")}</button>
            <div class="hint">${I18N.t("datamgr.exportHint")}</div>
            <hr class="dm-hr">
            <button class="btn ghost block" id="dmImportBtn">⬆️ ${I18N.t("datamgr.import")}</button>
            <div class="hint">${I18N.t("datamgr.importHint")}</div>
            <input type="file" id="dmFile" accept="application/json,.json" style="display:none">
            <div id="dmImportBox" style="display:none">
              <div class="dm-preview" id="dmPreview"></div>
              <div class="dm-radio">
                <label><input type="radio" name="dmMode" value="merge" checked> ${I18N.t("datamgr.importMerge")}</label>
                <label><input type="radio" name="dmMode" value="overwrite"> ${I18N.t("datamgr.importOverwrite")}</label>
              </div>
              <button class="btn primary block" id="dmImportGo">${I18N.t("datamgr.import")}</button>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">${I18N.t("datamgr.autoBackup")}</div>
          <div class="dm-actions">
            <div class="dm-row">
              <span class="dm-row-label">${I18N.t("datamgr.folder")}</span>
              <span class="dm-folder ${folder ? "ok" : "muted"}">${folder ? "📁 " + U.esc(folder) : I18N.t("datamgr.noFolder")}</span>
            </div>
            <button class="btn block" id="dmPickFolder" ${Backup.supported() ? "" : "disabled"}>📂 ${I18N.t("datamgr.pickFolder")}</button>
            <div class="hint">${I18N.t("datamgr.fsNote")}</div>
            <hr class="dm-hr">
            <div class="dm-row">
              <label class="switch"><input type="checkbox" id="dmAuto" ${cfg.auto ? "checked" : ""} ${folder ? "" : "disabled"}><span class="track"></span></label>
              <span>${I18N.t("datamgr.autoOn")}</span>
              <select id="dmInterval" class="dm-select">${intervals}</select>
            </div>
            <button class="btn ghost block" id="dmBackupNow" ${folder ? "" : "disabled"}>💾 ${I18N.t("datamgr.backupNow")}</button>
            <div class="dm-row">
              <span class="dm-row-label">${I18N.t("datamgr.lastBackup")}</span>
              <span class="dm-folder ${last ? "ok" : "muted"}">${last ? fmtTime(last.at) : I18N.t("datamgr.never")}</span>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">${I18N.t("migrate.title")}</div>
          <div class="dm-actions">
            <div class="hint">${I18N.t("datamgr.syncHint")}</div>
            <button class="btn block" id="dmSync" ${window.SB_OFFLINE ? "disabled" : ""}>☁️ ${I18N.t("datamgr.syncCloud")}</button>
            <div class="dm-row">
              <span class="dm-row-label">${I18N.t("datamgr.migratedAt")}</span>
              <span class="dm-folder ${mig ? "ok" : "muted"}">${mig ? fmtTime(mig.at) : I18N.t("migrate.never")}</span>
            </div>
            <hr class="dm-hr">
            <button class="btn ghost block dm-danger" id="dmReset">🗑 ${I18N.t("datamgr.reset")}</button>
          </div>
        </div>
      </div>
    `;

    bind(v, cfg);
  }

  function bind(v, cfg) {
    // 导出
    v.querySelector("#dmExport").onclick = async () => {
      const data = await LDB.exportAll();
      dl(`cb-backup-${stamp()}.json`, JSON.stringify(data, null, 2));
      U.toast("✓ " + I18N.t("datamgr.export"));
    };

    // 导入：选文件 → 预览
    const file = v.querySelector("#dmFile");
    v.querySelector("#dmImportBtn").onclick = () => file.click();
    file.onchange = async () => {
      const f = file.files && file.files[0];
      if (!f) return;
      let payload;
      try { payload = JSON.parse(await f.text()); } catch (e) { U.toast(I18N.t("datamgr.fileBad")); return; }
      const cs = LDB.countSummary(payload);
      const total = Object.values(cs).reduce((a, b) => a + b, 0);
      if (!total) { U.toast(I18N.t("datamgr.importEmpty")); return; }
      lastImportCounts = payload;
      const box = v.querySelector("#dmImportBox");
      box.style.display = "";
      const LABEL = { pricing: "countPricing", todos: "countTodos", tags: "countTags", knowledge: "countKnowledge", contacts: "countContacts" };
      v.querySelector("#dmPreview").innerHTML =
        `<b>${U.esc(f.name)}</b><br>` + LDB.dataStores.map((s) =>
          `${I18N.t("datamgr." + LABEL[s])}: ${cs[s]}`).join(" · ");
    };

    // 导入：执行
    const go = v.querySelector("#dmImportGo");
    if (go) go.onclick = async () => {
      if (!lastImportCounts) return;
      const mode = (v.querySelector('input[name="dmMode"]:checked') || {}).value || "merge";
      const r = await LDB.importAll(lastImportCounts, { merge: mode === "merge" });
      U.toast("✓ " + I18N.t("datamgr.importedOk"));
      lastImportCounts = null;
      if (window.App) await App.reloadData();
      render();
    };

    // 选择文件夹
    v.querySelector("#dmPickFolder").onclick = async () => {
      const ok = await Backup.pickFolder();
      if (ok) { U.toast("✓ " + I18N.t("datamgr.folder")); await Backup.startTimer(); render(); }
    };

    // 自动备份开关 / 间隔
    v.querySelector("#dmAuto").onchange = async (e) => {
      await Backup.enable(e.target.checked, null);
      U.toast(e.target.checked ? I18N.t("datamgr.autoOn") + " ✓" : I18N.t("datamgr.autoOn") + " ✕");
    };
    v.querySelector("#dmInterval").onchange = async (e) => {
      await Backup.enable(cfg.auto, +e.target.value);
      U.toast(I18N.t("datamgr.interval") + ": " + e.target.value + " min");
    };

    // 立即备份
    v.querySelector("#dmBackupNow").onclick = async () => {
      const r = await Backup.writeBackup();
      if (r.ok) { U.toast("✓ " + I18N.t("datamgr.backedUp")); render(); }
      else U.toast(I18N.t("datamgr.backupFail") + (r.reason ? SEP() + r.reason : ""));
    };

    // 云端同步
    const sync = v.querySelector("#dmSync");
    if (sync) sync.onclick = async () => {
      if (window.SB_OFFLINE) { U.toast(I18N.t("auth.cloudUnreachable")); return; }
      const uid = window.getUid ? await getUid() : null;
      if (!uid) { U.toast(I18N.t("auth.cloudUnreachable")); return; }
      const r = await Migrate.syncNow();
      if (r && r.ok) { U.toast("✓ " + I18N.t("datamgr.syncOk")); if (window.App) await App.reloadData(); render(); }
    };

    // 清空本地数据
    v.querySelector("#dmReset").onclick = async () => {
      if (!confirm(I18N.t("datamgr.resetConfirm"))) return;
      for (const s of LDB.dataStores) await LDB.clear(s);
      await LDB.setMeta("migrated_from_cloud", null);
      U.toast(I18N.t("datamgr.resetDone"));
      if (window.App) await App.reloadData();
      render();
    };
  }

  async function init() { await render(); }
  async function onShow() { await render(); }
  return { init, onShow };
})();

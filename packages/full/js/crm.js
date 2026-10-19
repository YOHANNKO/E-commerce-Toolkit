/* ===== CRM / Pricing & Contacts (contacts via DS + local pricing records in LDB) ===== */
window.CRM = (function () {
  const PALETTE = ["#2f6df6", "#14b8a6", "#f59e0b", "#8b5cf6", "#ef4444", "#0ea5e9", "#ec4899", "#22c55e"];
  let list = [];                                // 客户档案（DS：本地/云端）
  let pRecords = [];                            // 定价记录（IndexedDB）
  let filter = "";
  let folder = "all";
  let tab = "pricing";                          // pricing | contacts

  /* ---------- 客户档案（DS） ---------- */
  function types() {
    return { supplier: I18N.t("crm.typeSupplier"), customer: I18N.t("crm.typeCustomer"), platform: I18N.t("crm.typePlatform"), other: I18N.t("crm.typeOther") };
  }

  async function load() {
    list = await DS.list("contacts");
  }

  function stripRow(c) {
    return {
      name: c.name || "",
      type: c.type || "other",
      role: c.role || "",
      color: c.color || PALETTE[0],
      fields: Array.isArray(c.fields) ? c.fields : (c.fields ? [c.fields] : []),
      tags: Array.isArray(c.tags) ? c.tags : [],
      shared_from: c.shared_from || null,
      shared_from_name: c.shared_from_name || null
    };
  }

  async function persist(c) {
    if (c.id) {
      const upd = stripRow(c);
      const res = await DS.update("contacts", c.id, upd);
      if (!res) return false;
      const i = list.findIndex((x) => x.id === c.id);
      if (i >= 0) list[i] = Object.assign({}, list[i], upd);
    } else {
      const row = stripRow(c);
      const data = await DS.insert("contacts", row);
      if (!data) return false;
      list.unshift(data);
    }
    return true;
  }

  async function remove(id) {
    const ok = await DS.remove("contacts", id);
    if (!ok) return;
    list = list.filter((x) => x.id !== id);
  }

  // 类型选项（用于可视化选择器）
  const TYPE_META = () => ([
    { id: "supplier", icon: "🏭" },
    { id: "customer", icon: "🛒" },
    { id: "platform", icon: "🌐" },
    { id: "other", icon: "📌" },
  ]);

  function openEditor(contact) {
    const isEdit = !!contact;
    const c = contact || { id: null, name: "", type: "supplier", role: "", color: PALETTE[list.length % PALETTE.length], fields: [], tags: [] };
    if (!c.tags) c.tags = [];
    let fields = (c.fields || []).map((f) => Object.assign({}, f));
    let tags = (c.tags || []).slice();     // 标签用 chip 管理，不再用逗号串
    let type = c.type || "supplier";
    let color = c.color || PALETTE[0];

    const initials = () => (m.querySelector("#cName").value.trim() || "?").slice(0, 2).toUpperCase();
    const syncAvatar = () => {
      const av = m.querySelector("#cAvatar");
      if (av) { av.textContent = initials(); av.style.background = color; }
    };

    const fieldHtml = () => fields.length
      ? fields.map((f, i) =>
        `<div class="crm-field-row" data-fi="${i}">
           <span class="cfr-ico">•</span>
           <input type="text" class="fk" value="${U.esc(f.k)}" placeholder="${I18N.t("crm.fieldName")}">
           <input type="text" class="fv" value="${U.esc(f.v)}" placeholder="${I18N.t("crm.fieldValue")}">
           <button type="button" class="cfr-del fdel" title="${I18N.t("common.del")}">✕</button>
         </div>`).join("")
      : `<div class="crm-fields-empty">${I18N.t("crm.noFields")}</div>`;

    const tagHtml = () => tags.length
      ? tags.map((t, i) => `<span class="crm-tag-chip" data-ti="${i}">${U.esc(t)}<button type="button" class="ctc-x" data-tdel="${i}">×</button></span>`).join("")
      : `<span class="crm-tags-empty">${I18N.t("crm.noTags")}</span>`;

    const typeHtml = () => TYPE_META().map((t) =>
      `<button type="button" class="crm-type-btn ${type === t.id ? "active" : ""}" data-type="${t.id}">
         <span class="ctb-ico">${t.icon}</span><span class="ctb-txt">${I18N.t("crm.type" + t.id.charAt(0).toUpperCase() + t.id.slice(1))}</span>
       </button>`).join("");

    const paletteHtml = () => PALETTE.map((p) =>
      `<button type="button" class="crm-sw ${color === p ? "on" : ""}" data-color="${p}" style="background:${p}" title="${p}"></button>`).join("");

    const m = U.modal(`
      <div class="m-head">
        <span class="m-ico">${isEdit ? "✏️" : "👤"}</span>
        <h3>${isEdit ? I18N.t("common.edit") : I18N.t("crm.add")}</h3>
        <button class="m-x" id="cX" title="${I18N.t("common.close")}">×</button>
      </div>

      <div class="crm-editor">
        <div class="crm-ed-top">
          <div class="crm-avatar" id="cAvatar" style="background:${color}">${U.esc((c.name || "?").slice(0, 2).toUpperCase())}</div>
          <div class="crm-ed-topmain">
            <label class="field crm-nm"><span>${I18N.t("crm.name")}</span>
              <input type="text" id="cName" value="${U.esc(c.name)}" placeholder="${U.esc(I18N.t("crm.namePH"))}"></label>
            <label class="field crm-rl"><span>${I18N.t("crm.role")}</span>
              <input type="text" id="cRole" value="${U.esc(c.role)}" placeholder="${U.esc(I18N.t("crm.rolePH"))}"></label>
          </div>
        </div>

        <div class="sec-title">${I18N.t("crm.type")}</div>
        <div class="crm-type-grid" id="cTypeGrid">${typeHtml()}</div>

        <div class="sec-title">${I18N.t("crm.color")}</div>
        <div class="crm-palette" id="cPalette">${paletteHtml()}</div>

        <div class="sec-title">${I18N.t("crm.tags")}</div>
        <div class="crm-tagbox" id="cTagBox">
          <div class="crm-tag-list" id="cTagList">${tagHtml()}</div>
          <div class="crm-tag-add">
            <input type="text" id="cTagInput" placeholder="${I18N.t("crm.tagsPH")}" maxlength="20">
            <button type="button" class="btn ghost sm" id="cTagAdd">＋</button>
          </div>
        </div>

        <div class="sec-title crm-fields-head">
          <span>${I18N.t("crm.fields")}</span>
          <button type="button" class="btn ghost sm" id="cAddField">＋ ${I18N.t("crm.addField")}</button>
        </div>
        <div id="cFields" class="crm-fields">${fieldHtml()}</div>
      </div>

      <div class="actions">
        <button class="btn ghost" id="cCancel">${I18N.t("common.cancel")}</button>
        <button class="btn" id="cSave">${I18N.t("common.save")}</button>
      </div>
    `, { noClose: true, wide: true });

    /* —— 姓名 / 首字母头像 —— */
    m.querySelector("#cName").oninput = syncAvatar;

    /* —— 类型选择 —— */
    m.querySelectorAll("#cTypeGrid .crm-type-btn").forEach((b) => b.onclick = () => {
      type = b.dataset.type;
      m.querySelectorAll("#cTypeGrid .crm-type-btn").forEach((x) => x.classList.toggle("active", x.dataset.type === type));
    });

    /* —— 颜色选择 —— */
    m.querySelectorAll("#cPalette .crm-sw").forEach((b) => b.onclick = () => {
      color = b.dataset.color;
      m.querySelectorAll("#cPalette .crm-sw").forEach((x) => x.classList.toggle("on", x.dataset.color === color));
      syncAvatar();
    });

    /* —— 标签 chips —— */
    const refreshTags = () => {
      m.querySelector("#cTagList").innerHTML = tagHtml();
      bindTagDel();
    };
    function bindTagDel() {
      m.querySelectorAll("#cTagList .ctc-x").forEach((b) => b.onclick = () => {
        tags.splice(+b.dataset.tdel, 1); refreshTags();
      });
    }
    const addTag = () => {
      const inp = m.querySelector("#cTagInput");
      const v = inp.value.trim().replace(/[,，]/g, "");
      if (!v) return;
      if (!tags.includes(v)) tags.push(v);
      inp.value = ""; refreshTags(); inp.focus();
    };
    m.querySelector("#cTagAdd").onclick = addTag;
    m.querySelector("#cTagInput").onkeydown = (e) => {
      if (e.key === "Enter" || e.key === "," || e.key === "，") { e.preventDefault(); addTag(); }
    };
    bindTagDel();

    /* —— 自定义字段 —— */
    const refresh = () => { m.querySelector("#cFields").innerHTML = fieldHtml(); bindFields(); };
    function bindFields() {
      m.querySelectorAll("#cFields .crm-field-row").forEach((row) => {
        const i = +row.dataset.fi;
        row.querySelector(".fk").oninput = (e) => fields[i].k = e.target.value;
        row.querySelector(".fv").oninput = (e) => fields[i].v = e.target.value;
        row.querySelector(".fdel").onclick = () => { fields.splice(i, 1); refresh(); };
      });
    }
    bindFields();
    m.querySelector("#cAddField").onclick = () => { fields.push({ k: "", v: "" }); refresh(); };

    m.querySelector("#cX").onclick = m.closeModal;
    m.querySelector("#cCancel").onclick = m.closeModal;
    m.querySelector("#cSave").onclick = async () => {
      c.name = m.querySelector("#cName").value.trim();
      c.type = type;
      c.role = m.querySelector("#cRole").value.trim();
      c.color = color;
      c.tags = tags.slice();
      c.fields = fields.filter((f) => (f.k || "").trim() || (f.v || "").trim());
      if (!c.name) { U.toast(I18N.t("crm.name")); return; }
      const ok = await persist(c);
      if (ok) { m.closeModal(); renderContacts(); }
    };
  }

  function copyCard(c) {
    let txt = c.name + "\n" + (types()[c.type] || c.type) + (c.role ? " · " + c.role : "");
    (c.fields || []).forEach((f) => txt += "\n" + (f.k || I18N.t("common.note")) + ": " + f.v);
    U.copy(txt);
  }

  function renderContacts() {
    const el = document.getElementById("crmBody");
    if (!el) return;
    const T = types();
    const allTags = [];
    list.forEach((c) => (c.tags || []).forEach((t) => { if (!allTags.includes(t)) allTags.push(t); }));
    const cntOf = (id) => list.filter((c) => (c.tags || []).includes(id)).length;
    const untaggedN = list.filter((c) => !(c.tags || []).length).length;
    const folders = [{ id: "all", name: I18N.t("todo.all"), n: list.length, color: "var(--text-mute)", icon: "👥" }]
      .concat(allTags.map((t) => ({ id: t, name: t, n: cntOf(t), color: "var(--text-mute)", icon: "🏷" })))
      .concat(untaggedN ? [{ id: "none", name: I18N.t("crm.untagged"), n: untaggedN, color: "var(--text-mute)", icon: "❔" }] : []);

    const shown = list.filter((c) => {
      if (filter && !(c.name + (c.role || "") + (T[c.type] || c.type) + (c.tags || []).join(" ")).toLowerCase().includes(filter.toLowerCase())) return false;
      if (folder === "all") return true;
      if (folder === "none") return !(c.tags || []).length;
      return (c.tags || []).includes(folder);
    });

    // 类型统计
    const typeCount = {};
    list.forEach((c) => { typeCount[c.type] = (typeCount[c.type] || 0) + 1; });

    // 卡片只依赖 filter/folder/list，抽成独立函数，输入时只重画这一段
    const cardHtml = () => shown.map((c) => {
      const initials = (c.name || "?").trim().slice(0, 2).toUpperCase();
      const shared = c.shared_from_name ? `<span class="shared-badge" title="${I18N.t("share.from")} ${U.esc(c.shared_from_name)}">↘ ${U.esc(c.shared_from_name)}</span>` : "";
      const tagHtml = (c.tags || []).map((t) => `<span class="mini-tag">${U.esc(t)}</span>`).join("");
      const fields = (c.fields || []).map((f) =>
        `<div class="field-line">
           <span class="lbl">${U.esc(f.k || I18N.t("common.note"))}</span>
           <span class="fld-v">${U.esc(f.v)}</span>
           <button class="copy-btn" data-copy="${U.esc(f.v)}" title="${I18N.t("common.copy")}">⧉</button>
         </div>`).join("");
      return `<div class="contact-card hoverable">
        <div class="cc-top">
          <div class="avatar" style="background:${c.color || PALETTE[0]}">${U.esc(initials)}</div>
          <div class="cc-id">
            <div class="name">${U.esc(c.name)} ${shared}</div>
            <div class="role"><span class="badge2 user">${U.esc(T[c.type] || c.type)}</span>${c.role ? `<span class="cc-role-tx">${U.esc(c.role)}</span>` : ""}</div>
          </div>
        </div>
        ${tagHtml ? `<div class="tag-row">${tagHtml}</div>` : ""}
        <div class="fields">${fields || `<div class="muted cc-none">–</div>`}</div>
        <div class="acts">
          <button class="copy-btn" data-card="${c.id}" title="${U.esc(I18N.t("crm.copyCard"))}">📋 ${I18N.t("common.copy")}</button>
          <span class="sp"></span>
          <button class="copy-btn icon-only" data-edit="${c.id}" title="${U.esc(I18N.t("common.edit"))}">✏️</button>
          <button class="copy-btn icon-only" data-share="${c.id}" title="${U.esc(I18N.t("common.share"))}">🔗</button>
          <button class="copy-btn icon-only danger" data-del="${c.id}" title="${U.esc(I18N.t("common.delete"))}">🗑</button>
        </div>
      </div>`;
    }).join("");

    el.innerHTML = `
      <div class="crm-toolbar">
        <label class="crm-search">
          <span class="cs-ico">🔍</span>
          <input type="text" id="crmSearch" value="${U.esc(filter)}" placeholder="${I18N.t("crm.search")}">
          <button type="button" class="cs-clear" id="crmSearchClear" title="${U.esc(I18N.t("common.clear"))}" ${filter ? "" : "hidden"}>✕</button>
        </label>
        <div class="crm-actions">
          <button class="btn ghost" id="crmShareAll">🔗 ${I18N.t("crm.shareAll")}</button>
          <button class="btn" id="crmAdd">＋ ${I18N.t("crm.add")}</button>
        </div>
      </div>

      <div class="stats" style="margin-bottom:16px">
        <div class="stat"><div class="k">${I18N.t("crm.statTotal")}</div><div class="v">${list.length}</div></div>
        <div class="stat"><div class="k">${I18N.t("crm.typeSupplier")}</div><div class="v">${typeCount.supplier || 0}</div></div>
        <div class="stat"><div class="k">${I18N.t("crm.typeCustomer")}</div><div class="v">${typeCount.customer || 0}</div></div>
        <div class="stat"><div class="k">${I18N.t("crm.typePlatform")}</div><div class="v">${typeCount.platform || 0}</div></div>
        <div class="stat"><div class="k">${I18N.t("crm.statTags")}</div><div class="v">${allTags.length}</div></div>
      </div>

      <div class="crm-filterbar">
        <div class="chips" style="flex:1">${folders.map((f) =>
          `<button class="chip ${folder === f.id ? "active" : ""}" data-folder="${U.esc(f.id)}">
             <span>${f.icon}</span>${U.esc(f.name)}<span class="n">${f.n}</span>
           </button>`).join("")}</div>
      </div>

      <div class="crm-grid" id="crmGrid"></div>
    `;

    // 只重画卡片列表（输入搜索词时调用，输入框节点因此得以保留 → 焦点不丢）
    function paintList() {
      const grid = el.querySelector("#crmGrid");
      if (!grid) return;
      const T2 = types();
      const shownNow = list.filter((c) => {
        if (filter && !(c.name + (c.role || "") + (T2[c.type] || c.type) + (c.tags || []).join(" ")).toLowerCase().includes(filter.toLowerCase())) return false;
        if (folder === "all") return true;
        if (folder === "none") return !(c.tags || []).length;
        return (c.tags || []).includes(folder);
      });
      // 用当前 shown 重新生成（cardHtml 闭包引用的是旧的 shown，这里按需重算）
      const html = shownNow.map((c) => {
        const initials = (c.name || "?").trim().slice(0, 2).toUpperCase();
        const shared = c.shared_from_name ? `<span class="shared-badge" title="${I18N.t("share.from")} ${U.esc(c.shared_from_name)}">↘ ${U.esc(c.shared_from_name)}</span>` : "";
        const tagH = (c.tags || []).map((t) => `<span class="mini-tag">${U.esc(t)}</span>`).join("");
        const flds = (c.fields || []).map((f) =>
          `<div class="field-line">
             <span class="lbl">${U.esc(f.k || I18N.t("common.note"))}</span>
             <span class="fld-v">${U.esc(f.v)}</span>
             <button class="copy-btn" data-copy="${U.esc(f.v)}" title="${I18N.t("common.copy")}">⧉</button>
           </div>`).join("");
        return `<div class="contact-card hoverable">
          <div class="cc-top">
            <div class="avatar" style="background:${c.color || PALETTE[0]}">${U.esc(initials)}</div>
            <div class="cc-id">
              <div class="name">${U.esc(c.name)} ${shared}</div>
              <div class="role"><span class="badge2 user">${U.esc(T2[c.type] || c.type)}</span>${c.role ? `<span class="cc-role-tx">${U.esc(c.role)}</span>` : ""}</div>
            </div>
          </div>
          ${tagH ? `<div class="tag-row">${tagH}</div>` : ""}
          <div class="fields">${flds || `<div class="muted cc-none">–</div>`}</div>
          <div class="acts">
            <button class="copy-btn" data-card="${c.id}" title="${U.esc(I18N.t("crm.copyCard"))}">📋 ${I18N.t("common.copy")}</button>
            <span class="sp"></span>
            <button class="copy-btn icon-only" data-edit="${c.id}" title="${U.esc(I18N.t("common.edit"))}">✏️</button>
            <button class="copy-btn icon-only" data-share="${c.id}" title="${U.esc(I18N.t("common.share"))}">🔗</button>
            <button class="copy-btn icon-only danger" data-del="${c.id}" title="${U.esc(I18N.t("common.delete"))}">🗑</button>
          </div>
        </div>`;
      }).join("");
      grid.innerHTML = html || `<div class="empty2" style="grid-column:1/-1"><span class="ico">👥</span><span class="t">${filter || folder !== "all" ? I18N.t("crm.noMatch") : I18N.t("crm.empty")}</span><span class="s">${I18N.t("crm.emptyHint")}</span></div>`;
      // 重新绑定卡片内的按钮（列表被换掉了）
      grid.querySelectorAll("[data-card]").forEach((b) => b.onclick = () => copyCard(list.find((x) => x.id === b.dataset.card)));
      grid.querySelectorAll("[data-edit]").forEach((b) => b.onclick = () => openEditor(list.find((x) => x.id === b.dataset.edit)));
      grid.querySelectorAll("[data-share]").forEach((b) => b.onclick = () => window.Collab.share("crm", b.dataset.share));
      grid.querySelectorAll("[data-del]").forEach((b) => b.onclick = async () => { if (confirm(I18N.t("common.confirmDel"))) { await remove(b.dataset.del); renderContacts(); } });
      grid.querySelectorAll("[data-copy]").forEach((b) => b.onclick = (e) => { e.stopPropagation(); U.copy(b.dataset.copy); });
      // 清空按钮的显隐跟随是否有搜索词
      const clr = el.querySelector("#crmSearchClear");
      if (clr) clr.hidden = !filter;
    }
    paintList();

    el.querySelector("#crmSearch").oninput = (e) => {
      filter = e.target.value;
      // 关键：只重渲染卡片列表 + 计数，不重建整个 crmBody。
      // 之前每次输入都调 renderContacts() 重建 DOM，输入框节点被替换 → 焦点丢失 → 只能一个字一个字地打。
      paintList();
    };
    // 一键清空搜索
    const clr = el.querySelector("#crmSearchClear");
    if (clr) clr.onclick = () => {
      filter = "";
      const inp = el.querySelector("#crmSearch");
      if (inp) { inp.value = ""; inp.focus(); }
      paintList();
    };
    el.querySelector("#crmAdd").onclick = () => openEditor(null);
    el.querySelector("#crmShareAll").onclick = () => window.Collab.share("crm", null);
    el.querySelectorAll("[data-folder]").forEach((b) => b.onclick = () => { folder = b.dataset.folder; renderContacts(); });
    el.querySelectorAll("[data-card]").forEach((b) => b.onclick = () => copyCard(list.find((x) => x.id === b.dataset.card)));
    el.querySelectorAll("[data-edit]").forEach((b) => b.onclick = () => openEditor(list.find((x) => x.id === b.dataset.edit)));
    el.querySelectorAll("[data-share]").forEach((b) => b.onclick = () => window.Collab.share("crm", b.dataset.share));
    el.querySelectorAll("[data-del]").forEach((b) => b.onclick = async () => { if (confirm(I18N.t("common.confirmDel"))) { await remove(b.dataset.del); renderContacts(); } });
    el.querySelectorAll("[data-copy]").forEach((b) => b.onclick = (e) => { e.stopPropagation(); U.copy(b.dataset.copy); });
  }

  /* ---------- 定价记录（IndexedDB） ---------- */
  async function loadPricingRecords() {
    const arr = await LDB.all("pricing");
    arr.sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
    pRecords = arr;
  }

  // 由定价计算器调用：保存/更新一条定价记录到本地 IndexedDB
  // editId 非空时视为二次编辑：保留原 id，仅刷新字段与更新时间
  async function savePricing(rec, editId) {
    const id = editId || rec.id || U.uid();
    const prev = pRecords.find((x) => x.id === id);
    const full = Object.assign({}, rec, {
      id,
      at: new Date().toISOString(),
      created_at: (prev && prev.created_at) || (rec && rec.created_at) || new Date().toISOString(),
      edited: !!prev,
    });
    delete full.currencies_cache;
    await LDB.put("pricing", full);
    if (prev) {
      const i = pRecords.findIndex((x) => x.id === id);
      if (i >= 0) pRecords[i] = full; else pRecords.unshift(full);
    } else {
      pRecords.unshift(full);
    }
    if (window.Backup) Backup.notifyChange();
    if (tab === "pricing") renderPricingRecords();
    return true;
  }

  // 供计算器回填使用
  function getPricing(id) { return pRecords.find((x) => x.id === id) || null; }

  async function removePricing(id) {
    await LDB.del("pricing", id);
    pRecords = pRecords.filter((x) => x.id !== id);
    if (window.Backup) Backup.notifyChange();
    renderPricingRecords();
  }

  function fmtTime(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleString(I18N.getLang() === "zh" ? "zh-CN" : "en-US",
        { year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch (e) { return iso || ""; }
  }

  // 单条定价记录的完整明细（展开区）
  function pricingDetail(r) {
    const dims = r.dims || {};
    const dimStr = `${dims.L || 0} × ${dims.W || 0} × ${dims.H || 0} cm`;
    const ratio = (n) => (n || 0).toFixed(1) + "%";

    // 成本明细行
    const costRows = (r.costs || []).map((c) => `
      <div class="pd-costrow">
        <span class="pd-dot" style="background:${c.color || "var(--text-mute)"}"></span>
        <span class="pd-costname">${U.esc(c.label)}</span>
        <span class="pd-costpct">${ratio(c.pct)}</span>
        <span class="pd-costamt">${U.money(c.amt || 0, "USD")}</span>
      </div>`).join("");
    const fixedRows = `
      <div class="pd-costrow">
        <span class="pd-dot" style="background:#ef4444"></span>
        <span class="pd-costname">${I18N.t("crm.fShip")}</span>
        <span class="pd-costpct"></span>
        <span class="pd-costamt">${U.money(r.ship || 0, "USD")}</span>
      </div>
      <div class="pd-costrow">
        <span class="pd-dot" style="background:#2f6df6"></span>
        <span class="pd-costname">${I18N.t("crm.fCommissionAmt")}</span>
        <span class="pd-costpct">${ratio(r.price > 0 ? (r.commissionAmt / r.price) * 100 : 0)}</span>
        <span class="pd-costamt">${U.money(r.commissionAmt || 0, "USD")}</span>
      </div>
      <div class="pd-costrow">
        <span class="pd-dot" style="background:#a855f7"></span>
        <span class="pd-costname">${I18N.t("crm.fPurchase")}</span>
        <span class="pd-costpct"></span>
        <span class="pd-costamt">${U.money(r.purchase || 0, "USD")}</span>
      </div>`;

    // 多币种定价
    const curRows = (r.currencies || []).map((c) => `
      <div class="pd-curr">
        <span class="pd-curcode">${U.esc(c.code)}</span>
        <span class="pd-curamt">${U.money(c.price || 0, c.code)}</span>
      </div>`).join("");

    // 期望净收益：百分比 / 固定金额两种模式；label 与 value 分开保存，
    // 避免用全角冒号拼接后再 split —— 英文界面下分隔符不同会解析失败
    const netTargetLabel = r.netMode === "percent" ? I18N.t("crm.fNetPct") : I18N.t("crm.fNetTarget");
    const netTargetValue = r.netMode === "percent" ? `${r.netPct}%` : U.money(r.netProfit || 0, "USD");

    const kv = (k, v) => `<div class="pd-kv"><span class="pd-k">${k}</span><span class="pd-v">${v}</span></div>`;

    return `
      <div class="pd-detail">
        <div class="pd-group">
          <div class="pd-gtitle">📦 ${I18N.t("crm.secProduct")}</div>
          ${kv(I18N.t("crm.colPlatform"), U.esc(r.platform || "-"))}
          ${kv(I18N.t("crm.colClass"), U.esc(r.classification || "-"))}
          ${kv(I18N.t("crm.fDims"), `<b>${dimStr}</b>`)}
          ${kv(I18N.t("crm.fGrossWeight"), `<b>${U.precise(r.gross, 3)}</b>`)}
          ${kv(I18N.t("crm.fVolWeight"), `<b>${U.precise(r.volWeight || 0, 3)}</b>`)}
          ${kv(I18N.t("crm.fChargeWeight"), `<b>${U.precise(r.chargeWeight || 0, 3)}</b>`)}
          ${kv(I18N.t("crm.fCommission"), `<b>${r.commission || 0}%</b>`)}
        </div>

        <div class="pd-group">
          <div class="pd-gtitle">💸 ${I18N.t("crm.secCosts")}</div>
          <div class="pd-costlist">
            ${fixedRows}${costRows || `<div class="pd-empty">–</div>`}
          </div>
          <div class="pd-kv pd-total"><span class="pd-k">${I18N.t("crm.fExtra")}</span><span class="pd-v">${U.money(r.extraCosts || 0, "USD")}</span></div>
        </div>

        <div class="pd-group">
          <div class="pd-gtitle">🏷️ ${I18N.t("crm.secPricing")}</div>
          ${kv(I18N.t("crm.fPrice"), `<span class="pd-price">${U.money(r.price || 0, "USD")}</span>`)}
          ${kv(netTargetLabel, U.esc(netTargetValue))}
          ${kv(I18N.t("crm.fNetProfit"), `<b>${U.money(r.netProfit || 0, "USD")}</b>`)}
          ${kv(I18N.t("crm.fNetGain"), `<span class="pd-gain">${U.money(r.netGain || 0, "USD")}</span>`)}
          ${curRows ? `<div class="pd-gtitle" style="margin-top:10px">💱 ${I18N.t("crm.fCurrencies")}</div><div class="pd-currs">${curRows}</div>` : ""}
        </div>
      </div>`;
  }

  function renderPricingRecords() {
    const el = document.getElementById("crmBody");
    if (!el) return;

    const cards = pRecords.map((r) => {
      const name = r.name || r.platform || I18N.t("pricing.gallery.mercado");
      const dims = r.dims || {};
      const dimTag = (dims.L || dims.W || dims.H) ? `${dims.L}×${dims.W}×${dims.H}cm` : "";
      const subline = [r.platform, r.classification, dimTag, `${U.num(r.gross, 2)}kg`].filter(Boolean).join(" · ");
      return `<div class="pr-card" data-pr-id="${r.id}">
        <div class="pr-sum" data-pr-toggle="${r.id}">
          <button class="pr-caret" aria-hidden="true">▸</button>
          <div class="pr-main">
            <div class="pr-name" title="${U.esc(name)}">${U.esc(name)}</div>
            <div class="pr-sub" title="${U.esc(subline)}">${U.esc(subline || "-")}${r.edited ? `<span class="pr-badge">${I18N.t("crm.edited")}</span>` : ""}</div>
          </div>
          <div class="pr-metrics">
            <div class="pr-metric"><span class="pr-mk">${I18N.t("crm.fPrice")}</span><span class="pr-mv primary">${U.money(r.price || 0, "USD")}</span></div>
            <div class="pr-metric"><span class="pr-mk">${I18N.t("crm.colNet")}</span><span class="pr-mv">${U.money(r.netProfit || 0, "USD")}</span></div>
            <div class="pr-metric"><span class="pr-mk">${I18N.t("crm.colGain")}</span><span class="pr-mv ok">${U.money(r.netGain || 0, "USD")}</span></div>
            <div class="pr-metric time"><span class="pr-mk">${I18N.t("crm.colTime")}</span><span class="pr-mv muted">${fmtTime(r.at)}</span></div>
          </div>
          <div class="pr-acts">
            <button class="copy-btn" data-pr-edit="${r.id}" title="${I18N.t("crm.editRec")}">✏️ ${I18N.t("common.edit")}</button>
            <button class="copy-btn" data-pr-copy="${r.id}" title="${I18N.t("crm.copyAll")}">📋 ${I18N.t("common.copy")}</button>
            <button class="copy-btn icon-only" data-pr-del="${r.id}" title="${I18N.t("common.delete")}">🗑</button>
          </div>
        </div>
        ${pricingDetail(r)}
      </div>`;
    }).join("");

    el.innerHTML = `
      <div class="pr-toolbar">
        <span class="muted">${pRecords.length} ${I18N.t("datamgr.items")}</span>
        <button class="btn ghost sm" id="prToggleAll">${I18N.t("crm.prExpand")}</button>
      </div>
      <div class="pr-cards">${cards || `<div class="pr-empty">${I18N.t("crm.prEmpty")}</div>`}</div>
    `;

    // 单条展开/收起
    el.querySelectorAll("[data-pr-toggle]").forEach((b) => b.onclick = (e) => {
      if (e.target.closest("[data-pr-edit],[data-pr-copy],[data-pr-del]")) return;
      const card = b.closest(".pr-card");
      card.classList.toggle("open");
    });
    // 全部展开/收起
    const ta = el.querySelector("#prToggleAll");
    if (ta) ta.onclick = () => {
      const cards2 = el.querySelectorAll(".pr-card");
      const anyClosed = Array.from(cards2).some((c) => !c.classList.contains("open"));
      cards2.forEach((c) => c.classList.toggle("open", anyClosed));
      ta.textContent = anyClosed ? I18N.t("crm.prCollapse") : I18N.t("crm.prExpand");
    };
    // 二次编辑：回填计算器
    el.querySelectorAll("[data-pr-edit]").forEach((b) => b.onclick = (e) => {
      e.stopPropagation();
      window.Pricing.editById(b.dataset.prEdit);
    });
    // 复制完整信息
    el.querySelectorAll("[data-pr-copy]").forEach((b) => b.onclick = (e) => {
      e.stopPropagation();
      const r = pRecords.find((x) => x.id === b.dataset.prCopy);
      if (r) U.copy(r.summary || r.name || "", I18N.t("crm.copyAll"));
    });
    // 删除
    el.querySelectorAll("[data-pr-del]").forEach((b) => b.onclick = async (e) => {
      e.stopPropagation();
      if (confirm(I18N.t("common.confirmDel"))) await removePricing(b.dataset.prDel);
    });
  }

  /* ---------- 顶层渲染：内部双导航 ---------- */
  function render() {
    const el = document.getElementById("view-crm");
    if (!el) return;
    const nP = pRecords.length, nC = list.length;
    el.innerHTML = `
      <div class="ph">
        <span class="ph-ico">🗂️</span>
        <div class="ph-txt">
          <h1>${I18N.t("crm.title")}</h1>
          <p>${I18N.t("crm.sub")}</p>
        </div>
      </div>
      <div class="seg2" style="margin-bottom:18px">
        <button class="${tab === "pricing" ? "active" : ""}" data-tab="pricing">📊 ${I18N.t("crm.tabPricing")} <span class="cnt">${nP}</span></button>
        <button class="${tab === "contacts" ? "active" : ""}" data-tab="contacts">👥 ${I18N.t("crm.tabContacts")} <span class="cnt">${nC}</span></button>
      </div>
      <div id="crmBody"></div>
    `;
    el.querySelectorAll("[data-tab]").forEach((b) => b.onclick = () => { tab = b.dataset.tab; render(); });
    if (tab === "pricing") renderPricingRecords();
    else renderContacts();
  }

  function showTab(t) { tab = t; render(); }

  async function init() { await Promise.all([load(), loadPricingRecords()]); render(); }
  async function onShow() { await Promise.all([load(), loadPricingRecords()]); render(); }
  return { init, onShow, savePricing, getPricing, showTab };
})();

/* ===== Knowledge Base (Supabase) ===== */
window.KB = (function () {
  const TABLE = "knowledge";
  // 三个知识库（私有 / 官方 / 文案模板）各自独立的标签池：
  // 每个 view 有自己的预设标签，自定义与隐藏标签按 view 分别存储，互不影响。
  // 预设标签是「界面筛选器」，随语言切换；用户自建标签另存于 localStorage，不受影响。
  const PRESET_BY_VIEW = () => ({
    private: [
      I18N.t("seed.tag.mercado"), I18N.t("seed.tag.amazon"), I18N.t("seed.tag.aliexpress"),
      "TikTok Shop", I18N.t("seed.tag.dtc"), I18N.t("seed.tag.logistics"),
      I18N.t("seed.tag.payment"), I18N.t("seed.tag.tax")
    ],
    official: [
      I18N.t("seed.tag.mercado"), I18N.t("seed.tag.amazon"), I18N.t("seed.tag.aliexpress"),
      "TikTok Shop", I18N.t("seed.tag.dtc")
    ],
    templates: [
      I18N.t("seed.tag.productDesc"), I18N.t("seed.tag.csScript"), I18N.t("seed.tag.marketing"),
      I18N.t("seed.tag.aftersales"), I18N.t("seed.tag.inbox")
    ],
  });
  const LS_CUSTOM = "kb_custom_tags_v2";   // { private: [], official: [], templates: [] }
  const LS_HIDDEN = "kb_hidden_tags_v2";   // { private: [], official: [], templates: [] }
  const LS_LEGACY_CUSTOM = "kb_custom_tags"; // v1 全局键，仅用于首次迁移
  const LS_LEGACY_HIDDEN = "kb_hidden_tags";
  let items = [];
  let filter = "all";
  let view = "private"; // 'private' | 'official' | 'templates'

  // ---- 标签池存储（按 view 隔离） ----
  function readBucket(key) {
    try { const o = JSON.parse(localStorage.getItem(key) || "{}"); return o && typeof o === "object" && !Array.isArray(o) ? o : {}; }
    catch { return {}; }
  }
  function writeBucket(key, obj) { localStorage.setItem(key, JSON.stringify(obj)); }

  function getCustomTags(v) {
    v = v || view;
    const all = readBucket(LS_CUSTOM);
    if (Array.isArray(all[v])) return all[v];
    // 首次迁移：旧版全局自定义标签 → 私有库（官方库由 admin 单独维护，不继承）
    if (v === "private") {
      try {
        const legacy = JSON.parse(localStorage.getItem(LS_LEGACY_CUSTOM) || "[]");
        if (Array.isArray(legacy) && legacy.length) { saveCustomTags(legacy, v); return legacy.slice(); }
      } catch { /* 忽略 */ }
    }
    return [];
  }
  function saveCustomTags(a, v) {
    v = v || view;
    const all = readBucket(LS_CUSTOM);
    all[v] = Array.isArray(a) ? a : [];
    writeBucket(LS_CUSTOM, all);
  }
  function getHiddenTags(v) {
    v = v || view;
    const all = readBucket(LS_HIDDEN);
    if (Array.isArray(all[v])) return all[v];
    if (v === "private") {
      try {
        const legacy = JSON.parse(localStorage.getItem(LS_LEGACY_HIDDEN) || "[]");
        if (Array.isArray(legacy) && legacy.length) { saveHiddenTags(legacy, v); return legacy.slice(); }
      } catch { /* 忽略 */ }
    }
    return [];
  }
  function saveHiddenTags(a, v) {
    v = v || view;
    const all = readBucket(LS_HIDDEN);
    all[v] = Array.isArray(a) ? a : [];
    writeBucket(LS_HIDDEN, all);
  }

  // 私有/文案模板视图：所有人可管理标签；官方视图：仅 admin 可管理
  function canManageTags() {
    if (view !== "official") return true;
    return !!(window.Collab && window.Collab.isAdmin && window.Collab.isAdmin());
  }

  function normUrl(u) {
    u = (u || "").trim();
    if (!u) return "";
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    return u;
  }

  async function load() {
    if (view === "official") {
      // 官方库仅在云端模式可见
      if (DS.isLocal()) { items = []; return; }
      items = await DS.cloudQuery((sb) => sb.from(TABLE).select("*").eq("kind", "official").order("created_at", { ascending: false }));
      return;
    }
    items = await DS.list("knowledge", { filter: { kind: view } });
  }

  // 标签池 = 当前视图预设 + 当前视图自定义 + 当前视图条目已用，去掉本视图已隐藏
  function tagPool() {
    const hidden = getHiddenTags(view);
    const preset = PRESET_BY_VIEW()[view] || PRESET_BY_VIEW().private;
    const set = new Set([...preset, ...getCustomTags(view)]);
    items.forEach((x) => (x.platform_tags || []).forEach((t) => set.add(t)));
    return [...set].filter((t) => !hidden.includes(t));
  }

  function stripRow(it) {
    return {
      title: it.title || "",
      url: it.url || "",
      note: it.note || "",
      chinese_text: it.chinese_text || "",
      translations: Array.isArray(it.translations) ? it.translations : [],
      platform_tags: Array.isArray(it.platform_tags) ? it.platform_tags : [],
      kind: it.kind || "private",
      shared_from: it.shared_from || null,
      shared_from_name: it.shared_from_name || null
    };
  }

  async function persist(it) {
    if (it.id) {
      const upd = stripRow(it);
      const res = await DS.update("knowledge", it.id, upd);
      if (!res) return false;
      const i = items.findIndex((x) => x.id === it.id);
      if (i >= 0) items[i] = Object.assign({}, items[i], upd);
    } else {
      const row = stripRow(it);
      const data = await DS.insert("knowledge", row);
      if (!data) return false;
      items.unshift(data);
    }
    return true;
  }

  async function remove(id) {
    const ok = await DS.remove("knowledge", id);
    if (!ok) return;
    items = items.filter((x) => x.id !== id);
  }

  // 标签栏：新增（仅作用于当前视图的标签池）
  function addFilterTag(name) {
    name = (name || "").trim();
    if (!name) return;
    const pool = tagPool();
    if (pool.includes(name)) { U.toast(I18N.t("kb.tagExists", { name })); return; }
    const custom = getCustomTags(view);
    if (!custom.includes(name)) { custom.push(name); saveCustomTags(custom, view); }
    saveHiddenTags(getHiddenTags(view).filter((t) => t !== name), view);
    filter = "all";
    render();
  }

  // 标签栏：删除（仅作用于当前视图；确认 + 从本条目的条目剥除 + 本视图隐藏）
  async function deleteFilterTag(name) {
    const n = items.filter((x) => (x.platform_tags || []).includes(name)).length;
    if (!confirm(I18N.t("kb.delTagConfirm", { name, n }))) return;
    const targets = items.filter((x) => (x.platform_tags || []).includes(name));
    for (const x of targets) {
      const upd = { platform_tags: (x.platform_tags || []).filter((t) => t !== name) };
      const res = await DS.update("knowledge", x.id, upd);
      if (!res) { U.toast(I18N.t("common.saveFailed")); return; }
      x.platform_tags = upd.platform_tags;
    }
    const hidden = getHiddenTags(view);
    if (!hidden.includes(name)) { hidden.push(name); saveHiddenTags(hidden, view); }
    saveCustomTags(getCustomTags(view).filter((t) => t !== name), view);
    if (filter === name) filter = "all";
    await load();
    render();
    U.toast("✓ " + I18N.t("kb.delTag"));
  }

  function renderTagChecks(pool, selected) {
    return pool.map((g) =>
      `<label class="chip kb-chip ${selected.includes(g) ? "active" : ""}" style="cursor:pointer" title="${U.esc(g)}">
        <input type="checkbox" class="kbpick" value="${U.esc(g)}" ${selected.includes(g) ? "checked" : ""} style="display:none">${U.esc(g)}<span class="kb-tick">✓</span></label>`).join("");
  }

  function openEditor(item) {
    const isEdit = !!item;
    const it = item || { id: null, title: "", url: "", note: "", chinese_text: "", translations: [], platform_tags: [], kind: view };
    const pool = tagPool();
    const isTemplates = view === "templates";

    // 构建表单字段
    let fieldsHtml = "";
    if (isTemplates) {
      const translations = (it.translations || []).length ? it.translations : [{ tag: "", text: "" }];
      const transRows = translations.map((tr, idx) => `
        <div class="tmpl-edit-row" data-idx="${idx}">
          <input type="text" class="tmpl-tag" value="${U.esc(tr.tag || "")}" placeholder="${U.esc(I18N.t("kb.langTag"))}">
          <input type="text" class="tmpl-text" value="${U.esc(tr.text || "")}" placeholder="${U.esc(I18N.t("kb.langText"))}">
          <button class="btn ghost sm tmpl-rm" type="button">${I18N.t("common.remove")}</button>
        </div>`).join("");
      fieldsHtml = `
        <label class="field"><span>${I18N.t("kb.kbTitle")}</span><input type="text" id="kTitle" value="${U.esc(it.title)}" placeholder="${U.esc(I18N.t("kb.kbTitle"))}"></label>
        <label class="field"><span>${I18N.t("kb.chinese")}</span><input type="text" id="kChinese" value="${U.esc(it.chinese_text)}" placeholder="${U.esc(I18N.t("kb.chinese"))}"></label>
        <div class="card-title" style="margin:6px 0 4px">${I18N.t("kb.translateLang")}</div>
        <div id="kTranslations">${transRows}</div>
        <button class="btn ghost sm" id="kAddTrans" type="button" style="margin-top:8px">${I18N.t("kb.addTrans")}</button>`;
    } else {
      fieldsHtml = `
        <label class="field"><span>${I18N.t("kb.kbTitle")}</span><input type="text" id="kTitle" value="${U.esc(it.title)}" placeholder="Mercado Libre Seller Center"></label>
        <label class="field"><span>${I18N.t("kb.link")}</span><input type="url" id="kUrl" value="${U.esc(it.url)}" placeholder="https://..."></label>
        <label class="field"><span>${I18N.t("common.note")}</span><textarea id="kNote" placeholder="${I18N.t("common.note")}">${U.esc(it.note)}</textarea></label>`;
    }

    const m = U.modal(`
      <div class="m-head">
        <span class="m-ico">${isEdit ? "✏️" : "＋"}</span>
        <h3>${isEdit ? I18N.t("common.edit") : I18N.t("kb.add")}</h3>
        <button class="m-x" id="kX">×</button>
      </div>
      ${fieldsHtml}
      <div class="sec-title">${I18N.t("common.platform")}</div>
      <div id="kTags" class="chips">${renderTagChecks(pool, it.platform_tags || []) || `<span class="muted" style="font-size:12.5px">–</span>`}</div>
      <div class="actions"><button class="btn ghost" id="kCancel">${I18N.t("common.cancel")}</button><button class="btn" id="kSave">${I18N.t("common.save")}</button></div>
    `, { noClose: true });
    m.querySelector("#kX").onclick = m.closeModal;

    if (isTemplates) {
      const transWrap = m.querySelector("#kTranslations");
      const addTransRow = () => {
        const idx = transWrap.querySelectorAll(".tmpl-edit-row").length;
        const div = document.createElement("div");
        div.className = "tmpl-edit-row";
        div.dataset.idx = idx;
        div.innerHTML = `
          <input type="text" class="tmpl-tag" placeholder="${U.esc(I18N.t("kb.langTag"))}">
          <input type="text" class="tmpl-text" placeholder="${U.esc(I18N.t("kb.langText"))}">
          <button class="btn ghost sm tmpl-rm" type="button">${I18N.t("common.remove")}</button>`;
        transWrap.appendChild(div);
        bindTransRow(div);
      };
      const bindTransRow = (div) => {
        div.querySelector(".tmpl-rm").onclick = () => { div.remove(); };
      };
      transWrap.querySelectorAll(".tmpl-edit-row").forEach(bindTransRow);
      m.querySelector("#kAddTrans").onclick = addTransRow;
    }

    // 平台标签多选：隐藏 checkbox 不会自动高亮，需手动同步 .active（原来缺失）
    m.querySelectorAll(".kbpick").forEach((c) => c.onchange = () => {
      c.closest(".chip").classList.toggle("active", c.checked);
    });

    m.querySelector("#kCancel").onclick = m.closeModal;
    m.querySelector("#kSave").onclick = async () => {
      if (isTemplates) {
        const chinese = m.querySelector("#kChinese").value.trim();
        if (!chinese) { U.toast(I18N.t("kb.missingChinese")); return; }
        const translations = [];
        m.querySelectorAll(".tmpl-edit-row").forEach((row) => {
          const tag = row.querySelector(".tmpl-tag").value.trim();
          const text = row.querySelector(".tmpl-text").value.trim();
          if (tag || text) translations.push({ tag, text });
        });
        it.title = m.querySelector("#kTitle").value.trim() || chinese;
        it.chinese_text = chinese;
        it.translations = translations;
        it.url = "";
        it.note = "";
      } else {
        const url = normUrl(m.querySelector("#kUrl").value);
        if (!url) { U.toast(I18N.t("kb.invalidUrl")); return; }
        it.title = m.querySelector("#kTitle").value.trim() || url;
        it.url = url;
        it.note = m.querySelector("#kNote").value.trim();
        it.chinese_text = "";
        it.translations = [];
      }
      it.platform_tags = Array.from(m.querySelectorAll(".kbpick:checked")).map((x) => x.value);
      it.kind = view;
      const ok = await persist(it);
      if (ok) { m.closeModal(); render(); }
    };
  }

  function render() {
    const el = document.getElementById("view-knowledge");
    if (!el) return;
    const official = view === "official";
    const templates = view === "templates";
    const canEdit = official ? (window.Collab && window.Collab.canEditOfficial && window.Collab.canEditOfficial()) : true;
    const canTag = canManageTags();
    const shown = items.filter((x) => filter === "all" || (x.platform_tags || []).includes(filter));

    const tabs = `
      <div class="seg2" style="margin-bottom:16px">
        <button class="${!official && !templates ? "active" : ""}" data-view="private">🔒 ${I18N.t("kb.private")}</button>
        <button class="${official ? "active" : ""}" data-view="official">🌐 ${I18N.t("kb.official")}${official && !canEdit ? `<span class="kb-ro"> · ${I18N.t("kb.readonly")}</span>` : ""}</button>
        <button class="${templates ? "active" : ""}" data-view="templates">📝 ${I18N.t("kb.templates")}</button>
      </div>`;

    // 标签导航栏：全部 + 标签(可删) + 添加输入
    const allBtn = `<button class="chip ${filter === "all" ? "active" : ""}" data-f="all">📋 ${I18N.t("kb.allTags")} <span class="n">${items.length}</span></button>`;
    const cntTag = (t) => items.filter((x) => (x.platform_tags || []).includes(t)).length;
    const tagBtns = tagPool().map((t) => {
      const xBtn = canTag ? `<button class="x" data-deltag="${U.esc(t)}" title="${I18N.t("kb.delTag")}">×</button>` : "";
      return `<span class="chip ${filter === t ? "active" : ""}"><button class="chip-in" data-f="${U.esc(t)}" style="all:unset;cursor:pointer">${U.esc(t)} <span class="n">${cntTag(t)}</span></button>${xBtn}</span>`;
    }).join("");
    const addInput = canTag
      ? `<button class="chip kb-tag-plus" id="kbTagPlus" title="${I18N.t("kb.addTagPH")}">＋</button>`
      : (official ? `<span class="tf-readonly-hint" title="${I18N.t("kb.tagReadonly")}">🔒</span>` : "");

    const cards = shown.map((x) => {
      const tagHtml = (x.platform_tags || []).map((t) => `<button class="tag" data-ftag="${U.esc(t)}" style="background:var(--primary-soft);color:var(--primary-ink);border:none;cursor:pointer">${U.esc(t)}</button>`).join(" ");
      const shared = x.shared_from_name ? `<span class="shared-badge">↘ ${U.esc(x.shared_from_name)}</span>` : "";
      let bodyHtml = "";
      let acts = "";

      if (templates) {
        const transHtml = (x.translations || []).map((tr, i) => `
          <div class="tmpl-block">
            <div class="tmpl-label">${U.esc(tr.tag || I18N.t("kb.translateLang"))}</div>
            <div class="tmpl-text">${U.esc(tr.text || "")}</div>
            <button class="copy-btn" data-copy-trans="${U.esc(x.id)}:${i}" title="${I18N.t("kb.copyTrans")}">⧉</button>
          </div>`).join("");
        bodyHtml = `
          <div class="tmpl-block tmpl-chinese">
            <div class="tmpl-label">${I18N.t("kb.chinese")}</div>
            <div class="tmpl-text">${U.esc(x.chinese_text || "")}</div>
            <button class="copy-btn" data-copy-chinese="${U.esc(x.id)}" title="${I18N.t("kb.copyChinese")}">⧉</button>
          </div>
          ${transHtml}`;
        if (canEdit) {
          acts = `<span style="margin-left:auto;display:flex;gap:6px">
            <button class="copy-btn" data-copy-all="${U.esc(x.id)}" title="${I18N.t("kb.copyAll")}">📋</button>
            <button class="copy-btn" data-edit="${U.esc(x.id)}" title="${I18N.t("common.edit")}">✏️</button>
            <button class="copy-btn" data-del="${U.esc(x.id)}" title="${I18N.t("common.del")}">🗑</button>
          </span>`;
        }
        return `<div class="kb-card tmpl-card">
          <div class="kb-head"><div class="kb-title">${U.esc(x.title)}</div>${shared}</div>
          ${bodyHtml}
          <div class="kb-foot">${tagHtml}${acts}</div>
        </div>`;
      }

      // 私有 / 官方
      const titleLink = x.url
        ? `<a class="kb-title" href="${U.esc(x.url)}" target="_blank" rel="noopener">${U.esc(x.title)}</a>`
        : `<div class="kb-title">${U.esc(x.title)}</div>`;
      if (canEdit) {
        const shareBtn = !official ? `<button class="copy-btn" data-share="${U.esc(x.id)}">🔗</button>` : "";
        acts = `<span style="margin-left:auto;display:flex;gap:6px">
          <button class="copy-btn" data-edit="${U.esc(x.id)}" title="${I18N.t("common.edit")}">✏️</button>
          <button class="copy-btn" data-del="${U.esc(x.id)}" title="${I18N.t("common.del")}">🗑</button>
          ${shareBtn}
        </span>`;
      }
      return `<div class="kb-card">
        <div class="kb-head">${titleLink}${shared}</div>
        ${x.note ? `<div class="kb-note">${U.esc(x.note)}</div>` : ""}
        <div class="kb-foot">${tagHtml}${acts}</div>
      </div>`;
    }).join("");

    const topActions = official
      ? (canEdit ? `<button class="btn" id="kbAdd">＋ ${I18N.t("kb.add")}</button>` : "")
      : (templates
        ? `<button class="btn" id="kbAdd">＋ ${I18N.t("kb.add")}</button>`
        : `<button class="btn" id="kbShareAll">🔗 ${I18N.t("kb.shareAll")}</button><button class="btn" id="kbAdd">＋ ${I18N.t("kb.add")}</button>`);

    el.innerHTML = `
      <div class="ph">
        <span class="ph-ico">📚</span>
        <div class="ph-txt">
          <h1>${I18N.t("kb.title")}</h1>
          <p>${I18N.t("kb.sub")}</p>
        </div>
        <div class="ph-actions">${topActions}</div>
      </div>
      ${tabs}
      <div class="kb-tagbar">
        <div class="chips" style="flex:1">${allBtn}${tagBtns}${addInput}</div>
        <span class="kb-scope-hint" title="${I18N.t("kb.tagScopeHint")}">🔖 ${I18N.t("kb.tagScope")}</span>
      </div>
      <div class="kb-grid">${cards || `<div class="empty2" style="grid-column:1/-1"><span class="ico">📚</span><span class="t">${I18N.t("kb.empty")}</span><span class="s">${I18N.t("kb.emptyHint")}</span></div>`}</div>
    `;

    el.querySelectorAll("[data-view]").forEach((b) => b.onclick = async () => { view = b.dataset.view; filter = "all"; await load(); render(); });
    el.querySelectorAll("[data-f]").forEach((b) => b.onclick = () => { filter = b.dataset.f; render(); });
    el.querySelectorAll("[data-ftag]").forEach((b) => b.onclick = () => { filter = b.dataset.ftag; render(); });
    const add = el.querySelector("#kbAdd"); if (add) add.onclick = () => openEditor(null);
    const sa = el.querySelector("#kbShareAll"); if (sa) sa.onclick = () => window.Collab.share("knowledge", null);
    el.querySelectorAll("[data-edit]").forEach((b) => b.onclick = () => openEditor(items.find((x) => x.id === b.dataset.edit)));
    el.querySelectorAll("[data-share]").forEach((b) => b.onclick = () => window.Collab.share("knowledge", b.dataset.share));
    el.querySelectorAll("[data-del]").forEach((b) => b.onclick = async () => { if (confirm(I18N.t("common.confirmDel"))) { await remove(b.dataset.del); render(); } });
    el.querySelectorAll("[data-deltag]").forEach((b) => b.onclick = (e) => { e.stopPropagation(); deleteFilterTag(b.dataset.deltag); });

    // 文案模板复制按钮
    el.querySelectorAll("[data-copy-chinese]").forEach((b) => b.onclick = () => {
      const x = items.find((i) => i.id === b.dataset.copyChinese);
      if (x && x.chinese_text) U.copy(x.chinese_text, I18N.t("common.copied"));
    });
    el.querySelectorAll("[data-copy-trans]").forEach((b) => b.onclick = () => {
      const [id, idx] = b.dataset.copyTrans.split(":");
      const x = items.find((i) => i.id === id);
      const tr = x && x.translations && x.translations[parseInt(idx, 10)];
      if (tr && tr.text) U.copy(tr.text, I18N.t("common.copied"));
    });
    el.querySelectorAll("[data-copy-all]").forEach((b) => b.onclick = () => {
      const x = items.find((i) => i.id === b.dataset.copyAll);
      if (!x) return;
      const lines = [x.title, I18N.t("kb.chinese") + I18N.t("common.labelSep") + (x.chinese_text || "")];
      (x.translations || []).forEach((tr) => lines.push((tr.tag || I18N.t("kb.translateLang")) + I18N.t("common.labelSep") + (tr.text || "")));
      U.copy(lines.join("\n"), I18N.t("kb.copyAll"));
    });

    // 标签栏：新增 —— 点 ＋ 展开输入框，Enter 或点 ✓ 确认，Esc / 点 × 取消
    const tagPlus = el.querySelector("#kbTagPlus");
    if (tagPlus) {
      tagPlus.onclick = () => openInlineTagAdd(el, tagPlus);
    }
    // 兼容旧入口（若外部仍按 id 找输入框）
    const newTagInp = el.querySelector("#kbNewFilterTag");
    if (newTagInp) {
      newTagInp.onkeydown = (e) => {
        if (e.key === "Enter" || e.key === ",") {
          e.preventDefault();
          const v = newTagInp.value.trim();
          if (v) { addFilterTag(v); newTagInp.value = ""; }
        }
      };
    }
  }

  // 标签栏内联新增：把 ＋ 按钮原地替换成 [输入框][✓][×]，确认后收起
  function openInlineTagAdd(el, plusBtn) {
    const chips = plusBtn.parentElement;
    const wrap = document.createElement("span");
    wrap.className = "kb-tag-add";
    wrap.innerHTML = `
      <input type="text" id="kbNewFilterTag" placeholder="${I18N.t("kb.addTagPH")}" maxlength="24"/>
      <button class="kb-tag-ok" id="kbTagOk" title="${I18N.t("common.confirm")}">✓</button>
      <button class="kb-tag-cancel" id="kbTagCancel" title="${I18N.t("common.cancel")}">✕</button>`;
    plusBtn.replaceWith(wrap);
    const inp = wrap.querySelector("#kbNewFilterTag");
    inp.focus();

    const close = () => {
      wrap.replaceWith(plusBtn);       // 复原成 ＋
    };
    const commit = () => {
      const v = inp.value.trim();
      if (!v) { inp.focus(); return; }
      addFilterTag(v);                  // 内部会重新 render，＋ 自然回来
    };
    wrap.querySelector("#kbTagOk").onclick = commit;
    wrap.querySelector("#kbTagCancel").onclick = close;
    inp.onkeydown = (e) => {
      if (e.key === "Enter") { e.preventDefault(); commit(); }
      else if (e.key === "Escape") { e.preventDefault(); close(); }
    };
    // 失焦不自动提交（避免误建），但如果点到别处就收起
    inp.onblur = () => { setTimeout(() => { if (document.body.contains(wrap) && !wrap.contains(document.activeElement)) close(); }, 160); };
  }

  // 供翻译模块「收藏」调用：直接打开「文案模板库」新增面板并预填
  function openTemplateAdd(prefill) {
    view = "templates";
    const it = Object.assign(
      { id: null, title: "", url: "", note: "", chinese_text: "", translations: [], platform_tags: [], kind: "templates" },
      prefill || {}
    );
    openEditor(it);
  }

  // 供定价计算器调用：把一条定价记录存入知识库（private），保存后刷新列表
  async function savePricing(rec) {
    const it = {
      id: null,
      title: (rec.title || I18N.t("pricing.gallery.mercado") || "定价记录"),
      url: "",
      note: rec.note || "",
      chinese_text: "",
      translations: [],
      platform_tags: Array.isArray(rec.platform_tags) ? rec.platform_tags : [],
      kind: "private",
    };
    const ok = await persist(it);
    if (ok) { await load(); render(); }
    return ok;
  }

  async function init() { await load(); render(); }
  async function onShow() { await load(); render(); }
  return { init, onShow, openTemplateAdd, savePricing };
})();

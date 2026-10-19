/* ===== Translate (multi-language, batch) ===== */
window.Translate = (function () {
  // 语言表：代码 / 中文名(zh) / 英文名(en) / 旗帜
  // 注意：语言名称属于「界面文案」，随 UI 语言切换；而用户输入的待翻译正文不受影响。
  const LANGS = [
    { code: "zh", zh: "中文", en: "Chinese", flag: "🇨🇳" },
    { code: "en", zh: "英语", en: "English", flag: "🇬🇧" },
    { code: "es", zh: "西班牙语", en: "Spanish", flag: "🇪🇸" },
    { code: "pt", zh: "葡萄牙语", en: "Portuguese", flag: "🇵🇹" },
    { code: "de", zh: "德语", en: "German", flag: "🇩🇪" },
    { code: "fr", zh: "法语", en: "French", flag: "🇫🇷" },
    { code: "it", zh: "意大利语", en: "Italian", flag: "🇮🇹" },
    { code: "ja", zh: "日语", en: "Japanese", flag: "🇯🇵" },
    { code: "ko", zh: "韩语", en: "Korean", flag: "🇰🇷" },
    { code: "ar", zh: "阿拉伯语", en: "Arabic", flag: "🇸🇦" },
    { code: "ru", zh: "俄语", en: "Russian", flag: "🇷🇺" },
    { code: "nl", zh: "荷兰语", en: "Dutch", flag: "🇳🇱" },
    { code: "pl", zh: "波兰语", en: "Polish", flag: "🇵🇱" },
    { code: "tr", zh: "土耳其语", en: "Turkish", flag: "🇹🇷" },
    { code: "vi", zh: "越南语", en: "Vietnamese", flag: "🇻🇳" },
    { code: "th", zh: "泰语", en: "Thai", flag: "🇹🇭" },
    { code: "id", zh: "印尼语", en: "Indonesian", flag: "🇮🇩" },
    { code: "ms", zh: "马来语", en: "Malay", flag: "🇲🇾" }
  ];
  const byCode = (c) => LANGS.find((l) => l.code === c) || { code: c, zh: c, en: c, flag: "🌐" };
  const langName = (c) => { const l = byCode(c); return I18N.getLang() === "en" ? (l.en || l.zh) : l.zh; };
  const langFlag = (c) => byCode(c).flag;

  // 状态
  let src = "zh";
  let targets = ["en", "es", "ja"];
  let results = {}; // code -> { text, err, loading }
  let busy = false;

  // 引擎配置（localStorage）
  const getEngine = () => localStorage.getItem("cb_tr_engine") || "free";
  const setEngine = (v) => localStorage.setItem("cb_tr_engine", v);
  const cfg = () => ({
    base: localStorage.getItem("cb_tr_base") || "https://api.deepseek.com/v1",
    model: localStorage.getItem("cb_tr_model") || "deepseek-chat",
    key: localStorage.getItem("cb_tr_key") || ""
  });

  // ---- 翻译引擎 ----
  async function viaFree(text, s, t) {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(s)}|${encodeURIComponent(t)}`;
    const r = await fetch(url);
    const j = await r.json();
    const out = j && j.responseData && j.responseData.translatedText;
    if (!out) throw new Error(j.responseDetails || I18N.t("tr.errFree"));
    return out;
  }

  async function viaLLM(text, s, tlist) {
    const c = cfg();
    if (!c.key) throw new Error(I18N.t("tr.errNoKey"));
    const names = tlist.map(langName).join(I18N.t("common.listSep"));
    // 系统提示词随界面语言切换：中文界面用中文指令，英文界面用英文指令（目标语言名同步）。
    const sys = I18N.getLang() === "en"
      ? `You are a professional multi-language localization expert specializing in cross-border e-commerce copy. Translate the user's content into the following target languages: ${names}. Requirements: 1) Translate for meaning, not word-for-word; preserve the original marketing tone, professionalism and readability. 2) Keep brand names, proper nouns, and the format of sizes/prices/numbers/symbols. 3) Do not add any explanation, preamble or extra content. 4) Return strictly a JSON object whose keys are the target language codes (${tlist.join(", ")}) and whose values are the corresponding translations.`
      : `你是一名专业的多语言本地化翻译专家，尤其擅长跨境电商文案翻译。请把用户内容翻译为以下目标语言：${names}。要求：1) 意译而非逐字硬译，保持原文营销语气、专业度与可读性；2) 保留品牌名、专有名词、尺寸/价格/数字/符号格式；3) 不要添加任何解释、前言或额外内容；4) 严格以 JSON 对象返回，键为目标语言代码（${tlist.join(", ")}），值为对应译文。`;
    const body = {
      model: c.model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: sys },
        { role: "user", content: I18N.getLang() === "en"
            ? `Source language code: ${s}. Content to translate:\n${text}`
            : `源语言代码：${s}。待翻译内容：\n${text}` }
      ]
    };
    const r = await fetch(`${c.base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + c.key },
      body: JSON.stringify(body)
    });
    const j = await r.json();
    if (j.error) throw new Error(j.error.message || I18N.t("tr.errApi"));
    const content = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    if (!content) throw new Error(I18N.t("tr.errEmpty"));
    let obj;
    try { obj = JSON.parse(content); } catch (e) { throw new Error(I18N.t("tr.errBadJson")); }
    return obj;
  }

  async function doTranslate() {
    const el = document.getElementById("view-translate");
    const text = (el.querySelector("#trInput").value || "").trim();
    if (!text) { U.toast(I18N.t("tr.empty")); return; }
    if (!targets.length) { U.toast(I18N.t("tr.noTarget")); return; }
    busy = true;
    targets.forEach((t) => { results[t] = { loading: true }; });
    renderResults();

    if (getEngine() === "llm" && cfg().key) {
      try {
        const obj = await viaLLM(text, src, targets);
        targets.forEach((t) => { results[t] = { text: obj[t] != null ? String(obj[t]) : "", ok: true }; });
      } catch (e) {
        U.toast(I18N.t("tr.llmFail") + I18N.t("common.labelSep") + e.message);
        await freeFallback(text);
      }
    } else {
      await freeFallback(text);
    }
    busy = false;
    renderResults();
  }

  async function freeFallback(text) {
    await Promise.all(targets.map(async (t) => {
      try { const out = await viaFree(text, src, t); results[t] = { text: out, ok: true }; }
      catch (e) { results[t] = { err: e.message, ok: false }; }
    }));
  }

  // 收藏（单张卡片）：只收藏「被点击的那张卡片的语言」+ 原文
  // 之前的 bug：onclick 直接把 collect 当回调，而 collect 无差别遍历所有 targets，
  // 导致多语言时点一张卡片会收藏全部译文。现在由 data-collect 传入语言代码。
  function collect(langCode) {
    const el = document.getElementById("view-translate");
    const text = (el.querySelector("#trInput").value || "").trim();
    if (!text) { U.toast(I18N.t("tr.empty")); return; }
    if (!langCode || !targets.includes(langCode)) { U.toast(I18N.t("tr.noTransYet")); return; }
    const r = results[langCode];
    if (!r || !r.text) { U.toast(I18N.t("tr.noTransYet")); return; }
    openTemplateWith(text, [{ tag: langCode, label: langName(langCode), text: r.text }]);
  }

  // 收藏全部：把当前所有已成功翻译的语言一起收藏
  function collectAll() {
    const el = document.getElementById("view-translate");
    const text = (el.querySelector("#trInput").value || "").trim();
    if (!text) { U.toast(I18N.t("tr.empty")); return; }
    const pairs = targets
      .filter((t) => results[t] && results[t].text)
      .map((t) => ({ tag: t, label: langName(t), text: results[t].text }));
    if (!pairs.length) { U.toast(I18N.t("tr.noTransYet")); return; }
    openTemplateWith(text, pairs);
  }

  // 统一打开「文案模板库」新增面板并预填
  // title 使用当前界面语言下的默认名（英文模式不能出现中文默认值）
  function openTemplateWith(sourceText, pairs) {
    if (!window.KB || !window.KB.openTemplateAdd) { U.toast(I18N.t("tr.kbUnavailable")); return; }
    const defaultTitle = I18N.getLang() === "en"
      ? (sourceText.length > 24 ? sourceText.slice(0, 24) + "…" : sourceText)
      : (sourceText.length > 20 ? sourceText.slice(0, 20) + "…" : sourceText);
    window.KB.openTemplateAdd({
      title: defaultTitle,
      chinese_text: sourceText,
      translations: pairs.map((p) => ({ tag: p.label, text: p.text })),
    });
  }

  function renderTargets() {
    const wrap = document.getElementById("trTargets");
    if (!wrap) return;
    const chips = targets.map((t) =>
      `<span class="tr-chip"><span class="tr-chip-flag">${langFlag(t)}</span>${U.esc(langName(t))}<button class="tr-chip-x" data-rm="${t}" title="${U.esc(I18N.t("common.remove"))}">×</button></span>`).join("");
    const avail = LANGS.filter((l) => l.code !== src && !targets.includes(l.code));
    const opts = avail.map((l) => `<option value="${l.code}">${l.flag} ${U.esc(langName(l.code))}</option>`).join("");
    wrap.innerHTML = `<div class="tr-chips">${chips || `<span class="tr-chips-empty">${I18N.t("tr.noTarget")}</span>`}</div>
      <select id="trAddLang" class="tr-add"><option value="">＋ ${I18N.t("tr.addLang")}</option>${opts}</select>`;
    wrap.querySelector("#trAddLang").onchange = (e) => {
      const v = e.target.value; if (!v) return;
      if (!targets.includes(v)) targets.push(v);
      delete results[v];
      renderTargets(); renderResults();
    };
    wrap.querySelectorAll(".tr-chip-x").forEach((b) => b.onclick = () => {
      targets = targets.filter((t) => t !== b.dataset.rm);
      delete results[b.dataset.rm];
      renderTargets(); renderResults();
    });
  }

  function renderResults() {
    const box = document.getElementById("trResults");
    if (!box) return;
    if (!targets.length) { box.innerHTML = `<div class="tr-empty">${I18N.t("tr.noTarget")}</div>`; return; }
    const cards = targets.map((t) => {
      const r = results[t] || {};
      let body;
      if (r.loading) body = `<div class="tr-out tr-loading"><span class="tr-spin"></span>${I18N.t("tr.translating")}…</div>`;
      else if (r.err) body = `<div class="tr-out tr-err">⚠ ${U.esc(r.err)}</div>`;
      else if (r.text) body = `<div class="tr-out">${U.esc(r.text)}</div>`;
      else body = `<div class="tr-out tr-placeholder">—</div>`;
      const canCopy = !!r.text && !r.loading;
      return `<div class="tr-card">
        <div class="tr-card-head">
          <div class="tr-card-id"><span class="tr-badge">${langFlag(t)}</span><span class="tr-name">${U.esc(langName(t))}</span></div>
          <button class="tr-icon ${canCopy ? "" : "is-disabled"}" data-copy="${t}" title="${I18N.t("tr.copy")}" ${canCopy ? "" : "disabled"}>⧉</button>
        </div>
        ${body}
        <button class="tr-collect ${canCopy ? "" : "is-disabled"}" data-collect="${t}" ${canCopy ? "" : "disabled"}>⭐ ${I18N.t("tr.collect")}</button>
      </div>`;
    }).join("");
    box.innerHTML = `<div class="tr-grid">${cards}</div>`;
    box.querySelectorAll("[data-copy]").forEach((b) => b.onclick = () => {
      const r = results[b.dataset.copy];
      if (r && r.text) U.copy(r.text, I18N.t("common.copied"));
    });
    // 关键：把该卡片对应的语言代码传进去，只收藏这一条
    box.querySelectorAll("[data-collect]").forEach((b) => b.onclick = () => collect(b.dataset.collect));
  }

  function openSettings() {
    const c = cfg();
    const isLLM = getEngine() === "llm";
    const m = U.modal(`
      <div class="m-head">
        <span class="m-ico">⚙️</span>
        <h3>${I18N.t("tr.settings")}</h3>
        <button class="m-x" id="engX">×</button>
      </div>
      <label class="field"><span>${I18N.t("tr.engine")}</span>
        <select id="engSel">
          <option value="free" ${isLLM ? "" : "selected"}>${I18N.t("tr.engineFree")}</option>
          <option value="llm" ${isLLM ? "selected" : ""}>${I18N.t("tr.engineLLM")}</option>
        </select></label>
      <div id="llmCfg" style="${isLLM ? "" : "display:none"};margin-top:10px">
        <label class="field"><span>API Base URL</span><input id="engBase" value="${U.esc(c.base)}" placeholder="https://api.deepseek.com/v1"></label>
        <label class="field"><span>${I18N.t("tr.model")}</span><input id="engModel" value="${U.esc(c.model)}" placeholder="deepseek-chat"></label>
        <label class="field"><span>API Key</span><input id="engKey" type="password" value="${U.esc(c.key)}" placeholder="sk-…"></label>
        <p class="muted" style="font-size:12px">${I18N.t("tr.engineLLMHint")}</p>
      </div>
      <div class="actions"><button class="btn ghost" id="engCancel">${I18N.t("common.cancel")}</button><button class="btn" id="engSave">${I18N.t("common.save")}</button></div>
    `);
    m.querySelector("#engSel").onchange = (e) => {
      m.querySelector("#llmCfg").style.display = e.target.value === "llm" ? "" : "none";
    };
    m.querySelector("#engX").onclick = m.closeModal;
    m.querySelector("#engCancel").onclick = m.closeModal;
    m.querySelector("#engSave").onclick = () => {
      const eng = m.querySelector("#engSel").value;
      setEngine(eng);
      if (eng === "llm") {
        localStorage.setItem("cb_tr_base", m.querySelector("#engBase").value.trim() || "https://api.deepseek.com/v1");
        localStorage.setItem("cb_tr_model", m.querySelector("#engModel").value.trim() || "deepseek-chat");
        localStorage.setItem("cb_tr_key", m.querySelector("#engKey").value.trim());
      }
      m.closeModal();
      U.toast(I18N.t("tr.settingsSaved"));
    };
  }

  function render() {
    const el = document.getElementById("view-translate");
    if (!el) return;
    const srcOpts = LANGS.map((l) => `<option value="${l.code}" ${l.code === src ? "selected" : ""}>${l.flag} ${U.esc(langName(l.code))}</option>`).join("");
    el.innerHTML = `
      <div class="ph">
        <span class="ph-ico">🌐</span>
        <div class="ph-txt">
          <h1>${I18N.t("translate.title")}</h1>
          <p>${I18N.t("translate.sub")}</p>
        </div>
        <div class="ph-actions">
          <button class="btn ghost sm" id="trSettings">⚙ ${I18N.t("tr.settings")}</button>
        </div>
      </div>
      <div class="tr-layout">
        <div class="card tr-panel tr-side">
          <div class="tr-topbar">
            <div class="tr-lang-group">
              <span class="tr-mini-label">${I18N.t("tr.source")}</span>
              <select id="trSrc" class="tr-select">${srcOpts}</select>
            </div>
            <button class="tr-swap" id="trSwap" title="${I18N.t("tr.swap")}">⇄</button>
            <div class="tr-lang-group tr-lang-group-flex">
              <span class="tr-mini-label">${I18N.t("tr.targets")}</span>
              <div id="trTargets" class="tr-targets"></div>
            </div>
          </div>
          <div class="tr-input-wrap">
            <textarea id="trInput" rows="6" placeholder="${U.esc(I18N.t("tr.inputPH"))}"></textarea>
            <div class="tr-input-foot">
              <span class="tr-count" id="trCount">0 ${I18N.t("tr.chars")}</span>
              <button class="btn primary tr-go" id="trGo">🌐 ${I18N.t("tr.go")}</button>
            </div>
          </div>
          <div class="tr-actions">
            <button class="btn ghost tr-clear" id="trClear">🗑 ${I18N.t("common.clear")}</button>
            <button class="btn ghost tr-collect-all" id="trCollectAll" title="${I18N.t("tr.collectAllHint")}">⭐ ${I18N.t("tr.collectAll")}</button>
          </div>
        </div>
        <div id="trResults" class="tr-results"></div>
      </div>
    `;

    el.querySelector("#trSrc").onchange = (e) => {
      const v = e.target.value;
      if (targets.includes(v)) targets = targets.filter((t) => t !== v);
      src = v;
      renderTargets(); renderResults();
    };
    const inputEl = el.querySelector("#trInput");
    inputEl.oninput = (e) => {
      const n = (e.target.value || "").length;
      const c = el.querySelector("#trCount");
      if (c) c.textContent = n + " " + I18N.t("tr.chars");
    };
    // 回车直接翻译；Shift+Enter 保留换行（多行文案的常规约定）
    inputEl.onkeydown = (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!busy) doTranslate();
      }
    };
    el.querySelector("#trSwap").onclick = () => {
      if (!targets.length) return;
      const first = targets[0];
      targets = targets.slice(1);
      if (!targets.includes(src)) targets.push(src);
      src = first;
      // 同步源语言下拉
      const sel = el.querySelector("#trSrc");
      if (sel) sel.value = src;
      renderTargets(); renderResults();
    };
    el.querySelector("#trGo").onclick = doTranslate;
    el.querySelector("#trCollectAll").onclick = collectAll;
    el.querySelector("#trClear").onclick = () => {
      const ta = el.querySelector("#trInput"); if (ta) ta.value = "";
      const c = el.querySelector("#trCount");
      if (c) c.textContent = "0 " + I18N.t("tr.chars");
      results = {}; renderResults();
    };
    el.querySelector("#trSettings").onclick = openSettings;

    renderTargets();
    renderResults();
  }

  async function init() {}
  async function onShow() { render(); }
  return { init, onShow };
})();

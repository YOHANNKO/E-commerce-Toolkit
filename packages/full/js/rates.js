/* ===== Rates module ===== */
window.Rates = (function () {
  const KEY_SEL = "cb_rates_sel";
  const KEY_CACHE = "cb_rates_cache";
  const DEFAULT_SEL = ["USD", "CNY", "MXN", "BRL", "EUR", "GBP"];
  let state = { rates: {}, updated: 0, online: false };
  let selected = U.store(KEY_SEL) || DEFAULT_SEL.slice();
  let baseAmount = 100;
  let conv = { amount: 100, from: "USD", to: "CNY" };

  function meta(code) {
    const m = DB.CURRENCIES.find((c) => c.code === code);
    return m || { code, zh: code, en: code, flag: "🏳️", country: code };
  }

  async function fetchRates() {
    try {
      const r = await fetch("https://open.er-api.com/v6/latest/USD", { cache: "no-store" });
      const d = await r.json();
      if (d && d.result === "success" && d.rates) {
        state.rates = d.rates; state.updated = Date.now(); state.online = true;
        U.store(KEY_CACHE, state);
        updateNet(true);
      } else throw new Error("bad");
    } catch (e) {
      const c = U.store(KEY_CACHE);
      if (c && c.rates) { state.rates = c.rates; state.updated = c.updated; state.online = false; }
      else { state.rates = { USD: 1 }; state.online = false; }
      updateNet(false);
    }
    if (document.getElementById("view-rates")) render();
  }

  function updateNet(online) {
    const el = document.getElementById("netStatus");
    if (!el) return;
    el.className = "net-status " + (online ? "online" : "offline");
    el.querySelector("span:last-child").textContent = I18N.t(online ? "net.online" : "net.offline");
  }

  function addCur(code) {
    if (!state.rates[code] && code !== "USD") return;
    if (!selected.includes(code)) { selected.push(code); U.store(KEY_SEL, selected); }
    Rates._search = "";
    render();
  }
  function removeCur(code) {
    selected = selected.filter((c) => c !== code);
    U.store(KEY_SEL, selected);
    renderCards();
  }

  function render() {
    const el = document.getElementById("view-rates");
    if (!el) return;
    const updatedStr = state.updated ? new Date(state.updated).toLocaleString(I18N.getLang() === "zh" ? "zh-CN" : "en-US") : "–";

    const opts = (sel) => selected.concat(DB.CURRENCIES.map(c=>c.code))
      .filter((v, i, a) => a.indexOf(v) === i)
      .map((c) => `<option value="${c}" ${c === sel ? "selected" : ""}>${meta(c).flag} ${c} · ${I18N.getLang()==="zh"?meta(c).zh:meta(c).en}</option>`).join("");

    const fromRate = state.rates[conv.from] || 1;
    const toRate = state.rates[conv.to] || 1;
    const result = (conv.amount / fromRate) * toRate;

    el.innerHTML = `
      <div class="ph">
        <span class="ph-ico">💱</span>
        <div class="ph-txt">
          <h1>${I18N.t("rates.title")}</h1>
          <p>${I18N.t("rates.sub")}</p>
        </div>
        <div class="ph-actions">
          <span class="pill" title="${I18N.t("rates.lastUpdate")}">${state.online ? "🟢" : "🟡"} ${I18N.t("rates.lastUpdate")} ${updatedStr}</span>
          <button class="btn ghost sm" id="ratesRefresh">↻ ${I18N.t("rates.refresh")}</button>
        </div>
      </div>

      <div class="cv-hero">
        <div class="cv-hero-l">
          <label class="cv-field"><span>${I18N.t("rates.base")}</span>
            <input type="number" id="convAmt" value="${conv.amount}" step="any"></label>
          <label class="cv-field"><span>${I18N.t("rates.from")}</span>
            <select id="convFrom">${opts(conv.from)}</select></label>
        </div>
        <button class="cv-swap-btn" id="convSwap" title="${I18N.t("rates.swap")}">⇄</button>
        <div class="cv-hero-r">
          <div class="cv-to-label">${I18N.t("rates.to")}</div>
          <select id="convTo">${opts(conv.to)}</select>
          <div class="cv-hero-out" id="convResult">${U.money(result, conv.to)}</div>
        </div>
      </div>
      ${state.online ? "" : `<div class="warn-bar">⚠ ${I18N.t("rates.offlineNote")}</div>`}

      <div class="card">
        <div class="card-title">🌍 ${I18N.t("rates.title")}</div>
        <label class="field" style="max-width:230px"><span>${I18N.t("rates.base")} (USD)</span>
          <input type="number" id="baseAmt" value="${baseAmount}" step="any"></label>
        <div class="rate-grid" id="rateGrid"></div>
      </div>

      <div class="card">
        <div class="card-title">＋ ${I18N.t("rates.addCountry")}</div>
        <input type="text" id="curSearch" placeholder="${I18N.t("rates.searchPH")}" value="${Rates._search||""}">
        <div id="curPool" class="cur-pool"></div>
      </div>
    `;

    el.querySelector("#convAmt").oninput = (e) => { conv.amount = parseFloat(e.target.value) || 0; updateResult(); };
    el.querySelector("#convFrom").onchange = (e) => { conv.from = e.target.value; updateResult(); };
    el.querySelector("#convTo").onchange = (e) => { conv.to = e.target.value; updateResult(); };
    el.querySelector("#convSwap").onclick = () => {
      const f = conv.from; conv.from = conv.to; conv.to = f;
      const fs = el.querySelector("#convFrom"), ts = el.querySelector("#convTo");
      fs.value = conv.from; ts.value = conv.to;
      updateResult();
    };
    el.querySelector("#baseAmt").oninput = (e) => { baseAmount = parseFloat(e.target.value) || 0; renderCards(); };
    el.querySelector("#curSearch").oninput = (e) => { Rates._search = e.target.value; renderPool(); };
    el.querySelector("#ratesRefresh").onclick = () => { U.toast(I18N.t("rates.refreshing")); fetchRates(); };

    renderCards();
    renderPool();
  }

  // 只刷新卡片区，保留基准金额输入框焦点
  function renderCards() {
    const grid = document.getElementById("rateGrid");
    if (!grid) return;
    grid.innerHTML = selected.map((code) => {
      const m = meta(code);
      const rate = state.rates[code];
      const val = baseAmount * (rate || 0);
      return `<div class="rate-card hoverable">
        <button class="rm" data-rm="${code}" title="${I18N.t("common.remove")}">✕</button>
        <div class="top"><span class="flag">${m.flag}</span>
          <div><div class="code">${code}</div><div class="country">${I18N.getLang()==="zh"?m.zh:m.en}</div></div>
        </div>
        <div class="val">${U.money(val, code)}</div>
        <div class="conv">${I18N.t("rates.ratePer")} <b>${rate ? U.num(rate, rate < 1 ? 4 : 2) : "–"}</b> ${code}</div>
      </div>`;
    }).join("");
    grid.querySelectorAll("[data-rm]").forEach((b) => b.onclick = () => removeCur(b.dataset.rm));
  }

  // 只刷新候选币种区，保留搜索框焦点
  function renderPool() {
    const pool = document.getElementById("curPool");
    if (!pool) return;
    const searchTerm = (Rates._search || "").toLowerCase();
    const list = DB.CURRENCIES.filter((c) =>
      !selected.includes(c.code) &&
      (!searchTerm || c.code.toLowerCase().includes(searchTerm) ||
       c.zh.includes(searchTerm) || c.en.toLowerCase().includes(searchTerm) || c.country.toLowerCase().includes(searchTerm))
    ).slice(0, 40);
    pool.innerHTML = `<div class="chips">${list.map((c) =>
      `<button class="chip" data-add="${c.code}">
        <span>${c.flag}</span><b>${c.code}</b>
        <span class="muted" style="font-weight:600">${I18N.getLang()==="zh"?c.zh:c.en}</span>
        <span class="plus">＋</span>
      </button>`).join("") || `<span class="muted" style="font-size:12.5px">${I18N.t("rates.notFound")}</span>`}</div>`;
    pool.querySelectorAll("[data-add]").forEach((b) => b.onclick = () => addCur(b.dataset.add));
  }

  function updateResult() {
    const fromRate = state.rates[conv.from] || 1;
    const toRate = state.rates[conv.to] || 1;
    const result = (conv.amount / fromRate) * toRate;
    const box = document.getElementById("convResult");
    if (box) box.textContent = U.money(result, conv.to);
  }

  function init() { fetchRates(); }
  function onShow() { if (!state.updated) fetchRates(); else render(); }

  return { init, onShow, _search: "", fetchRates };
})();

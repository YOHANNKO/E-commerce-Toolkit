/* ===== Pricing Calculators (gallery + Mercado Libre) ===== */
window.Pricing = (function () {
  const KEY = "cb_pricing";
  let rates = { USD: 1 };
  let rateUpdated = 0;
  let online = false;

  const def = () => ({
    name: "", platform: "", classification: "",
    commission: 16, gross: 0.5, L: 20, W: 15, H: 10,
    ship: 0, purchase: 0,
    netMode: "manual", net: 10, netPct: 15,
    costs: {
      aftersale: { on: true, mode: "ratio", ratio: 3, manual: 0 },
      ad: { on: true, mode: "ratio", ratio: 10, manual: 0 },
      fx: { on: true, mode: "ratio", ratio: 1.5, manual: 0 },
    },
    custom: [],
    displayCurs: ["USD", "CNY", "MXN"],
    activeCur: "USD",
  });
  // 合并旧存档（浅合并，兼容缺字段的旧状态）
  let s = Object.assign(def(), U.store(KEY) || {});

  let current = null;        // 当前打开的计算器 id；null = 画廊
  let editingId = null;      // 正在二次编辑的定价记录 id；null = 新建
  let viewMode = U.store("cb_calc_view") || "grid";

  /* ----- 计算器注册表：后续新增平台，往这里 registerCalc 即可 ----- */
  const CALCS = [];
  function registerCalc(c) { CALCS.push(c); }

  function save() { U.store(KEY, s); }
  function rate(code) { return rates[code] != null ? rates[code] : (code === "USD" ? 1 : 0); }

  // 汇率源与 rates.js 保持一致：优先 jsdelivr/currency-api，失败再用 open.er-api.com。
  // 返回统一的 { USD:1, CNY:7.x, ... }（代码全大写）。
  const RATE_SOURCES = [
    { url: "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json", upper: true },
    { url: "https://open.er-api.com/v6/latest/USD", upper: false }
  ];
  async function fetchRateTable() {
    for (const src of RATE_SOURCES) {
      const ctrl = (typeof AbortController !== "undefined") ? new AbortController() : null;
      const timer = setTimeout(() => { if (ctrl) ctrl.abort(); }, 7000);
      try {
        const r = await fetch(src.url, { cache: "no-store", signal: ctrl ? ctrl.signal : undefined });
        if (!r.ok) continue;
        const d = await r.json();
        const raw = src.upper ? d.usd : d.rates;
        if (!raw) continue;
        const out = {};
        Object.keys(raw).forEach((k) => {
          const key = src.upper ? String(k).toUpperCase() : String(k);
          const v = Number(raw[k]);
          if (isFinite(v) && v > 0) out[key] = v;
        });
        if (out.USD) return out;
      } catch (_) { /* 换下一个源 */ }
      finally { clearTimeout(timer); }
    }
    return null;
  }

  async function fetchRates() {
    try {
      const got = await fetchRateTable();
      if (got) { rates = got; rateUpdated = Date.now(); online = true; U.store("cb_rates_cache", { rates, updated: rateUpdated }); }
      else throw 0;
    } catch (e) {
      const c = U.store("cb_rates_cache"); if (c && c.rates) { rates = c.rates; rateUpdated = c.updated; } online = false;
    }
    if (document.getElementById("view-pricing") && document.getElementById("view-pricing").classList.contains("active")) render();
  }

  function render() {
    if (current) openCalc();
    else renderGallery();
  }

  /* ============ 画廊 ============ */
  function renderGallery() {
    const view = document.getElementById("view-pricing");
    if (!view) return;
    const cards = CALCS.map((c) => {
      const ready = c.status === "ready";
      return `<div class="calc-card ${ready ? "" : "soon"}" data-calc="${c.id}">
        <div class="calc-card-ico">${c.icon}</div>
        <div class="calc-card-body">
          <div class="calc-card-name">${I18N.t(c.key)}</div>
          <div class="calc-card-desc">${I18N.t(c.descKey)}</div>
        </div>
        <div class="calc-card-act ${ready ? "" : "soon"}">${ready ? I18N.t("pricing.gallery.open") : I18N.t("pricing.gallery.soon")}</div>
      </div>`;
    }).join("");

    view.innerHTML = `
      <div class="page-head"><h1>${I18N.t("pricing.gallery.title")}</h1><p>${I18N.t("pricing.gallery.sub")}</p></div>
      <div class="calc-toolbar">
        <span class="muted">${I18N.t("pricing.gallery.count").replace("{n}", CALCS.length)}</span>
        <div class="seg">
          <button class="seg-btn ${viewMode === "grid" ? "active" : ""}" data-mode="grid">▦ ${I18N.t("pricing.gallery.grid")}</button>
          <button class="seg-btn ${viewMode === "list" ? "active" : ""}" data-mode="list">≡ ${I18N.t("pricing.gallery.list")}</button>
        </div>
      </div>
      <div class="calc-list ${viewMode}">${cards}</div>
    `;

    view.querySelectorAll("[data-calc]").forEach((b) => {
      const c = CALCS.find((x) => x.id === b.dataset.calc);
      if (c && c.status === "ready") b.onclick = () => { current = c.id; openCalc(); };
      else b.onclick = () => U.toast(I18N.t("pricing.gallery.soon"));
    });
    view.querySelectorAll("[data-mode]").forEach((b) => b.onclick = () => { viewMode = b.dataset.mode; U.store("cb_calc_view", viewMode); renderGallery(); });
  }

  function openCalc() {
    const c = CALCS.find((x) => x.id === current);
    if (c && c.open) c.open();
  }

  /* ============ 美客多定价计算器 ============ */
  // 成本模型：售价 P
  //   固定成本 fixed = 运费 + 采购价 + 各手动金额费用
  //   按比例费用占比 ratioSum = 佣金% + 各项比例%(广告/售后/汇损/自定义)
  //   净收入 net：手动模式 = 用户输入值；百分比模式 = P × 净收入%/100
  //   定价 P：手动模式 P = (net + fixed)/(1-ratioSum)；百分比模式 P = fixed/(1-ratioSum-净收入%)
  //   净收益 = 净收入 + 采购价 + 额外添加的产品与费用(成本区各项)
  function calc() {
    const commission = +s.commission || 0;
    const purchase = +s.purchase || 0;
    const ship = +s.ship || 0;

    const activeCosts = [];
    const c = s.costs;
    if (c.aftersale.on) activeCosts.push({ key: "pricing.aftersale", cfg: c.aftersale, color: "#f59e0b" });
    if (c.ad.on) activeCosts.push({ key: "pricing.ad", cfg: c.ad, color: "#8b5cf6" });
    if (c.fx.on) activeCosts.push({ key: "pricing.fx", cfg: c.fx, color: "#0ea5e9" });
    s.custom.forEach((x, i) => { if (x.on) activeCosts.push({ key: null, name: x.name, cfg: x, color: `hsl(${(i * 67) % 360} 70% 55%)` }); });

    let ratioSum = commission / 100;
    let fixed = ship + purchase;
    activeCosts.forEach((a) => {
      if (a.cfg.mode === "ratio") ratioSum += (+a.cfg.ratio || 0) / 100;
      else fixed += +a.cfg.manual || 0;
    });

    const denom = 1 - ratioSum;
    let P = 0, net = 0, valid = false;
    if (s.netMode === "percent") {
      const pct = (+s.netPct || 0) / 100;
      const d2 = denom - pct;
      valid = d2 > 0;
      P = valid ? fixed / d2 : 0;
      net = P * pct;
    } else {
      net = +s.net || 0;
      valid = denom > 0;
      P = valid ? (net + fixed) / denom : 0;
    }

    const comps = activeCosts.map((a) => ({
      label: a.name || I18N.t(a.key),
      color: a.color,
      amt: a.cfg.mode === "ratio" ? P * (+a.cfg.ratio || 0) / 100 : (+a.cfg.manual || 0),
    }));
    const commissionAmt = P * commission / 100;
    const extraCosts = comps.reduce((sum, x) => sum + x.amt, 0); // 额外添加的产品与费用
    const netGain = net + purchase + extraCosts;                  // 净收益

    // 体积重 = 长×宽×高(cm) ÷ 6000；计费重取毛重与体积重较大者
    const volWeight = ((+s.L || 0) * (+s.W || 0) * (+s.H || 0)) / 6000;
    const gross = +s.gross || 0;
    const chargeWeight = Math.max(gross, volWeight);

    return { ship, purchase, P, denom: ratioSum, comps, commissionAmt, net, netGain, extraCosts, valid, volWeight, chargeWeight };
  }

  function costRows() {
    // 两行卡片式：第一行 = 开关 + 完整成本名称；第二行 = 比例 / 手动金额 / 单位 / 删除
    const row = (id, name, cfg, fixedName) => `
      <div class="cost-row" data-cost="${id}">
        <div class="cr-top">
          <label class="switch"><input type="checkbox" class="c-on" ${cfg.on ? "checked" : ""}><span class="track"></span></label>
          <input type="text" class="c-name" value="${U.esc(fixedName ? I18N.t(name) : (cfg.name || ""))}" ${fixedName ? "readonly" : ""} placeholder="${I18N.t("pricing.customName")}" title="${U.esc(fixedName ? I18N.t(name) : (cfg.name || ""))}">
          ${fixedName ? "" : `<button class="rm c-del" title="${I18N.t("common.delete")}">✕</button>`}
        </div>
        <div class="cr-bot">
          <label class="cr-fld"><span>${I18N.t("pricing.ratio")}</span>
            <input type="number" class="c-ratio" value="${cfg.ratio}" step="any" ${cfg.mode === "manual" ? "disabled" : ""}></label>
          <label class="cr-fld"><span>${I18N.t("pricing.manual")}</span>
            <input type="number" class="c-manual" value="${cfg.manual}" step="any" ${cfg.mode === "ratio" ? "disabled" : ""}></label>
          <label class="cr-fld cr-fld-mode"><span>${I18N.t("pricing.mode")}</span>
            <select class="c-mode"><option value="ratio" ${cfg.mode === "ratio" ? "selected" : ""}>%</option><option value="manual" ${cfg.mode === "manual" ? "selected" : ""}>$</option></select></label>
        </div>
      </div>`;
    let html = "";
    html += row("aftersale", "pricing.aftersale", s.costs.aftersale, true);
    html += row("ad", "pricing.ad", s.costs.ad, true);
    html += row("fx", "pricing.fx", s.costs.fx, true);
    s.custom.forEach((x, i) => { html += row("custom_" + i, null, x, false); });
    return html;
  }

  function openMercado() {
    const view = document.getElementById("view-pricing");
    if (!view) return;
    const r = calc();
    const pctChips = [10, 15, 20, 25, 30].map((p) =>
      `<button type="button" class="pct-chip ${+s.netPct === p ? "active" : ""}" data-pct="${p}">${p}%</button>`).join("");

    view.innerHTML = `
      <button class="back-btn" id="calcBack">${I18N.t("pricing.back")}</button>
      <div class="page-head"><h1>${I18N.t("pricing.gallery.mercado")}</h1><p>${I18N.t("pricing.sub")}</p></div>
      ${editingId ? `<div class="edit-banner">✏️ ${I18N.t("pricing.editingHint")}<button class="btn ghost sm" id="cancelEdit">${I18N.t("common.cancel")}</button></div>` : ""}
      <div class="calc3">
        <!-- ① 产品与参数 -->
        <div class="calc3-col">
          <div class="card">
            <div class="col-head"><span class="col-ico">📦</span>${I18N.t("pricing.colProduct")}</div>
            <label class="field"><span>${I18N.t("pricing.name")}</span><input type="text" id="pName" value="${U.esc(s.name)}" placeholder="${I18N.t("pricing.namePH")}"></label>
            <label class="field"><span>${I18N.t("pricing.platform")}</span><input type="text" id="pPlatform" value="${U.esc(s.platform)}" placeholder="${I18N.t("pricing.platformPH")}"></label>
            <label class="field"><span>${I18N.t("pricing.classification")}</span><input type="text" id="pClass" value="${U.esc(s.classification)}" placeholder="${I18N.t("pricing.classPH")}"></label>
            <label class="field"><span>${I18N.t("pricing.dimensions")}</span>
              <div class="dim-row">
                <input type="number" id="pL" value="${s.L}" step="any" placeholder="L">
                <span class="dim-x">×</span>
                <input type="number" id="pW" value="${s.W}" step="any" placeholder="W">
                <span class="dim-x">×</span>
                <input type="number" id="pH" value="${s.H}" step="any" placeholder="H">
              </div>
            </label>
            <label class="field"><span>${I18N.t("pricing.grossWeight")}</span><input type="number" id="pGross" value="${s.gross}" step="any"></label>
            <div class="vol-box" id="volBox"></div>
            <div class="row">
              <label class="field"><span>${I18N.t("pricing.commission")}</span><input type="number" id="pComm" value="${s.commission}" step="any"></label>
              <label class="field"><span>${I18N.t("pricing.purchase")}</span><input type="number" id="pPurchase" value="${s.purchase}" step="any" placeholder="0"></label>
            </div>
            <label class="field"><span>${I18N.t("pricing.ship")}</span><input type="number" id="pShip" value="${s.ship}" step="any" placeholder="0"></label>
          </div>
        </div>

        <!-- ② 成本与费用 -->
        <div class="calc3-col">
          <div class="card">
            <div class="col-head"><span class="col-ico">💸</span>${I18N.t("pricing.colCost")}</div>
            <div id="costRows">${costRows()}</div>
            <button class="btn ghost sm" id="addCost" style="margin-top:6px">${I18N.t("pricing.addCustom")}</button>
          </div>
          <div class="card">
            <div class="col-head"><span class="col-ico">🎯</span>${I18N.t("pricing.netIncome")}</div>
            <div class="seg" id="netModeSeg" style="margin-left:0">
              <button type="button" class="seg-btn ${s.netMode === "manual" ? "active" : ""}" data-netmode="manual">${I18N.t("pricing.netManual")}</button>
              <button type="button" class="seg-btn ${s.netMode === "percent" ? "active" : ""}" data-netmode="percent">${I18N.t("pricing.netPercent")}</button>
            </div>
            <div id="netManualBox" style="margin-top:10px;${s.netMode === "manual" ? "" : "display:none"}">
              <label class="field"><span>${I18N.t("pricing.netValue")}</span><input type="number" id="pNet" value="${s.net}" step="any"></label>
            </div>
            <div id="netPctBox" style="margin-top:10px;${s.netMode === "percent" ? "" : "display:none"}">
              <div class="pct-chips" id="netPctChips">${pctChips}</div>
              <div class="hint">${I18N.t("pricing.netPctHint")}</div>
            </div>
          </div>
        </div>

        <!-- ③ 定价结果 -->
        <div class="calc3-col calc3-col-result">
          <div class="card">
            <div class="col-head"><span class="col-ico">🏷️</span>${I18N.t("pricing.colResult")}</div>
            <div id="pResult"></div>
            <div class="row" style="margin-top:14px;gap:10px">
              <button class="btn block" id="copyPrice" style="flex:1">${I18N.t("common.copy")} ${I18N.t("pricing.suggestedPrice")}</button>
              <button class="btn block primary" id="saveKB" style="flex:1">💾 ${I18N.t(editingId ? "pricing.updateKB" : "pricing.saveToKB")}</button>
            </div>
          </div>
        </div>
      </div>
    `;

    bindInputs();
    bindCostRows();
    view.querySelector("#calcBack").onclick = () => { current = null; clearEditing(); renderGallery(); };
    const cancelBtn = view.querySelector("#cancelEdit");
    if (cancelBtn) cancelBtn.onclick = () => {
      clearEditing();
      s = Object.assign(def(), {}); save();
      current = null; renderGallery(); U.toast(I18N.t("pricing.editCanceled"));
    };
    view.querySelector("#addCost").onclick = () => { s.custom.push({ on: true, mode: "ratio", ratio: 5, manual: 0, name: "" }); save(); renderCostRows(); updateResult(); };
    view.querySelector("#copyPrice").onclick = () => { const rr = calc(); U.copy(U.money(rr.P * rate(s.activeCur), s.activeCur)); };
    view.querySelector("#saveKB").onclick = () => saveToKB();
    updateResult();
    updateVolBox();
  }

  // 体积重 / 计费重 提示条
  function updateVolBox() {
    const box = document.getElementById("volBox");
    if (!box) return;
    const r = calc();
    const gross = +s.gross || 0;
    const vol = r.volWeight || 0;
    const billable = r.chargeWeight || 0;
    const volWins = vol > gross && vol > 0;
    box.innerHTML = `
      <span>${I18N.t("pricing.volWeight")}: <b>${U.precise(vol, 3)} kg</b></span>
      <span>${I18N.t("pricing.chargeWeight")}: <b>${U.precise(billable, 3)} kg</b></span>
      ${volWins ? `<span class="vol-warn">⚠ 按体积重计费</span>` : ""}
      <span style="flex-basis:100%;color:var(--text-mute)">${I18N.t("pricing.volWeightHint")}</span>
    `;
  }

  function bindInputs() {
    const el = document.getElementById("view-pricing");
    const set = (sel, prop, alsoVol) => { const e = el.querySelector(sel); if (e) e.oninput = () => { s[prop] = e.value; save(); updateResult(); if (alsoVol) updateVolBox(); }; };
    set("#pName", "name"); set("#pPlatform", "platform"); set("#pClass", "classification");
    set("#pComm", "commission"); set("#pGross", "gross", true);
    set("#pL", "L", true); set("#pW", "W", true); set("#pH", "H", true); set("#pShip", "ship");
    set("#pPurchase", "purchase"); set("#pNet", "net");

    // 期望净利润：手动金额 / 售价百分比 二选一
    const modeBtns = el.querySelectorAll("[data-netmode]");
    modeBtns.forEach((b) => b.onclick = () => {
      s.netMode = b.dataset.netmode;
      const manual = s.netMode === "manual";
      const mb = el.querySelector("#netManualBox"), pb = el.querySelector("#netPctBox");
      if (mb) mb.style.display = manual ? "" : "none";
      if (pb) pb.style.display = manual ? "none" : "";
      modeBtns.forEach((x) => x.classList.toggle("active", x === b));
      save(); updateResult();
    });

    const chips = el.querySelector("#netPctChips");
    if (chips) chips.querySelectorAll("[data-pct]").forEach((b) => b.onclick = () => {
      s.netPct = +b.dataset.pct;
      chips.querySelectorAll("[data-pct]").forEach((x) => x.classList.toggle("active", x === b));
      save(); updateResult();
    });
  }

  function renderCostRows() {
    const host = document.getElementById("costRows");
    if (!host) return;
    host.innerHTML = costRows();
    bindCostRows();
  }

  function bindCostRows() {
    const el = document.getElementById("view-pricing");
    el.querySelectorAll(".cost-row[data-cost]").forEach((row) => {
      const id = row.dataset.cost;
      const cfg = id.startsWith("custom_") ? s.custom[+id.split("_")[1]] : s.costs[id];
      row.querySelector(".c-on").onchange = (e) => { cfg.on = e.target.checked; save(); updateResult(); };
      const nameI = row.querySelector(".c-name");
      if (nameI && !nameI.hasAttribute("readonly")) nameI.oninput = (e) => { cfg.name = e.target.value; save(); };
      row.querySelector(".c-ratio").oninput = (e) => { cfg.ratio = e.target.value; save(); updateResult(); };
      row.querySelector(".c-manual").oninput = (e) => { cfg.manual = e.target.value; save(); updateResult(); };
      row.querySelector(".c-mode").onchange = (e) => {
        cfg.mode = e.target.value; save();
        const ratioI = row.querySelector(".c-ratio"), manualI = row.querySelector(".c-manual");
        if (cfg.mode === "manual") { ratioI.disabled = true; manualI.disabled = false; }
        else { ratioI.disabled = false; manualI.disabled = true; }
        updateResult();
      };
      const del = row.querySelector(".c-del");
      if (del) del.onclick = () => { s.custom.splice(+id.split("_")[1], 1); save(); renderCostRows(); updateResult(); };
    });
  }

  // 只刷新结果区，绝不重建输入框 → 连续输入、小数点输入都不丢焦点
  function updateResult() {
    const host = document.getElementById("pResult");
    if (!host) return;
    const r = calc();

    const tabs = s.displayCurs.map((c) =>
      `<button class="cur-tab ${c === s.activeCur ? "active" : ""}" data-cur="${c}">${c}</button>`).join("");

    let bar = "", bd = "";
    if (r.valid && r.P > 0) {
      const segs = [{ l: I18N.t("pricing.shipping"), v: r.ship, c: "#ef4444" },
        { l: I18N.t("pricing.commissionCost"), v: r.commissionAmt, c: "#2f6df6" }]
        .concat(r.comps.map((x) => ({ l: x.label, v: x.amt, c: x.color })))
        .concat([{ l: I18N.t("pricing.purchaseShort"), v: r.purchase, c: "#a855f7" }])
        .concat([{ l: I18N.t("pricing.net"), v: r.net, c: "#22c55e" }]);
      segs.forEach((x) => { const pct = (x.v / r.P) * 100; if (pct > 0) bar += `<div style="width:${pct}%;background:${x.c}" title="${U.esc(x.l)}"></div>`; });
      segs.forEach((x) => { bd += `<div class="result-row"><span class="k"><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${x.c};margin-right:6px"></span>${U.esc(x.l)}</span><span class="v">${U.money(x.v, "USD")}</span></div>`; });
    }

    const convPills = s.displayCurs.map((c) => `<span class="pill">${c} ${U.money(r.P * rate(c), c)}</span>`).join(" ");

    const netModeLabel = s.netMode === "percent"
      ? `${I18N.t("pricing.net")} · ${s.netPct}%`
      : `${I18N.t("pricing.net")}`;

    host.innerHTML = `
      <div class="cur-tabs">${tabs}<button class="cur-tab" id="addCur" style="background:transparent">＋</button></div>
      <div class="result-big">${U.money(r.P * rate(s.activeCur), s.activeCur)}</div>
      <div class="hint" style="margin-top:4px">${I18N.t("pricing.suggestedPrice")} · ${convPills}</div>
      <div class="breakdown-bar">${bar}</div>
      ${bd}
      <div class="result-row net-gain-row"><span class="k">${I18N.t("pricing.netGain")}</span><span class="v">${U.money(r.netGain, "USD")}</span></div>
      <div class="hint">${I18N.t("pricing.netGainFormula")}</div>
      <div class="hint" style="margin-top:6px">${I18N.t("pricing.shipNote")}${online ? "" : " · ⚠ " + I18N.t("rates.offlineNote")}</div>
    `;

    host.querySelectorAll(".cur-tab[data-cur]").forEach((b) => b.onclick = () => { s.activeCur = b.dataset.cur; save(); updateResult(); });
    const addBtn = host.querySelector("#addCur");
    if (addBtn) addBtn.onclick = () => addCurPrompt();
  }

  function addCurPrompt() {
    const m = U.modal(`
      <h3>${I18N.t("pricing.addCur")}</h3>
      <label class="field"><span>ISO 4217</span><input type="text" id="nc" placeholder="EUR / JPY / BRL ..." style="text-transform:uppercase"></label>
      <div class="actions"><button class="btn ghost" id="ncCancel">${I18N.t("common.cancel")}</button><button class="btn" id="ncOk">${I18N.t("common.add")}</button></div>
    `);
    m.querySelector("#ncCancel").onclick = m.closeModal;
    m.querySelector("#ncOk").onclick = () => {
      const v = m.querySelector("#nc").value.trim().toUpperCase();
      if (!v || !/^[A-Z]{3}$/.test(v)) { U.toast("3-letter code"); return; }
      if (!s.displayCurs.includes(v)) { s.displayCurs.push(v); }
      s.activeCur = v; save();
      m.closeModal(); updateResult();
    };
  }

  function buildSummary(r) {
    const lines = [];
    lines.push(`${I18N.t("pricing.platform")}${I18N.t("common.labelSep")}${s.platform || "-"}${I18N.t("common.colSep")}${I18N.t("pricing.classification")}${I18N.t("common.labelSep")}${s.classification || "-"}`);
    lines.push(`${I18N.t("pricing.commission")} ${s.commission}%`);
    lines.push(`${I18N.t("pricing.grossWeight")}${I18N.t("common.labelSep")}${s.gross}kg${I18N.t("common.colSep")}${I18N.t("pricing.dimensions")}${I18N.t("common.labelSep")}${s.L}×${s.W}×${s.H}cm`);
    // 列分隔符 / 标签冒号统一走 i18n，避免英文界面混入全角符号
    const COL = I18N.t("common.colSep");
    const SEP = I18N.t("common.labelSep");
    lines.push(`${I18N.t("pricing.purchase")}${SEP}$${U.num(s.purchase)}${COL}${I18N.t("pricing.ship")}${SEP}$${U.num(s.ship)}`);
    lines.push(`${I18N.t("pricing.netIncome")}${SEP}${s.netMode === "percent" ? s.netPct + "% " + I18N.t("pricing.netPercent") : "$" + U.num(s.net)}`);
    const curParts = s.displayCurs.map((c) => `${c} ${U.num(r.P * rate(c), 2)}`).join(COL);
    lines.push(`${I18N.t("pricing.suggestedPrice")}${SEP}$${U.num(r.P, 2)}${I18N.t("common.parenL")}${curParts}${I18N.t("common.parenR")}`);
    lines.push(`${I18N.t("pricing.netGain")}${SEP}$${U.num(r.netGain, 2)}`);
    const costLines = r.comps.map((x) => `${x.label}: $${U.num(x.amt, 2)}`).join(COL);
    if (costLines) lines.push(`${I18N.t("pricing.costs")}${I18N.t("common.labelSep")}${costLines}`);
    return lines.join("\n");
  }

  // 组装一条定价记录的完整快照：产品信息 + 成本明细 + 定价结果 + 多币种换算
  function buildRecord(r) {
    // 成本明细（含金额与占比；占比四舍五入到 4 位小数，避免浮点误差在编辑回填时显示成长串）
    const costs = r.comps.map((x) => ({
      label: x.label,
      color: x.color,
      amt: Math.round(x.amt * 10000) / 10000,
      pct: r.P > 0 ? Math.round((x.amt / r.P) * 1000000) / 10000 : 0,
    }));
    // 分币种定价
    const currencies = (s.displayCurs || ["USD"]).map((c) => ({
      code: c,
      price: r.P * rate(c),
    }));
    return {
      // —— 产品信息 ——
      name: s.name || "",
      platform: s.platform || "",
      classification: s.classification || "",
      dims: { L: +s.L || 0, W: +s.W || 0, H: +s.H || 0 },
      gross: +s.gross || 0,
      volWeight: r.volWeight,
      chargeWeight: r.chargeWeight,
      commission: +s.commission || 0,
      // —— 成本 ——
      costs,
      purchase: r.purchase,
      ship: r.ship,
      commissionAmt: r.commissionAmt,
      extraCosts: r.extraCosts,
      // —— 定价结果 ——
      netMode: s.netMode,
      netPct: +s.netPct || 0,
      price: r.P,
      netProfit: r.net,
      netGain: r.netGain,
      // —— 币种 ——
      activeCur: s.activeCur,
      currencies,
      rateDate: rateUpdated,
      // —— 可复制文本 ——
      summary: buildSummary(r),
    };
  }

  // 把一条已保存的定价记录回填到计算器状态（用于二次编辑）
  function editRecord(rec) {
    if (!rec) return;
    const d = rec.dims || {};
    s.name = rec.name || "";
    s.platform = rec.platform || "";
    s.classification = rec.classification || "";
    s.L = +d.L || 0;
    s.W = +d.W || 0;
    s.H = +d.H || 0;
    s.gross = +rec.gross || 0;
    s.commission = +rec.commission || 0;
    s.purchase = +rec.purchase || 0;
    s.ship = +rec.ship || 0;
    s.netMode = rec.netMode || "manual";
    s.netPct = +rec.netPct || 15;
    // 净收入金额：记录里存的是算出来的净利润，回填到手动模式输入框
    s.net = +rec.netProfit || 0;
    if (Array.isArray(rec.currencies) && rec.currencies.length) {
      s.displayCurs = rec.currencies.map((c) => c.code);
    }
    if (rec.activeCur) s.activeCur = rec.activeCur;

    // 还原成本：固定三项 + 自定义项
    const FIXED = { "aftersale": "pricing.aftersale", "ad": "pricing.ad", "fx": "pricing.fx" };
    const byLabel = {};
    (rec.costs || []).forEach((c) => { byLabel[c.label] = c; });
    // 固定项按 i18n 标签匹配
    const fixedKeys = { aftersale: I18N.t("pricing.aftersale"), ad: I18N.t("pricing.ad"), fx: I18N.t("pricing.fx") };
    Object.keys(fixedKeys).forEach((k) => {
      const c = byLabel[fixedKeys[k]];
      if (c) {
        s.costs[k].on = true;
        s.costs[k].ratio = +c.pct || 0;
      } else {
        s.costs[k].on = false;
      }
    });
    // 其余视为自定义成本
    const fixedLabels = Object.values(fixedKeys);
    s.custom = (rec.costs || [])
      .filter((c) => fixedLabels.indexOf(c.label) < 0)
      .map((c) => ({ on: true, mode: "ratio", ratio: +c.pct || 0, manual: 0, name: c.label || "" }));

    editingId = rec.id || null;
    save();
  }

  function editById(id) {
    const rec = (window.CRM && CRM.getPricing) ? CRM.getPricing(id) : null;
    if (!rec) return;
    editRecord(rec);
    current = "mercado";
    App.setView("pricing");
    openCalc();
    U.toast(I18N.t("pricing.editingHint"));
  }

  function clearEditing() { editingId = null; }

  async function saveToKB() {
    const r = calc();
    if (!r.valid || !(r.P > 0)) { U.toast(I18N.t("pricing.invalid")); return; }
    const rec = buildRecord(r);
    if (window.CRM && CRM.savePricing) {
      U.toast(I18N.t("pricing.savingKB"));
      await CRM.savePricing(rec, editingId);
      U.toast("✓ " + I18N.t(editingId ? "pricing.updatedKB" : "pricing.savedKB"));
      editingId = null;
      App.setView("crm");
      CRM.showTab("pricing");
    } else {
      U.toast("CRM unavailable");
    }
  }

  // 注册计算器：美客多为上线版，其余为占位（后续接入真实平台逻辑即可）
  registerCalc({ id: "mercado", icon: "🧮", key: "pricing.gallery.mercado", descKey: "pricing.gallery.mercadoDesc", status: "ready", open: openMercado });
  registerCalc({ id: "amazon", icon: "📦", key: "pricing.gallery.amazon", descKey: "pricing.gallery.amazonDesc", status: "soon" });
  registerCalc({ id: "shopee", icon: "🛒", key: "pricing.gallery.shopee", descKey: "pricing.gallery.shopeeDesc", status: "soon" });
  registerCalc({ id: "aliexpress", icon: "🌐", key: "pricing.gallery.aliexpress", descKey: "pricing.gallery.aliexpressDesc", status: "soon" });
  registerCalc({ id: "temu", icon: "🛍️", key: "pricing.gallery.temu", descKey: "pricing.gallery.temuDesc", status: "soon" });

  function init() { renderGallery(); fetchRates(); }
  function onShow() { render(); }
  return { init, onShow, editRecord, editById, clearEditing, get editingId() { return editingId; } };
})();

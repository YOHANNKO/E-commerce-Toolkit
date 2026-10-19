/* ===== World Clock module (offline fuzzy + online city search) ===== */
window.Clock = (function () {
  const KEY = "cb_clocks";        // [{ id, pinned }]
  const KEY_H12 = "cb_clock_h12"; // "1" | "0" —— 12/24 小时制
  const DEFAULT = ["Asia/Shanghai", "America/Los_Angeles", "America/New_York", "America/Mexico_City", "Europe/Berlin", "Europe/London"];
  let list = loadList();
  let timer = null;
  let searchTimer = null;

  // ---------- 12/24 小时制 ----------
  let h12 = localStorage.getItem(KEY_H12) === "1";
  function setH12(v) { h12 = !!v; localStorage.setItem(KEY_H12, h12 ? "1" : "0"); }

  // ---------- 模拟时间模式 ----------
  // simTz 非空即处于模拟模式：以 simTz 这张卡片为基准
  // simBase 是「基准时区在该时刻的本地时间」→ 用 Date.UTC 反推出真实 UTC 时间点
  let simTz = null;
  let simBase = null;    // Date 对象，表示基准时区「墙上时间」被当作 UTC 构造的时刻
  let simStep = 15;      // 分钟步进：1 / 15 / 60

  // ---------- 列表读写与旧数据迁移 ----------
  // 老版本存的是 ["Asia/Shanghai", ...] 纯字符串数组，这里统一升级为对象数组
  function loadList() {
    const raw = U.store(KEY);
    if (!Array.isArray(raw)) return DEFAULT.map((id) => ({ id, pinned: false }));
    if (!raw.length) return [];
    return raw.map((x) =>
      typeof x === "string" ? { id: x, pinned: false } : { id: x.id, pinned: !!x.pinned }
    ).filter((x) => x && x.id);
  }
  function saveList() { U.store(KEY, list); }
  function ids() { return list.map((x) => x.id); }
  function isPinned(id) { const e = list.find((x) => x.id === id); return !!(e && e.pinned); }

  // 置顶的排在前面；两组内部保持各自的相对顺序
  function orderedList() {
    const pin = list.filter((x) => x.pinned);
    const rest = list.filter((x) => !x.pinned);
    return pin.concat(rest);
  }

  function meta(id) {
    const t = DB.TIMEZONES.find((t) => t.id === id);
    if (t) return t;
    const a = DB.CITY_ALIAS.find((x) => x.tz === id);
    if (a) return { id, zh: a.zh, en: a.en, flag: a.flag };
    const city = id.split("/").pop().replace(/_/g, " ");
    return { id, zh: city, en: city, flag: "🌐" };
  }
  function validTZ(tz) {
    try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch (e) { return false; }
  }

  // ---------- 时间基准：实时 or 模拟 ----------
  // 所有取当前时间的函数都必须走 nowPoint()，模拟模式才能全局接管
  function nowPoint() {
    if (simTz && simBase) {
      // simBase 是把「基准时区墙上时间」当作 UTC 构造的 Date，
      // 因此真实的 UTC 毫秒数 = simBase.getTime() - 基准时区偏移
      return new Date(simBase.getTime() - tzOffsetMs(simTz, simBase));
    }
    return new Date();
  }
  // 某时区在某一时刻的 UTC 偏移（毫秒）
  function tzOffsetMs(tz, at) {
    try {
      const d = at || new Date();
      const local = new Date(d.toLocaleString("en-US", { timeZone: tz }));
      const utc = new Date(d.toLocaleString("en-US", { timeZone: "UTC" }));
      return local - utc;
    } catch (e) { return 0; }
  }

  // 取某时区当前的「墙上时间」各部分
  // 返回 { h, m, s, time, hhmm, ampm, dayShift }
  function parts(tz) {
    const at = nowPoint();
    const f = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const p = f.formatToParts(at);
    const g = (t) => p.find((x) => x.type === t).value;
    const h = parseInt(g("hour"), 10) % 24; // en-GB 可能给出 24:xx
    const m = parseInt(g("minute"), 10);
    const s = parseInt(g("second"), 10);
    const hhmm = String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");

    let time;
    if (h12) {
      const ap = h < 12 ? "AM" : "PM";
      const hh = h % 12 === 0 ? 12 : h % 12;
      time = `${String(hh).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")} ${ap}`;
    } else {
      time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }

    // 相对基准卡片的天数偏移（模拟模式下最有用：一眼看出目标时区是今天/明天/昨天）
    let dayShift = 0;
    if (simTz) {
      dayShift = tzDayDiff(tz, simTz, at);
    }
    return { h, m, s, time, hhmm, dayShift };
  }

  // 同一时刻，两个时区的「日历日」相差几天
  function tzDayDiff(tzA, tzB, at) {
    const dayNum = (tz) => {
      const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
      const [y, mo, d] = f.format(at).split("-").map(Number);
      return Date.UTC(y, mo - 1, d) / 86400000;
    };
    try { return dayNum(tzA) - dayNum(tzB); } catch (e) { return 0; }
  }

  function dateStr(tz) {
    const lang = I18N.getLang() === "zh" ? "zh-CN" : "en-US";
    return new Intl.DateTimeFormat(lang, { timeZone: tz, year: "numeric", month: "short", day: "numeric", weekday: "short" }).format(nowPoint());
  }

  // UTC 偏移，如 +08:00（实时计算，与模拟无关）
  function utcOffset(tz) {
    try {
      const mins = Math.round(tzOffsetMs(tz) / 60000);
      const sign = mins < 0 ? "-" : "+";
      const a = Math.abs(mins);
      return "UTC" + sign + String(Math.floor(a / 60)).padStart(2, "0") + ":" + String(a % 60).padStart(2, "0");
    } catch (e) { return ""; }
  }

  // 相对北京的时差描述（如「晚 15 小时」「同日」）
  function diffFromHome(tz) {
    try {
      const home = "Asia/Shanghai";
      if (tz === home) return I18N.t("clock.sameAsHome");
      const h = Math.round((tzOffsetMs(tz) - tzOffsetMs(home)) / 3600000);
      if (h === 0) return I18N.t("clock.sameAsHome");
      return h > 0 ? I18N.t("clock.ahead", { n: h }) : I18N.t("clock.behind", { n: -h });
    } catch (e) { return ""; }
  }

  // ---------- 模拟时间的构造 ----------
  // 用基准时区的「墙上时间」初始化模拟基准（取该时区此刻的时分）
  function startSim(tz) {
    const p = parts(tz);
    const d = new Date();
    simBase = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), p.h, p.m, 0));
    simTz = tz;
    render();
  }
  function exitSim() { simTz = null; simBase = null; render(); }

  // 模拟基准的时分（用于滑块显示）
  function simHM() {
    if (!simBase) return { h: 0, m: 0 };
    return { h: simBase.getUTCHours(), m: simBase.getUTCMinutes() };
  }
  // 把滑块值（分钟数）写回模拟基准，跨天由 Date 自动进位
  function applySimMinutes(totalMin) {
    if (!simBase) return;
    const d = new Date(Date.UTC(
      simBase.getUTCFullYear(), simBase.getUTCMonth(), simBase.getUTCDate(),
      0, 0, 0
    ));
    d.setUTCMinutes(totalMin);
    simBase = d;
  }

  // ---------- 渲染 ----------
  function render() {
    const el = document.getElementById("view-clock");
    if (!el) return;
    const ordered = orderedList();

    const cards = ordered.map((entry) => {
      const id = entry.id;
      const m = meta(id);
      const pp = parts(id);
      const isDay = pp.h >= 6 && pp.h < 18;
      const isSim = simTz === id;
      const pinned = !!entry.pinned;

      // 模拟模式下的跨天角标（+1 / -1）
      let shiftBadge = "";
      if (simTz && pp.dayShift !== 0) {
        const sign = pp.dayShift > 0 ? "+" : "";
        shiftBadge = `<span class="shift-badge ${pp.dayShift > 0 ? "plus" : "minus"}">${sign}${pp.dayShift}${I18N.t("clock.daySuffix")}</span>`;
      }

      return `<div class="clock-card hoverable ${isDay ? "is-day" : "is-night"}${pinned ? " is-pinned" : ""}${isSim ? " is-sim" : ""}"
          data-card="${id}">
        <button class="ck-rm rm off" data-rm="${id}" title="${I18N.t("common.remove")}">✕</button>
        <div class="ck-top">
          <span class="ck-flag">${m.flag}</span>
          <div class="ck-id">
            <div class="city">${I18N.getLang() === "zh" ? m.zh : m.en}${isSim ? ` <span class="sim-tag">${I18N.t("clock.simTag")}</span>` : ""}</div>
            <div class="zone">${utcOffset(id)} · ${id}</div>
          </div>
          <span class="day-badge ${isDay ? "day" : "night"}">${isDay ? "☀️ " + I18N.t("clock.day") : "🌙 " + I18N.t("clock.night")}</span>
        </div>
        <div class="time" data-time="${id}">${pp.time}</div>
        <div class="ck-foot">
          <span class="date" data-date="${id}">${dateStr(id)}</span>
          ${shiftBadge}
          <span class="ck-diff">${diffFromHome(id)}</span>
        </div>
        <button class="ck-pin" data-pin="${id}" title="${I18N.t(pinned ? "clock.unpin" : "clock.pin")}">
          <span class="tp-ico">${pinned ? "📌" : "📍"}</span>
        </button>
      </div>`;
    }).join("");

    const pool = DB.TIMEZONES.filter((t) => !ids().includes(t.id))
      .map((t) => `<button class="chip" data-add="${t.id}">
        <span>${t.flag}</span><b>${I18N.getLang()==="zh"?t.zh:t.en}</b>
        <span class="muted" style="font-weight:600;font-size:11px">${utcOffset(t.id)}</span>
        <span class="plus">＋</span></button>`).join("");

    el.innerHTML = `
      <div class="ph">
        <span class="ph-ico">🕐</span>
        <div class="ph-txt">
          <h1>${I18N.t("clock.title")}</h1>
          <p>${I18N.t("clock.sub")}</p>
        </div>
        <div class="ph-actions">
          <span class="pill">🌍 ${I18N.t("clock.count", { n: list.length })}</span>
          <button class="pill pill-btn" id="ckFmt" title="${I18N.t("clock.fmtTip")}">
            ${h12 ? I18N.t("clock.h12") : I18N.t("clock.h24")}
          </button>
        </div>
      </div>
      ${simTz ? simBar() : ""}
      <div class="card">
        <div class="clock-grid">${cards || `<div class="empty2"><span class="ico">🕐</span><span class="t">${I18N.t("clock.emptyTitle")}</span><span class="s">${I18N.t("clock.emptyHint")}</span></div>`}</div>
        ${list.length ? `<div class="ck-hint">${I18N.t("clock.dragHint")}</div>` : ""}
      </div>
      <div class="card">
        <div class="card-title">＋ ${I18N.t("clock.addCity")}</div>
        <div class="clock-search">
          <div class="row" style="align-items:flex-end">
            <input type="text" id="tzInput" placeholder="${I18N.t("clock.searchCities")}" autocomplete="off">
            <button class="btn" id="tzAdd">${I18N.t("clock.addByCity")}</button>
          </div>
          <div class="suggest" id="tzSuggest"></div>
        </div>
        <div class="sec-title" style="margin-top:16px">${I18N.t("clock.popular")}</div>
        <div class="chips">${pool || `<span class="muted" style="font-size:12.5px">${I18N.t("clock.allAdded")}</span>`}</div>
      </div>
    `;

    bind(el);
  }

  // 模拟模式顶部的控制条
  function simBar() {
    const m = meta(simTz);
    const { h, m: mm } = simHM();
    const total = h * 60 + mm;
    const name = I18N.getLang() === "zh" ? m.zh : m.en;
    const disp = h12
      ? (() => { const ap = h < 12 ? "AM" : "PM"; const hh = h % 12 === 0 ? 12 : h % 12; return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")} ${ap}`; })()
      : `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    const steps = [
      { v: 1, label: I18N.t("clock.step1") },
      { v: 15, label: I18N.t("clock.step15") },
      { v: 60, label: I18N.t("clock.step60") },
    ].map((s) => `<button class="step-btn ${simStep === s.v ? "active" : ""}" data-step="${s.v}">${s.label}</button>`).join("");

    return `<div class="sim-bar">
      <div class="sim-head">
        <span class="sim-ico">⏱️</span>
        <div class="sim-txt">
          <b>${I18N.t("clock.simTitle", { city: name })}</b>
          <span>${I18N.t("clock.simHint")}</span>
        </div>
        <div class="sim-now">${disp}</div>
        <div class="sim-steps">${steps}</div>
        <button class="btn ghost sim-exit" id="simExit">${I18N.t("clock.simExit")}</button>
      </div>
      <input type="range" class="sim-range" id="simRange" min="0" max="1439" step="${simStep}" value="${total}">
      <div class="sim-scale">
        <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00</span>
      </div>
    </div>`;
  }

  function bind(el) {
    // ---- 删除 ----
    el.querySelectorAll("[data-rm]").forEach((b) => b.onclick = (e) => {
      e.stopPropagation();
      const id = b.dataset.rm;
      list = list.filter((x) => x.id !== id);
      if (simTz === id) { simTz = null; simBase = null; }
      saveList(); render();
    });

    // ---- 置顶 / 取消置顶 ----
    el.querySelectorAll("[data-pin]").forEach((b) => b.onclick = (e) => {
      e.stopPropagation();
      const id = b.dataset.pin;
      const entry = list.find((x) => x.id === id);
      if (entry) { entry.pinned = !entry.pinned; saveList(); render(); }
    });

    // ---- 双击进入模拟模式 ----
    el.querySelectorAll("[data-card]").forEach((c) => {
      c.ondblclick = (e) => {
        if (e.target.closest("[data-rm],[data-pin]")) return;
        const id = c.dataset.card;
        if (simTz === id) exitSim(); else startSim(id);
      };
    });

    // ---- 模拟条 ----
    const exit = el.querySelector("#simExit");
    if (exit) exit.onclick = exitSim;

    el.querySelectorAll("[data-step]").forEach((b) => b.onclick = () => {
      simStep = parseInt(b.dataset.step, 10);
      render();  // 步进变了要重画滑块
    });

    const range = el.querySelector("#simRange");
    if (range) {
      const onMove = () => {
        applySimMinutes(parseInt(range.value, 10));
        paintSim();  // 只更新数字，不整页重绘（避免拖动滑块时卡顿）
      };
      range.oninput = onMove;
      range.onchange = onMove;
    }

    // ---- 12/24 小时制 ----
    const fmt = el.querySelector("#ckFmt");
    if (fmt) fmt.onclick = () => { setH12(!h12); render(); };

    // ---- 添加城市 ----
    el.querySelectorAll("[data-add]").forEach((b) => b.onclick = () => {
      if (!ids().includes(b.dataset.add)) { list.push({ id: b.dataset.add, pinned: false }); saveList(); render(); }
    });
    el.querySelector("#tzAdd").onclick = () => {
      const v = el.querySelector("#tzInput").value.trim();
      if (!v) return;
      addTZ(v);
    };
    const input = el.querySelector("#tzInput");
    input.oninput = () => runSearch(input.value);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { const v = input.value.trim(); if (v) addTZ(v); } });

    document.removeEventListener("click", onDocClick);
    document.addEventListener("click", onDocClick);
  }

  // 只更新模拟相关的时间文本，不整页重绘
  function paintSim() {
    const el = document.getElementById("view-clock");
    if (!el) return;
    const { h, m } = simHM();
    const disp = h12
      ? (() => { const ap = h < 12 ? "AM" : "PM"; const hh = h % 12 === 0 ? 12 : h % 12; return `${String(hh).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ap}`; })()
      : `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const now = el.querySelector(".sim-now");
    if (now) now.textContent = disp;
    // 所有卡片的时间 + 日期 + 跨天角标
    orderedList().forEach((entry) => {
      const id = entry.id;
      const pp = parts(id);
      const t = el.querySelector(`[data-time="${id}"]`);
      const d = el.querySelector(`[data-date="${id}"]`);
      if (t) t.textContent = pp.time;
      if (d) d.textContent = dateStr(id);
      const card = el.querySelector(`[data-card="${id}"]`);
      if (card) {
        const isDay = pp.h >= 6 && pp.h < 18;
        card.classList.toggle("is-day", isDay);
        card.classList.toggle("is-night", !isDay);
        // 昼夜徽章的文案与配色也要跟着刷新（否则会出现「23:00 显示白天」的矛盾）
        const badge = card.querySelector(".day-badge");
        if (badge) {
          badge.className = "day-badge " + (isDay ? "day" : "night");
          badge.textContent = isDay ? "☀️ " + I18N.t("clock.day") : "🌙 " + I18N.t("clock.night");
        }
        // 更新跨天角标
        const old = card.querySelector(".shift-badge");
        if (pp.dayShift !== 0) {
          const sign = pp.dayShift > 0 ? "+" : "";
          const html = `${sign}${pp.dayShift}${I18N.t("clock.daySuffix")}`;
          if (old) { old.textContent = html; old.className = "shift-badge " + (pp.dayShift > 0 ? "plus" : "minus"); }
          else {
            const foot = card.querySelector(".ck-foot");
            const b = document.createElement("span");
            b.className = "shift-badge " + (pp.dayShift > 0 ? "plus" : "minus");
            b.textContent = html;
            foot.insertBefore(b, foot.querySelector(".ck-diff"));
          }
        } else if (old) old.remove();
      }
    });
  }

  function onDocClick(e) {
    const box = document.querySelector(".clock-search");
    if (box && !box.contains(e.target)) hideSuggest();
  }

  function hideSuggest() {
    const s = document.getElementById("tzSuggest");
    if (s) { s.innerHTML = ""; s.classList.remove("show"); }
  }

  function runSearch(q) {
    q = (q || "").trim();
    const sug = document.getElementById("tzSuggest");
    if (!sug) return;
    if (!q) { hideSuggest(); return; }
    clearTimeout(searchTimer);

    const offline = offlineMatches(q);
    paintSuggest(offline, false);

    searchTimer = setTimeout(async () => {
      paintSuggest(offline, true);
      const online = await onlineMatches(q);
      const merged = mergeResults(offline, online);
      paintSuggest(merged, false);
    }, 260);
  }

  function offlineMatches(q) {
    const qq = q.toLowerCase();
    const out = [];
    DB.CITY_ALIAS.forEach((a) => {
      if (a.zh.toLowerCase().includes(qq) || a.en.toLowerCase().includes(qq) || a.tz.toLowerCase().includes(qq))
        out.push({ tz: a.tz, name: I18N.getLang() === "zh" ? a.zh : a.en, flag: a.flag, country: "" });
    });
    DB.ALL_ZONES.forEach((z) => {
      const parts = z.split("/");
      const city = parts.pop().replace(/_/g, " ").toLowerCase();
      const region = parts.join("/").toLowerCase();
      if (city.includes(qq) || z.toLowerCase().includes(qq))
        out.push({ tz: z, name: city.replace(/\b\w/g, (c) => c.toUpperCase()), flag: "🌐", country: region });
    });
    return dedupe(out).slice(0, 10);
  }

  async function onlineMatches(q) {
    try {
      const lang = I18N.getLang() === "zh" ? "zh" : "en";
      const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=${lang}`;
      const r = await fetch(url);
      const d = await r.json();
      if (d && d.results) {
        return dedupe(d.results
          .filter((x) => x.timezone && validTZ(x.timezone))
          .map((x) => ({ tz: x.timezone, name: x.name, flag: "🌐", country: x.country || "" })));
      }
    } catch (e) {}
    return [];
  }

  function dedupe(arr) {
    const seen = new Set(); const out = [];
    arr.forEach((x) => { if (!seen.has(x.tz)) { seen.add(x.tz); out.push(x); } });
    return out;
  }
  function mergeResults(a, b) {
    const seen = new Set(a.map((x) => x.tz));
    b.forEach((x) => { if (!seen.has(x.tz)) { seen.add(x.tz); a.push(x); } });
    return a.slice(0, 12);
  }

  function paintSuggest(items, loading) {
    const sug = document.getElementById("tzSuggest");
    if (!sug) return;
    if (!items.length && !loading) { sug.innerHTML = `<div class="suggest-empty">${I18N.t("clock.noMatch")}</div>`; sug.classList.add("show"); return; }
    const rows = items.map((x) =>
      `<button class="suggest-item" data-tz="${U.esc(x.tz)}">
        <span class="sf">${x.flag}</span>
        <span class="sn">${U.esc(x.name)}</span>
        ${x.country ? `<span class="muted sm">${U.esc(x.country)}</span>` : ""}
        <span class="muted sm tz">${U.esc(x.tz)}</span>
      </button>`).join("");
    sug.innerHTML = (loading ? `<div class="suggest-loading">${I18N.t("clock.onlineSearch")}</div>` : "") + rows;
    sug.classList.add("show");
    sug.querySelectorAll(".suggest-item").forEach((b) => b.onmousedown = (e) => { e.preventDefault(); addTZ(b.dataset.tz); });
  }

  function addTZ(tz) {
    tz = (tz || "").trim();
    if (!validTZ(tz)) { U.toast(I18N.t("clock.invalidZone")); return; }
    if (ids().includes(tz)) { U.toast(I18N.t("clock.zoneAlready")); hideSuggest(); return; }
    list.push({ id: tz, pinned: false }); saveList();
    const input = document.getElementById("tzInput");
    if (input) input.value = "";
    hideSuggest();
    render();
  }

  // 实时模式下的秒级刷新（模拟模式下时间静止，不刷新）
  function tick() {
    if (simTz) return;
    orderedList().forEach((entry) => {
      const id = entry.id;
      const t = document.querySelector(`[data-time="${id}"]`);
      const d = document.querySelector(`[data-date="${id}"]`);
      if (t) t.textContent = parts(id).time;
      if (d) d.textContent = dateStr(id);
    });
  }

  function init() { render(); timer = setInterval(tick, 1000); }
  function onShow() { render(); }
  function cleanup() { document.removeEventListener("click", onDocClick); }

  return { init, onShow, cleanup };
})();

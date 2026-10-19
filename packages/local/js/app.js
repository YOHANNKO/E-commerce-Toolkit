/* ===== App shell: nav, i18n, theme ===== */
const App = (function () {
  const views = ["rates", "clock", "pricing", "crm", "todo", "knowledge", "convert", "editor", "translate", "datamgr"];
  const mods = { rates: Rates, clock: Clock, pricing: Pricing, crm: CRM, todo: Todo, knowledge: KB, convert: Convert, editor: ImageEditor, translate: Translate, datamgr: DataMgr };
  let booted = false;

  const NAV_ORDER_KEY = "cb_nav_order";

  function getNavOrder() {
    try { return JSON.parse(localStorage.getItem(NAV_ORDER_KEY)) || []; } catch { return []; }
  }
  function saveNavOrder() {
    const order = [...document.querySelectorAll("#nav .nav-item")].map((b) => b.dataset.view);
    localStorage.setItem(NAV_ORDER_KEY, JSON.stringify(order));
  }
  // 按 localStorage 里保存的顺序重排 DOM（新视图默认追加到末尾）
  function applyNavOrder() {
    const nav = document.getElementById("nav");
    if (!nav) return;
    const items = [...nav.querySelectorAll(".nav-item")];
    const saved = getNavOrder();
    if (saved.length) {
      const pos = (v) => { const i = saved.indexOf(v); return i === -1 ? 1e9 : i; };
      items.sort((a, b) => pos(a.dataset.view) - pos(b.dataset.view));
      items.forEach((it) => nav.appendChild(it));
    }
  }
  // 侧栏拖动排序（HTML5 DnD + localStorage 持久化）
  // 用专用手柄拖动，避免 draggable 吞掉按钮的 click
  function initNavDnd() {
    const nav = document.getElementById("nav");
    if (!nav) return;
    let dragEl = null;
    nav.querySelectorAll(".nav-item").forEach((item) => {
      // 给每个 nav-item 加一个专用拖动手柄（避免整个按钮 draggable 影响点击）
      let h = item.querySelector(".nav-handle");
      if (!h) {
        h = document.createElement("span");
        h.className = "nav-handle";
        h.textContent = "⋮⋮";
        h.setAttribute("aria-hidden", "true");
        item.insertBefore(h, item.firstChild);
      }
      h.setAttribute("draggable", "true");
      h.addEventListener("dragstart", (e) => {
        dragEl = item;
        item.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        try { e.dataTransfer.setData("text/plain", item.dataset.view); } catch (_) {}
      });
      h.addEventListener("dragend", () => {
        item.classList.remove("dragging");
        dragEl = null;
        saveNavOrder();
        U.toast(I18N.t("nav.orderSaved"));
      });
      item.addEventListener("dragover", (e) => {
        if (!dragEl) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (item === dragEl) return;
        const rect = item.getBoundingClientRect();
        const after = (e.clientY - rect.top) > rect.height / 2;
        if (after) nav.insertBefore(dragEl, item.nextSibling);
        else nav.insertBefore(dragEl, item);
      });
      item.addEventListener("drop", (e) => { if (dragEl) e.preventDefault(); });
    });
  }

  function closeModals() {
    document.querySelectorAll(".modal-scrim").forEach((m) => { if (m.closeModal) m.closeModal(); });
  }

  function setView(name) {
    closeModals();
    views.forEach((v) => {
      document.getElementById("view-" + v).classList.toggle("active", v === name);
    });
    document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
    if (mods[name] && mods[name].onShow) mods[name].onShow();
    document.getElementById("sidebar").classList.remove("open");
    document.getElementById("scrim").classList.remove("show");
  }

  // ============================================================
  // 外观三态：经典 / 夜间 / Lumen
  // ------------------------------------------------------------
  // 原本「主题（浅/暗）」和「皮肤（classic/lumen）」是两套独立状态，
  // 组合起来有 4 种，但 Lumen 只接管浅色，实际有效只有 3 种。
  // 现在收拢成单一 MOOD 概念（经典 / 夜间 / Lumen），顶栏图标按钮循环切换。
  //
  // 存储：沿用 cb_theme + cb_skin 两个旧键，老用户的选择可以无缝继承。
  //   classic → cb_theme=light, cb_skin=classic
  //   dark    → cb_theme=dark,  cb_skin=classic
  //   lumen   → cb_theme=light, cb_skin=lumen
  // ============================================================
  const THEME_KEY = "cb_theme";
  const MOODS = ["classic", "dark", "lumen"];
  const MOOD_ICON = { classic: "🎨", dark: "🌙", lumen: "✨" };

  // 由两个存储键反推当前模式（顺序：Lumen 优先于暗色，保持与旧逻辑一致）
  function getMood() {
    const skin = localStorage.getItem(SKIN_KEY) || "classic";
    const theme = localStorage.getItem(THEME_KEY) || "light";
    if (skin === "lumen" && theme !== "dark" && skinAllowed("lumen")) return "lumen";
    return theme === "dark" ? "dark" : "classic";
  }

  // 把模式写回两个存储键并应用到 DOM
  function commitMood(mood) {
    if (mood === "dark") {
      localStorage.setItem(THEME_KEY, "dark");
      localStorage.setItem(SKIN_KEY, "classic");
    } else if (mood === "lumen") {
      localStorage.setItem(THEME_KEY, "light");
      localStorage.setItem(SKIN_KEY, "lumen");
    } else {
      localStorage.setItem(THEME_KEY, "light");
      localStorage.setItem(SKIN_KEY, "classic");
    }
    applyTheme();
  }

  function applyTheme() {
    const t = localStorage.getItem(THEME_KEY) || "light";
    document.documentElement.setAttribute("data-theme", t);
    // 主题变化会影响皮肤可用性（Lumen 仅接管浅色），需重新结算
    if (typeof applySkin === "function") applySkin();
    syncMoodButton();
  }

  // 顶栏按钮：图标反映当前模式，title 提示「当前 → 下一个」
  function syncMoodButton() {
    const btn = document.getElementById("themeBtn");
    if (!btn) return;
    const mood = getMood();
    const next = MOODS[(MOODS.indexOf(mood) + 1) % MOODS.length];
    btn.textContent = MOOD_ICON[mood];
    btn.dataset.mood = mood;
    const label = I18N.t("mood." + mood);
    const nextLabel = I18N.t("mood." + next);
    btn.title = I18N.getLang() === "zh"
      ? `外观：${label}（点击切换为「${nextLabel}」）`
      : `Appearance: ${label} (next: ${nextLabel})`;
    btn.setAttribute("aria-label", btn.title);
  }

  function cycleMood() {
    const cur = getMood();
    const next = MOODS[(MOODS.indexOf(cur) + 1) % MOODS.length];
    commitMood(next);
    if (window.U && U.toast) U.toast(I18N.t("mood.switched", { name: I18N.t("mood." + next) }));
  }

  // 兼容旧接口：设置面板里仍可直接指定主题 / 皮肤
  function toggleTheme() {
    const cur = document.documentElement.getAttribute("data-theme");
    commitMood(cur === "dark" ? "classic" : "dark");
  }

  // ============================================================
  // 界面皮肤（Skin）
  // ------------------------------------------------------------
  // 机制：皮肤是独立 CSS 文件，<link id="skinXxx" disabled> 挂在 index.html。
  //   · 启用 = 去掉 disabled + body 上加 data-skin
  //   · 停用 = 加回 disabled + 移除 body 属性（皮肤规则全部失效）
  //   · 删除 = 删 css/themes/xxx/ 目录 + index.html 里那行 <link>
  //            localStorage 里残留的皮肤名会被下面的回退逻辑自动忽略。
  // 皮肤清单：新增皮肤时只改 SKINS 一处。
  // ============================================================
  const SKINS = {
    classic: { name: "classic", linkId: null },              // 经典：现有样式，零改动
    lumen:   { name: "lumen",   linkId: "skinLumen" }        // Lumen：玻璃拟态极简
  };
  const SKIN_KEY = "cb_skin";

  // 皮肤仅接管浅色。暗色模式下强制回落 classic，避免出现"半套皮肤"的观感。
  function skinAllowed(name) {
    const def = SKINS[name];
    if (!def || !def.linkId || name === "classic") return false;
    const node = document.getElementById(def.linkId);
    if (!node) return false;                                  // 皮肤文件已删除 → 不可用
    return document.documentElement.getAttribute("data-theme") !== "dark";
  }

  function applySkin() {
    const stored = localStorage.getItem(SKIN_KEY) || "classic";
    const use = skinAllowed(stored) ? stored : "classic";
    // 所有皮肤 link 先全部禁用，再按需启用 —— 保证同时只有一个皮肤生效
    Object.values(SKINS).forEach((s) => {
      if (!s.linkId) return;
      const node = document.getElementById(s.linkId);
      if (node) node.disabled = (s.name !== use);
    });
    if (use === "classic") {
      document.body.removeAttribute("data-skin");
    } else {
      document.body.setAttribute("data-skin", use);
    }
    return use;
  }

  function setSkin(name) {
    localStorage.setItem(SKIN_KEY, name);
    // 选中 Lumen 时顺带把主题置浅，避免「暗色 + Lumen」的无效组合被存下来
    if (name === "lumen") localStorage.setItem(THEME_KEY, "light");
    const actual = applySkin();
    applyTheme();
    if (actual !== name) {
      // 请求的皮肤不可用（文件被删 / 暗色模式），给出可读反馈
      if (window.U && U.toast) {
        U.toast(document.documentElement.getAttribute("data-theme") === "dark"
          ? I18N.t("skin.darkFallback")
          : I18N.t("skin.unavailable"));
      }
    }
    return actual;
  }

  function getSkin() { return localStorage.getItem(SKIN_KEY) || "classic"; }

  // 可供设置面板渲染选项用
  function skinOptions() {
    return [
      { value: "classic", label: I18N.t("skin.classic"), available: true },
      { value: "lumen", label: I18N.t("skin.lumen"), available: skinAllowed("lumen") }
    ];
  }

  // 三态外观清单（供设置面板或外部渲染「经典 / 夜间 / Lumen」三项时使用）
  function moodOptions() {
    return MOODS.map((m) => ({ value: m, label: I18N.t("mood." + m), icon: MOOD_ICON[m] }));
  }

  function toggleLang() {
    const next = I18N.getLang() === "zh" ? "en" : "zh";
    I18N.setLang(next);
    I18N.apply();
    document.getElementById("langBtn").textContent = next === "zh" ? "中 / EN" : "EN / 中";
    syncMoodButton();   // 按钮 title 是双语的，跟随重新生成
    views.forEach((v) => { if (mods[v] && mods[v].onShow) mods[v].onShow(); });
  }

  // 会话就绪后由 Auth 调用（幂等）
  function boot() {
    if (booted) return;
    booted = true;
    I18N.apply();
    applyTheme();          // 内部会连带结算皮肤
    applySkin();
    document.getElementById("langBtn").textContent = I18N.getLang() === "zh" ? "中 / EN" : "EN / 中";

    applyNavOrder();
    document.querySelectorAll(".nav-item").forEach((b) => b.onclick = () => setView(b.dataset.view));
    initNavDnd();
    document.getElementById("themeBtn").onclick = cycleMood;
    document.getElementById("langBtn").onclick = toggleLang;
    document.getElementById("menuBtn").onclick = () => {
      document.getElementById("sidebar").classList.add("open");
      document.getElementById("scrim").classList.add("show");
    };
    document.getElementById("scrim").onclick = () => {
      document.getElementById("sidebar").classList.remove("open");
      document.getElementById("scrim").classList.remove("show");
    };

    Object.values(mods).forEach((m) => { if (m && m.init) try { m.init(); } catch (e) { console.error(e); } });
    setView("rates");
  }

  // 切换用户后重新加载各数据模块（crm / todo / knowledge）
  function reloadData() {
    ["crm", "todo", "knowledge"].forEach((v) => {
      if (mods[v] && mods[v].onShow) try { mods[v].onShow(); } catch (e) { console.error(e); }
    });
  }

  return { boot, setView, toggleLang, reloadData, applySkin, setSkin, getSkin, skinOptions,
           cycleMood, getMood, setMood: commitMood, moodOptions };
})();
window.App = App;

document.addEventListener("DOMContentLoaded", () => {
  // 纯本地版：无后端探活、无登录会话，直接初始化界面与启动页
  I18N.apply();
  Auth.init();
});

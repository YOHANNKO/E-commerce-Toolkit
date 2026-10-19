// ============================================================
// 纯本地版 · 会话门控（无账号、无后端、无网络请求）
// ------------------------------------------------------------
// 与原双模式版的区别：
//   · 已删除 Supabase SDK / config.js / supabase.js / collab.js
//   · 不再做「后端探活」，启动零网络等待（原版最多等 6 秒）
//   · 登录页只剩「进入」按钮，点一下即进入本地模式
//   · 数据全部存本机 IndexedDB（localdb.js），永不上传
// 对外接口保持兼容：Auth.init / Auth.forceLogout / Auth.localMode
// ============================================================
const Auth = (function () {
  let localMode = false;
  let appBooted = false;

  const $ = (id) => document.getElementById(id);

  function showAuth(show) {
    document.body.classList.toggle("authed", !show);
    const s = $("authScreen");
    if (s) s.classList.toggle("show", show);
  }

  // 顶栏用户区：本地模式下只有一个身份标识 + 退出按钮
  function renderUser() {
    const box = $("userBox");
    if (!box) return;
    if (!localMode) { box.innerHTML = ""; return; }
    box.innerHTML =
      `<span class="uname" title="${I18N.t("auth.localHint")}">💾 ${I18N.t("auth.localUser")}</span>` +
      `<button id="logoutBtn" class="ghost-btn sm" title="${I18N.t("auth.logout")}">${I18N.t("auth.logout")}</button>`;
    const b = $("logoutBtn");
    if (b) b.onclick = forceLogout;
  }

  async function bootApp() {
    if (appBooted) return;
    appBooted = true;
    window.DS.setMode("local");
    if (window.App && App.boot) await App.boot();
  }

  // 进入本地模式（唯一入口）
  async function loginLocal() {
    localMode = true;
    window.DS.setMode("local");
    await bootApp();
    showAuth(false);
    renderUser();
    U.toast(I18N.t("auth.localEntered"));
  }

  // 退出 = 回到启动页（数据不删除，仍在 IndexedDB 里）
  function forceLogout() {
    localMode = false;
    renderUser();
    showAuth(true);
    U.toast(I18N.t("auth.loggedOut"));
  }

  // 启动页上方的语言 / 主题按钮
  function initAuthUtil() {
    const lb = $("authLangBtn");
    if (lb) {
      const paintLang = () => { lb.textContent = I18N.getLang() === "zh" ? "中 / EN" : "EN / 中"; };
      paintLang();
      lb.onclick = () => {
        const next = I18N.getLang() === "zh" ? "en" : "zh";
        I18N.setLang(next);
        I18N.apply();
        paintLang();
      };
    }
    const tb = $("authThemeBtn");
    if (tb) {
      const paintTheme = () => {
        const t = document.documentElement.getAttribute("data-theme") || "light";
        tb.textContent = t === "dark" ? "☀️" : "🌙";
      };
      paintTheme();
      tb.onclick = () => {
        const next = (document.documentElement.getAttribute("data-theme") || "light") === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", next);
        localStorage.setItem("cb_theme", next);
        paintTheme();
      };
    }
  }

  async function init() {
    initAuthUtil();
    const lb = $("btnLocalEnter");
    if (lb) lb.onclick = loginLocal;
    // 启动页固定展示「进入」入口，不做任何网络探测
    showAuth(true);
  }

  return { init, forceLogout, get localMode() { return localMode; } };
})();
window.Auth = Auth;

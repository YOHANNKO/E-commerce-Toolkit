// 登录 / 注册 / 会话门控（双入口：云端登录 / 本地登录）
const Auth = (function () {
  let user = null;
  let guest = false;      // 离线访客（后端不可达时的兜底）
  let localMode = false;  // 本地登录（数据存 IndexedDB）
  let appBooted = false;

  const $ = (id) => document.getElementById(id);

  function showAuth(show) {
    document.body.classList.toggle("authed", !show);
    const s = $("authScreen");
    if (s) s.classList.toggle("show", show);
  }

  function renderUser() {
    const box = $("userBox");
    if (!box) return;
    if (!user) {
      if (localMode) {
        // 本地模式同样交给 Collab 渲染统一的用户按钮（含设置入口）
        if (window.Collab && Collab.ME) { window.Collab.renderUserBox(box); return; }
        box.innerHTML =
          `<span class="uname" title="${I18N.t("auth.localHint")}">💾 ${I18N.t("auth.localUser")}</span>` +
          `<button id="logoutBtn" class="ghost-btn sm" title="${I18N.t("auth.logout")}">${I18N.t("auth.logout")}</button>`;
        $("logoutBtn").onclick = forceLogout;
      } else if (guest) {
        box.innerHTML = `<span class="uname" title="${I18N.t("auth.offlineHint")}">👤 ${I18N.t("auth.guest")}</span>`;
      } else {
        box.innerHTML = "";
      }
      return;
    }
    if (window.Collab) { window.Collab.renderUserBox(box); return; }
    const email = (user.email || "").replace(/[<>&]/g, "");
    box.innerHTML =
      `<span class="uname" title="${email}">${email}</span>` +
      `<button id="logoutBtn" class="ghost-btn sm" title="Logout">${I18N.t("auth.logout")}</button>`;
    $("logoutBtn").onclick = logout;
  }

  // 登录屏内的两个大入口：云端 / 本地
  function switchEntry(entry) {
    const isCloud = entry === "cloud";
    const cb = $("entryCloud"), lb = $("entryLocal");
    if (cb) cb.classList.toggle("active", isCloud);
    if (lb) lb.classList.toggle("active", !isCloud);
    const cf = $("cloudForm"), lf = $("localForm");
    if (cf) cf.style.display = isCloud ? "" : "none";
    if (lf) lf.style.display = isCloud ? "none" : "";
    const hint = $("authHint");
    if (hint) hint.textContent = "";
  }

  // 云端表单内：登录 / 注册
  function switchTab(tab) {
    const isLogin = tab === "login";
    $("tabLogin").classList.toggle("active", isLogin);
    $("tabSignup").classList.toggle("active", !isLogin);
    $("btnLogin").style.display = isLogin ? "" : "none";
    $("btnSignup").style.display = isLogin ? "none" : "";
    document.querySelectorAll(".auth-only-signup").forEach((e) => {
      e.style.display = isLogin ? "none" : "";
    });
    const hint = $("authHint");
    if (hint) hint.textContent = "";
  }

  // ===== 云端登录 =====
  // 探活尚未完成时点按钮：先提示等待，并 await 探活结果，避免把「还没连上」误报为失败
  async function ensureBackend() {
    if (window.__sbReady && !window.SB_OFFLINE && window.sb && window.sb.offline) {
      U.toast(I18N.t("auth.connecting"));
      try { await window.__sbReady; } catch (_) {}
    }
    if (window.SB_OFFLINE || (window.sb && window.sb.offline)) {
      U.toast(I18N.t("auth.cloudUnreachable"));
      return false;
    }
    return true;
  }

  async function signIn() {
    const email = $("authEmail").value.trim();
    const pw = $("authPw").value;
    if (!email || !pw) { U.toast(I18N.t("auth.fillRequired")); return; }
    if (!(await ensureBackend())) return;
    const { error } = await sb.auth.signInWithPassword({ email, password: pw });
    if (error) { U.toast(error.message); return; }
  }

  async function signUp() {
    const email = $("authEmail").value.trim();
    const pw = $("authPw").value;
    const name = $("authName").value.trim();
    if (!email || !pw) { U.toast(I18N.t("auth.fillRequired")); return; }
    if (pw.length < 6) { U.toast(I18N.t("auth.pwShort")); return; }
    if (!(await ensureBackend())) return;
    const { data, error } = await sb.auth.signUp({
      email,
      password: pw,
      options: { data: { display_name: name } }
    });
    if (error) { U.toast(error.message); return; }
    if (!data.session) U.toast(I18N.t("auth.confirmEmail"));
  }

  async function logout() {
    try { await sb.auth.signOut(); } catch (e) {}
    U.toast(I18N.t("auth.loggedOut"));
  }

  // 本地登录：无密码，数据存浏览器 IndexedDB
  async function loginLocal() {
    localMode = true;
    guest = false;
    user = null;
    window.DS.setMode("local");
    await bootApp();
    showAuth(false);
    await (window.Collab ? window.Collab.loadMe() : Promise.resolve());
    renderUser();
    U.toast(I18N.t("auth.localEntered"));
  }

  // 离线访客：后端不可达时的兜底（同样走本地数据）
  function enterGuest() {
    guest = true;
    localMode = false;
    window.DS.setMode("local");
    showAuth(false);
    renderUser();
    const s = $("authHint");
    if (s) s.textContent = I18N.t("auth.offlineHint");
    bootApp();
    U.toast(I18N.t("auth.offlineEnter"));
  }

  function bootApp() {
    if (!window.App) return Promise.resolve();
    if (!appBooted) { appBooted = true; const p = window.App.boot(); return Promise.resolve(p).catch(() => {}); }
    return Promise.resolve(window.App.reloadData()).catch(() => {});
  }

  // 退出到登录屏（本地/云端通用）
  async function forceLogout() {
    if (localMode) {
      localMode = false;
      user = null;
      showAuth(true);
      switchEntry("local");
      renderUser();
      U.toast(I18N.t("auth.loggedOut"));
      return;
    }
    await logout();
  }

  async function handleSession(session) {
    user = session && session.user ? session.user : null;
    if (user) {
      guest = false;
      localMode = false;
      // 云端模式：数据走后端
      window.DS.setMode("cloud");
      showAuth(false);
      await window.Collab.loadMe();
      renderUser();
      await bootApp();
      // 首次云端登录 → 自动把云端数据迁移到本地
      if (window.Migrate) {
        try {
          const r = await Migrate.run();
          if (r && r.ok && !r.skipped && r.counts) {
            const c = r.counts;
            U.toast(I18N.t("migrate.done", {
              t: c.todos || 0, k: c.knowledge || 0, c: c.contacts || 0
            }));
            if (window.App) window.App.reloadData();
          }
        } catch (e) { /* 迁移失败不阻塞使用 */ }
      }
    } else if (window.SB_OFFLINE) {
      enterGuest();
    } else {
      showAuth(true);
      if (window.Collab) window.Collab.ME = null;
      renderUser();
    }
  }

  // —— 登录屏的语言 / 主题切换 ——
  // 顶栏（含 #langBtn / #themeBtn）在登录前被 #app{display:none} 隐藏，
  // 而 app.js 的绑定发生在 boot() 之后。若不在这里单独提供入口，
  // 用户会被"锁"在默认语言里，必须登录后才能改语言。
  function initAuthUtil() {
    const lb = $("authLangBtn");
    const tb = $("authThemeBtn");
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
    $("entryCloud").onclick = () => switchEntry("cloud");
    $("entryLocal").onclick = () => switchEntry("local");
    const lb = $("btnLocalEnter");
    if (lb) lb.onclick = loginLocal;
    $("tabLogin").onclick = () => switchTab("login");
    $("tabSignup").onclick = () => switchTab("signup");
    $("btnLogin").onclick = signIn;
    $("btnSignup").onclick = signUp;
    switchEntry("cloud");
    switchTab("login");

    // 等待后端探活完成：window.sb 可能是先挂的离线 stub，探活后才会被真实客户端替换。
    // 必须在替换之后再注册 onAuthStateChange，否则监听会绑到被丢弃的 stub 上。
    if (window.__sbReady) { try { await window.__sbReady; } catch (e) {} }

    if (window.SB_OFFLINE) {
      const s = $("authHint");
      if (s) s.textContent = I18N.t("auth.offlineHint");
      // 后端不可达：默认切到「本地登录」入口，不阻塞
      switchEntry("local");
      return;
    }

    // 此时 window.sb 已是真实客户端，注册会话监听
    sb.auth.onAuthStateChange((_event, session) => handleSession(session));

    const { data } = await sb.auth.getSession();
    handleSession(data.session);
  }

  return { init, forceLogout, get localMode() { return localMode; } };
})();
window.Auth = Auth;

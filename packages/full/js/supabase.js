// 初始化 Supabase 客户端（全局 sb）
// 说明：若后端不可达（如 Supabase 项目被暂停/删除，域名解析失败），
//       自动切换到「离线访客模式」：用一个轻量 stub 顶替 sb.auth，
//       使界面不被登录门控挡住（数据模块各自降级为本地缓存 / localStorage）。
(function () {
  window.SB_OFFLINE = false;
  window.SB_ERR = "";
  let realClient = null;   // 探活通过后的真实客户端
  let stubClient = null;   // 兜底离线 stub

  // 判定后端是否可达：优先探测 REST 端点，超时/网络错误即视为不可达
  function probeBackend() {
    return new Promise((resolve) => {
      if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) { resolve(false); return; }
      const ctrl = (typeof AbortController !== "undefined") ? new AbortController() : null;
      const timer = setTimeout(() => { if (ctrl) ctrl.abort(); resolve(false); }, 6000);
      fetch(window.SUPABASE_URL + "/auth/v1/health", {
        method: "GET",
        headers: { apikey: window.SUPABASE_ANON_KEY },
        cache: "no-store",
        signal: ctrl ? ctrl.signal : undefined
      }).then((r) => { clearTimeout(timer); resolve(r.ok || r.status === 401 || r.status === 404 || r.status < 500); })
        .catch(() => { clearTimeout(timer); resolve(false); });
    });
  }
  window.__probeBackend = probeBackend;

  // 离线 stub：模拟 supabase 客户端里被 auth.js / collab.js 用到的最小接口
  // 注意：探活完成前用户就点「登录/注册」时，绝不能把 OFFLINE_MODE 当业务错误抛回，
  //      而是挂起等待探活结果，再用真实客户端重放（见 callAuth）。
  function makeOfflineClient() {
    const listeners = [];
    const noop = async () => ({ data: { user: null, session: null }, error: null });
    return {
      offline: true,
      auth: {
        onAuthStateChange(cb) { listeners.push(cb); return { data: { subscription: { unsubscribe() {} } } }; },
        async getSession() { return { data: { session: null }, error: null }; },
        async getUser() { return { data: { user: null }, error: null }; },
        async signInWithPassword() { return callAuth("signInWithPassword", arguments); },
        async signUp() { return callAuth("signUp", arguments); },
        async signOut() { return { error: null }; }
      },
      from() {
        // 链式 no-op，保证 .select().eq().order() 等调用不抛错
        const chain = {};
        const self = () => chain;
        ["select", "insert", "update", "upsert", "delete", "eq", "neq", "order", "limit", "single", "maybeSingle", "match", "in", "gte", "lte", "is"].forEach((m) => { chain[m] = self; });
        chain.then = (res) => Promise.resolve({ data: [], error: null }).then(res);
        chain.catch = () => Promise.resolve({ data: [], error: null });
        return chain;
      },
      rpc: noop,
      storage: { from() { return { upload: noop, download: noop, getPublicUrl: () => ({ data: { publicUrl: "" } }) }; } }
    };
  }

  // 探活未完成时由 stub 转发进来的 auth 调用：等 window.__sbReady 后重放到真实客户端
  async function callAuth(method, args) {
    try { if (window.__sbReady) await window.__sbReady; } catch (_) {}
    if (window.SB_OFFLINE || !realClient) {
      return { data: { user: null, session: null }, error: { message: "OFFLINE_MODE" } };
    }
    if (realClient === stubClient) {
      return { data: { user: null, session: null }, error: { message: "OFFLINE_MODE" } };
    }
    return realClient.auth[method].apply(realClient.auth, args);
  }

  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    // 这是开源版的正常状态（本地模式无需后端），用 info 级别，
    // 避免用户看到红色 error 误判为故障。
    console.info("[Supabase] 未配置 js/config.js —— 已进入本地模式，数据保存在浏览器 IndexedDB。");
  }

  // 先挂一个离线 stub 作为兜底（探活期间若有代码提前调用也不会崩，且会自动重放），
  // 探活通过后再替换为真实客户端。
  stubClient = makeOfflineClient();
  window.sb = stubClient;

  window.__sbReady = probeBackend().then((ok) => {
    if (ok) {
      try {
        realClient = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
        window.sb = realClient;
        window.SB_OFFLINE = false;
      } catch (e) {
        window.SB_OFFLINE = true; window.SB_ERR = String(e && e.message || e);
      }
    } else {
      window.SB_OFFLINE = true;
      window.SB_ERR = "后端不可达（Supabase 项目可能已暂停或删除）";
    }
    return !window.SB_OFFLINE;
  });

  // 取当前登录用户 id（异步）
  window.getUid = async function () {
    if (window.SB_OFFLINE) return null;
    const { data } = await window.sb.auth.getUser();
    return data.user ? data.user.id : null;
  };

  // 取当前用户对象
  window.getCurrentUser = async function () {
    if (window.SB_OFFLINE) return null;
    const { data } = await window.sb.auth.getUser();
    return data.user || null;
  };
})();

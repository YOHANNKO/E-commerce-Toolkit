/* ===== Collaboration: roles, user settings, members, sharing ===== */
window.Collab = (function () {
  let ME = null; // { id, email, name, role }
  const state = { bulk: false };  // 成员管理的批量模式开关（重渲染间保持）

  async function loadMe() {
    // 本地模式：无云端账号与协作，直接给一个本地身份
    if (window.DS && DS.isLocal()) {
      ME = { id: DS.LOCAL_OWNER, email: "local@device", name: I18N.t("auth.guest"), role: "admin", phone: "", local: true };
      return ME;
    }
    const uid = await getUid();
    if (!uid) { ME = null; return ME; }
    const { data } = await sb.from("profiles").select("id,display_name,phone,role").eq("id", uid).single();
    const email = (await getCurrentUser()).email || "";
    if (data) {
      ME = { id: uid, email, name: data.display_name || email.split("@")[0], role: data.role || "user", phone: data.phone };
    } else {
      // 兜底：profile 缺失则建一条
      const name = email.split("@")[0];
      await sb.from("profiles").upsert({ id: uid, display_name: name, role: "user" });
      ME = { id: uid, email, name, role: "user" };
    }
    // 兜底：若全库尚无 admin，把当前用户提升为 admin（首个注册用户）
    // 直接用 fetch 调 PostgREST，绕过 supabase-js（其 rpc() 在本地偶发 schema cache miss）
    // 说明：迁移 0004 未执行时该函数不存在（404）。用 localStorage 记住结果，
    // 避免每次登录都发一次注定 404 的请求刷屏控制台。
    const RPC_FLAG = "cb_rpc_admin_bootstrap";
    try {
      if (localStorage.getItem(RPC_FLAG) === "missing") throw new Error("skip-known-missing");
      const { data: sess } = await sb.auth.getSession();
      const token = sess && sess.session && sess.session.access_token;
      if (token) {
        const res = await fetch(window.SUPABASE_URL + "/rest/v1/rpc/ensure_caller_admin_if_first", {
          method: "POST",
          headers: {
            "apikey": window.SUPABASE_ANON_KEY,
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json"
          },
          body: "{}"
        });
        if (res.ok) {
          localStorage.removeItem(RPC_FLAG); // 迁移已执行，恢复常态
          const promoted = await res.json().catch(() => null);
          if (promoted === true) ME.role = "admin";
        } else if (res.status === 404) {
          localStorage.setItem(RPC_FLAG, "missing"); // 记住，后续静默跳过
        }
      }
    } catch (_) { /* 静默 */ }
    return ME;
  }

  function isAdmin() { return ME && ME.role === "admin"; }
  function isAdminUser() { return ME && ME.role === "admin_user"; }
  function canEditOfficial() { return isAdmin() || isAdminUser(); }
  function canManage() { return isAdmin(); }
  function roleLabel() {
    if (isAdmin()) return I18N.t("role.admin");
    if (isAdminUser()) return I18N.t("role.adminUser");
    return I18N.t("role.user");
  }

  // ---------- 用户设置 ----------
  // 顶栏退出按钮：手机上只放图标（文字在窄屏会被挤出按钮框），
  // 用 .lo-ico / .lo-tx 两个 span 让 CSS 按断点切换，文字始终留在框内。
  function logoutBtnHTML() {
    return `<button id="logoutBtn" class="ghost-btn sm logout-btn" title="${U.esc(I18N.t("auth.logout"))}">
      <span class="lo-ico" aria-hidden="true">⏻</span>
      <span class="lo-tx">${I18N.t("auth.logout")}</span>
    </button>`;
  }

  function renderUserBox(box) {
    if (!box) return;
    if (!ME) { box.innerHTML = ""; return; }
    if (ME.local) {
      box.innerHTML =
        `<button class="ubtn" id="settingsBtn" title="${I18N.t("settings.title")}">
           <span class="ava sm" style="background:linear-gradient(135deg,#22c55e,#14b8a6)">💾</span>
           <span class="ub-txt"><span class="ub-n">${I18N.t("auth.localUser")}</span><span class="ub-r">${I18N.t("settings.localNote").slice(0, 12)}…</span></span>
         </button>
         ${logoutBtnHTML()}`;
      document.getElementById("settingsBtn").onclick = openSettings;
      document.getElementById("logoutBtn").onclick = () => { if (window.Auth && Auth.forceLogout) Auth.forceLogout(); };
      return;
    }
    const email = (ME.email || "").replace(/[<>&]/g, "");
    const nm = ME.name || email.split("@")[0];
    box.innerHTML =
      `<button class="ubtn" id="settingsBtn" title="${I18N.t("settings.title")}">
         <span class="ava sm">${U.esc(initial(nm))}</span>
         <span class="ub-txt"><span class="ub-n">${U.esc(nm)}</span><span class="ub-r">${U.esc(email)}</span></span>
         <span class="badge2 ${roleCls(ME.role)}">${roleLabel()}</span>
       </button>
       ${logoutBtnHTML()}`;
    document.getElementById("settingsBtn").onclick = openSettings;
    document.getElementById("logoutBtn").onclick = () => sb.auth.signOut();
  }

  // 角色 → 徽标样式类
  function roleCls(r) { return r === "admin" ? "admin" : r === "admin_user" ? "admin_user" : "user"; }
  function initial(s) { return String(s || "?").trim().charAt(0).toUpperCase() || "?"; }

  function openSettings() {
    document.querySelectorAll(".modal-scrim").forEach((m) => { if (m.closeModal) m.closeModal(); });
    const isLocal = !!(ME && ME.local);
    const tabs = `
      <div class="seg2" style="margin-bottom:16px">
        <button class="active" data-st="profile">👤 ${I18N.t("settings.profile")}</button>
        ${isLocal ? "" : `<button data-st="share">🔗 ${I18N.t("settings.share")}</button>`}
        ${canManage() ? `<button data-st="members">👥 ${I18N.t("members.title")}</button>` : ""}
      </div>`;
    const m = U.modal(`
      <div class="m-head">
        <span class="m-ico">⚙️</span>
        <h3>${I18N.t("settings.title")}</h3>
        <button class="m-x" id="stX" title="${I18N.t("settings.close")}">×</button>
      </div>
      ${tabs}
      <div id="stBody"></div>
      <div class="actions"><button class="btn ghost" id="stClose">${I18N.t("common.close")}</button></div>
    `, { noClose: true });
    const doClose = m.closeModal;
    m.querySelector("#stX").onclick = doClose;
    m.querySelector("#stClose").onclick = doClose;
    m.querySelectorAll("[data-st]").forEach((b) => b.onclick = () => {
      m.querySelectorAll("[data-st]").forEach((x) => x.classList.toggle("active", x === b));
      showTab(b.dataset.st, m);
    });
    showTab("profile", m);
  }

  function showTab(tab, m) {
    const body = m.querySelector("#stBody");
    if (tab === "profile") return renderProfile(body, m);
    if (tab === "share") return renderShare(body, m);
    if (tab === "members") return renderMembers(body, m);
  }

  function renderProfile(body, m) {
    const isLocal = !!(ME && ME.local);
    const roleB = isLocal
      ? `<span class="badge2 local">💾 ${I18N.t("auth.localUser")}</span>`
      : `<span class="badge2 ${roleCls(ME.role)}">${roleLabel()}</span>`;
    body.innerHTML = `
      <div class="lrow" style="margin-bottom:16px">
        <span class="ava">${U.esc(initial(ME.name || ME.email))}</span>
        <div class="lrow-main">
          <div class="lrow-t">${U.esc(ME.name || ME.email)}</div>
          <div class="lrow-s">${U.esc(ME.email)}</div>
        </div>
        ${roleB}
      </div>

      <div class="sec-title">${I18N.t("settings.account")}</div>
      ${isLocal
        ? `<p class="muted" style="font-size:12.5px;margin:0 0 12px">${I18N.t("settings.localNote")}</p>`
        : `<label class="field"><span>${I18N.t("settings.displayName")}</span><input type="text" id="stName" value="${U.esc(ME.name)}"></label>
           <label class="field"><span>${I18N.t("auth.email")}</span><input type="text" value="${U.esc(ME.email)}" disabled></label>
           <button class="btn" id="stSaveName">${I18N.t("settings.saveName")}</button>`}

      <div class="sec-title" style="margin-top:20px">${I18N.t("settings.identity")}</div>
      <div class="lrow">
        <div class="lrow-main">
          <div class="lrow-t">${I18N.t("settings.role")}</div>
          <div class="lrow-s">${isLocal ? I18N.t("settings.localNote") : I18N.t("members.hint")}</div>
        </div>
        ${roleB}
      </div>

      ${renderSkinSection()}`;

    bindSkinSection(body);
    const save = body.querySelector("#stSaveName");
    if (!save) return;
    save.onclick = async () => {
      const nm = body.querySelector("#stName").value.trim();
      if (!nm) { U.toast(I18N.t("auth.fillRequired")); return; }
      const { error } = await sb.from("profiles").update({ display_name: nm }).eq("id", ME.id);
      if (error) { U.toast(error.message); return; }
      ME.name = nm;
      U.toast(I18N.t("common.saved"));
      m.closeModal();
      renderUserBox(document.getElementById("userBox"));
    };
  }

  // ---------- 界面皮肤（Skin）切换区 ----------
  // 皮肤由 App 模块统一管理；这里只负责渲染选项与绑定事件。
  // 若 App 未暴露皮肤接口（旧版本或模块被裁剪），整块自动隐藏，不影响设置页其它内容。
  function renderSkinSection() {
    if (!window.App || !App.skinOptions) return "";
    const opts = App.skinOptions();
    const cur = App.getSkin();
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    return `
      <div class="sec-title" style="margin-top:20px">${I18N.t("skin.title")}</div>
      <p class="muted" style="font-size:12.5px;margin:0 0 12px">${I18N.t("skin.desc")}</p>
      <div class="seg2" id="skinPick">
        ${opts.map((o) => `<button data-skin="${o.value}" class="${o.value === cur ? "active" : ""}" ${o.available ? "" : "disabled"}>${U.esc(o.label)}${o.available ? "" : " · N/A"}</button>`).join("")}
      </div>
      ${dark ? `<p class="muted" style="font-size:11.5px;margin:10px 0 0">⚠️ ${I18N.t("skin.darkFallback")}</p>` : ""}`;
  }

  function bindSkinSection(body) {
    const pick = body.querySelector("#skinPick");
    if (!pick || !window.App || !App.setSkin) return;
    pick.querySelectorAll("button[data-skin]").forEach((b) => {
      b.onclick = () => {
        const want = b.dataset.skin;
        const got = App.setSkin(want);
        pick.querySelectorAll("button[data-skin]").forEach((x) => x.classList.toggle("active", x.dataset.skin === got));
        const label = (App.skinOptions().find((o) => o.value === got) || {}).label || got;
        U.toast(I18N.t("skin.applied", { name: label }));
      };
    });
  }

  // ---------- 共享：收件箱 + 历史 ----------
  async function renderShare(body, m) {
    const [{ data: inbox }, { data: sent }, { data: recv }] = await Promise.all([
      sb.from("share_item").select("*").eq("target", ME.id).eq("status", "pending").order("created_at", { ascending: false }),
      sb.from("share_item").select("*").eq("owner", ME.id).order("created_at", { ascending: false }),
      sb.from("share_item").select("*").eq("target", ME.id).eq("status", "accepted").order("created_at", { ascending: false })
    ]);
    const resLabel = (s) => (s.resource === "crm" ? I18N.t("nav.crm") : I18N.t("nav.knowledge"));
    const row = (s) => {
      const pending = s.status === "pending";
      const title = s.title || resLabel(s);
      return `<div class="lrow">
        <span class="ava sm" style="background:${s.resource === "crm" ? "linear-gradient(135deg,#2f6df6,#5b8bff)" : "linear-gradient(135deg,#14b8a6,#22c55e)"}">${resLabel(s).charAt(0)}</span>
        <div class="lrow-main">
          <div class="lrow-t">${U.esc(title)}</div>
          <div class="lrow-s">${resLabel(s)} · ${pending ? I18N.t("share.pending") : I18N.t("share.accepted")} · ${pending ? (I18N.t("share.from") + " " + U.esc(s.from_name || s.owner)) : (I18N.t("share.to") + " " + U.esc(s.target_email || s.target))}</div>
        </div>
        ${pending && s.target === ME.id ? `<button class="btn sm" data-accept="${s.id}">${I18N.t("share.accept")}</button>` : ""}
      </div>`;
    };
    const box = (title, arr, emptyKey) =>
      `<div class="sec-title">${title} <span class="cnt">${arr ? arr.length : 0}</span></div>
       <div>${(arr && arr.length) ? arr.map(row).join("") : `<div class="empty2" style="padding:22px"><span class="s">${I18N.t(emptyKey)}</span></div>`}</div>`;

    body.innerHTML =
      box(I18N.t("share.inbox"), inbox, "share.emptyInbox") +
      `<div style="height:8px"></div>` +
      box(I18N.t("share.sent"), sent, "share.emptySent") +
      `<div style="height:8px"></div>` +
      box(I18N.t("share.received"), recv, "share.emptyRecv");
    body.querySelectorAll("[data-accept]").forEach((b) => b.onclick = async () => {
      const { data, error } = await sb.rpc("accept_share", { p_item: b.dataset.accept });
      if (error) { U.toast(error.message); return; }
      if (data && data.ok) { U.toast(I18N.t("share.acceptedOk")); if (window.CRM) CRM.onShow(); if (window.KB) KB.onShow(); }
      else U.toast(I18N.t("share.sourceGone"));
      renderShare(body, m);
    });
  }

  // ---------- 成员管理（仅 admin） ----------
  // 批量选择状态（按弹窗生命周期：每次 renderMembers 重建时由 picked 保留已勾选项）
  function renderMembers(body, m, picked) {    picked = picked || new Set();
    let bulk = !!state.bulk;

    async function load() {
      const { data: members, error } = await sb.from("profiles").select("id,display_name,phone,role,created_at").order("created_at", { ascending: true });
      if (error) {
        body.innerHTML = `<div class="empty2" style="padding:24px"><span class="ico">⚠️</span><span class="t">${I18N.t("members.loadFail")}</span><span class="s">${U.esc(error.message)}</span></div>`;
        return;
      }
      draw(members || [], picked, bulk);
    }

    function draw(list, pickedSet, bulkOn) {
      // 可批量删除的候选人（排除自己）
      const selectable = list.filter((p) => p.id !== ME.id).map((p) => p.id);
      // 清理已不存在的勾选项
      [...pickedSet].forEach((id) => { if (!selectable.includes(id)) pickedSet.delete(id); });
      const selCount = pickedSet.size;
      const allSel = selectable.length > 0 && selCount === selectable.length;

      const rows = list.map((p) => {
        const isMe = p.id === ME.id;
        const nm = p.display_name || p.id;
        const rc = roleCls(p.role);
        const isPicked = pickedSet.has(p.id);
        const chk = bulkOn
          ? `<input type="checkbox" class="mb-chk" data-mchk="${p.id}" ${isPicked ? "checked" : ""} ${isMe ? "disabled" : ""} title="${isMe ? I18N.t("members.selfNoDel") : ""}">`
          : "";
        const sel = `<select data-role="${p.id}" title="${I18N.t("members.roleOf")}" style="width:auto;min-width:112px;padding:7px 10px">
          <option value="user" ${p.role === "user" ? "selected" : ""}>${I18N.t("role.user")}</option>
          <option value="admin_user" ${p.role === "admin_user" ? "selected" : ""}>${I18N.t("role.adminUser")}</option>
          <option value="admin" ${p.role === "admin" ? "selected" : ""}>${I18N.t("role.admin")}</option>
        </select>`;
        const delBtn = isMe
          ? `<span class="badge2 user" title="${I18N.t("members.selfNoDel")}">${I18N.t("members.you")}</span>`
          : `<button class="copy-btn danger" data-mdel="${p.id}" data-mname="${U.esc(nm)}" title="${I18N.t("members.delete")}">🗑</button>`;
        return `<div class="lrow${isPicked ? " mb-picked" : ""}">
          ${chk}
          <span class="ava sm">${U.esc(initial(nm))}</span>
          <div class="lrow-main">
            <div class="lrow-t">${U.esc(nm)}</div>
            <div class="lrow-s">${U.esc(p.id)}</div>
          </div>
          <span class="badge2 ${rc}">${I18N.t("role." + (rc === "admin" ? "admin" : rc === "admin_user" ? "adminUser" : "user"))}</span>
          ${isMe ? "" : sel}
          ${delBtn}
        </div>`;
      }).join("");

      const bar = `
        <div class="mb-bar">
          <button class="btn ghost sm" id="mbToggle">${bulkOn ? "✕ " + I18N.t("members.bulkExit") : "☑️ " + I18N.t("members.bulk")}</button>
          ${bulkOn ? `
            <button class="btn ghost sm" id="mbAll">${allSel ? I18N.t("members.selectClear") : I18N.t("members.selectAll")}</button>
            <span class="mb-selcount${selCount ? "" : " zero"}">${I18N.t("members.selectedN", { n: selCount })}</span>
            <span class="sp"></span>
          <button class="btn sm" id="mbDel" ${selCount ? "" : "disabled"} style="${selCount ? "background:var(--danger);border-color:var(--danger);color:#fff" : ""}">🗑 ${I18N.t("members.bulkDelete")}</button>
          ` : `<span class="sp"></span><span class="mb-self-tip" title="${U.esc(I18N.t("members.pickHint"))}"><span class="mst-full">${I18N.t("members.pickHint")}</span><span class="mst-short">${I18N.t("members.pickHintShort")}</span></span>`}
        </div>`;

      body.innerHTML = `
        <div class="sec-title">${I18N.t("members.title")} <span class="cnt">${I18N.t("members.count", { n: list.length })}</span></div>
        <p class="muted" style="font-size:12px;margin:0 0 10px">${I18N.t("members.hint")}</p>
        ${bar}
        <div>${rows || `<div class="empty2" style="padding:22px"><span class="s">${I18N.t("members.empty")}</span></div>`}</div>`;

      // 角色变更
      body.querySelectorAll("[data-role]").forEach((sel) => sel.onchange = async () => {
        const uid = sel.dataset.role, role = sel.value;
        const { error } = await sb.from("profiles").update({ role }).eq("id", uid);
        if (error) { U.toast(error.message); return; }
        U.toast(I18N.t("common.saved"));
        state.bulk = bulkOn;
        renderMembers(body, m, pickedSet);
        if (window.KB) KB.onShow();
      });

      // 单条删除
      body.querySelectorAll("[data-mdel]").forEach((btn) => btn.onclick = async () => {
        const uid = btn.dataset.mdel, nm = btn.dataset.mname || "";
        if (!confirm(I18N.t("members.deleteConfirm", { name: nm }))) return;
        const { data, error } = await sb.rpc("admin_delete_member", { p_uid: uid });
        if (error) {
          U.toast(/PGRST202|schema cache|does not exist|404/i.test(error.message || "")
            ? I18N.t("members.needMigration")
            : (error.message || I18N.t("common.saveFailed")));
          return;
        }
        if (data && data.ok) {
          U.toast("✓ " + I18N.t("members.deleted", { name: nm }));
          pickedSet.delete(uid);
          state.bulk = bulkOn;
          renderMembers(body, m, pickedSet);
        } else if (data && data.msg === "cannot_delete_self") {
          U.toast(I18N.t("members.selfNoDel"));
        } else if (data && data.msg === "forbidden") {
          U.toast(I18N.t("members.onlyAdmin"));
        } else {
          U.toast(I18N.t("members.deleteFail"));
        }
      });

      // 进入 / 退出批量模式
      const tgl = body.querySelector("#mbToggle");
      if (tgl) tgl.onclick = () => {
        state.bulk = !bulkOn;
        if (!state.bulk) pickedSet.clear();
        renderMembers(body, m, pickedSet);
      };

      // 全选 / 清空
      const allBtn = body.querySelector("#mbAll");
      if (allBtn) allBtn.onclick = () => {
        if (allSel) pickedSet.clear();
        else selectable.forEach((id) => pickedSet.add(id));
        renderMembers(body, m, pickedSet);
      };

      // 勾选
      body.querySelectorAll("[data-mchk]").forEach((c) => c.onchange = () => {
        if (c.checked) pickedSet.add(c.dataset.mchk); else pickedSet.delete(c.dataset.mchk);
        renderMembers(body, m, pickedSet);
      });

      // 批量删除
      const bulkDel = body.querySelector("#mbDel");
      if (bulkDel && selCount) bulkDel.onclick = async () => {
        const ids = [...pickedSet];
        if (!ids.length) { U.toast(I18N.t("members.bulkNoSel")); return; }
        if (!confirm(I18N.t("members.bulkDeleteConfirm", { n: ids.length }))) return;
        const { data, error } = await sb.rpc("admin_delete_members", { p_uids: ids });
        if (error) {
          // 0007 未部署 → 退回逐条调用 0006，保证功能可用
          if (/PGRST202|schema cache|does not exist|404/i.test(error.message || "")) {
            const res = await bulkDeleteFallback(ids);
            if (res.tried && !res.anyOk) { U.toast(I18N.t("members.bulkNeedMigration")); return; }
            pickedSet.clear();
            state.bulk = bulkOn;
            renderMembers(body, m, pickedSet);
            U.toast(describeBulk(res.ok, res.skip));
            return;
          }
          U.toast(error.message || I18N.t("common.saveFailed"));
          return;
        }
        if (data && data.ok) {
          const skipped = Array.isArray(data.skipped) ? data.skipped.length : 0;
          pickedSet.clear();
          state.bulk = bulkOn;
          renderMembers(body, m, pickedSet);
          U.toast(describeBulk(data.deleted || 0, skipped));
        } else if (data && data.msg === "forbidden") {
          U.toast(I18N.t("members.onlyAdmin"));
        } else {
          U.toast(I18N.t("members.deleteFail"));
        }
      };
    }

    // 0007 未部署时：逐条走 0006，尽力而为
    async function bulkDeleteFallback(ids) {
      let ok = 0, skip = 0, tried = 0, anyOk = false;
      for (const id of ids) {
        if (id === ME.id) { skip++; continue; }
        tried++;
        const { data, error } = await sb.rpc("admin_delete_member", { p_uid: id });
        if (error) { skip++; continue; }
        if (data && data.ok) { ok++; anyOk = true; } else skip++;
      }
      return { ok, skip, tried, anyOk };
    }

    function describeBulk(ok, skip) {
      if (ok && skip) return I18N.t("members.bulkPartial", { ok, skip });
      if (ok) return I18N.t("members.bulkDone", { n: ok });
      return I18N.t("members.deleteFail");
    }

    // 不要 await：本函数需保持同步返回，调用方（showTab）按同步语义切换标签
    load();
  }

  // ---------- 分享动作 ----------
  async function share(resource, id) {
    if (window.DS && DS.isLocal()) { U.toast(I18N.t("share.localUnsupported")); return; }
    const label = resource === "crm" ? I18N.t("nav.crm") : I18N.t("nav.knowledge");
    const m = U.modal(`
      <div class="m-head">
        <span class="m-ico">🔗</span>
        <h3>${I18N.t("share.toUser")}</h3>
        <button class="m-x" id="shX">×</button>
      </div>
      <p class="m-sub">${I18N.t("share.tip")}</p>
      <label class="field"><span>${I18N.t("auth.email")}</span><input type="email" id="shEmail" placeholder="friend@email.com"></label>
      <div class="actions"><button class="btn ghost" id="shCancel">${I18N.t("common.cancel")}</button><button class="btn" id="shSend">${I18N.t("common.share")}</button></div>
    `, { noClose: true });
    m.querySelector("#shX").onclick = m.closeModal;
    m.querySelector("#shCancel").onclick = m.closeModal;
    m.querySelector("#shSend").onclick = async () => {
      const email = m.querySelector("#shEmail").value.trim();
      if (!email) { U.toast(I18N.t("auth.fillRequired")); return; }
      const { data: tuid } = await sb.rpc("email_to_uid", { p_email: email });
      if (!tuid) { U.toast(I18N.t("share.userNotFound")); return; }
      if (tuid === ME.id) { U.toast(I18N.t("share.cannotSelf")); return; }
    let rows = [];
    if (id) {
      if (resource === "crm") { const { data } = await sb.from("contacts").select("name").eq("id", id).eq("owner", ME.id).single(); rows = [{ resource_id: id, title: (data && data.name) || label }]; }
      else { const { data } = await sb.from("knowledge").select("title").eq("id", id).eq("owner", ME.id).single(); rows = [{ resource_id: id, title: (data && data.title) || label }]; }
    } else {
      const tbl = resource === "crm" ? "contacts" : "knowledge";
      // 知识库共享全部：仅共享私有条目（官方全员可见、文案模板暂不支持共享）
      const q = resource === "knowledge"
        ? sb.from(tbl).select("id,name,title").eq("owner", ME.id).eq("kind", "private")
        : sb.from(tbl).select("id,name,title").eq("owner", ME.id);
      const { data } = await q;
      rows = (data || []).map((r) => ({ resource_id: r.id, title: r.name || r.title || label }));
    }
      if (!rows.length) { U.toast(I18N.t("share.nothing")); return; }
      const payload = rows.map((r) => ({ owner: ME.id, target: tuid, resource, resource_id: r.resource_id, title: r.title, target_email: email, from_name: ME.name, status: "pending" }));
      const { error } = await sb.from("share_item").insert(payload);
      if (error) { U.toast(error.message); return; }
      U.toast(I18N.t("share.sentOk"));
      m.closeModal();
    };
  }

  return { loadMe, renderUserBox, openSettings, share, isAdmin, isAdminUser, canEditOfficial, canManage, roleLabel, get ME() { return ME; } };
})();

/* ===== To-Do & Schedule with tags (local + cloud via DS) ===== */
window.Todo = (function () {
  // 默认标签：仅在首次加载（本地/云端都还没有任何标签）时写入一次，之后即为用户数据。
  // 名称走 i18n，按「首次创建时的界面语言」落库；用户可随时自行重命名。
  const DEF_TAGS = () => [
    { name: I18N.t("seed.tag.mercado"), color: "#f59e0b", icon: "🛒" },
    { name: I18N.t("seed.tag.amazon"), color: "#ff9900", icon: "📦" },
    { name: I18N.t("seed.tag.aliexpress"), color: "#e4393c", icon: "✈️" },
    { name: I18N.t("seed.tag.logistics"), color: "#0ea5e9", icon: "🚚" },
    { name: I18N.t("seed.tag.finance"), color: "#22c55e", icon: "💰" },
    { name: I18N.t("seed.tag.other"), color: "#8b5cf6", icon: "📌" }
  ];
  // 优先级四档：紧急 > 优先 > 平缓 > 不急
  const PRIOS = [
    { id: "urgent", icon: "🔥", labelKey: "todo.prioUrgent", color: "#ef4444", weight: 0 },
    { id: "high", icon: "⚡", labelKey: "todo.prioHigh", color: "#f59e0b", weight: 1 },
    { id: "normal", icon: "🔹", labelKey: "todo.prioNormal", color: "#2f6df6", weight: 2 },
    { id: "none", icon: "⚪", labelKey: "todo.prioNone", color: "#97a0b3", weight: 3 }
  ];

  let todos = [];
  let tags = [];
  let filter = "all";

  const tagOf = (id) => tags.find((t) => t.id === id);
  const prioOf = (id) => PRIOS.find((p) => p.id === id) || PRIOS[3];

  // 截止日期本地化格式：英文界面 → "Mar 5, 2026"；中文界面 → "2026年3月5日"
  // 存储永远是 ISO，只有展示层随语言切换（原生日期控件的显示格式跟随浏览器语言，不可控）。
  function fmtDue(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    if (!m) return iso || "";
    const y = +m[1], mo = +m[2], d = +m[3];
    if (I18N.getLang() === "en") {
      const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${MON[mo - 1]} ${d}, ${y}`;
    }
    return `${y}年${mo}月${d}日`;
  }

  // 列表里的日期同样本地化显示
  function fmtDueShort(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    if (!m) return iso || "";
    const y = +m[1], mo = +m[2], d = +m[3];
    if (I18N.getLang() === "en") {
      const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${MON[mo - 1]} ${d}`;
    }
    return `${mo}月${d}日`;
  }

  // 排序：未完成在前 → 优先级 → 有截止日期在前(按日期) → 有标签在前 → created_at 降序
  function sortTodos(arr) {
    return arr.slice().sort((a, b) => {
      const da = a.done ? 1 : 0, db = b.done ? 1 : 0;
      if (da !== db) return da - db;
      const wa = prioOf(a.priority).weight, wb = prioOf(b.priority).weight;
      if (wa !== wb) return wa - wb;
      const hasDA = a.due ? 1 : 0, hasDB = b.due ? 1 : 0;
      if (hasDA !== hasDB) return hasDB - hasDA;
      if (a.due && b.due && a.due !== b.due) return a.due < b.due ? -1 : 1;
      const hasTA = (a.tags || []).length ? 1 : 0, hasTB = (b.tags || []).length ? 1 : 0;
      if (hasTA !== hasTB) return hasTB - hasTA;
      const ca = a.created_at || "", cb = b.created_at || "";
      if (ca === cb) return 0;
      return ca < cb ? 1 : -1;
    });
  }

  async function load() {
    const td = await DS.list("todos");
    const tg = await DS.list("tags", { orderBy: "created_at", asc: true });
    todos = td || [];
    if (tg && tg.length) tags = tg;
    else {
      // 首次：写入默认标签
      const seeded = DEF_TAGS().map((t) => Object.assign({}, t));
      const saved = await Promise.all(seeded.map((t) => DS.insert("tags", t)));
      tags = saved.filter(Boolean);
    }
  }

  function stripTodo(t) {
    return {
      // 兼顾两种入参：编辑器传 {title}，列表对象传 {text}
      text: t.title !== undefined && t.title !== "" ? t.title : (t.text || ""),
      note: t.note || "",
      done: !!t.done,
      due: t.due || null,
      tags: Array.isArray(t.tags) ? t.tags : [],
      priority: t.priority || "none"
    };
  }

  async function persistTodo(t) {
    if (t.id) {
      const upd = stripTodo(t);
      const res = await DS.update("todos", t.id, upd);
      if (!res) return false;
      const i = todos.findIndex((x) => x.id === t.id);
      if (i >= 0) todos[i] = Object.assign({}, todos[i], upd);
      // 同步回入参对象，避免调用方持有旧引用（如 openPrioMenu 拿到的列表项）
      Object.assign(t, upd);
    } else {
      const row = stripTodo(t);
      const data = await DS.insert("todos", row);
      if (!data) return false;
      todos.unshift(data);
    }
    return true;
  }

  async function removeTodo(id) {
    const ok = await DS.remove("todos", id);
    if (!ok) return;
    todos = todos.filter((x) => x.id !== id);
  }

  function openTagManager() {
    // 单行渲染：图标（可编辑）| 颜色 | 名称 | 预览 chip | 删除
    const rowHtml = (t) =>
      `<div class="lrow" data-tg="${t.id}">
        <span class="tg-ico" title="${I18N.t("todo.tagIcon")}"><input type="text" class="tg-ico-in" value="${U.esc(t.icon || "🏷")}" maxlength="4"></span>
        <input type="color" value="${t.color}" class="tg-color" title="${I18N.t("crm.color")}">
        <input type="text" class="tg-name" value="${U.esc(t.name)}" maxlength="20" title="${I18N.t("todo.tagName")}">
        <button class="btn ghost sm tg-del" title="${I18N.t("common.delete")}">✕</button>
      </div>`;

    const listHtml = () => (tags.length
      ? tags.map(rowHtml).join("")
      : `<div class="tg-empty">${I18N.t("todo.noTags")}</div>`);

    const m = U.modal(`
      <div class="m-head">
        <span class="m-ico">🏷</span>
        <h3>${I18N.t("todo.managedTags")}</h3>
        <button class="m-x" id="tgX">×</button>
      </div>
      <div class="sec-title">${I18N.t("todo.managedTags")}</div>
      <div id="tagList">${listHtml()}</div>
      <div class="sec-title" style="margin-top:16px">${I18N.t("todo.addTag")}</div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:nowrap;margin-top:8px">
        <span class="tg-add-ico" title="${I18N.t("todo.tagIcon")}"><input type="text" id="ntIcon" placeholder="🏷" maxlength="4"></span>
        <input type="color" id="ntColor" value="#2f6df6" title="${I18N.t("crm.color")}" style="flex:0 0 34px;width:34px;height:34px;padding:2px;border:1px solid var(--border);border-radius:9px;background:var(--surface);cursor:pointer">
        <input type="text" id="ntName" placeholder="${I18N.t("todo.tagName")}" maxlength="20" style="flex:1;min-width:0;margin:0">
        <button class="btn" id="ntAdd" style="flex:0 0 auto;height:38px;padding:0 16px">＋</button>
      </div>
      <div class="actions"><button class="btn ghost" id="tgClose">${I18N.t("common.close")}</button></div>
    `, { noClose: true });
    const refresh = () => {
      const box = m.querySelector("#tagList");
      if (box) box.innerHTML = listHtml();
      bindList();
    };
    async function bindList() {
      m.querySelectorAll("#tagList .lrow").forEach((row) => {
        const id = row.dataset.tg;
        // 颜色 / 图标 / 名称：即时写库（oninput 防抖由浏览器天然合并，这里直接写）
        row.querySelector(".tg-color").oninput = async (e) => { const tg = tagOf(id); if (tg) { tg.color = e.target.value; await DS.update("tags", id, { color: tg.color }); render(); } };
        row.querySelector(".tg-name").oninput = async (e) => { const tg = tagOf(id); if (tg) { tg.name = e.target.value; await DS.update("tags", id, { name: tg.name }); render(); } };
        const icoIn = row.querySelector(".tg-ico-in");
        if (icoIn) {
          icoIn.onchange = async (e) => {
            const tg = tagOf(id); if (!tg) return;
            tg.icon = e.target.value.trim() || "🏷"; e.target.value = tg.icon;
            await DS.update("tags", id, { icon: tg.icon }); render();
          };
        }
        row.querySelector(".tg-del").onclick = async () => {
          await DS.remove("tags", id);
          todos.forEach((x) => { if (x.tags && x.tags.includes(id)) x.tags = x.tags.filter((g) => g !== id); });
          tags = tags.filter((t) => t.id !== id);
          refresh(); render();
        };
      });
    }
    bindList();
    // 新建：回车或点 ＋ 都能提交
    const addNew = async () => {
      const name = m.querySelector("#ntName").value.trim();
      if (!name) { U.toast(I18N.t("todo.tagName")); m.querySelector("#ntName").focus(); return; }
      const data = await DS.insert("tags", { name, color: m.querySelector("#ntColor").value, icon: m.querySelector("#ntIcon").value.trim() || "🏷" });
      if (!data) return;
      tags.push(data);
      m.querySelector("#ntName").value = "";
      m.querySelector("#ntIcon").value = "";
      refresh(); render();
      m.querySelector("#ntName").focus();
    };
    m.querySelector("#ntAdd").onclick = addNew;
    m.querySelector("#ntName").onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); addNew(); } };
    m.querySelector("#tgClose").onclick = m.closeModal;
    m.querySelector("#tgX").onclick = m.closeModal;
  }

  function openEditor(todo) {
    const isEdit = !!todo;
    const t = todo || { id: null, title: "", note: "", due: "", done: false, tags: [], priority: "none" };
    if (t.text !== undefined && !t.title) t.title = t.text;
    if (!t.priority) t.priority = "none";
    const tagChecks = tags.map((g) =>
      `<label class="chip tp-chip ${t.tags.includes(g.id) ? "active" : ""}" style="cursor:pointer" title="${U.esc(g.name)}">
        <input type="checkbox" class="tgpick" value="${g.id}" ${t.tags.includes(g.id) ? "checked" : ""} style="display:none">
        <span class="sw" style="background:${g.color}"></span>${g.icon || "🏷"} ${U.esc(g.name)}<span class="tp-tick">✓</span>
      </label>`).join("");

    const prioChecks = PRIOS.map((p) =>
      `<label class="chip ${t.priority === p.id ? "active" : ""}" style="cursor:pointer">
        <input type="radio" class="priopick" name="prio" value="${p.id}" ${t.priority === p.id ? "checked" : ""} style="display:none">
        <span class="sw" style="background:${p.color}"></span>${p.icon} ${I18N.t(p.labelKey)}
      </label>`).join("");

    const m = U.modal(`
      <div class="m-head">
        <span class="m-ico">${isEdit ? "✏️" : "＋"}</span>
        <h3>${isEdit ? I18N.t("common.edit") : I18N.t("todo.add")}</h3>
        <button class="m-x" id="tX">×</button>
      </div>
      <label class="field"><span>${I18N.t("todo.titlePH")}</span><input type="text" id="tTitle" value="${U.esc(t.title)}" placeholder="${I18N.t("todo.titlePH")}"></label>
      <label class="field"><span>${I18N.t("todo.note")}</span><textarea id="tNote" placeholder="${I18N.t("todo.note")}">${U.esc(t.note)}</textarea></label>
      <label class="field"><span>${I18N.t("todo.due")}</span>
        <div class="due-field" id="tDueWrap">
          <input type="text" id="tDue" value="${t.due || ""}" placeholder="${U.esc(I18N.t("todo.duePH"))}" readonly>
          <input type="date" id="tDueNative" class="due-native" value="${t.due || ""}" aria-hidden="true" tabindex="-1">
          <button type="button" class="due-pick" id="tDuePick" title="${U.esc(I18N.t("todo.pickDate"))}">📅</button>
          <button type="button" class="due-clear" id="tDueClear" title="${U.esc(I18N.t("common.clear"))}">✕</button>
        </div>
      </label>
      <div class="sec-title">${I18N.t("todo.priority")}</div>
      <div class="chips" id="prioPick">${prioChecks}</div>
      <div class="sec-title">${I18N.t("todo.tag")}</div>
      <div class="chips" id="tagPick">${tagChecks || `<span class="muted" style="font-size:12.5px">${I18N.t("todo.addTag")}</span>`}</div>
      <div class="actions"><button class="btn ghost" id="tCancel">${I18N.t("common.cancel")}</button><button class="btn" id="tSave">${I18N.t("common.save")}</button></div>
    `, { noClose: true });

    /* —— 截止日期：原生 input[type=date] 的显示格式跟随浏览器 UI 语言，
           不受 <html lang> 控制，所以英文界面下仍是「年/月/日」。
           这里改为「只读文本框（本地化格式）+ 隐藏原生选择器 + 📅 按钮」：
           存储值始终是 ISO（YYYY-MM-DD），仅显示层随界面语言切换。 —— */
    const dueNative = m.querySelector("#tDueNative");
    const dueText = m.querySelector("#tDue");
    function syncDueText() {
      const v = dueNative.value || "";
      dueText.value = v ? fmtDue(v) : "";
      dueText.dataset.iso = v;
    }
    m.querySelector("#tDuePick").onclick = () => {
      // 调用原生选择器；现代浏览器支持 showPicker()
      if (typeof dueNative.showPicker === "function") { try { dueNative.showPicker(); return; } catch (e) {} }
      dueNative.focus(); dueNative.click();
    };
    dueNative.onchange = syncDueText;
    m.querySelector("#tDueClear").onclick = () => { dueNative.value = ""; syncDueText(); };
    syncDueText();

    // 优先级单选组的视觉选中态（chips 用 .active 类，隐藏的 radio 只管值）
    m.querySelectorAll("#prioPick .priopick").forEach((r) => r.onchange = () => {
      m.querySelectorAll("#prioPick .chip").forEach((c) => c.classList.toggle("active", c.querySelector(".priopick").checked));
    });

    // 标签多选组：隐藏的 checkbox 不会自动高亮，需手动同步 .active
    // （原来缺这段，导致勾选后没有任何选中反馈）
    m.querySelectorAll("#tagPick .tgpick").forEach((c) => c.onchange = () => {
      c.closest(".chip").classList.toggle("active", c.checked);
    });

    m.querySelector("#tX").onclick = m.closeModal;
    m.querySelector("#tCancel").onclick = m.closeModal;
    m.querySelector("#tSave").onclick = async () => {
      t.title = m.querySelector("#tTitle").value.trim();
      t.note = m.querySelector("#tNote").value.trim();
      t.due = m.querySelector("#tDueNative").value || null;
      t.tags = Array.from(m.querySelectorAll(".tgpick:checked")).map((x) => x.value);
      const pr = m.querySelector(".priopick:checked");
      t.priority = pr ? pr.value : "none";
      if (!t.title) { U.toast(I18N.t("todo.titlePH")); return; }
      const ok = await persistTodo(t);
      if (ok) { m.closeModal(); render(); }
    };
  }

  // 悬停快捷菜单：轻量绝对定位弹层，不遮蔽整屏
  function openPrioMenu(todo, anchor) {
    document.querySelectorAll(".prio-menu").forEach((n) => n.remove());
    const cur = todo.priority || "none";
    const menu = document.createElement("div");
    menu.className = "prio-menu";
    menu.innerHTML =
      `<div class="prio-menu-h">${I18N.t("todo.prioSet")}</div>` +
      PRIOS.map((p) =>
        `<button class="prio-menu-item ${cur === p.id ? "on" : ""}" data-p="${p.id}">
          <span class="sw" style="background:${p.color}"></span>${p.icon} ${I18N.t(p.labelKey)}
          ${cur === p.id ? `<span class="tick">✓</span>` : ""}
        </button>`).join("");
    document.body.appendChild(menu);

    // 锚点若在视口外（长列表未滚动到位），先把它滚进视野，菜单才贴着条目显示
    const vv = window.visualViewport;
    const vw0 = (vv && vv.width) || window.innerWidth;
    const vh0 = (vv && vv.height) || window.innerHeight;
    let r0 = anchor.getBoundingClientRect();
    if (r0.top < 8 || r0.bottom > vh0 - 8) {
      anchor.scrollIntoView({ block: "center" });
      r0 = anchor.getBoundingClientRect();
    }

    // 定位：先挪到屏幕外测出真实尺寸，再决定上下翻转方向
    menu.style.left = "-9999px";
    menu.style.top = "0px";
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    const vw = (vv && vv.width) || window.innerWidth;
    const vh = (vv && vv.height) || window.innerHeight;
    const r = anchor.getBoundingClientRect();

    // 水平：右对齐按钮，越界则左收，且不超出左右安全边距
    let left = r.right - mw;
    if (left + mw > vw - 8) left = vw - mw - 8;
    if (left < 8) left = 8;

    // 垂直：优先向下展开；下方放不下则上翻；最后统一夹紧到视口内，
    // 避免锚点本身已在视口外（列表很长、未滚动到位）时菜单被推出屏幕。
    let top = r.bottom + 6;
    if (top + mh > vh - 8) {
      const upTop = r.top - mh - 6;
      top = upTop >= 8 ? upTop : r.top + r.height + 6;
    }
    const maxTop = Math.max(8, vh - mh - 8);
    if (top > maxTop) top = maxTop;
    if (top < 8) top = 8;
    menu.style.maxHeight = (vh - 16) + "px";
    menu.style.left = left + "px";
    menu.style.top = top + "px";

    const close = () => {
      menu.remove();
      document.removeEventListener("click", onDoc, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close, true);
    };
    const onDoc = (e) => { if (!menu.contains(e.target)) close(); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    setTimeout(() => {
      document.addEventListener("click", onDoc, true);
      document.addEventListener("keydown", onKey, true);
      window.addEventListener("scroll", close, true);
      window.addEventListener("resize", close, true);
    }, 0);

    menu.querySelectorAll("[data-p]").forEach((b) => b.onclick = async (e) => {
      e.stopPropagation();
      const p = prioOf(b.dataset.p);
      todo.priority = p.id;
      const ok = await persistTodo(todo);
      close();
      if (!ok) return;
      U.toast(I18N.t("todo.prioChanged", { name: I18N.t(p.labelKey) }));
      render();
    });
  }

  function render() {
    const el = document.getElementById("view-todo");
    if (!el) return;
    const shown = sortTodos(todos.filter((x) => filter === "all" || (x.tags || []).includes(filter)));
    const done = todos.filter((x) => x.done).length;
    const pct = todos.length ? Math.round((done / todos.length) * 100) : 0;
    const pending = todos.length - done;
    const today = new Date().toISOString().slice(0, 10);
    const overdue = todos.filter((x) => !x.done && x.due && x.due < today).length;

    // 各标签计数
    const cntOf = (id) => todos.filter((x) => (x.tags || []).includes(id)).length;
    const filters = [{ id: "all", name: I18N.t("todo.all"), color: "var(--text-mute)", icon: "📋", n: todos.length }]
      .concat(tags.map((g) => Object.assign({}, g, { n: cntOf(g.id) })))
      .map((g) =>
        `<button class="chip ${filter === g.id ? "active" : ""}" data-f="${g.id}">
          <span class="sw" style="background:${g.color}"></span>${g.icon || "🏷"} ${U.esc(g.name)}
          <span class="n">${g.n}</span>
        </button>`).join("");

    const items = shown.map((x) => {
      const tagHtml = (x.tags || []).map((id) => { const g = tagOf(id); return g ? `<span class="tag" style="background:${g.color}22;color:${g.color}">${g.icon || "🏷"} ${U.esc(g.name)}</span>` : ""; }).join("");
      const isOverdue = !x.done && x.due && x.due < today;
      const dueHtml = x.due
        ? `<span class="due ${isOverdue ? "overdue" : ""}" title="${U.esc(fmtDue(x.due))}">📅 ${U.esc(fmtDueShort(x.due))}${isOverdue ? " · " + I18N.t("todo.overdue") : ""}</span>`
        : "";
      const p = prioOf(x.priority);
      const prioHtml = p.id === "none" ? "" : `<span class="prio prio-${p.id}">${p.icon} ${I18N.t(p.labelKey)}</span>`;
      return `<div class="todo-item ${x.done ? "done" : ""}">
        <label class="tchk"><input type="checkbox" class="chk" ${x.done ? "checked" : ""} data-chk="${x.id}"><span></span></label>
        <div class="body">
          <div class="todo-title">${U.esc(x.text)}</div>
          <div class="todo-meta">${prioHtml}${dueHtml}${tagHtml}</div>
          ${x.note ? `<div class="todo-note">${U.esc(x.note)}</div>` : ""}
        </div>
        <div class="acts"><button class="copy-btn" data-prio="${x.id}" title="${I18N.t("todo.prioSet")}">⚡</button><button class="copy-btn" data-edit="${x.id}" title="${I18N.t("common.edit")}">✏️</button><button class="copy-btn" data-del="${x.id}" title="${I18N.t("common.delete")}">🗑</button></div>
      </div>`;
    }).join("");

    el.innerHTML = `
      <div class="ph">
        <span class="ph-ico">✅</span>
        <div class="ph-txt">
          <h1>${I18N.t("todo.title")}</h1>
          <p>${I18N.t("todo.sub")}</p>
        </div>
        <div class="ph-actions">
          <button class="btn" id="todoAdd">＋ ${I18N.t("todo.add")}</button>
        </div>
      </div>

      <div class="stats" style="margin-bottom:18px">
        <div class="stat"><div class="k">${I18N.t("todo.total")}</div><div class="v">${todos.length}</div></div>
        <div class="stat"><div class="k">${I18N.t("todo.pending")}</div><div class="v" style="color:var(--primary-ink)">${pending}</div></div>
        <div class="stat"><div class="k">${I18N.t("todo.completed")}</div><div class="v" style="color:var(--ok)">${done}</div></div>
        <div class="stat"><div class="k">${I18N.t("todo.overdue")}</div><div class="v" style="color:${overdue ? "var(--danger)" : "var(--text-mute)"}">${overdue}</div></div>
        <div class="stat">
          <div class="k">${I18N.t("todo.progress")}</div>
          <div class="v">${pct}%</div>
          <div class="pbar"><div style="width:${pct}%"></div></div>
        </div>
      </div>

      <div class="todo-layout">
        <div class="card">
          <div class="sec-title">${I18N.t("todo.filter")}</div>
          <div class="chips">${filters}</div>
          <button class="btn ghost sm block" id="tagMgr" style="margin-top:14px">🏷 ${I18N.t("todo.managedTags")}</button>
        </div>
        <div>
          <div id="todoList">${items || `<div class="card"><div class="empty2"><span class="ico">✅</span><span class="t">${I18N.t("todo.empty")}</span><span class="s">${I18N.t("todo.emptyHint")}</span></div></div>`}</div>
        </div>
      </div>
    `;

    el.querySelectorAll("[data-f]").forEach((b) => b.onclick = () => { filter = b.dataset.f; render(); });
    el.querySelector("#tagMgr").onclick = openTagManager;
    el.querySelector("#todoAdd").onclick = () => openEditor(null);
    el.querySelectorAll("[data-chk]").forEach((b) => b.onchange = async () => { const t = todos.find((x) => x.id === b.dataset.chk); if (t) { t.done = b.checked; await persistTodo(t); render(); } });
    el.querySelectorAll("[data-prio]").forEach((b) => b.onclick = (e) => { e.stopPropagation(); openPrioMenu(todos.find((x) => x.id === b.dataset.prio), b); });
    el.querySelectorAll("[data-edit]").forEach((b) => b.onclick = () => openEditor(todos.find((x) => x.id === b.dataset.edit)));
    el.querySelectorAll("[data-del]").forEach((b) => b.onclick = async () => { if (confirm(I18N.t("common.confirmDel"))) { await removeTodo(b.dataset.del); render(); } });
  }

  async function init() { await load(); render(); }
  async function onShow() { await load(); render(); }
  return { init, onShow };
})();

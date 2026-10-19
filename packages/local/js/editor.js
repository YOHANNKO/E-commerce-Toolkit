/* ===== Image Editor: 图片库 + 压缩 / 水印 / 裁切 三个独立工作区（纯前端 Canvas） ===== */
window.ImageEditor = (function () {
  const FONTS = '"PingFang SC","Microsoft YaHei","Hiragino Sans GB","Noto Sans CJK SC","Source Han Sans SC",sans-serif';

  // 输出格式（压缩）
  const FORMATS = [
    { id: "jpg", label: "JPG", ext: "jpg", mime: "image/jpeg", lossy: true },
    { id: "png", label: "PNG", ext: "png", mime: "image/png", lossy: false },
    { id: "webp", label: "WebP", ext: "webp", mime: "image/webp", lossy: true },
    { id: "avif", label: "AVIF", ext: "avif", mime: "image/avif", lossy: true }
  ];
  const OUT = { id: "jpg", quality: 0.8 };

  // 中式证件照预设
  const ID_PRESETS = [
    { name: "一寸", w: 295, h: 413 },
    { name: "大一寸", w: 390, h: 567 },
    { name: "二寸", w: 413, h: 579 },
    { name: "小二寸", w: 413, h: 531 },
    { name: "身份证", w: 358, h: 441 },
    { name: "中国护照", w: 390, h: 567 },
    { name: "美国签证", w: 600, h: 600 },
    { name: "日本证件照", w: 354, h: 472 },
    { name: "自定义", w: 0, h: 0 }
  ];

  // ---- 状态 ----
  let lib = [];                                    // 图片库（唯一图源）：{ id, blob, name, url, width, height, ext }
  let zones = { compress: [], watermark: [], crop: [] }; // 三个工作区各自的图片列表
  let zone = "compress";                           // 当前工作区
  let selLib = new Set();                          // 图片库选中 id
  let selZone = new Set();                         // 工作区选中 id
  let zoneMem = {};                                // 各工作区的选中/编辑目标记忆：{ [zone]: {sel:Set, edit} }
  let editing = null;                              // 工作区当前编辑图 id（逐张编辑）
  let lastCompress = null;                         // 最近一次压缩结果：{ id, before, after }
  let crop = { w: 295, h: 413, zoom: 1, ox: 0, oy: 0, bg: "#ffffff", mode: "cover" };
  let cropDebug = null;                            // 裁切面板挂载后可用：state()/redraw()
  let wm = { logo: null, logoPos: "bottom-right", logoScale: 0.18, text: "", tile: true, pos: "center", opacity: 30, sizeRatio: 0.09, color: "#ffffff", angle: -20, bold: true };

  // ---- 工具 ----
  function fmtBytes(n) {
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / 1024 / 1024).toFixed(2) + " MB";
  }
  function baseName(name) { return (name || "").replace(/\.[^.]+$/, "") || "image"; }
  function extFor(id) { return (FORMATS.find((f) => f.id === id) || FORMATS[0]).ext; }
  function mimeFor(id) { return (FORMATS.find((f) => f.id === id) || FORMATS[0]).mime; }
  function extFromType(type) {
    if (!type) return "png";
    if (type === "image/jpeg") return "jpg";
    if (type === "image/png") return "png";
    if (type === "image/webp") return "webp";
    if (type === "image/avif") return "avif";
    return "png";
  }
  function tabKey(id) { return "editor.tab" + id.charAt(0).toUpperCase() + id.slice(1); }
  function curEdit() { return zones[zone].find((x) => x.id === editing) || null; }

  // ---- 输出尺寸上限保护：避免超大输入撑爆画布内存 ----
  const MAX_OUT_PX = 8000;        // 单边上限（像素）
  const MAX_OUT_AREA = 40e6;      // 总面积上限（约 40MP）

  // 把 (w,h) 约束到安全范围，返回 {w,h,scaled}
  function clampOutSize(w, h) {
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    let k = 1;
    if (w > MAX_OUT_PX || h > MAX_OUT_PX) k = MAX_OUT_PX / Math.max(w, h);
    if (w * h * k * k > MAX_OUT_AREA) k = Math.sqrt(MAX_OUT_AREA / (w * h));
    if (k >= 1) return { w, h, scaled: false };
    return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)), scaled: true };
  }

  // ---- 统一编码输出：跟随压缩区所选格式（JPG 自动填白底）----
  async function encodeCanvas(canvas) {
    const mime = mimeFor(OUT.id);
    const opts = mime === "image/png" ? undefined : OUT.quality;
    if (mime === "image/jpeg") {
      const ctx = canvas.getContext("2d");
      ctx.save();
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    let blob = await new Promise((res) => canvas.toBlob(res, mime, opts));
    // 浏览器不支持该格式（如部分环境的 AVIF）→ 回退 WebP 并同步格式状态
    if (!blob && OUT.id === "avif") {
      OUT.id = "webp";
      blob = await new Promise((res) => canvas.toBlob(res, "image/webp", OUT.quality));
    }
    if (!blob) blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
    return blob;
  }
  function outName(im, suffix) {
    return baseName(im.name) + (suffix || "") + "." + extFor(OUT.id);
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const obj = typeof src === "string" ? src : URL.createObjectURL(src);
      img.onload = () => { if (typeof src !== "string") URL.revokeObjectURL(obj); resolve(img); };
      img.onerror = () => { if (typeof src !== "string") URL.revokeObjectURL(obj); reject(new Error("decode")); };
      img.src = obj;
    });
  }
  function downloadBlob(blob, filename) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  // 由 blob 生成图片对象（解析尺寸）
  // origin 记录首次导入的原始 blob/尺寸，供「还原原图」使用（编辑结果原地更新 origin 不变）
  function makeImg(blob, name) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const im = new Image();
      const finish = (w, h) => resolve({
        id: U.uid(), blob, name: name || baseName("image"), url,
        width: w, height: h, size: blob.size, ext: extFromType(blob.type),
        origin: { blob, name: name || "image", width: w, height: h, size: blob.size, ext: extFromType(blob.type) }
      });
      im.onload = () => finish(im.naturalWidth, im.naturalHeight);
      im.onerror = () => finish(0, 0);
      im.src = url;
    });
  }
  // 复制一张图进工作区（新 id + 新 url，共享同一 blob 与 origin）
  function copyImage(img) {
    return {
      id: U.uid(), blob: img.blob, name: img.name, url: URL.createObjectURL(img.blob),
      width: img.width, height: img.height, size: img.size, ext: img.ext,
      origin: img.origin || { blob: img.blob, name: img.name, width: img.width, height: img.height, size: img.size, ext: img.ext }
    };
  }
  // 当前工作区图片是否已被编辑过（与原始快照有差异）
  function isEdited(img) {
    if (!img || !img.origin) return false;
    return img.blob !== img.origin.blob || img.size !== img.origin.size;
  }

  // ---- 导入 ----
  async function importFiles(fileList) {
    const files = [...fileList].filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    for (const f of files) { lib.push(await makeImg(f, baseName(f.name))); }
    render();
  }
  async function importUrl(url) {
    try {
      U.toast("正在获取图片…");
      const resp = await fetch(url, { mode: "cors" });
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const blob = await resp.blob();
      const name = baseName(new URL(url).pathname.split("/").pop()) || "remote";
      lib.push(await makeImg(blob, name));
      render();
    } catch (e) { U.toast(I18N.t("editor.importFail") + I18N.t("common.labelSep") + (e.message || e)); }
  }

  // ---- 删除 / 清空（不直接重渲染，由调用方统一 render）----
  function deleteLib(id) {
    const i = lib.findIndex((x) => x.id === id); if (i < 0) return;
    if (lib[i].url) URL.revokeObjectURL(lib[i].url);
    lib.splice(i, 1); selLib.delete(id);
  }
  function deleteZone(z, id) {
    const arr = zones[z]; const i = arr.findIndex((x) => x.id === id); if (i < 0) return;
    if (arr[i].url) URL.revokeObjectURL(arr[i].url);
    arr.splice(i, 1); selZone.delete(id);
    if (editing === id) editing = null;
  }
  function toggle(set, id) { if (set.has(id)) set.delete(id); else set.add(id); }

  // ---- 选中集合 ----
  // 注意：模块级 zone 只会是 "compress"/"watermark"/"crop"，永远不会是 "lib"。
  // 所以凡是和「图片库 vs 工作区」相关的判断，一律以卡片的 which 为准，
  // 不能用 `zone === "lib"`（那会永远为 false，导致库的勾选写错集合）。
  function selFor(which) { return which === "lib" ? selLib : selZone; }
  function arrFor(which) { return which === "lib" ? lib : zones[which]; }

  // 批量操作的作用对象：优先用勾选集合；没有勾选时退回当前编辑目标，保证单张也能直接操作
  function targetIds() {
    if (selZone.size) return [...selZone];
    const arr = zones[zone];
    if (editing && arr.some((x) => x.id === editing)) return [editing];
    return [];
  }

  // 应用按钮文案：多选时明确标注 "应用到 N 张"，消除「以为批量其实单张」的歧义
  function applyLabel(key) {
    const base = I18N.t(key);
    const n = targetIds().length;
    return n > 1 ? `${base} · ${I18N.t("editor.applyToN", { n })}` : base;
  }

  // ---- 分配 / 流转 ----
  function sendTo(tz) {
    if (!selLib.size) { U.toast(I18N.t("editor.emptyLib")); return; }
    const firstId = [...selLib][0];
    selLib.forEach((id) => { const im = lib.find((x) => x.id === id); if (im) zones[tz].push(copyImage(im)); });
    selLib.clear(); zone = tz;
    // 切换后自动打开第一张作为编辑目标，避免「面板空白、不知从何下手」
    const arr = zones[tz];
    const just = arr.find((x) => baseName(x.name).replace(/_\d+$/, "") === baseName((lib.find((l) => l.id === firstId) || {}).name || ""));
    editing = (just || arr[arr.length - 1] || {}).id || null;
    if (editing) selZone.add(editing);
    render(); U.toast(I18N.t("editor.done"));
  }
  function flowTo(tz) {
    // 没有多选时，退回「当前正在编辑的那张」，避免误判为“未选中”而无反应
    const ids = selZone.size ? [...selZone] : (editing ? [editing] : []);
    if (!ids.length) { U.toast(I18N.t("editor.pickToEdit")); return; }
    const movedIds = [];
    ids.forEach((id) => {
      const im = zones[zone].find((x) => x.id === id);
      if (im) { const cp = copyImage(im); zones[tz].push(cp); movedIds.push(cp.id); }
    });
    selZone.clear(); zone = tz;
    // 切到目标区后，把流转进来的第一张设为编辑目标，面板立即可用
    editing = movedIds[0] || (zones[tz][0] || {}).id || null;
    if (editing) selZone.add(editing);
    render(); U.toast(I18N.t("editor.done"));
  }

  // ---- 编辑结果原地更新（指定工作区的某张图）----
  // 注意：不再自动 render()，由批量驱动统一在结束时刷新一次，避免每张都整页重绘
  // 返回 Promise：等新图解码完成、宽高写回后再 resolve，
  // 这样批量结束时的统一 render() 才拿得到最新尺寸（否则卡片仍显示旧宽高）
  function replaceImage(id, blob, name, z) {
    const arr = zones[z || zone]; const it = arr.find((x) => x.id === id);
    if (!it) return Promise.resolve(null);
    if (it.url) URL.revokeObjectURL(it.url);
    const url = URL.createObjectURL(blob);
    it.blob = blob; it.name = name; it.url = url; it.ext = extFromType(blob.type); it.size = blob.size;
    return new Promise((resolve) => {
      const im = new Image();
      const done = () => { it.width = im.naturalWidth || it.width; it.height = im.naturalHeight || it.height; resolve(it); };
      im.onload = done;
      im.onerror = () => resolve(it);   // 解码失败也不能卡住批量
      im.src = url;
    });
  }

  // ---------- 批量执行器 ----------
  // 依次处理若干张图，带进度反馈；返回 { total, ok, fail, detail }
  // 参数：ids 目标 id 数组；job 单张处理函数 (img, idx) => { blob, name } | null
  // 说明：处理过程中把每张的结果写回该区数组，全部完成后统一 render 一次。
  async function runBatch(ids, job, opts) {
    const o = opts || {};
    const z = o.zone || zone;
    const arr = zones[z];
    const total = ids.length;
    if (!total) { U.toast(I18N.t("editor.pickToEdit")); return null; }

    // 进度条（超过 1 张才显示，单张时直接处理，避免闪烁）
    let bar = null;
    if (total > 1) bar = showProgress(total, o.label);

    let ok = 0, fail = 0;
    const failList = [];
    for (let i = 0; i < total; i++) {
      const id = ids[i];
      const it = arr.find((x) => x.id === id);
      if (!it) { fail++; continue; }
      try {
        const r = await job(it, i);
        if (r && r.blob) {
          await replaceImage(id, r.blob, r.name, z);   // 等尺寸写回，保证列表元信息同步
          ok++;
        } else { fail++; failList.push(it.name); }
      } catch (e) { fail++; failList.push(it.name); }
      if (bar) bar.set(i + 1);
      // 让出主线程，保持进度条可见可动
      await new Promise((r) => setTimeout(r, 0));
    }
    if (bar) bar.done();

    // 汇总提示
    if (total === 1) {
      if (ok) U.toast(I18N.t("editor.done"));
      else U.toast(I18N.t("editor.applyFail"));
    } else {
      U.toast(fail
        ? I18N.t("editor.batchPartial", { ok, total, fail })
        : I18N.t("editor.batchDone", { ok, total }));
    }
    render();
    return { total, ok, fail, detail: failList };
  }

  // 顶部进度条（轻量，不阻塞交互）
  function showProgress(total, label) {
    const box = document.createElement("div");
    box.className = "ed-progress";
    box.innerHTML = `<div class="ed-progress-inner">
      <div class="ed-progress-txt"><b class="ep-label">${label || I18N.t("editor.processing")}</b><span class="ep-n">0 / ${total}</span></div>
      <div class="ed-progress-track"><i style="width:0%"></i></div>
    </div>`;
    document.body.appendChild(box);
    const fill = box.querySelector("i");
    const num = box.querySelector(".ep-n");
    return {
      set(n) {
        fill.style.width = Math.round((n / total) * 100) + "%";
        num.textContent = n + " / " + total;
      },
      done() { box.remove(); },
    };
  }

  // ---- 压缩（支持批量：作用于全部选中图；未勾选时作用于当前编辑图）----
  async function compressWork() {
    const ids = targetIds();
    if (!ids.length) { U.toast(I18N.t("editor.pickToEdit")); return; }
    lastCompress = null;
    await runBatch(ids, async (im) => {
      const before = im.size || 0;
      const img = await loadImage(im.blob);
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      canvas.getContext("2d").drawImage(img, 0, 0);
      const out = await encodeCanvas(canvas);
      if (!out) return null;
      // 单张时记录体积对比，供面板展示
      if (ids.length === 1) lastCompress = { id: im.id, before, after: out.size };
      return { blob: out, name: outName(im, "_" + OUT.id) };
    }, { label: I18N.t("editor.processingCompress") });
  }

  // ---- 还原原图：回到首次导入的快照（origin），丢弃所有编辑（支持批量）----
  function restoreOrigin() {
    // 优先对全部勾选的图生效；否则对当前编辑目标生效
    let ids = selZone.size ? [...selZone] : (editing ? [editing] : []);
    const arr = zones[zone];
    ids = ids.filter((id) => { const it = arr.find((x) => x.id === id); return it && it.origin && isEdited(it); });
    if (!ids.length) {
      const cur0 = curEdit();
      if (!cur0) { U.toast(I18N.t("editor.pickToEdit")); return; }
      U.toast(I18N.t(cur0.origin ? "editor.alreadyOrig" : "editor.noOrigin"));
      return;
    }
    ids.forEach((id) => {
      const it = arr.find((x) => x.id === id);
      if (it.url) URL.revokeObjectURL(it.url);
      const o = it.origin;
      it.blob = o.blob; it.name = o.name; it.width = o.width; it.height = o.height;
      it.size = o.size; it.ext = o.ext; it.url = URL.createObjectURL(o.blob);
    });
    lastCompress = null;
    render();
    U.toast(ids.length > 1
      ? I18N.t("editor.restoredN", { n: ids.length })
      : I18N.t("editor.restored"));
  }

  // ---- 水印 ----
  function drawTiledText(ctx, W, H, o) {
    ctx.save();
    ctx.globalAlpha = o.opacity;
    ctx.fillStyle = o.color;
    ctx.font = (o.bold ? "bold " : "") + o.fontSize + "px " + FONTS;
    const tw = ctx.measureText(o.text).width;
    const stepX = tw * 1.6;
    const stepY = o.fontSize * 2.6;
    ctx.translate(W / 2, H / 2);
    ctx.rotate(o.angle * Math.PI / 180);
    const diag = Math.sqrt(W * W + H * H) * 1.25;
    const cols = Math.ceil(diag / stepX) + 1;
    const rows = Math.ceil(diag / stepY) + 1;
    const sx = -diag / 2, sy = -diag / 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) { ctx.fillText(o.text, sx + c * stepX, sy + r * stepY + o.fontSize); }
    }
    ctx.restore();
  }
  function drawSingleText(ctx, W, H, o) {
    ctx.save();
    ctx.globalAlpha = o.opacity;
    ctx.fillStyle = o.color;
    ctx.font = (o.bold ? "bold " : "") + o.fontSize + "px " + FONTS;
    const tw = ctx.measureText(o.text).width;
    const m = Math.max(12, W * 0.04);
    let x, y = m + o.fontSize;
    if (o.pos === "top-left") { x = m; y = m + o.fontSize; }
    else if (o.pos === "top-right") { x = W - tw - m; y = m + o.fontSize; }
    else if (o.pos === "bottom-left") { x = m; y = H - m; }
    else if (o.pos === "bottom-right") { x = W - tw - m; y = H - m; }
    else { x = W / 2 - tw / 2; y = H / 2 + o.fontSize / 2; }
    ctx.fillText(o.text, x, y);
    ctx.restore();
  }
  // ---- 水印（支持批量：同一套水印配置套用到全部选中图）----
  async function applyWatermark() {
    const ids = targetIds();
    if (!ids.length) { U.toast(I18N.t("editor.pickToEdit")); return; }
    // logo 只解码一次，批量复用
    let logoImg = null;
    if (wm.logo && wm.logoPos) logoImg = await loadImage(wm.logo);

    await runBatch(ids, async (im) => {
      const img = await loadImage(im.blob);
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      if (wm.text) {
        const o = { text: wm.text, fontSize: Math.round(canvas.height * wm.sizeRatio), color: wm.color, opacity: wm.opacity / 100, angle: wm.angle, bold: wm.bold, pos: wm.pos };
        if (wm.tile) drawTiledText(ctx, canvas.width, canvas.height, o);
        else drawSingleText(ctx, canvas.width, canvas.height, o);
      }
      if (logoImg && wm.logoPos) {
        const lw = canvas.width * wm.logoScale;
        const lh = lw * (logoImg.naturalHeight / logoImg.naturalWidth);
        const m = canvas.width * 0.04;
        let x = m, y = m;
        if (wm.logoPos === "top-right") x = canvas.width - lw - m;
        else if (wm.logoPos === "bottom-left") y = canvas.height - lh - m;
        else if (wm.logoPos === "bottom-right") { x = canvas.width - lw - m; y = canvas.height - lh - m; }
        else if (wm.logoPos === "center") { x = canvas.width / 2 - lw / 2; y = canvas.height / 2 - lh / 2; }
        ctx.drawImage(logoImg, x, y, lw, lh);
      }
      const out = await encodeCanvas(canvas);
      if (!out) return null;
      return { blob: out, name: outName(im, "_wm") };
    }, { label: I18N.t("editor.processingWatermark") });
  }

  // ---- 裁切（证件照）----
  // 统一的可视区域计算：给定视口 (TW,TH) 与配置，返回原图应绘制的目标矩形
  // ox/oy 的语义固定为「画布像素偏移」，避免同一状态在不同尺度下含义漂移
  function frameRect(img, TW, TH, c) {
    const iw = img.naturalWidth || img.width || TW;
    const ih = img.naturalHeight || img.height || TH;
    const base = c.mode === "cover" ? Math.max(TW / iw, TH / ih) : Math.min(TW / iw, TH / ih);
    const scale = base * (c.zoom || 1);
    const dw = iw * scale, dh = ih * scale;
    let ox = c.ox || 0, oy = c.oy || 0;
    if (c.mode === "cover") {
      const mx = Math.max(0, (dw - TW) / 2), my = Math.max(0, (dh - TH) / 2);
      ox = Math.max(-mx, Math.min(mx, ox)); oy = Math.max(-my, Math.min(my, oy));
    } else {
      const mx = Math.max(0, (TW - dw) / 2), my = Math.max(0, (TH - dh) / 2);
      ox = Math.max(-mx, Math.min(mx, ox)); oy = Math.max(-my, Math.min(my, oy));
    }
    return { iw, ih, dw, dh, ox, oy, x: (TW - dw) / 2 + ox, y: (TH - dh) / 2 + oy };
  }

  function drawFrame(ctx, img, TW, TH, c) {
    const r = frameRect(img, TW, TH, c);
    ctx.clearRect(0, 0, TW, TH);
    if (c.mode === "contain") { ctx.fillStyle = c.bg || "#fff"; ctx.fillRect(0, 0, TW, TH); }
    ctx.drawImage(img, r.x, r.y, r.dw, r.dh);
    // 回写被夹紧后的偏移，保证状态与画面一致
    c.ox = r.ox; c.oy = r.oy;
    return r;
  }

  // 有效区域占比：绘制矩形与画布的交集 / 画布
  function coverage(r, TW, TH) {
    const ix = Math.max(0, Math.min(TW, r.x + r.dw) - Math.max(0, r.x));
    const iy = Math.max(0, Math.min(TH, r.y + r.dh) - Math.max(0, r.y));
    const a = TW * TH;
    return a > 0 ? Math.max(0, Math.min(1, (ix * iy) / a)) : 0;
  }

  // ---- 裁切（支持批量：同一裁切框套用到全部选中图）----
  async function applyCrop() {
    const ids = targetIds();
    if (!ids.length) { U.toast(I18N.t("editor.pickToEdit")); return; }
    if (!crop.w || !crop.h || crop.w < 1 || crop.h < 1) { U.toast(I18N.t("crop.needSize")); return; }
    const size = clampOutSize(crop.w, crop.h);
    await runBatch(ids, async (im) => {
      const img = await loadImage(im.blob);
      const canvas = document.createElement("canvas");
      canvas.width = size.w; canvas.height = size.h;
      // 在真实输出尺度下重算偏移（ox/oy 为画布像素，尺度变化时需等比换算）
      const sc = size.w / crop.w;
      drawFrame(canvas.getContext("2d"), img, size.w, size.h,
        { mode: crop.mode, zoom: crop.zoom, ox: crop.ox * sc, oy: crop.oy * sc, bg: crop.bg });
      const out = await encodeCanvas(canvas);
      if (!out) return null;
      return { blob: out, name: outName(im, "_" + size.w + "x" + size.h) };
    }, { label: I18N.t("editor.processingCrop") });
    if (size.scaled) U.toast(I18N.t("editor.sizeClamped", { w: size.w, h: size.h }));
  }

  // ---- 渲染：缩略图卡片 ----
  function thumbHTML(img, which) {
    const sel = which === "lib" ? selLib : selZone;
    const checked = sel.has(img.id);
    const isTarget = which === "zone" && editing === img.id;
    const edited = which === "zone" && isEdited(img);
    return `<div class="ed-thumb-card${checked ? " selected" : ""}${isTarget ? " editing" : ""}" data-id="${img.id}" data-which="${which}" draggable="true">
      <button class="ed-thumb-chk${checked ? " on" : ""}" data-chk="${img.id}" data-which="${which}"
        role="checkbox" aria-checked="${checked ? "true" : "false"}"
        title="${I18N.t(checked ? "editor.uncheck" : "editor.check")}">${checked ? "✓" : ""}</button>
      <button class="ed-thumb-del" data-del="${img.id}" data-which="${which}" title="${I18N.t("common.del")}">✕</button>
      <div class="ed-thumb-img" data-open="${img.id}" data-which="${which}" role="button" tabindex="0"
        title="${I18N.t("editor.openEdit")}"><img src="${img.url}" alt=""></div>
      <div class="ed-thumb-name" data-name="${img.id}" data-which="${which}" title="${U.esc(img.name)}">${U.esc(img.name)}</div>
      <div class="ed-thumb-meta muted">${img.width || "?"}×${img.height || "?"} · ${img.size ? fmtBytes(img.size) : ""}</div>
      ${which === "zone" ? `<span class="ed-thumb-badge${edited ? " edited" : ""}">${edited ? I18N.t("editor.badgeEdited") : ""}</span>` : ""}
    </div>`;
  }

  function render() {
    const el = document.getElementById("view-editor");
    if (!el) return;
    const otherZones = ["compress", "watermark", "crop"].filter((x) => x !== zone);

    el.innerHTML = `
      <div class="ph">
        <span class="ph-ico">🎨</span>
        <div class="ph-txt">
          <h1>${I18N.t("editor.title")}</h1>
          <p>${I18N.t("editor.sub")}</p>
        </div>
        <div class="ph-actions">
          <span class="pill">🖼️ ${I18N.t("editor.libCount", { n: lib.length })}</span>
        </div>
      </div>

      <div class="card ed-lib">
        <div class="sec-title">${I18N.t("editor.library")} <span class="cnt">${lib.length}</span></div>
        <div id="dropZone" class="drop-zone">
          <div class="dz-ico">🖼️</div>
          <div class="dz-t">${I18N.t("editor.drop")}</div>
          <div class="dz-s">${I18N.t("editor.dragSort")}</div>
          <button class="btn" id="pickBtn">📁 ${I18N.t("editor.pick")}</button>
          <input type="file" id="fileInput" accept="image/*" multiple hidden>
        </div>
        <div class="ed-urlrow">
          <label class="field ed-urlfield" for="urlInput"><span>${I18N.t("editor.url")}</span>
            <input id="urlInput" type="url" placeholder="https://…" spellcheck="false">
          </label>
          <button class="btn ed-urlbtn" id="urlAdd"><span class="ico" aria-hidden="true">⬇</span><span class="tx">${I18N.t("editor.import")}</span></button>
        </div>
        <div class="ed-toolbar">
          <button class="btn ghost sm" id="selAll">${I18N.t(selLib.size === lib.length && selLib.size ? "editor.clearSel" : "editor.selectAll")}</button>
          <span class="ed-selcount" id="libCount">${I18N.t("editor.selected", { n: selLib.size })}</span>
          <span class="sp"></span>
          <span class="ed-group">${I18N.t("editor.sendTo")}${I18N.t("common.labelColon")}
            <button class="btn sm" data-send="compress"><span class="ico" aria-hidden="true">📦</span><span class="tx">${I18N.t("editor.tabCompress")}</span></button>
            <button class="btn sm" data-send="watermark"><span class="ico" aria-hidden="true">💧</span><span class="tx">${I18N.t("editor.tabWatermark")}</span></button>
            <button class="btn sm" data-send="crop"><span class="ico" aria-hidden="true">✂️</span><span class="tx">${I18N.t("editor.tabCrop")}</span></button>
          </span>
          <button class="btn ghost sm" id="delLib" ${selLib.size ? "" : "disabled"}>${I18N.t("editor.delSel")}</button>
          <button class="btn ghost sm" id="clearLib">${I18N.t("editor.clearLib")}</button>
        </div>
        <div id="libGrid" class="ed-thumbs">${lib.length ? lib.map((i) => thumbHTML(i, "lib")).join("") : `<div class="ed-empty muted">${I18N.t("editor.emptyLib")}</div>`}</div>
      </div>

        <div class="ed-zone">
        <div class="seg2 ed-tabs">
          ${["compress", "watermark", "crop"].map((id, ix) => `<button class="${zone === id ? "active" : ""}" data-tab="${id}">
            <span class="tab-ico" aria-hidden="true">${["📦", "💧", "✂️"][ix]}</span>
            <span class="tab-tx">${I18N.t(tabKey(id))}</span>
            <span class="tab-n">${zones[id].length}</span>
          </button>`).join("")}
        </div>
        <div class="ed-toolbar zone-toolbar">
          <button class="btn ghost sm" id="selAllZone">${I18N.t(selZone.size === zones[zone].length && selZone.size ? "editor.clearSel" : "editor.selectAll")}</button>
          <span class="ed-selcount" id="zoneCount">${I18N.t("editor.selected", { n: selZone.size })}</span>
          ${
            editing
              ? `<span class="ed-target" title="${I18N.t("editor.targetHint")}">🎯 ${I18N.t("editor.target")}${I18N.t("common.labelColon")}<b>${U.esc((curEdit() || {}).name || "")}</b></span>`
              : ""
          }
          <span class="sp"></span>
          <span class="ed-group">${I18N.t("editor.flowTo")}${I18N.t("common.labelColon")}
            ${otherZones.map((id) => `<button class="btn sm" data-flow="${id}">${I18N.t(tabKey(id))}</button>`).join("")}
          </span>
          <button class="btn ghost sm" id="restoreZone" ${(editing && isEdited(curEdit())) ? "" : "disabled"} title="${I18N.t("editor.resetOrigHint")}">↩ ${I18N.t("editor.resetOrig")}</button>
          <button class="btn sm" id="dlZone" ${targetIds().length ? "" : "disabled"}>⬇ ${I18N.t("editor.downloadSel")}</button>
          <button class="btn ghost sm" id="delZone" ${selZone.size ? "" : "disabled"}>${I18N.t("editor.delSel")}</button>
        </div>
        <div id="zoneGrid" class="ed-thumbs">${zones[zone].length ? zones[zone].map((i) => thumbHTML(i, "zone")).join("") : `<div class="ed-empty muted">${I18N.t("editor.zoneEmpty")}</div>`}</div>
        <div id="edPanel" class="ed-panel-wrap"></div>
      </div>

      <p class="muted ed-flow">💡 ${I18N.t("editor.selHint")}</p>
      <p class="muted ed-flow">💡 ${I18N.t("editor.flow")}</p>
    `;

    // 导入
    const fIn = el.querySelector("#fileInput");
    el.querySelector("#pickBtn").onclick = () => fIn.click();
    fIn.onchange = () => { if (fIn.files.length) importFiles(fIn.files); fIn.value = ""; };
    const dz = el.querySelector("#dropZone");
    dz.ondragover = (e) => { e.preventDefault(); dz.classList.add("drag"); };
    dz.ondragleave = () => dz.classList.remove("drag");
    dz.ondrop = (e) => { e.preventDefault(); dz.classList.remove("drag"); if (e.dataTransfer.files.length) importFiles(e.dataTransfer.files); };
    el.querySelector("#urlAdd").onclick = () => { const v = el.querySelector("#urlInput").value.trim(); if (v) importUrl(v); el.querySelector("#urlInput").value = ""; };

    // 图片库工具栏
    el.querySelector("#selAll").onclick = () => {
      // 全选 / 取消选择 二态切换
      if (selLib.size === lib.length && lib.length) selLib.clear();
      else lib.forEach((i) => selLib.add(i.id));
      render();
    };
    el.querySelector("#delLib").onclick = () => { if (!selLib.size) return; [...selLib].forEach(deleteLib); selLib.clear(); render(); };
    el.querySelector("#clearLib").onclick = () => { lib.forEach((i) => i.url && URL.revokeObjectURL(i.url)); lib = []; selLib.clear(); render(); };
    el.querySelectorAll("[data-send]").forEach((b) => b.onclick = () => sendTo(b.dataset.send));

    // 工作区 tab（只取工作区那几个；上方还有其他 [data-tab] 语义的按钮，必须限定容器）
    el.querySelectorAll(".ed-tabs > button[data-tab]").forEach((b) => b.onclick = () => {
      if (b.dataset.tab === zone) return;
      zoneMem[zone] = { sel: new Set(selZone), edit: editing };  // 暂存当前区状态
      zone = b.dataset.tab;
      const m = zoneMem[zone];
      selZone = new Set(m ? m.sel : []);
      editing = m ? m.edit : null;
      // 清掉已被删除/不存在的残留 id
      const alive = new Set(zones[zone].map((x) => x.id));
      selZone = new Set([...selZone].filter((id) => alive.has(id)));
      if (editing && !alive.has(editing)) editing = null;
      render();
    });

    // 工作区工具栏
    el.querySelectorAll("[data-flow]").forEach((b) => b.onclick = () => flowTo(b.dataset.flow));
    el.querySelector("#selAllZone").onclick = () => {
      const arr = zones[zone];
      if (selZone.size === arr.length && arr.length) selZone.clear();
      else arr.forEach((i) => selZone.add(i.id));
      render();
    };
    el.querySelector("#dlZone").onclick = () => {
      const ids = targetIds();
      if (!ids.length) return;
      ids.forEach((id) => { const im = zones[zone].find((x) => x.id === id); if (im) downloadBlob(im.blob, outName(im, "")); });
    };
    el.querySelector("#delZone").onclick = () => { if (!selZone.size) return; [...selZone].forEach((id) => deleteZone(zone, id)); selZone.clear(); render(); };
    el.querySelector("#restoreZone").onclick = restoreOrigin;

    // 缩略图交互
    bindThumbs(el.querySelector("#libGrid"), "lib");
    bindThumbs(el.querySelector("#zoneGrid"), "zone");

    // 编辑面板
    renderPanel(el.querySelector("#edPanel"));

    // 拖拽排序
    initDnd(el.querySelector("#libGrid"), lib);
    initDnd(el.querySelector("#zoneGrid"), zones[zone]);
  }

  function bindThumbs(grid, which) {
    if (!grid) return;
    grid.querySelectorAll(".ed-thumb-card").forEach((card) => {
      const id = card.dataset.id;
      const sel = selFor(which);

      // ① 复选框：纯勾选切换（可自由反选到 0），不改变编辑目标
      const chk = card.querySelector(".ed-thumb-chk");
      if (chk) chk.onclick = (e) => {
        e.stopPropagation();
        toggle(sel, id);
        syncSel(which);
      };

      // ② 图片区域：打开这张图的编辑（图片库无编辑面板，则等同勾选，方便继续送往）
      const open = card.querySelector(".ed-thumb-img");
      if (open) {
        const doOpen = (e) => {
          e.stopPropagation();
          if (which === "lib") { toggle(sel, id); syncSel(which); return; }
          editing = id;
          if (!sel.has(id)) sel.add(id);   // 打开编辑时自动勾上，符合直觉
          render();
        };
        open.onclick = doOpen;
        open.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); doOpen(e); } };
      }

      // ③ 点卡片空白处：等同于勾选切换（图片/名称/按钮都有自己的处理，不会走到这里）
      card.onclick = (e) => {
        if (e.target.closest(".ed-thumb-chk,.ed-thumb-del,.ed-thumb-name,.ed-thumb-img")) return;
        toggle(sel, id);
        syncSel(which);
      };

      const del = card.querySelector(".ed-thumb-del");
      if (del) del.onclick = (e) => {
        e.stopPropagation();
        if (which === "lib") deleteLib(id); else deleteZone(zone, id);
        render();
      };
      const nm = card.querySelector(".ed-thumb-name");
      if (nm) nm.onclick = (e) => { e.stopPropagation(); renameImg(which, id); };
    });
  }

  // 只刷新选中相关的视觉与计数，避免整页重绘（保持滚动位置、避免 DOM 句柄失效）
  // which 指明本次操作发生在「图片库」还是「工作区」，因为一次 render 里两个网格同时存在
  function syncSel(which) {
    const el = document.getElementById("view-editor");
    if (!el) return;
    const grid = which === "lib" ? el.querySelector("#libGrid") : el.querySelector("#zoneGrid");
    const sel = selFor(which);
    if (grid) grid.querySelectorAll(".ed-thumb-card").forEach((card) => {
      const on = sel.has(card.dataset.id);
      card.classList.toggle("selected", on);
      const chk = card.querySelector(".ed-thumb-chk");
      if (chk) {
        chk.classList.toggle("on", on);
        chk.textContent = on ? "✓" : "";
        chk.setAttribute("aria-checked", on ? "true" : "false");
        chk.title = I18N.t(on ? "editor.uncheck" : "editor.check");
      }
    });

    if (which === "lib") {
      const n = selLib.size;
      const cnt = el.querySelector("#libCount");
      if (cnt) cnt.textContent = I18N.t("editor.selected", { n });
      const del = el.querySelector("#delLib"); if (del) del.disabled = !n;
      const all = el.querySelector("#selAll");
      if (all) all.textContent = I18N.t(lib.length && n === lib.length ? "editor.clearSel" : "editor.selectAll");
    } else {
      const n = selZone.size;
      const cnt = el.querySelector("#zoneCount");
      if (cnt) cnt.textContent = I18N.t("editor.selected", { n });
      // 说明：下载/删除走「勾选集 (selZone)」，所以这里用 n 判定禁用；
      // 应用类按钮走 targetIds()（勾选集优先、否则当前编辑图），两者语义不同不要混用。
      const dl = el.querySelector("#dlZone"); if (dl) dl.disabled = !n;
      const del = el.querySelector("#delZone"); if (del) del.disabled = !n;
      const cur = curEdit();
      const rs = el.querySelector("#restoreZone"); if (rs) rs.disabled = !(cur && isEdited(cur));
      const all = el.querySelector("#selAllZone");
      if (all) all.textContent = I18N.t(zones[zone].length && n === zones[zone].length ? "editor.clearSel" : "editor.selectAll");
      // 应用按钮的数量标注可能随勾选变化
      const labelMap = { compress: ["#edCompress", "editor.applyCompress"], watermark: ["#wmApply", "editor.applyWatermark"], crop: ["#cropApply", "editor.applyCrop"] };
      const lm = labelMap[zone];
      if (lm) { const btn = el.querySelector(lm[0]); if (btn) btn.textContent = applyLabel(lm[1]); }
    }
  }

  function renameImg(which, id) {
    const arr = which === "lib" ? lib : zones[zone];
    const it = arr.find((x) => x.id === id); if (!it) return;
    const n = prompt(I18N.t("editor.rename"), it.name);
    if (n != null) { it.name = n.trim() || it.name; render(); }
  }

  // HTML5 拖拽排序（整卡 draggable，移动后按 DOM 顺序同步数组）
  function initDnd(grid, arr) {
    if (!grid) return;
    let dragEl = null;
    grid.querySelectorAll(".ed-thumb-card").forEach((card) => {
      card.addEventListener("dragstart", (e) => {
        dragEl = card; card.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        try { e.dataTransfer.setData("text/plain", card.dataset.id); } catch (_) {}
      });
      card.addEventListener("dragend", () => {
        card.classList.remove("dragging"); dragEl = null;
        const ids = [...grid.querySelectorAll(".ed-thumb-card")].map((c) => c.dataset.id);
        arr.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
      });
      card.addEventListener("dragover", (e) => {
        if (!dragEl || dragEl === card) return;
        e.preventDefault();
        const rect = card.getBoundingClientRect();
        const after = (e.clientY - rect.top) > rect.height / 2;
        if (after) grid.appendChild(dragEl); else grid.insertBefore(dragEl, card);
      });
      card.addEventListener("drop", (e) => { if (dragEl) e.preventDefault(); });
    });
  }

  function renderPanel(box) {
    const im = curEdit();
    if (!im) {
      // 区分两种空态：本区没有图片 vs 有图片但未选中
      const none = !zones[zone].length;
      box.innerHTML = `<div class="ed-panel-hint muted">
        ${none ? `📥 ${I18N.t("editor.zoneEmptyPick", { zone: I18N.t(tabKey(zone)) })}`
               : `👆 ${I18N.t("editor.pickToEdit")}`}
      </div>`;
      return;
    }
    if (zone === "compress") renderCompress(box);
    else if (zone === "watermark") renderWatermark(box);
    else renderCrop(box);
  }

  function renderCompress(box) {
    const fmtOpts = FORMATS.map((f) => `<option value="${f.id}" ${OUT.id === f.id ? "selected" : ""}>${f.label}</option>`).join("");
    box.innerHTML = `
      <div class="card ed-panel">
        <div class="row" style="gap:16px;flex-wrap:wrap;align-items:center">
          <label class="field" style="margin:0"><span>${I18N.t("compress.format")}</span><select id="outFormat">${fmtOpts}</select></label>
          <label class="field" style="margin:0;min-width:220px"><span>${I18N.t("compress.quality")} <b id="qVal">${Math.round(OUT.quality * 100)}</b></span>
            <input type="range" id="quality" min="10" max="100" value="${Math.round(OUT.quality * 100)}"></label>
          <button class="btn primary" id="edCompress">${applyLabel("editor.applyCompress")}</button>
        </div>
        <p class="muted" id="cmpSize" style="margin-top:12px">${I18N.t("editor.compressHint")}</p>
      </div>`;
    box.querySelector("#outFormat").onchange = (e) => {
      OUT.id = e.target.value; lastCompress = null; render();
      // 格式是全局输出设置，其它面板（裁切/水印）的提示也需同步刷新
      U.toast(I18N.t("compress.fmtChanged", { fmt: (FORMATS.find((f) => f.id === OUT.id) || {}).label || OUT.id }));
    };
    box.querySelector("#quality").oninput = (e) => { OUT.quality = +e.target.value / 100; box.querySelector("#qVal").textContent = e.target.value; };
    box.querySelector("#edCompress").onclick = compressWork;
    // 原图大小 / 压缩后大小 同步展示
    const sizeBox = box.querySelector("#cmpSize");
    if (sizeBox) {
      if (lastCompress && lastCompress.id === editing && lastCompress.before) {
        const pct = Math.round((1 - lastCompress.after / lastCompress.before) * 100);
        const tag = pct >= 0 ? `节省 ${pct}%` : `增大 ${-pct}%`;
        sizeBox.innerHTML = `原图 <b>${fmtBytes(lastCompress.before)}</b> → 压缩后 <b>${fmtBytes(lastCompress.after)}</b>（${tag}）`;
      } else {
        sizeBox.textContent = I18N.t("editor.compressHint");
      }
    }
  }

  function renderWatermark(box) {
    const im = curEdit();
    box.innerHTML = `
      <div class="card ed-panel ed-wm-grid">
        <div class="ed-wm-cfg">
          <div class="card-title">${I18N.t("watermark.text")}</div>
          <label class="field"><span>${I18N.t("watermark.textContent")}</span><input id="wmText" value="${U.esc(wm.text)}" placeholder="${I18N.t("watermark.textPH")}"></label>
          <div class="row" style="gap:10px;flex-wrap:wrap;align-items:center">
            <label class="field" style="margin:0"><span>${I18N.t("watermark.mode")}</span>
              <select id="wmMode"><option value="1" ${wm.tile ? "selected" : ""}>${I18N.t("watermark.tile")}</option><option value="0" ${!wm.tile ? "selected" : ""}>${I18N.t("watermark.single")}</option></select></label>
            <label class="field" id="wmPosWrap" style="margin:0;${wm.tile ? "display:none" : ""}"><span>${I18N.t("watermark.pos")}</span>
              <select id="wmPos"><option value="top-left">左上</option><option value="top-right">右上</option><option value="bottom-left">左下</option><option value="bottom-right">右下</option><option value="center" ${wm.pos === "center" ? "selected" : ""}>居中</option></select></label>
          </div>
          <label class="field"><span>${I18N.t("watermark.opacity")} <b id="wmOpacityV">${wm.opacity}</b></span><input type="range" id="wmOpacity" min="0" max="100" value="${wm.opacity}"></label>
          <label class="field"><span>${I18N.t("watermark.sizeRatio")} <b id="wmSizeV">${Math.round(wm.sizeRatio * 100)}%</b></span><input type="range" id="wmSize" min="2" max="25" value="${Math.round(wm.sizeRatio * 100)}"></label>
          <label class="field" id="wmAngleWrap" style="margin:0"><span>${I18N.t("watermark.angle")} <b id="wmAngleV">${wm.angle}</b>°</span><input type="range" id="wmAngle" min="-60" max="60" value="${wm.angle}"></label>
          <div class="row" style="gap:12px;align-items:center;flex-wrap:wrap">
            <label class="field" style="margin:0"><span>${I18N.t("watermark.color")}</span><input type="color" id="wmColor" value="${wm.color}" style="width:48px;height:34px;padding:2px"></label>
            <label class="checkbox"><input type="checkbox" id="wmBold" ${wm.bold ? "checked" : ""}> ${I18N.t("watermark.bold")}</label>
          </div>
          <div class="card-title" style="margin-top:14px">${I18N.t("watermark.logo")}</div>
          <div class="row" style="gap:10px;align-items:center;flex-wrap:wrap">
            <button class="btn ghost sm" id="wmLogoBtn">${wm.logo ? I18N.t("watermark.changeLogo") : I18N.t("watermark.uploadLogo")}</button>
            <input type="file" id="wmLogoFile" accept="image/*" hidden>
            ${wm.logo ? `<span class="muted">✓</span><button class="btn ghost sm" id="wmLogoX">✕ ${I18N.t("editor.rename")}</button>` : ""}
          </div>
          <label class="field" style="${wm.logo ? "" : "display:none"};margin-top:10px"><span>${I18N.t("watermark.logoPos")}</span>
            <select id="wmLogoPos"><option value="top-left">左上</option><option value="top-right">右上</option><option value="bottom-left">左下</option><option value="bottom-right" ${wm.logoPos === "bottom-right" ? "selected" : ""}>右下</option><option value="center">居中</option></select></label>
          <label class="field" style="${wm.logo ? "" : "display:none"};margin-top:6px"><span>${I18N.t("watermark.logoScale")} <b id="wmLogoScaleV">${Math.round(wm.logoScale * 100)}%</b></span><input type="range" id="wmLogoScale" min="5" max="50" value="${Math.round(wm.logoScale * 100)}"></label>
          <div class="row" style="margin-top:14px"><button class="btn primary" id="wmApply">${applyLabel("editor.applyWatermark")}</button></div>
        </div>
        <div class="ed-wm-preview">
          <div class="ed-prev-label">${I18N.t("editor.preview")}</div>
          <canvas id="wmPrev" class="ed-prev-canvas"></canvas>
        </div>
      </div>`;

    const prev = box.querySelector("#wmPrev");
    // 预览按显示尺寸绘制（大图不再按原图尺寸渲染），水印参数按比例缩放，视觉一致且流畅
    const PREVIEW_MAX = 760;
    const redraw = async () => {
      if (!im) return;
      const img = await loadImage(im.blob);
      const iw = img.naturalWidth || 1, ih = img.naturalHeight || 1;
      const k = Math.min(1, PREVIEW_MAX / Math.max(iw, ih));
      const pw = Math.max(1, Math.round(iw * k)), ph = Math.max(1, Math.round(ih * k));
      prev.width = pw; prev.height = ph;
      prev.style.width = pw + "px"; prev.style.height = ph + "px";
      const ctx = prev.getContext("2d");
      ctx.clearRect(0, 0, pw, ph);
      ctx.drawImage(img, 0, 0, pw, ph);
      if (wm.text) {
        const o = { text: wm.text, fontSize: Math.round(ph * wm.sizeRatio), color: wm.color, opacity: wm.opacity / 100, angle: wm.angle, bold: wm.bold, pos: wm.pos };
        if (wm.tile) drawTiledText(ctx, pw, ph, o); else drawSingleText(ctx, pw, ph, o);
      }
      if (wm.logo) {
        const lo = await loadImage(wm.logo);
        const lw = pw * wm.logoScale, lh = lw * (lo.naturalHeight / lo.naturalWidth), m = pw * 0.04;
        let x = m, y = m;
        if (wm.logoPos === "top-right") x = pw - lw - m;
        else if (wm.logoPos === "bottom-left") y = ph - lh - m;
        else if (wm.logoPos === "bottom-right") { x = pw - lw - m; y = ph - lh - m; }
        else if (wm.logoPos === "center") { x = pw / 2 - lw / 2; y = ph / 2 - lh / 2; }
        ctx.drawImage(lo, x, y, lw, lh);
      }
    };

    box.querySelector("#wmText").oninput = (e) => { wm.text = e.target.value; redraw(); };
    box.querySelector("#wmMode").onchange = (e) => { wm.tile = e.target.value === "1"; box.querySelector("#wmPosWrap").style.display = wm.tile ? "none" : ""; box.querySelector("#wmAngleWrap").style.display = wm.tile ? "" : "none"; redraw(); };
    box.querySelector("#wmPos").onchange = (e) => { wm.pos = e.target.value; redraw(); };
    box.querySelector("#wmOpacity").oninput = (e) => { wm.opacity = +e.target.value; box.querySelector("#wmOpacityV").textContent = e.target.value; redraw(); };
    box.querySelector("#wmSize").oninput = (e) => { wm.sizeRatio = +e.target.value / 100; box.querySelector("#wmSizeV").textContent = e.target.value + "%"; redraw(); };
    box.querySelector("#wmAngle").oninput = (e) => { wm.angle = +e.target.value; box.querySelector("#wmAngleV").textContent = e.target.value; redraw(); };
    box.querySelector("#wmColor").oninput = (e) => { wm.color = e.target.value; redraw(); };
    box.querySelector("#wmBold").onchange = (e) => { wm.bold = e.target.checked; redraw(); };
    box.querySelector("#wmLogoBtn").onclick = () => box.querySelector("#wmLogoFile").click();
    box.querySelector("#wmLogoFile").onchange = (e) => {
      const f = e.target.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => { wm.logo = r.result; render(); };
      r.readAsDataURL(f);
    };
    const lx = box.querySelector("#wmLogoX"); if (lx) lx.onclick = () => { wm.logo = null; render(); };
    box.querySelector("#wmLogoPos").onchange = (e) => { wm.logoPos = e.target.value; redraw(); };
    box.querySelector("#wmLogoScale").oninput = (e) => { wm.logoScale = +e.target.value / 100; box.querySelector("#wmLogoScaleV").textContent = e.target.value + "%"; redraw(); };
    box.querySelector("#wmApply").onclick = applyWatermark;
    redraw();
  }

  function renderCrop(box) {
    const im = curEdit();
    const presetOpts = ID_PRESETS.map((p) => `<option value="${p.name}" ${crop.w === p.w && crop.h === p.h ? "selected" : ""}>${p.name}（${p.w ? p.w + "×" + p.h : "自定义"}）</option>`).join("");
    box.innerHTML = `
      <div class="card ed-panel ed-crop-grid">
        <div class="ed-crop-cfg">
          <label class="field"><span>${I18N.t("crop.preset")}</span><select id="cropPreset">${presetOpts}</select></label>
          <div class="row" style="gap:10px">
            <label class="field" style="margin:0"><span>${I18N.t("crop.width")}</span><input type="number" id="cropW" value="${crop.w || ""}" min="1" max="8000"></label>
            <label class="field" style="margin:0"><span>${I18N.t("crop.height")}</span><input type="number" id="cropH" value="${crop.h || ""}" min="1" max="8000"></label>
          </div>
          <label class="field"><span>${I18N.t("crop.mode")}</span>
            <select id="cropMode"><option value="cover" ${crop.mode === "cover" ? "selected" : ""}>${I18N.t("crop.cover")}</option><option value="contain" ${crop.mode === "contain" ? "selected" : ""}>${I18N.t("crop.contain")}</option></select></label>
          <label class="field" id="cropBgWrap" style="margin:0${crop.mode === "cover" ? ";display:none" : ""}"><span>${I18N.t("crop.bg")}</span>
            <select id="cropBg"><option value="#ffffff" ${crop.bg === "#ffffff" ? "selected" : ""}>${I18N.t("crop.white")}</option><option value="#2e5bba" ${crop.bg === "#2e5bba" ? "selected" : ""}>${I18N.t("crop.blue")}</option><option value="#d9001b" ${crop.bg === "#d9001b" ? "selected" : ""}>${I18N.t("crop.red")}</option></select></label>
          <label class="field"><span>${I18N.t("crop.zoom")} <b id="cropZoomV">${Math.round(crop.zoom * 100)}%</b></span><input type="range" id="cropZoom" min="100" max="300" value="${Math.round(crop.zoom * 100)}"></label>
          <div class="ed-crop-actions">
            <button class="btn ghost sm" id="cropCenter">${I18N.t("crop.recenter")}</button>
            <button class="btn ghost sm" id="cropReset">${I18N.t("crop.reset")}</button>
          </div>
          <p class="muted">${I18N.t("crop.dragHint")}</p>
          <button class="btn primary" id="cropApply">${applyLabel("editor.applyCrop")}</button>
        </div>
        <div class="ed-crop-preview">
          <div class="ed-prev-label">${I18N.t("editor.preview")}</div>
          <div id="cropStage" class="ed-crop-stage"><canvas id="cropPrev" class="ed-prev-canvas"></canvas></div>
          <div class="ed-crop-readout" id="cropReadout"></div>
        </div>
      </div>`;

    const prev = box.querySelector("#cropPrev");
    const outEl = box.querySelector("#cropReadout");
    const stage = box.querySelector("#cropStage");

    // 预览画布的内部分辨率（CSS 尺寸与之一一对应，避免被 max-* 二次压缩）
    // 按容器实测宽度反推，随面板宽度自适应；上下限防止极端值
    const VIEW_MAX_H = 420, VIEW_MIN_W = 200, VIEW_MAX_W = 460;
    function viewSize() {
      const aspect = (crop.h || 1) / (crop.w || 1);
      const availW = Math.round((stage && stage.clientWidth ? stage.clientWidth : 360) - 4);
      let w = Math.max(VIEW_MIN_W, Math.min(VIEW_MAX_W, availW || 360));
      let h = Math.round(w * aspect);
      if (h > VIEW_MAX_H) { h = VIEW_MAX_H; w = Math.round(h / aspect); }
      return { w: Math.max(1, w), h: Math.max(1, h) };
    }

    async function redraw() {
      if (!im) return null;
      const img = await loadImage(im.blob);
      const vs = viewSize();
      // 按设备像素比渲染，保证高分屏清晰度；CSS 尺寸显式设定，杜绝缩放歧义
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      prev.width = Math.round(vs.w * dpr);
      prev.height = Math.round(vs.h * dpr);
      prev.style.width = vs.w + "px";
      prev.style.height = vs.h + "px";
      const ctx = prev.getContext("2d");
      // 关键：ox/oy 语义为「输出画布像素」，按输出尺寸绘制再整体缩放到预览尺度
      const r = drawFrame(ctx, img, vs.w, vs.h, {
        mode: crop.mode, zoom: crop.zoom,
        ox: crop.ox * (vs.w / (crop.w || vs.w)),
        oy: crop.oy * (vs.h / (crop.h || vs.h)),
        bg: crop.bg
      });
      r.tw = vs.w; r.th = vs.h;
      return r;
    }

    // 渲染后把「被 clamp 的真实偏移」换算回输出像素尺度写回状态
    // （视图尺寸可能变化，但状态永远以输出像素表达 → 跨视图不漂移）
    function syncOffset(r, vs) {
      if (!r || !crop.w || !crop.h || !vs.w || !vs.h) return;
      crop.ox = r.ox * (crop.w / vs.w);
      crop.oy = r.oy * (crop.h / vs.h);
    }

    function updateReadout(r, vs) {
      if (!outEl) return;
      const W = crop.w || 0, H = crop.h || 0;
      const cov = r ? Math.round(coverage(r, vs.w, vs.h) * 100) : 0;
      const clamped = clampOutSize(W, H);
      const sizeTxt = clamped.scaled
        ? `<b class="warn">${W}×${H} → ${clamped.w}×${clamped.h}px</b>`
        : `<b>${W}×${H}px</b>`;
      const srcTxt = im ? `${im.width||"?"}×${im.height||"?"}px` : "-";
      outEl.innerHTML = `
        <span class="cr-item"><i>${I18N.t("crop.outSize")}</i>${sizeTxt}</span>
        <span class="cr-item"><i>${I18N.t("crop.srcSize")}</i><b>${srcTxt}</b></span>
        <span class="cr-item"><i>${I18N.t("crop.zoom")}</i><b>${Math.round(crop.zoom * 100)}%</b></span>
        <span class="cr-item"><i>${I18N.t("crop.offset")}</i><b>${Math.round(crop.ox)}, ${Math.round(crop.oy)}</b></span>
        <span class="cr-item"><i>${I18N.t("crop.cover")}</i><b class="${cov < 100 && crop.mode === "cover" ? "warn" : ""}">${cov}%</b></span>`;
    }

    // screen(CSS) 位移 → 输出画布像素位移：用 getBoundingClientRect 求真实显示尺寸，
    // 彻底摆脱 DPR 与 CSS 压缩的影响（旧实现用 prev.width 缓冲像素，高 DPI 下会差 2 倍）
    function dragScale() {
      const rect = prev.getBoundingClientRect();
      const sx = rect.width > 0 ? (crop.w || 1) / rect.width : 1;
      const sy = rect.height > 0 ? (crop.h || 1) / rect.height : 1;
      return { sx, sy };
    }
    // 渲染 → 回写 clamp 后的偏移 → 刷新读数条（一次到位，避免状态与画面不一致）
    async function refresh() {
      const r = await redraw();
      const vs = { w: (r && r.tw) || 0, h: (r && r.th) || 0 };
      if (r) syncOffset(r, vs);
      updateReadout(r, vs);
      return r;
    }

    let raf = null;
    const scheduleRedraw = () => { if (raf) cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { raf = null; refresh(); }); };

    box.querySelector("#cropPreset").onchange = (e) => {
      const p = ID_PRESETS.find((x) => x.name === e.target.value);
      if (p) {
        crop.w = p.w; crop.h = p.h; crop.ox = 0; crop.oy = 0; crop.zoom = 1;
        const z = box.querySelector("#cropZoom"); if (z) z.value = 100;
        const zv = box.querySelector("#cropZoomV"); if (zv) zv.textContent = "100%";
        box.querySelector("#cropW").value = p.w || "";
        box.querySelector("#cropH").value = p.h || "";
        refresh();
      }
    };
    // 自定义尺寸：防抖刷新预览，并把预设下拉切到「自定义」
    let sizeTimer = null;
    const onSizeInput = () => {
      const w = +box.querySelector("#cropW").value || 0;
      const h = +box.querySelector("#cropH").value || 0;
      crop.w = w; crop.h = h;
      const p = ID_PRESETS.find((x) => x.w === w && x.h === h);
      box.querySelector("#cropPreset").value = p ? p.name : "自定义";
      clearTimeout(sizeTimer);
      sizeTimer = setTimeout(refresh, 180);
    };
    box.querySelector("#cropW").oninput = onSizeInput;
    box.querySelector("#cropH").oninput = onSizeInput;
    box.querySelector("#cropMode").onchange = (e) => { crop.mode = e.target.value; box.querySelector("#cropBgWrap").style.display = crop.mode === "cover" ? "none" : ""; refresh(); };
    box.querySelector("#cropBg").onchange = (e) => { crop.bg = e.target.value; refresh(); };
    box.querySelector("#cropZoom").oninput = (e) => { crop.zoom = +e.target.value / 100; box.querySelector("#cropZoomV").textContent = e.target.value + "%"; scheduleRedraw(); };
    box.querySelector("#cropCenter").onclick = () => { crop.ox = 0; crop.oy = 0; refresh(); };
    box.querySelector("#cropReset").onclick = () => {
      crop.ox = 0; crop.oy = 0; crop.zoom = 1; crop.mode = "cover";
      box.querySelector("#cropZoom").value = 100;
      box.querySelector("#cropZoomV").textContent = "100%";
      box.querySelector("#cropMode").value = "cover";
      box.querySelector("#cropBgWrap").style.display = "none";
      refresh();
      U.toast(I18N.t("crop.resetDone"));
    };
    box.querySelector("#cropApply").onclick = applyCrop;

    // 拖拽平移：位移按 rect 换算，跟手且与 DPR 无关
    let lastX = 0, lastY = 0, dragging = false;
    prev.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      dragging = true;
      try { prev.setPointerCapture(e.pointerId); } catch (_) {}
      lastX = e.clientX; lastY = e.clientY;
      prev.classList.add("dragging");
    });
    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      prev.classList.remove("dragging");
      try { prev.releasePointerCapture(e.pointerId); } catch (_) {}
      refresh(); // 收尾时以精确值重绘一次
    };
    prev.addEventListener("pointerup", endDrag);
    prev.addEventListener("pointercancel", endDrag);
    prev.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const { sx, sy } = dragScale();
      crop.ox += (e.clientX - lastX) * sx;
      crop.oy += (e.clientY - lastY) * sy;
      lastX = e.clientX; lastY = e.clientY;
      scheduleRedraw();
    });    // 滚轮缩放（可选增强，不改动滑块行为）
    prev.addEventListener("wheel", (e) => {
      e.preventDefault();
      const step = e.deltaY < 0 ? 5 : -5;
      crop.zoom = Math.max(1, Math.min(3, +(crop.zoom + step / 100).toFixed(2)));
      const z = box.querySelector("#cropZoom"); if (z) z.value = Math.round(crop.zoom * 100);
      const zv = box.querySelector("#cropZoomV"); if (zv) zv.textContent = Math.round(crop.zoom * 100) + "%";
      scheduleRedraw();
    }, { passive: false });

    refresh();
    // 调试/测试钩子：暴露当前裁切视图状态与重绘入口（只读 + 主动刷新）
    cropDebug = {
      state: () => ({
        w: crop.w, h: crop.h, mode: crop.mode, zoom: crop.zoom,
        ox: Math.round(crop.ox), oy: Math.round(crop.oy),
        viewW: prev.width, viewH: prev.height,
        cssW: Math.round(prev.getBoundingClientRect().width),
        cssH: Math.round(prev.getBoundingClientRect().height),
        scale: dragScale()
      }),
      redraw: () => refresh()
    };
  }

  async function init() {}
  async function onShow() { render(); }
  return { init, onShow, get cropDebug() { return cropDebug; } };
})();

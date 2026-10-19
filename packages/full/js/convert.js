/* ===== Calculator + Unit Converter ===== */
window.Convert = (function () {
  /* ============== Unit Converter 数据 ============== */
  // 「单位」用稳定 id 作 key（如 len_km），中文名/英文名/显示缩写由 i18n 提供：
  //   z  = 中文显示名（zh 模式）
  //   e  = 英文显示名（en 模式）
  //   v  = 换算到基准单位的倍率（温度类走 special:"temp"，值为单位符号 C/F/K）
  // 这样切换语言时单位名会跟着变，而数值换算逻辑完全不依赖显示文本。
  const U_ = (z, e, v) => ({ z, e, v });
  const CATS = {
    length: { icon: "📏", base: "m", units: {
      len_km: U_("千米", "Kilometer", 1000), len_m: U_("米", "Meter", 1), len_dm: U_("分米", "Decimeter", 0.1),
      len_cm: U_("厘米", "Centimeter", 0.01), len_mm: U_("毫米", "Millimeter", 0.001), len_um: U_("微米", "Micrometer", 1e-6),
      len_mi: U_("英里", "Mile", 1609.344), len_yd: U_("码", "Yard", 0.9144), len_ft: U_("英尺", "Foot", 0.3048),
      len_in: U_("英寸", "Inch", 0.0254), len_nmi: U_("海里", "Nautical mile", 1852)
    } },
    area: { icon: "▦", base: "m²", units: {
      ar_km2: U_("平方千米", "Square kilometer", 1e6), ar_m2: U_("平方米", "Square meter", 1), ar_dm2: U_("平方分米", "Square decimeter", 0.01),
      ar_cm2: U_("平方厘米", "Square centimeter", 1e-4), ar_mm2: U_("平方毫米", "Square millimeter", 1e-6),
      ar_ha: U_("公顷", "Hectare", 10000), ar_acre: U_("英亩", "Acre", 4046.8564224),
      ar_ft2: U_("平方英尺", "Square foot", 0.09290304), ar_in2: U_("平方英寸", "Square inch", 0.00064516),
      ar_mi2: U_("平方英里", "Square mile", 2589988.110336)
    } },
    volume: { icon: "📦", base: "m³", units: {
      vo_m3: U_("立方米", "Cubic meter", 1), vo_dm3: U_("立方分米", "Cubic decimeter", 0.001),
      vo_cm3: U_("立方厘米", "Cubic centimeter", 1e-6), vo_mm3: U_("立方毫米", "Cubic millimeter", 1e-9),
      vo_ft3: U_("立方英尺", "Cubic foot", 0.028316846592), vo_in3: U_("立方英寸", "Cubic inch", 1.6387064e-5),
      vo_yd3: U_("立方码", "Cubic yard", 0.764554857984)
    } },
    capacity: { icon: "🥤", base: "L", units: {
      ca_m3: U_("立方米", "Cubic meter", 1000), ca_l: U_("升", "Liter", 1), ca_dl: U_("分升", "Deciliter", 0.1),
      ca_ml: U_("毫升", "Milliliter", 0.001), ca_galus: U_("加仑(美)", "Gallon (US)", 3.785411784),
      ca_galuk: U_("加仑(英)", "Gallon (UK)", 4.54609), ca_qt: U_("夸脱(美)", "Quart (US)", 0.946352946),
      ca_pt: U_("品脱(美)", "Pint (US)", 0.473176473), ca_cup: U_("杯(美)", "Cup (US)", 0.2365882365),
      ca_floz: U_("液量盎司(美)", "Fluid ounce (US)", 0.0295735295625), ca_bbl: U_("桶(原油)", "Barrel (oil)", 158.987294928)
    } },
    mass: { icon: "⚖️", base: "kg", units: {
      ma_t: U_("吨", "Tonne", 1000), ma_kg: U_("千克", "Kilogram", 1), ma_g: U_("克", "Gram", 0.001), ma_mg: U_("毫克", "Milligram", 1e-6),
      ma_lb: U_("磅", "Pound", 0.45359237), ma_oz: U_("盎司(常衡)", "Ounce (avoirdupois)", 0.028349523125),
      ma_st: U_("英石", "Stone", 6.35029318), ma_ct: U_("克拉", "Carat", 0.0002)
    } },
    temperature: { icon: "🌡️", base: "°C", special: "temp", units: {
      te_c: U_("摄氏度", "Celsius", "C"), te_f: U_("华氏度", "Fahrenheit", "F"), te_k: U_("开尔文", "Kelvin", "K")
    } },
    data: { icon: "💾", base: "B", units: {
      da_bit: U_("位", "Bit", 1 / 8), da_b: U_("字节", "Byte", 1), da_kb: U_("千字节", "Kilobyte", 1024),
      da_mb: U_("兆字节", "Megabyte", 1048576), da_gb: U_("吉字节", "Gigabyte", 1073741824),
      da_tb: U_("太字节", "Terabyte", 1099511627776), da_kbit: U_("千比特", "Kilobit", 128),
      da_mbit: U_("兆比特", "Megabit", 131072), da_gbit: U_("吉比特", "Gigabit", 134217728)
    } },
    time: { icon: "⏱️", base: "s", units: {
      ti_wk: U_("周", "Week", 604800), ti_d: U_("天", "Day", 86400), ti_h: U_("小时", "Hour", 3600),
      ti_min: U_("分钟", "Minute", 60), ti_s: U_("秒", "Second", 1), ti_ms: U_("毫秒", "Millisecond", 0.001)
    } },
    speed: { icon: "🚀", base: "m/s", units: {
      sp_ms: U_("米/秒", "Meter/second", 1), sp_kmh: U_("千米/时", "Kilometer/hour", 0.27777777777778),
      sp_mph: U_("英里/时", "Mile/hour", 0.44704), sp_fts: U_("英尺/秒", "Foot/second", 0.3048),
      sp_knot: U_("节", "Knot", 0.51444444444444)
    } }
  };
  // 类别名与单位后缀（不随语言变化的符号，如 km / m² / °C）
  const CAT_LABEL = {
    length: { z: "长度", e: "Length" }, area: { z: "面积", e: "Area" }, volume: { z: "体积", e: "Volume" },
    capacity: { z: "容积", e: "Capacity" }, mass: { z: "质量", e: "Mass" }, temperature: { z: "温度", e: "Temperature" },
    data: { z: "数据存储", e: "Data storage" }, time: { z: "时间", e: "Time" }, speed: { z: "速度", e: "Speed" }
  };
  // 单位显示后缀（国际符号，中英一致）：len_km -> "km"，ar_m2 -> "m²"
  const UNIT_SUFFIX = {
    len_km: "km", len_m: "m", len_dm: "dm", len_cm: "cm", len_mm: "mm", len_um: "μm",
    len_mi: "mi", len_yd: "yd", len_ft: "ft", len_in: "in", len_nmi: "nmi",
    ar_km2: "km²", ar_m2: "m²", ar_dm2: "dm²", ar_cm2: "cm²", ar_mm2: "mm²", ar_ha: "ha", ar_acre: "acre",
    ar_ft2: "ft²", ar_in2: "in²", ar_mi2: "mi²",
    vo_m3: "m³", vo_dm3: "dm³", vo_cm3: "cm³", vo_mm3: "mm³", vo_ft3: "ft³", vo_in3: "in³", vo_yd3: "yd³",
    ca_m3: "m³", ca_l: "L", ca_dl: "dL", ca_ml: "mL", ca_galus: "gal (US)", ca_galuk: "gal (UK)", ca_qt: "qt (US)",
    ca_pt: "pt (US)", ca_cup: "cup (US)", ca_floz: "fl oz (US)", ca_bbl: "bbl",
    ma_t: "t", ma_kg: "kg", ma_g: "g", ma_mg: "mg", ma_lb: "lb", ma_oz: "oz", ma_st: "st", ma_ct: "ct",
    te_c: "°C", te_f: "°F", te_k: "K",
    da_bit: "bit", da_b: "B", da_kb: "KB", da_mb: "MB", da_gb: "GB", da_tb: "TB",
    da_kbit: "Kbit", da_mbit: "Mbit", da_gbit: "Gbit",
    ti_wk: "wk", ti_d: "d", ti_h: "h", ti_min: "min", ti_s: "s", ti_ms: "ms",
    sp_ms: "m/s", sp_kmh: "km/h", sp_mph: "mph", sp_fts: "ft/s", sp_knot: "knot"
  };
  // 当前语言下单位的显示文本：
  //   中文：「千米 km」/「平方千米 km²」（中文名 + 符号，帮助对照）
  //   英文：只显示符号「km」（英文里 km/m/cm 已是通用写法，"Kilometer km" 反而啰嗦）
  const isZh = () => I18N.getLang() !== "en";
  function unitLabel(k) {
    const u = CATS[cat].units[k]; const suf = UNIT_SUFFIX[k] || "";
    if (!isZh()) return suf || u.e;
    return ((u.z + " " + suf) || "").trim();
  }
  function catLabel(k) { const c = CAT_LABEL[k]; return isZh() ? c.z : c.e; }


  let cat = "length";
  let fromU = null, toU = null;
  let _keyInstalled = false; // 键盘监听是否已安装（脚本加载时安装一次）

  function unitKeys() { return Object.keys(CATS[cat].units); }
  function toBaseTemp(u, v) { if (u === "C") return v; if (u === "F") return (v - 32) * 5 / 9; if (u === "K") return v - 273.15; }
  function fromBaseTemp(u, c) { if (u === "C") return c; if (u === "F") return c * 9 / 5 + 32; if (u === "K") return c + 273.15; }

  function convert(v) {
    const c = CATS[cat];
    if (c.special === "temp") { return fromBaseTemp(c.units[toU].v, toBaseTemp(c.units[fromU].v, v)); }
    return (v * c.units[fromU].v) / c.units[toU].v;
  }
  function fmt(n) {
    if (!isFinite(n)) return "—"; if (n === 0) return "0";
    const abs = Math.abs(n);
    if (abs !== 0 && (abs < 1e-6 || abs >= 1e15)) return n.toExponential(6);
    if (abs < 0.01) return n.toPrecision(6);
    return (Math.round(n * 1e8) / 1e8).toLocaleString(isZh() ? "zh-CN" : "en-US", { maximumFractionDigits: 8 });
  }
  function reCompute() {
    const vEl = document.getElementById("cvFromVal"); const out = document.getElementById("cvToVal"); const formula = document.getElementById("cvFormula");
    if (!vEl || !out) return;
    const raw = vEl.value.trim();
    if (raw === "") { out.value = ""; formula.textContent = ""; return; }
    const v = parseFloat(raw);
    if (isNaN(v)) { out.value = "—"; return; }
    out.value = fmt(convert(v));
    const c = CATS[cat];
    if (c.special === "temp") formula.textContent = I18N.t("convert.tempNote");
    else formula.textContent = `1 ${unitLabel(fromU)} = ${fmt(c.units[fromU].v / c.units[toU].v)} ${unitLabel(toU)}`;
  }
  function fillSelect(sel, keys, selected) { sel.innerHTML = keys.map((k) => `<option value="${U.esc(k)}" ${k === selected ? "selected" : ""}>${U.esc(unitLabel(k))}</option>`).join(""); }

  /* ============== Calculator ============== */
  // 状态机求值：从左到右扫描，遇到 % 时把"上一数字"与"当前数字"合成 n/100 注入回表达式
  // 例: "200+10%"   -> "200+200*(10/100)"
  //     "50%"       -> "(50/100)"        （没有运算符则视为整体百分比）
  //     "(1+2)×3"   -> "(1+2)*3"          （括号包裹左值，上一数字取括号结果）
  //     "8÷2"       -> "8/2"
  // 只支持 + - × ÷ . ( ) 与数字，安全通过白名单正则 + 状态机得到纯 JS 表达式再用 Function 评估
  function safeEval(expr) {
    if (!expr) throw new Error("bad");
    // 先剔除"显示用"的字符：千分位逗号 / 记录里的 "=" / 全角空格
    // 这些字符只存在于 calcFmt 回填的展示串里，若不清掉会导致「算完再按 ÷」直接报错
    expr = String(expr).replace(/[,，"'\s]/g, "").replace(/=$/, "");
    if (!expr) throw new Error("bad");
    // 末尾挂着运算符（用户还没输入右操作数就按了 =）→ 容忍，丢掉即可
    expr = expr.replace(/[+\-*/×÷−]+$/, "");
    if (!expr) throw new Error("bad");
    // 左括号多余 / 收尾未闭合 → 自动补齐，避免 "([...]" 这类半成品报错
    const opens = (expr.match(/\(/g) || []).length;
    const closes = (expr.match(/\)/g) || []).length;
    if (opens > closes) expr += ")".repeat(opens - closes);
    // 末尾又出现运算符（补齐括号后可能暴露）→ 再清一次
    expr = expr.replace(/[+\-*/×÷−]+$/, "");
    if (!/^[\d+\-*/().×÷−%\s]*$/.test(expr)) throw new Error("bad");
    // 标准化可视符号 → 标准 JS
    let s = expr.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/\s+/g, "");
    // 百分号语义（拼装为纯 JS 表达式，最后用 Function 求值）：
    //   - "n%" 出现在二元运算符右侧 -> 展开成 "leftValue op n/100"  (200+10% → 200+200*10/100 = 220; 200*10% → 200*10/100 = 20)
    //   - "n%" 出现在表达式开头 / 括号后 -> 直接 n/100  (50% → 50/100 = 0.5)
    let out = "", i = 0, lastNum = null, pendingOp = null;
    while (i < s.length) {
      const c = s[i];
      if ("+-*/".includes(c)) { pendingOp = c; out += c; i++; }
      else if (c === "(" || c === ")") { out += c; i++; }
      else if (/[\d.]/.test(c)) {
        let j = i; while (j < s.length && /[\d.]/.test(s[j])) j++;
        const numStr = s.slice(i, j);
        if (j < s.length && s[j] === "%") {
          if (pendingOp && lastNum !== null) {
            // out 末尾已是 pendingOp；只需追加 (lastNum)*n/100 (加减) 或 (n/100) (乘除)
            if (pendingOp === "+" || pendingOp === "-") {
              // 200+10% = 200+200*10/100 = 220
              out += `(${lastNum})*${numStr}/100`;
            } else {
              // * /: 200*10% = 200*(10/100) = 20
              out += `(${numStr}/100)`;
            }
          } else {
            out += `(${numStr}/100)`;
          }
          pendingOp = null;
          i = j + 1;
        } else {
          out += numStr; lastNum = parseFloat(numStr); pendingOp = null; i = j;
        }
      } else { throw new Error("bad"); }
    }
    if (!/^[\d+\-*/().]*$/.test(out)) throw new Error("bad");
    if (/[\+\-\*\/\.]$/.test(out)) throw new Error("bad");
    if (/\(\)/.test(out)) throw new Error("bad");
    // eslint-disable-next-line no-new-func
    const v = Function('"use strict"; return (' + out + ')')();
    if (!isFinite(v)) throw new Error("bad");
    return v;
  }
  function calcFmt(n) {
    if (!isFinite(n)) return "—";
    if (Math.abs(n) >= 1e15 || (n !== 0 && Math.abs(n) < 1e-9)) return n.toExponential(6);
    return (Math.round(n * 1e10) / 1e10).toLocaleString("zh-CN", { maximumFractionDigits: 10 });
  }
  const OPS = "+-*/×÷−";

  function calcPress(el, key) {
    const disp = document.getElementById("calcDisp"); const prev = document.getElementById("calcPrev");
    if (!disp) return;
    let cur = disp.value;

    if (key === "=") {
      if (!cur) return;
      try {
        const v = safeEval(cur);
        if (prev) prev.textContent = cur + " =";
        // 结果用纯数字回填（不加千分位），避免逗号污染后续输入。
        // 先做 1e-10 级归一化消除浮点尾巴（999999×999999 → 999998000000.9999），
        // 再用 toPrecision(15) 兜住大数精度，避免出现 ...000001 之类的偏差。
        let n = Math.round(v * 1e10) / 1e10;
        if (!Number.isInteger(n) && Math.abs(n) >= 1e9) n = +v.toPrecision(15);
        disp.value = String(n);
        disp.dataset.result = "1";     // 标记：下次输入数字应"开始新算式"
      } catch (e) { U.toast(I18N.t("calc.err")); }
      return;
    }
    if (key === "C") { disp.value = ""; disp.dataset.result = ""; if (prev) prev.textContent = ""; return; }
    if (key === "←") { disp.value = cur.slice(0, -1); disp.dataset.result = ""; return; }

    const last = cur.slice(-1);
    const isOp = (ch) => OPS.includes(ch);

    // ① 连按运算符 → 替换上一个运算符，而不是叠加成 "5+×"
    if (isOp(key)) {
      // "−" 的两种语义要分开：
      //   a) 负号前缀：空串开头 / 紧跟另一个运算符之后（如 "10+−5"）
      //   b) 减法运算符：已有完整操作数时（含"刚算完的结果"）→ 正常续算 "100−30"
      if (key === "−" && (!cur || isOp(last)) && disp.dataset.result !== "1") {
        disp.value = cur + key; disp.dataset.result = ""; return;
      }
      if (disp.dataset.result === "1") {       // 刚出结果：运算符一律当续算算符
        disp.value = cur + key; disp.dataset.result = ""; return;
      }
      if (cur && isOp(last)) { disp.value = cur.slice(0, -1) + key; disp.dataset.result = ""; return; }
      if (!cur) {
        // 空串：只有 "−" 有意义（作为负号起头），其它运算符无意义
        if (key === "−") { disp.value = "−"; disp.dataset.result = ""; }
        return;
      }
      disp.value = cur + key; disp.dataset.result = ""; return;
    }

    // ② 刚出结果后：
    //    - 按数字 → 清空重新开始（计算器通用行为）
    //    - 按小数点 → 从 "0." 开始
    if (disp.dataset.result === "1") {
      if (/[\d.]/.test(key)) { cur = key === "." ? "0." : ""; disp.value = cur + (key === "." ? "" : key); disp.dataset.result = ""; return; }
      disp.dataset.result = "";
    }

    // ③ 相邻小数点去重："1." 后再按 "." 忽略
    if (key === "." && /\.\d*$/.test(cur)) return;
    // ④ 数字前导零清理："0" 后按数字 → 替换
    if (/^0$/.test(cur) && /^\d$/.test(key)) { disp.value = key; return; }

    disp.value = cur + key;
  }

  /* ============== 渲染 ============== */
  function render() {
    const el = document.getElementById("view-convert");
    if (!el) return;
    const cats = Object.keys(CATS).map((k) =>
      `<button class="chip ${k === cat ? "active" : ""}" data-cat="${k}">${CATS[k].icon} ${U.esc(catLabel(k))}</button>`).join("");
    const keys = unitKeys();
    if (!fromU) fromU = keys[0];
    if (!toU || !keys.includes(toU)) toU = keys[1] || keys[0];

    // 计算器按键布局（5 行：控制行 / 数字行 ×4，末行 = 占满）
    const btns = [
      ["C", "C", "danger"], ["←", "⌫", "muted"], ["(", "(", "muted"], [")", ")", "muted"],
      ["7", "7"], ["8", "8"], ["9", "9"], ["÷", "÷", "op"],
      ["4", "4"], ["5", "5"], ["6", "6"], ["×", "×", "op"],
      ["1", "1"], ["2", "2"], ["3", "3"], ["−", "−", "op"],
      ["%", "%", "muted"], ["0", "0"], [".", "."], ["+", "+", "op"],
      ["=", "=", "eq"]
    ];
    const btnHtml = btns.map(([k, txt, kind]) => {
      const cls = "cw-key" + (kind ? " cw-" + kind : "") + (k === "=" ? " cw-span4" : "");
      return `<button class="${cls}" data-key="${U.esc(k)}">${U.esc(txt)}</button>`;
    }).join("");

    el.innerHTML = `
      <div class="ph">
        <span class="ph-ico">📐</span>
        <div class="ph-txt">
          <h1>${I18N.t("nav.convert")}</h1>
          <p>${I18N.t("convert.sub")}</p>
        </div>
      </div>
      <div class="calc-convert-grid">
          <div class="convert-pane">
            <div class="card">
              <div class="sec-title">${I18N.t("convert.panel.unit")}</div>
              <div class="chips" style="margin-bottom:18px">${cats}</div>
              <div class="cv-pair">
                <div class="cv-side">
                  <div class="cv-side-label">${I18N.t("convert.from")}</div>
                  <input type="number" id="cvFromVal" placeholder="0" value="1" step="any" class="cv-num">
                  <select id="cvFrom" class="cv-unit"></select>
                </div>
                <button class="cv-swap-btn sm" id="cvSwap" title="${I18N.t("convert.swap")}">⇅</button>
                <div class="cv-side">
                  <div class="cv-side-label">${I18N.t("convert.to")}</div>
                  <input type="text" id="cvToVal" readonly placeholder="—" class="cv-num out">
                  <select id="cvTo" class="cv-unit"></select>
                </div>
              </div>
              <div class="cv-formula" id="cvFormula"></div>
            </div>
          </div>
          <div class="calc-pane">
            <div class="card">
              <div class="sec-title">${I18N.t("convert.panel.calc")}</div>
              <div class="calc-widget">
                <div class="cw-screen">
                  <div class="cw-prev" id="calcPrev"></div>
                  <input class="cw-disp" id="calcDisp" type="text" inputmode="decimal" placeholder="0" readonly>
                </div>
                <div class="cw-keys">${btnHtml}</div>
                <button type="button" class="cw-copy" id="calcCopy" title="${I18N.t("calc.copy")}">
                  <span class="cw-copy-ico">⧉</span>
                  <span class="cw-copy-tx">${I18N.t("calc.copyShort")}</span>
                  <span class="cw-copy-arrow">→</span>
                  <span class="cw-copy-dst">${I18N.t("convert.panel.unit")}</span>
                </button>
                <div class="cw-hint">${I18N.t("calc.kbHint")}</div>
              </div>
            </div>
          </div>
        </div>
    `;

    /* —— 单位换算绑定 —— */
    const fSel = el.querySelector("#cvFrom"); const tSel = el.querySelector("#cvTo");
    fillSelect(fSel, keys, fromU); fillSelect(tSel, keys, toU);
    el.querySelectorAll("[data-cat]").forEach((b) => b.onclick = () => { cat = b.dataset.cat; fromU = null; toU = null; render(); });
    fSel.onchange = () => { fromU = fSel.value; reCompute(); };
    tSel.onchange = () => { toU = tSel.value; reCompute(); };
    el.querySelector("#cvFromVal").oninput = reCompute;
    el.querySelector("#cvSwap").onclick = () => {
      const a = fromU; fromU = toU; toU = a;
      fillSelect(fSel, keys, fromU); fillSelect(tSel, keys, toU); reCompute();
    };
    reCompute();

    /* —— 计算器绑定 —— */
    el.querySelectorAll(".cw-key").forEach((b) => b.onclick = () => calcPress(b, b.dataset.key));
    el.querySelector("#calcCopy").onclick = () => {
      const v = el.querySelector("#calcDisp").value;
      if (!v || v === "—") return;
      // 一键两功能：复制到剪贴板 + 自动流转到左侧单位换算输入框
      U.copy(v, I18N.t("calc.copied"));
      const from = el.querySelector("#cvFromVal");
      if (from) { from.value = v; reCompute(); }
      const btn = el.querySelector("#calcCopy");
      if (btn) {
        btn.classList.add("is-done");
        const tx = btn.querySelector(".cw-copy-tx");
        const old = tx ? tx.textContent : "";
        if (tx) tx.textContent = I18N.t("calc.copiedShort");
        setTimeout(() => { btn.classList.remove("is-done"); if (tx) tx.textContent = old; }, 1400);
      }
    };
    // 键盘监听已在 IIFE 加载时安装（installKeyHandler），此处无需重复安装
  }

  // 键盘输入支持：计算器每个按键都映射到键盘（在 IIFE 加载时安装，
  // 不依赖 boot() 是否运行，避免登录整页重载后句柄绑定到旧 document 而失效）。
  //  数字 0-9 / 运算符 + - * /(→÷) / 小数点 . / 百分比 % / 括号 ( )
  //  Enter 或 = 求值 / Backspace 退格 / Esc 或 c/C 清空
  //  仅当「计算器和单位换算」视图激活时响应；焦点在换算数值等其它输入框时交由其原生处理，
  //  但焦点在计算器显示屏本身（calcDisp）时仍由键盘驱动计算器。
  function installKeyHandler() {
    if (_keyInstalled) return;
    _keyInstalled = true;
    document.addEventListener("keydown", function (e) {
      const wrap = document.getElementById("view-convert");
      if (!wrap || !wrap.classList.contains("active")) return;
      const d = document.getElementById("calcDisp"); if (!d) return;
      const ae = document.activeElement;
      if (ae && ae !== d && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.tagName === "SELECT")) return;
      const k = e.key;
      let handled = false;
      if (/^[0-9]$/.test(k)) { calcPress(d, k); handled = true; }
      else if (k === "+" || k === "-" || k === "*" || k === "/") { calcPress(d, k === "*" ? "×" : k === "/" ? "÷" : k); handled = true; }
      else if (k === ".") { calcPress(d, "."); handled = true; }
      else if (k === "%") { calcPress(d, "%"); handled = true; }
      else if (k === "(" || k === ")") { calcPress(d, k); handled = true; }
      else if (k === "Enter" || k === "=") { calcPress(d, "="); handled = true; }
      else if (k === "Backspace") { calcPress(d, "←"); handled = true; }
      else if (k === "Escape" || k === "c" || k === "C") { calcPress(d, "C"); handled = true; }
      if (handled) e.preventDefault();
    });
  }

  async function init() { render(); }
  async function onShow() { render(); }
  // 脚本加载即安装键盘监听（仅一次），与 boot/render 调用解耦
  installKeyHandler();
  return { init, onShow };
})();
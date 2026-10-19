/* ===== i18n + shared utilities ===== */
window.I18N = (function () {
  let lang = localStorage.getItem("cb_lang") || "zh";
  if (lang !== "zh" && lang !== "en") lang = "zh";
  // 初次加载即写入 <html lang>，否则英文界面下文档语言仍标记为 zh（影响字体回退与无障碍）
  document.documentElement.lang = lang;

  const dict = {
    "app.title": { zh: "跨境百宝囊", en: "Cross-Border Toolkit" },
    "nav.rates": { zh: "汇率换算", en: "Exchange Rates" },
    "nav.clock": { zh: "世界时钟", en: "World Clock" },
    "nav.pricing": { zh: "定价计算器", en: "Pricing Calc" },
    "nav.crm": { zh: "定价与客户档案", en: "Pricing & CRM" },
    "nav.todo": { zh: "日程待办", en: "To-Do" },
    "nav.knowledge": { zh: "知识库", en: "Knowledge" },
    "nav.convert": { zh: "计算器和单位换算", en: "Calculator & Units" },
    "nav.datamgr": { zh: "数据管理", en: "Data Manager" },
    "nav.orderSaved": { zh: "导航顺序已保存", en: "Nav order saved" },
    "nav.dragHint": { zh: "拖动右侧条目可调整顺序", en: "Drag items to reorder" },

    "convert.sub": { zh: "长度、面积、体积、容积、质量、温度等国际单位换算，支持同制与跨制互转", en: "Convert length, area, volume, capacity, mass, temperature and more — within or across unit systems" },
    "convert.from": { zh: "输入数值", en: "Value" },
    "convert.to": { zh: "换算结果", en: "Result" },
    "convert.unit": { zh: "单位", en: "Unit" },
    "convert.swap": { zh: "交换", en: "Swap" },
    "convert.tempNote": { zh: "温度按偏移量换算（非等比）", en: "Temperature converts by offset, not by ratio" },
    "convert.panel.unit": { zh: "单位换算", en: "Unit Converter" },
    "convert.panel.calc": { zh: "计算器", en: "Calculator" },
    "calc.eq": { zh: "=", en: "=" },
    "calc.clear": { zh: "清空", en: "Clear" },
    "calc.back": { zh: "退格", en: "⌫" },
    "calc.copy": { zh: "复制结果并填入换算", en: "Copy & send to converter" },
    "calc.copyShort": { zh: "复制并填入", en: "Copy & fill" },
    "calc.copiedShort": { zh: "已复制 ✓", en: "Copied ✓" },
    "calc.copied": { zh: "已复制，并已填入左侧换算", en: "Copied & sent to converter" },
    "calc.err": { zh: "表达式错误", en: "Bad expression" },
    "calc.kbHint": { zh: "支持键盘直接输入：数字 · + − × ÷ · . · % · ( ) · Enter 求值 · Backspace 退格 · Esc 清空", en: "Keyboard ready: digits · + − × ÷ · . · % · ( ) · Enter = · Backspace · Esc to clear" },

    "net.checking": { zh: "网络检测中…", en: "Checking network…" },
    "net.online": { zh: "已联网 · 汇率实时", en: "Online · live rates" },
    "net.offline": { zh: "离线 · 使用缓存汇率", en: "Offline · cached rates" },

    // 侧栏底部署名区（注意：branding.name 与 app.title 同步修改）
    "branding.name": { zh: "跨境百宝囊", en: "Cross-Border Toolkit" },
    "branding.dev": { zh: "Developed by Yohan", en: "Developed by Yohan" },
    "branding.copyright": { zh: "© 2026 {name} · 保留所有权利", en: "© 2026 {name} · All rights reserved" },

    "common.add": { zh: "添加", en: "Add" },
    "common.remove": { zh: "移除", en: "Remove" },
    "common.save": { zh: "保存", en: "Save" },
    "common.cancel": { zh: "取消", en: "Cancel" },
    "common.confirm": { zh: "确认", en: "Confirm" },
    "common.edit": { zh: "编辑", en: "Edit" },
    "common.del": { zh: "删除", en: "Delete" },
    "common.saveFailed": { zh: "保存失败", en: "Save failed" },
    "common.delete": { zh: "删除", en: "Delete" },
    "common.clear": { zh: "一键清空", en: "Clear all" },
    "common.share": { zh: "共享", en: "Share" },
    "common.copy": { zh: "复制", en: "Copy" },
    "common.edit": { zh: "编辑", en: "Edit" },
    "common.close": { zh: "关闭", en: "Close" },
    "common.search": { zh: "搜索", en: "Search" },
    "common.name": { zh: "名称", en: "Name" },
    "common.note": { zh: "备注", en: "Note" },
    "common.platform": { zh: "平台", en: "Platform" },
    "common.confirmDel": { zh: "确定删除吗？", en: "Delete this item?" },
    "common.copied": { zh: "已复制", en: "Copied" },

    "rates.title": { zh: "实时汇率换算", en: "Live Exchange Rates" },
    "rates.sub": { zh: "美客多主站点及全球币种，数据来自 exchangerate-api", en: "Mercado Libre sites & global currencies, powered by exchangerate-api" },
    "rates.base": { zh: "基准金额", en: "Amount" },
    "rates.from": { zh: "从", en: "From" },
    "rates.to": { zh: "到", en: "To" },
    "rates.swap": { zh: "互换", en: "Swap" },
    "rates.result": { zh: "换算结果", en: "Result" },
    "rates.addCountry": { zh: "添加币种 / 国家", en: "Add currency / country" },
    "rates.searchPH": { zh: "搜索国家、币种或代码…", en: "Search country, currency or code…" },
    "rates.presetHint": { zh: "美客多主站点已默认展示，可搜索添加更多国家", en: "Mercado Libre sites shown by default; search to add more" },
    "rates.lastUpdate": { zh: "更新于", en: "Updated" },
    "rates.ratePer": { zh: "1 USD =", en: "1 USD =" },
    "rates.offlineNote": { zh: "当前离线，显示上次缓存的汇率", en: "Offline now, showing last cached rates" },
    "rates.notFound": { zh: "未找到匹配币种，可直接输入 ISO 代码（如 KES）", en: "No match; type an ISO code directly (e.g. KES)" },
    "rates.refresh": { zh: "刷新汇率", en: "Refresh" },
    "rates.refreshing": { zh: "正在刷新汇率…", en: "Refreshing rates…" },

    "clock.title": { zh: "世界各国时间", en: "World Clock" },
    "clock.sub": { zh: "主要跨境电商站点时区，双击卡片可模拟时间", en: "Key cross-border time zones — double-click a card to simulate" },
    "clock.addCity": { zh: "添加城市 / 时区", en: "Add city / timezone" },
    "clock.tzPH": { zh: "输入 IANA 时区，如 Asia/Dubai", en: "IANA timezone, e.g. Asia/Dubai" },
    "clock.day": { zh: "白天", en: "Day" },
    "clock.night": { zh: "夜间", en: "Night" },
    "clock.count": { zh: "{n} 个时区", en: "{n} zones" },
    "clock.popular": { zh: "常用城市", en: "Popular cities" },
    "clock.allAdded": { zh: "已添加全部常用城市", en: "All popular cities added" },
    "clock.emptyTitle": { zh: "还没有添加时区", en: "No time zones yet" },
    "clock.emptyHint": { zh: "从下方选择常用城市，或搜索任意城市", en: "Pick a popular city below, or search any city" },
    "clock.sameAsHome": { zh: "与北京同时", en: "Same as Beijing" },
    "clock.ahead": { zh: "比北京早 {n} 小时", en: "{n}h ahead of Beijing" },
    "clock.behind": { zh: "比北京晚 {n} 小时", en: "{n}h behind Beijing" },

    "pricing.title": { zh: "美客多定价计算器", en: "Mercado Libre Pricing Calculator" },
    "pricing.sub": { zh: "填写产品参数与期望净利润，反推含运费/佣金/各项成本的定价（USD 为主）", en: "Fill product params & target net profit to derive price incl. shipping, commission & costs (USD base)" },
    "pricing.inputs": { zh: "基础参数", en: "Inputs" },
    "pricing.category": { zh: "品类", en: "Category" },
    "pricing.commission": { zh: "平台佣金率 %", en: "Platform commission %" },
    "pricing.grossWeight": { zh: "产品毛重 (kg)", en: "Gross weight (kg)" },
    "pricing.dimensions": { zh: "长宽高 (cm)", en: "L × W × H (cm)" },
    "pricing.name": { zh: "名称", en: "Name" },
    "pricing.namePH": { zh: "产品名称", en: "Product name" },
    "pricing.platform": { zh: "平台", en: "Platform" },
    "pricing.platformPH": { zh: "如 美客多 / Amazon", en: "e.g. Mercado / Amazon" },
    "pricing.classification": { zh: "分类", en: "Classification" },
    "pricing.classPH": { zh: "如 电子产品 / 服饰", en: "e.g. Electronics / Fashion" },
    "pricing.volDivisor": { zh: "体积重除数", en: "Vol. weight divisor" },
    "pricing.listingTier": { zh: "商品定价档位", en: "Listing price tier" },
    "pricing.tierAbove": { zh: "≥ MXN 299（运费较高）", en: "≥ MXN 299 (higher ship)" },
    "pricing.tierBelow": { zh: "< MXN 299（运费较低）", en: "< MXN 299 (lower ship)" },
    "pricing.purchase": { zh: "采购价 (USD)", en: "Purchase price (USD)" },
    "pricing.purchaseShort": { zh: "采购价（手动填写）", en: "Purchase price (manual)" },
    "pricing.shipManual": { zh: "运费（手动覆盖）", en: "Shipping (override)" },
    "pricing.ship": { zh: "运费 (USD)", en: "Shipping (USD)" },
    "pricing.shipManualShort": { zh: "手动", en: "manual" },
    "pricing.shipTableShort": { zh: "按表", en: "table" },
    "pricing.grossRule": { zh: "规则：毛重 < 500g 时一律按毛重计费（不使用体积重）", en: "Rule: gross < 500g is always charged by gross weight (no volumetric)" },
    "pricing.grossRuleNote": { zh: "⚠ 毛重 < 500g，已强制按毛重计费（忽略体积重）", en: "⚠ Gross < 500g: charged by gross weight (vol. weight ignored)" },
    "pricing.netIncome": { zh: "期望净利润 (USD)", en: "Target net profit (USD)" },
    "pricing.netManual": { zh: "手动金额", en: "Fixed amount" },
    "pricing.netPercent": { zh: "售价百分比", en: "% of price" },
    "pricing.netValue": { zh: "期望净利润值 (USD)", en: "Target net profit (USD)" },
    "pricing.netPctHint": { zh: "按售价的预设百分比反推定价", en: "Derive price from a preset % of sale price" },
    "pricing.targetPriceLabel": { zh: "期望售价 (USD)", en: "Target sale price (USD)" },
    "pricing.targetModeHint": { zh: "期望净收入 与 期望售价 二选一：填其一则另一项自动清空且不参与计算；填期望售价时，售价即售价，净收入由售价自动反推。", en: "Target net profit and target sale price are mutually exclusive: filling one clears the other (and it won't be used in the calc). With a sale price, the price stays as entered and net profit is auto-derived." },
    "pricing.netFromPrice": { zh: "净收入（由售价反推）", en: "Net profit (from sale price)" },
    "pricing.costs": { zh: "成本与费用", en: "Costs & Fees" },
    "pricing.aftersale": { zh: "售后成本", en: "After-sales" },
    "pricing.ad": { zh: "广告成本", en: "Ad spend" },
    "pricing.fx": { zh: "汇损成本", en: "FX loss" },
    "pricing.custom": { zh: "自定义成本", en: "Custom cost" },
    "pricing.costName": { zh: "成本名称", en: "Cost name" },
    "pricing.mode": { zh: "计费方式", en: "Mode" },
    "pricing.customName": { zh: "成本名称", en: "Cost name" },
    "pricing.ratio": { zh: "比例 %", en: "Ratio %" },
    "pricing.manual": { zh: "手动金额", en: "Manual $" },
    "pricing.addCustom": { zh: "＋ 添加自定义成本", en: "＋ Add custom cost" },
    "pricing.modeRatio": { zh: "按比例", en: "by %" },
    "pricing.modeManual": { zh: "手动", en: "manual" },
    "pricing.result": { zh: "定价", en: "Pricing" },
    "pricing.resultSub": { zh: "含运费/佣金/各项成本的定价", en: "Price incl. shipping, commission & costs" },
    "pricing.suggestedPrice": { zh: "定价", en: "Price" },
    "pricing.breakdown": { zh: "成本构成", en: "Breakdown" },
    "pricing.shipping": { zh: "运费", en: "Shipping" },
    "pricing.commissionCost": { zh: "平台佣金", en: "Commission" },
    "pricing.net": { zh: "净收入", en: "Net profit" },
    "pricing.netGain": { zh: "净收益", en: "Net gain" },
    "pricing.netGainFormula": { zh: "净收益 = 净收入 + 采购价 + 额外添加的产品与费用", en: "Net gain = net profit + purchase + extra products & fees" },
    "pricing.volWeight": { zh: "体积重", en: "Vol. weight" },
    "pricing.billWeight": { zh: "计费重", en: "Billable weight" },
    "pricing.colProduct": { zh: "① 产品与参数", en: "① Product & Specs" },
    "pricing.colCost": { zh: "② 成本与费用", en: "② Costs & Fees" },
    "pricing.colResult": { zh: "③ 定价结果", en: "③ Pricing Result" },
    "pricing.volWeightHint": { zh: "体积重 = 长×宽×高(cm) ÷ 6000，计费重取毛重与体积重较大者", en: "Vol. weight = L×W×H(cm) ÷ 6000; billable = greater of gross & vol." },
    "pricing.chargeWeight": { zh: "计费重", en: "Chargeable weight" },
    "pricing.displayCur": { zh: "展示币种", en: "Display currencies" },
    "pricing.addCur": { zh: "＋ 添加展示币种", en: "＋ Add currency" },
    "pricing.volNote": { zh: "体积重 = 长×宽×高(cm) ÷ 除数；计费重取毛重与体积重之大者", en: "Vol. weight = L×W×H(cm) ÷ divisor; billable = max(gross, vol)" },
    "pricing.shipNote": { zh: "运费为手动填写的固定成本", en: "Shipping is a manually entered fixed cost" },
    "pricing.useNet": { zh: "按净收入反推定价", en: "Derive price from net profit" },
    "pricing.saveToKB": { zh: "保存记录", en: "Save record" },
    "pricing.updateKB": { zh: "更新记录", en: "Update record" },
    "pricing.editCanceled": { zh: "已取消编辑", en: "Editing canceled" },
    "pricing.savingKB": { zh: "正在保存…", en: "Saving…" },
    "pricing.savedKB": { zh: "已保存到「定价与客户档案」", en: "Saved to Pricing & Contacts" },
    "pricing.updatedKB": { zh: "已更新该定价记录", en: "Pricing record updated" },
    "pricing.editingHint": { zh: "正在编辑已有记录，保存后将覆盖原记录", en: "Editing an existing record; saving will overwrite it" },
    "pricing.editingBadge": { zh: "编辑中", en: "Editing" },
    "pricing.invalid": { zh: "请先得到有效定价", en: "Calculate a valid price first" },

    "crm.title": { zh: "定价与客户档案", en: "Pricing & Contacts" },
    "crm.sub": { zh: "产品定价记录与客户档案，集中存档、一键复制", en: "Product pricing records & contacts — saved in one place, one-click copy" },
    "crm.tabPricing": { zh: "定价记录", en: "Pricing Records" },
    "crm.tabContacts": { zh: "客户档案", en: "Contacts" },
    "crm.prEmpty": { zh: "还没有定价记录，去「定价计算器」算一条保存吧", en: "No pricing records yet — save one from the pricing calculator" },
    "crm.colName": { zh: "名称", en: "Name" },
    "crm.colPlatform": { zh: "平台", en: "Platform" },
    "crm.colClass": { zh: "分类", en: "Category" },
    "crm.colPrice": { zh: "定价 (USD)", en: "Price (USD)" },
    "crm.colNet": { zh: "净利润", en: "Net Profit" },
    "crm.colGain": { zh: "净收益", en: "Net Gain" },
    "crm.colTime": { zh: "保存时间", en: "Saved" },
    "crm.prSummary": { zh: "摘要", en: "Summary" },
    "crm.prExpand": { zh: "展开明细", en: "Show details" },
    "crm.prCollapse": { zh: "收起", en: "Collapse" },
    "crm.secProduct": { zh: "产品信息", en: "Product" },
    "crm.secCosts": { zh: "成本与费用", en: "Costs & Fees" },
    "crm.secPricing": { zh: "定价结果", en: "Pricing Result" },
    "crm.fDims": { zh: "尺寸 (L×W×H cm)", en: "Dimensions (L×W×H cm)" },
    "crm.fGrossWeight": { zh: "毛重 (kg)", en: "Gross weight (kg)" },
    "crm.fVolWeight": { zh: "体积重 (kg)", en: "Volumetric weight (kg)" },
    "crm.fChargeWeight": { zh: "计费重 (kg)", en: "Chargeable weight (kg)" },
    "crm.fCommission": { zh: "平台佣金率", en: "Commission rate" },
    "crm.fCommissionAmt": { zh: "平台佣金", en: "Commission" },
    "crm.fPurchase": { zh: "采购价", en: "Purchase price" },
    "crm.fShip": { zh: "运费", en: "Shipping" },
    "crm.fExtra": { zh: "其他费用合计", en: "Other fees total" },
    "crm.fNetTarget": { zh: "期望净利润", en: "Target net profit" },
    "crm.fNetPct": { zh: "期望净利润率", en: "Target net margin" },
    "crm.fPrice": { zh: "定价", en: "Price" },
    "crm.fNetProfit": { zh: "净利润", en: "Net profit" },
    "crm.fNetGain": { zh: "净收益", en: "Net gain" },
    "crm.fRatio": { zh: "占比", en: "Share" },
    "crm.fCurrencies": { zh: "多币种定价", en: "Multi-currency price" },
    "crm.copyAll": { zh: "复制完整信息", en: "Copy full details" },
    "crm.editRec": { zh: "编辑该定价记录", en: "Edit this pricing record" },
    "crm.edited": { zh: "已编辑", en: "edited" },
    "crm.add": { zh: "新增档案", en: "New contact" },
    "crm.empty": { zh: "还没有档案，点击「新增档案」开始", en: "No contacts yet. Click 'New contact'." },
    "crm.emptyHint": { zh: "记录供应商、客户与平台联系人，一键复制发给同事", en: "Keep suppliers, customers and platform contacts — copy in one click" },
    "crm.noMatch": { zh: "没有匹配的档案", en: "No matching contacts" },
    "crm.statTotal": { zh: "档案总数", en: "Total" },
    "crm.statTags": { zh: "标签数", en: "Tags" },
    "crm.name": { zh: "名称", en: "Name" },
    "crm.namePH": { zh: "如：张先生 / 阿里巴巴", en: "e.g. John Smith / Alibaba" },
    "crm.type": { zh: "类型", en: "Type" },
    "crm.typeSupplier": { zh: "供应商", en: "Supplier" },
    "crm.typeCustomer": { zh: "客户", en: "Customer" },
    "crm.typeOther": { zh: "其他", en: "Other" },
    "crm.addField": { zh: "＋ 添加字段", en: "＋ Add field" },
    "crm.fieldName": { zh: "字段名", en: "Field name" },
    "crm.fieldValue": { zh: "字段值", en: "Field value" },
    "crm.copyCard": { zh: "复制全部", en: "Copy all" },
    "crm.search": { zh: "搜索名称 / 类型", en: "Search name / type" },
    "crm.role": { zh: "角色 / 公司", en: "Role / Company" },
    "crm.rolePH": { zh: "公司 / 职位", en: "Company / Position" },
    "crm.color": { zh: "头像颜色", en: "Avatar color" },
    "crm.fields": { zh: "自定义字段", en: "Custom fields" },
    "crm.noFields": { zh: "还没有字段，点右上角「＋ 添加字段」", en: "No fields yet — click “＋ Add field” above" },
    "crm.noTags": { zh: "还没有标签，在下方输入后回车", en: "No tags yet — type below and press Enter" },

    "todo.title": { zh: "日程待办", en: "To-Do & Schedule" },
    "todo.sub": { zh: "按平台 / 自定义标签管理任务", en: "Organize tasks by platform & custom tags" },
    "todo.add": { zh: "新增待办", en: "New task" },
    "todo.empty": { zh: "暂无待办，享受一杯咖啡 ☕", en: "Nothing to do. Grab a coffee ☕" },
    "todo.titlePH": { zh: "待办内容", en: "What to do" },
    "todo.note": { zh: "详细说明", en: "Details" },
    "todo.due": { zh: "截止日期", en: "Due date" },
    "todo.duePH": { zh: "选择日期", en: "Pick a date" },
    "todo.pickDate": { zh: "打开日期选择器", en: "Open date picker" },
    "todo.tag": { zh: "标签", en: "Tags" },
    "todo.all": { zh: "全部", en: "All" },
    "todo.filter": { zh: "按平台 / 标签筛选", en: "Filter by platform / tag" },
    "todo.addTag": { zh: "＋ 标签管理", en: "＋ Manage tags" },
    "todo.tagName": { zh: "标签名", en: "Tag name" },
    "todo.tagIcon": { zh: "图标", en: "Icon" },
    "todo.noTags": { zh: "还没有标签，在下方输入名称后回车", en: "No tags yet — type a name below and press Enter" },
    "todo.tagColor": { zh: "颜色", en: "Color" },
    "todo.tagIcon": { zh: "图标 (emoji)", en: "Icon (emoji)" },
    "todo.managedTags": { zh: "标签管理", en: "Tag manager" },
    "todo.filterAll": { zh: "全部", en: "All" },
    "todo.progress": { zh: "进度", en: "Progress" },
    "todo.pending": { zh: "进行中", en: "Pending" },
    "todo.completed": { zh: "已完成", en: "Done" },
    "todo.total": { zh: "全部任务", en: "Total" },
    "todo.overdue": { zh: "已逾期", en: "Overdue" },
    "todo.emptyHint": { zh: "点击右上角「新增待办」开始记录", en: "Click 'New task' to get started" },
    "todo.priority": { zh: "优先级", en: "Priority" },
    "todo.prioUrgent": { zh: "紧急", en: "Urgent" },
    "todo.prioHigh": { zh: "优先", en: "High" },
    "todo.prioNormal": { zh: "平缓", en: "Normal" },
    "todo.prioNone": { zh: "不急", en: "Low" },
    "todo.prioSet": { zh: "设定优先级", en: "Set priority" },
    "todo.prioChanged": { zh: "已设为「{name}」", en: "Set to \u201c{name}\u201d" },

    "kb.title": { zh: "知识库", en: "Knowledge Base" },
    "kb.sub": { zh: "收藏链接、备注与平台标签，点击直达", en: "Save links, notes & platform tags, click to open" },
    "kb.add": { zh: "新增条目", en: "New entry" },
    "kb.empty": { zh: "知识库空空如也，添加第一条吧", en: "Knowledge base is empty. Add one." },
    "kb.emptyHint": { zh: "点击右上角「新增条目」收藏你的第一个链接或文案", en: "Click 'New entry' to save your first link or copy" },
    "kb.allTags": { zh: "全部", en: "All" },
    "kb.tagScope": { zh: "本库独立标签", en: "Tags for this library only" },
    "kb.tagScopeHint": { zh: "三个知识库（私有 / 官方 / 文案模板）的标签互相独立，在此新增标签不会影响其它知识库", en: "The three libraries (Private / Official / Templates) keep separate tags — adding here won't affect the others" },
    "kb.tagExists": { zh: "标签「{name}」已存在", en: "Tag \"{name}\" already exists" },
    "kb.kbTitle": { zh: "标题", en: "Title" },
    "kb.link": { zh: "链接 URL", en: "Link URL" },
    "kb.chinese": { zh: "中文原文", en: "Chinese Original" },
    "kb.translateLang": { zh: "翻译语言", en: "Translations" },
    "kb.langTag": { zh: "语言标签", en: "Language" },
    "kb.langText": { zh: "翻译内容", en: "Translation" },
    "kb.addTrans": { zh: "＋ 添加翻译", en: "＋ Add translation" },
    "kb.open": { zh: "打开链接", en: "Open" },
    "kb.search": { zh: "搜索标题 / 备注", en: "Search title / note" },
    "kb.invalidUrl": { zh: "请输入有效链接", en: "Enter a valid URL" },
    "kb.missingChinese": { zh: "请输入中文原文", en: "Enter the Chinese original" },
    "kb.copyChinese": { zh: "复制中文原文", en: "Copy Chinese" },
    "kb.copyTrans": { zh: "复制翻译", en: "Copy translation" },
    "kb.copyAll": { zh: "复制全部", en: "Copy all" },

    "pricing.gallery.title": { zh: "定价计算器", en: "Pricing Calculators" },
    "pricing.gallery.sub": { zh: "按平台选择计算器，持续扩充中；点击卡片进入", en: "Pick a calculator by platform; more coming. Click a card to open" },
    "pricing.gallery.count": { zh: "共 {n} 个计算器", en: "{n} calculators" },
    "pricing.gallery.grid": { zh: "方块", en: "Grid" },
    "pricing.gallery.list": { zh: "列表", en: "List" },
    "pricing.gallery.open": { zh: "打开", en: "Open" },
    "pricing.gallery.soon": { zh: "敬请期待", en: "Soon" },
    "pricing.back": { zh: "← 返回计算器列表", en: "← Back to calculators" },
    "pricing.gallery.mercado": { zh: "美客多定价计算器", en: "Mercado Libre Calculator" },
    "pricing.gallery.mercadoDesc": { zh: "填写产品参数与期望净利润，反推含运费/佣金/各项成本的定价，可存档至定价与客户档案", en: "Inputs + target net profit → price incl. shipping, commission & costs; save to Pricing & Contacts" },
    "pricing.gallery.amazon": { zh: "亚马逊定价计算器", en: "Amazon Calculator" },
    "pricing.gallery.amazonDesc": { zh: "FBA / 自发货运费与佣金测算（规划中）", en: "FBA / MFN shipping & referral fees (planned)" },
    "pricing.gallery.shopee": { zh: "虾皮定价计算器", en: "Shopee Calculator" },
    "pricing.gallery.shopeeDesc": { zh: "东南亚站点佣金与运费测算（规划中）", en: "SEA commission & shipping (planned)" },
    "pricing.gallery.aliexpress": { zh: "速卖通定价计算器", en: "AliExpress Calculator" },
    "pricing.gallery.aliexpressDesc": { zh: "跨境运费与佣金测算（规划中）", en: "Cross-border fees (planned)" },
    "pricing.gallery.temu": { zh: "Temu 定价计算器", en: "Temu Calculator" },
    "pricing.gallery.temuDesc": { zh: "全托管 / 半托管核价（规划中）", en: "Full / semi-managed pricing (planned)" },

    "nav.editor": { zh: "图片编辑", en: "Image Editor" },
    "editor.title": { zh: "图片编辑", en: "Image Editor" },
    "editor.sub": { zh: "批量上传图片到图片库，分配到压缩 / 水印 / 裁切三个独立工作区，逐张编辑后可在工作区间自由流转", en: "Batch upload to the library, assign into Compress / Watermark / Crop workspaces, edit per image, then flow freely between zones" },
    "editor.drop": { zh: "拖拽图片到此处，或点击选择文件（可多选）", en: "Drop images here, or click to choose files (multiple)" },
    "editor.pick": { zh: "选择文件", en: "Pick files" },
    "editor.url": { zh: "URL 导入", en: "Import URL" },
    "editor.import": { zh: "导入", en: "Import" },
    "editor.noImage": { zh: "请先导入一张图片", en: "Import an image first" },
    "editor.pickFirst": { zh: "请先在上方导入一张图片", en: "Import an image above first" },
    "editor.downloadCurrent": { zh: "下载当前图", en: "Download current" },
    "editor.resetOrig": { zh: "还原原图", en: "Reset to original" },
    "editor.done": { zh: "已应用", en: "Applied" },
    "editor.flow": { zh: "提示：图片库是唯一图源；在图片库选中图片「送往」任意工作区，进入工作区后逐张编辑，编辑后的图片可「流转」到另外两个工作区。", en: "Tip: the library is the single source. Select images and 'Send to' any workspace, edit per image inside, then 'Flow to' the other two zones." },
    "editor.tabCompress": { zh: "压缩", en: "Compress" },
    "editor.tabWatermark": { zh: "水印", en: "Watermark" },
    "editor.tabCrop": { zh: "裁切", en: "Crop" },
    "editor.applyCompress": { zh: "应用压缩", en: "Apply compress" },
    "editor.applyWatermark": { zh: "应用水印", en: "Apply watermark" },
    "editor.applyCrop": { zh: "应用裁切", en: "Apply crop" },
    "editor.preview": { zh: "预览", en: "Preview" },
    "editor.compressHint": { zh: "压缩按所选格式与质量重新编码；JPG 自动填白底。选中一张图片后应用，结果原地更新该图。", en: "Compress re-encodes at chosen format/quality; JPG fills white background. Select one image, apply, and it updates in place." },
    "editor.library": { zh: "图片库", en: "Image Library" },
    "editor.upload": { zh: "上传图片", en: "Upload" },
    "editor.sendTo": { zh: "送往", en: "Send to" },
    "editor.flowTo": { zh: "流转到", en: "Flow to" },
    "editor.importFail": { zh: "导入失败", en: "Import failed" },
    "editor.selected": { zh: "已选 {n} 张", en: "{n} selected" },
    "editor.selectAll": { zh: "全选", en: "Select all" },
    "editor.clearSel": { zh: "取消选择", en: "Clear" },
    "editor.rename": { zh: "重命名", en: "Rename" },
    "editor.delSel": { zh: "删除选中", en: "Delete selected" },
    "editor.clearLib": { zh: "清空图片库", en: "Clear library" },
    "editor.emptyLib": { zh: "图片库为空，先上传图片", en: "Library is empty — upload images first" },
    "editor.zoneEmpty": { zh: "该工作区还没有图片。在上方图片库选中图片后点「送往」，即可把图片复制进来。", en: "This workspace is empty. Select images in the library above and click 'Send to' to copy them in." },
    "editor.pickToEdit": { zh: "选中一张图片进行编辑", en: "Select an image to edit" },
    "editor.zoneEmptyPick": { zh: "「{zone}」工作区还没有图片：先在图片库选中，再点「送往{zone}」", en: "The '{zone}' workspace is empty: select images in the library, then click 'Send to {zone}'" },
    "editor.downloadSel": { zh: "下载选中", en: "Download selected" },
    "editor.workspace": { zh: "工作区", en: "Workspace" },
    "editor.dragSort": { zh: "拖动缩略图可排序", en: "Drag thumbnails to reorder" },
    "editor.libCount": { zh: "{n} 张图片", en: "{n} images" },
    "editor.applyFail": { zh: "处理失败，请重试或更换格式", en: "Processing failed — retry or switch format" },
    "editor.sizeClamped": { zh: "尺寸超出上限，已按 {w}×{h}px 输出", en: "Size over limit — output clamped to {w}×{h}px" },
    "editor.resetOrigHint": { zh: "把当前编辑图还原为最初导入的原图（丢弃全部编辑）", en: "Restore the current image to its original import (discards all edits)" },
    "editor.noOrigin": { zh: "该图没有可用的原图快照", en: "No original snapshot available" },
    "editor.alreadyOrig": { zh: "当前已是原图，无需还原", en: "Already at original — nothing to restore" },
    "editor.restored": { zh: "已还原为原图", en: "Restored to original" },

    // ---- 选中 / 编辑目标 / 批量 ----
    "editor.check": { zh: "勾选此图", en: "Check this image" },
    "editor.uncheck": { zh: "取消勾选", en: "Uncheck" },
    "editor.openEdit": { zh: "打开这张图的编辑面板", en: "Open this image in the editor" },
    "editor.target": { zh: "编辑中", en: "Editing" },
    "editor.targetHint": { zh: "当前正在编辑的图片；勾选多张后批量操作会应用到全部勾选图", en: "The image currently open in the editor. When several are checked, batch actions apply to all checked images." },
    "editor.badgeEdited": { zh: "已编辑", en: "Edited" },
    "editor.applyToN": { zh: "应用到 {n} 张", en: "apply to {n}" },
    "editor.processing": { zh: "正在处理…", en: "Processing…" },
    "editor.processingCompress": { zh: "正在压缩…", en: "Compressing…" },
    "editor.processingWatermark": { zh: "正在添加水印…", en: "Applying watermark…" },
    "editor.processingCrop": { zh: "正在裁切…", en: "Cropping…" },
    "editor.batchDone": { zh: "已处理 {ok}/{total} 张", en: "Processed {ok}/{total}" },
    "editor.batchPartial": { zh: "已处理 {ok}/{total} 张，{fail} 张失败", en: "Processed {ok}/{total} — {fail} failed" },
    "editor.restoredN": { zh: "已还原 {n} 张为原图", en: "Restored {n} image(s) to original" },
    "editor.selHint": { zh: "点左上角方框勾选（可多选）；点图片本身打开编辑面板", en: "Click the box at top-left to check (multi-select); click the image to open it in the editor" },

    "watermark.text": { zh: "文字水印", en: "Text watermark" },
    "watermark.textContent": { zh: "水印文字", en: "Watermark text" },
    "watermark.textPH": { zh: "如：品牌名 / 版权声明", en: "e.g. brand / copyright" },
    "watermark.mode": { zh: "模式", en: "Mode" },
    "watermark.tile": { zh: "平铺", en: "Tile" },
    "watermark.single": { zh: "单行", en: "Single" },
    "watermark.pos": { zh: "位置", en: "Position" },
    "watermark.opacity": { zh: "不透明度", en: "Opacity" },
    "watermark.sizeRatio": { zh: "字号比例", en: "Font size" },
    "watermark.angle": { zh: "倾斜角度", en: "Angle" },
    "watermark.color": { zh: "颜色", en: "Color" },
    "watermark.bold": { zh: "加粗", en: "Bold" },
    "watermark.logo": { zh: "角标图片", en: "Logo badge" },
    "watermark.uploadLogo": { zh: "上传角标", en: "Upload logo" },
    "watermark.changeLogo": { zh: "更换角标", en: "Change logo" },
    "watermark.logoPos": { zh: "角标位置", en: "Logo position" },
    "watermark.logoScale": { zh: "角标大小", en: "Logo size" },

    "crop.preset": { zh: "证件照尺寸", en: "ID photo size" },
    "crop.width": { zh: "宽（像素）", en: "Width (px)" },
    "crop.height": { zh: "高（像素）", en: "Height (px)" },
    "crop.mode": { zh: "布局方式", en: "Layout" },
    "crop.cover": { zh: "裁剪填满", en: "Crop to fill" },
    "crop.contain": { zh: "留白填充", en: "Contain + fill" },
    "crop.bg": { zh: "背景色", en: "Background" },
    "crop.white": { zh: "白", en: "White" },
    "crop.blue": { zh: "蓝", en: "Blue" },
    "crop.red": { zh: "红", en: "Red" },
    "crop.zoom": { zh: "缩放", en: "Zoom" },
    "crop.dragHint": { zh: "在预览图上拖动可调整人物位置；缩放滑块控制放大倍数。", en: "Drag on preview to reposition; zoom slider to scale." },
    "crop.needSize": { zh: "请填写有效的宽高（≥1 像素）", en: "Enter a valid width/height (≥1 px)" },
    "crop.outSize": { zh: "输出尺寸", en: "Output" },
    "crop.srcSize": { zh: "原图", en: "Source" },
    "crop.offset": { zh: "偏移", en: "Offset" },
    "crop.recenter": { zh: "居中", en: "Center" },
    "crop.reset": { zh: "重置视图", en: "Reset view" },
    "crop.resetDone": { zh: "已重置裁切视图", en: "Crop view reset" },

    "compress.format": { zh: "输出格式", en: "Output format" },
    "compress.quality": { zh: "压缩质量", en: "Quality" },
    "compress.fmtChanged": { zh: "输出格式已切换为 {fmt}，裁切/水印也会跟随", en: "Output format switched to {fmt}; crop & watermark follow" },



    "nav.translate": { zh: "翻译", en: "Translate" },
    "translate.title": { zh: "翻译", en: "Translate" },
    "translate.sub": { zh: "中文（或任一源语言）一键翻译多种语言，逐条复制，一键收藏到文案模板库", en: "Translate from Chinese (or any source) into many languages at once; copy each, or save to template library" },
    "tr.source": { zh: "源语言", en: "Source" },
    "tr.input": { zh: "原文", en: "Source text" },
    "tr.inputPH": { zh: "输入要翻译的内容…", en: "Type text to translate…" },
    "tr.targets": { zh: "目标语言（可添加多个，一次性翻译）", en: "Target languages (add many, translate once)" },
    "tr.addLang": { zh: "添加语言", en: "Add language" },
    "tr.go": { zh: "翻译", en: "Translate" },
    "tr.copy": { zh: "复制", en: "Copy" },
    "tr.collect": { zh: "收藏", en: "Save" },
    "tr.collectAll": { zh: "收藏全部", en: "Save all" },
    "tr.collectAllHint": { zh: "收藏全部已翻译语言 + 原文到文案模板库", en: "Save every translated language plus the source to the template library" },
    "tr.translating": { zh: "翻译中", en: "Translating" },
    "tr.swap": { zh: "互换源语言与首个目标语言", en: "Swap source with first target" },
    "tr.empty": { zh: "请先输入原文", en: "Enter source text first" },
    "tr.noTarget": { zh: "请至少添加一个目标语言", en: "Add at least one target language" },
    "tr.noTransYet": { zh: "请先翻译再收藏", en: "Translate before saving" },
    "tr.llmFail": { zh: "API 翻译失败", en: "API translation failed" },
    "tr.errFree": { zh: "免费引擎翻译失败", en: "Free engine translation failed" },
    "tr.errNoKey": { zh: "未配置 API Key", en: "No API key configured" },
    "tr.errApi": { zh: "API 错误", en: "API error" },
    "tr.errEmpty": { zh: "API 返回为空", en: "API returned an empty response" },
    "tr.errBadJson": { zh: "API 返回格式异常", en: "API returned malformed data" },
    "tr.kbUnavailable": { zh: "文案模板库不可用", en: "Copy template library unavailable" },
    "tr.settings": { zh: "高级设置", en: "Settings" },
    "tr.engine": { zh: "翻译引擎", en: "Engine" },
    "tr.engineFree": { zh: "免费引擎（MyMemory，无需密钥）", en: "Free engine (MyMemory, no key)" },
    "tr.engineLLM": { zh: "API 引擎（OpenAI 兼容，质量更高）", en: "API engine (OpenAI-compatible, higher quality)" },
    "tr.model": { zh: "模型", en: "Model" },
    "tr.engineLLMHint": { zh: "支持 DeepSeek / OpenAI 等 OpenAI 兼容接口；Key 仅保存在本机浏览器", en: "DeepSeek / OpenAI compatible endpoints; key stored only in this browser" },
    "tr.chars": { zh: "字符", en: "chars" },
    "tr.settingsSaved": { zh: "设置已保存", en: "Settings saved" },

    "clock.searchCities": { zh: "搜索城市（联网 + 离线），如 东京 / Tokyo / Dubai", en: "Search a city (online + offline), e.g. Tokyo / Dubai / London" },
    "clock.addByCity": { zh: "添加", en: "Add" },
    "clock.tzSuggestions": { zh: "匹配结果", en: "Matches" },
    "clock.onlineSearch": { zh: "联网检索中…", en: "Searching online…" },
    "clock.zoneAlready": { zh: "该时区已在列表中", en: "Already in list" },
    "clock.invalidZone": { zh: "时区格式无效，示例：Asia/Dubai", en: "Invalid timezone, e.g. Asia/Dubai" },
    "clock.noMatch": { zh: "无匹配，可直接输入 IANA 时区（如 Asia/Dubai）", en: "No match; type an IANA zone directly (e.g. Asia/Dubai)" },
    // ===== 12/24 小时制切换 =====
    "clock.h12": { zh: "12 小时制", en: "12-hour" },
    "clock.h24": { zh: "24 小时制", en: "24-hour" },
    "clock.fmtTip": { zh: "点击切换 12 / 24 小时制", en: "Click to switch 12 / 24-hour format" },
    // ===== 拖动排序 / 置顶 =====
    "clock.pin": { zh: "置顶此卡片", en: "Pin this card" },
    "clock.unpin": { zh: "取消置顶", en: "Unpin" },
    "clock.dragHint": { zh: "提示：双击卡片可进入时间模拟模式；卡片右下角图钉按钮可置顶", en: "Tip: double-click a card to enter time simulation; use the pin button at the card's bottom-right to pin it" },
    // ===== 时间模拟模式 =====
    "clock.simTitle": { zh: "以「{city}」为基准调整时间", en: "Adjusting time based on “{city}”" },
    "clock.simHint": { zh: "拖动下方滑块，所有卡片会联动显示对应时刻", en: "Drag the slider; all cards follow this moment" },
    "clock.simTag": { zh: "基准", en: "base" },
    "clock.simExit": { zh: "退出模拟", en: "Exit" },
    "clock.step1": { zh: "1 分钟", en: "1 min" },
    "clock.step15": { zh: "15 分钟", en: "15 min" },
    "clock.step60": { zh: "1 小时", en: "1 hour" },
    "clock.daySuffix": { zh: "天", en: "d" },

    "crm.typePlatform": { zh: "网络平台", en: "Online Platform" },

    "auth.login": { zh: "登录", en: "Sign in" },
    "auth.signup": { zh: "注册", en: "Sign up" },
    "auth.email": { zh: "邮箱", en: "Email" },
    "auth.name": { zh: "昵称", en: "Display name" },
    "auth.password": { zh: "密码", en: "Password" },
    "auth.langBtn": { zh: "中 / EN", en: "EN / 中" },
    "auth.themeBtn": { zh: "切换外观（经典 / 夜间 / Lumen）", en: "Switch appearance (Classic / Dark / Lumen)" },
    "auth.loginBtn": { zh: "登录", en: "Sign in" },
    "auth.signupBtn": { zh: "注册", en: "Create account" },
    "auth.fillRequired": { zh: "请填写邮箱和密码", en: "Email and password required" },
    "auth.pwShort": { zh: "密码至少 6 位", en: "Password needs 6+ chars" },
    "auth.confirmEmail": { zh: "请查收邮件完成验证", en: "Check your email to confirm" },
    "auth.logout": { zh: "退出", en: "Logout" },
    "auth.loggedOut": { zh: "已退出登录", en: "Signed out" },
    "auth.guest": { zh: "离线访客", en: "Offline Guest" },
    "auth.offlineHint": { zh: "后端暂不可用，已进入离线访客模式（本机数据保存）", en: "Backend unavailable — entered offline guest mode (local data only)" },
    "auth.offlineEnter": { zh: "已进入离线访客模式", en: "Entered offline guest mode" },
    "auth.cloudTab": { zh: "云端登录", en: "Cloud Login" },
    "auth.localTab": { zh: "本地登录", en: "Local Login" },
    "auth.cloudTip": { zh: "使用云端账号，数据同步到 Supabase", en: "Sign in with your cloud account, synced to Supabase" },
    "auth.localTip": { zh: "无需账号，数据保存在本机浏览器", en: "No account needed, data stored in this browser" },
    "auth.localHint": { zh: "数据保存在本机浏览器，无需账号密码，离线可用。", en: "Data is stored in this browser — no account, works offline." },
    "auth.localEnter": { zh: "进入本地模式", en: "Enter Local Mode" },
    "auth.localEntered": { zh: "已进入本地模式", en: "Entered local mode" },
    "auth.localUser": { zh: "本地用户", en: "Local User" },
    "auth.cloudUnreachable": { zh: "云端不可达，请改用本地登录", en: "Cloud unreachable — use Local Login instead" },
    "auth.connecting": { zh: "正在连接云端，请稍候…", en: "Connecting to cloud, one moment…" },

    "migrate.done": { zh: "已从云端同步：{t} 条日程、{k} 条知识库、{c} 条客户档案到本地", en: "Synced from cloud: {t} todos, {k} knowledge, {c} contacts" },
    "migrate.title": { zh: "云端数据迁移", en: "Cloud Migration" },
    "migrate.syncNow": { zh: "从云端同步到现在", en: "Sync from cloud" },
    "migrate.synced": { zh: "已从云端同步", en: "Synced from cloud" },
    "migrate.never": { zh: "尚未从云端迁移", en: "Not migrated yet" },

    "role.admin": { zh: "主管理", en: "Admin" },
    "role.adminUser": { zh: "内容管理", en: "Content Editor" },
    "role.user": { zh: "用户", en: "User" },

    "settings.title": { zh: "用户设置", en: "Settings" },
    "settings.profile": { zh: "资料", en: "Profile" },
    "settings.displayName": { zh: "用户名", en: "Display name" },
    "settings.role": { zh: "角色", en: "Role" },
    "settings.share": { zh: "共享", en: "Sharing" },
    "settings.saved": { zh: "已保存", en: "Saved" },
    "settings.account": { zh: "账号信息", en: "Account" },
    "settings.identity": { zh: "身份权限", en: "Permissions" },
    "settings.localNote": { zh: "本地模式：数据保存在本机浏览器，无云端账号与协作功能。", en: "Local mode: data lives in this browser; no cloud account or collaboration." },
    "settings.saveName": { zh: "保存用户名", en: "Save display name" },
    "settings.close": { zh: "关闭设置", en: "Close settings" },

    // 界面皮肤（Skin）
    "skin.title": { zh: "外观皮肤", en: "Appearance" },
    "skin.desc": { zh: "经典为原有外观，Lumen 为玻璃拟态极简风；夜间模式与皮肤互斥，选中 Lumen 会自动切回浅色。", en: "Classic is the original look; Lumen is a glassmorphic minimal skin. Dark mode and skins are mutually exclusive — picking Lumen returns to light." },
    "skin.classic": { zh: "经典", en: "Classic" },
    "skin.lumen": { zh: "Lumen", en: "Lumen" },
    "skin.darkFallback": { zh: "Lumen 皮肤仅支持浅色模式，已临时切回经典外观", en: "Lumen supports light mode only — fell back to Classic" },
    "skin.unavailable": { zh: "该皮肤文件不存在，已回退到经典外观", en: "Skin file not found — reverted to Classic" },
    "skin.applied": { zh: "已切换外观：{name}", en: "Appearance: {name}" },

    // 外观三态（顶栏图标按钮循环切换）
    "mood.classic": { zh: "经典", en: "Classic" },
    "mood.dark": { zh: "夜间", en: "Dark" },
    "mood.lumen": { zh: "Lumen", en: "Lumen" },
    "mood.switched": { zh: "外观已切换：{name}", en: "Appearance: {name}" },
    "mood.btnTitle": { zh: "外观：{name}（点击切换）", en: "Appearance: {name} (click to switch)" },

    "members.title": { zh: "成员管理", en: "Members" },
    "members.you": { zh: "我", en: "You" },
    "members.hint": { zh: "admin 可将 user 提升为「内容管理」(具官方知识库写权限，但不可提升他人)", en: "Admin can promote user to Content Editor (official KB write, but cannot promote others)" },
    "members.count": { zh: "共 {n} 位成员", en: "{n} members" },
    "members.roleOf": { zh: "调整角色", en: "Change role" },
    "members.empty": { zh: "暂无成员", en: "No members" },
    "members.delete": { zh: "删除该成员（连带其全部数据）", en: "Delete member (with all their data)" },
    "members.deleteConfirm": { zh: "确定删除成员「{name}」？\n其账号、档案及全部业务数据将被一并删除，且不可恢复！", en: "Delete member \"{name}\"?\nTheir account, profile and ALL business data will be removed permanently!" },
    "members.deleted": { zh: "已删除成员「{name}」", en: "Member \"{name}\" deleted" },
    "members.deleteFail": { zh: "删除失败，请重试", en: "Delete failed, please retry" },
    "members.selfNoDel": { zh: "不能删除自己", en: "You" },
    "members.onlyAdmin": { zh: "仅主管理员可删除成员", en: "Only the main admin can delete members" },
    "members.loadFail": { zh: "成员列表加载失败", en: "Failed to load members" },
    "members.needMigration": { zh: "删除功能未就绪：请先在 Supabase SQL Editor 执行 supabase/migrations/0006_member_admin.sql", en: "Delete not ready: run supabase/migrations/0006_member_admin.sql in the Supabase SQL Editor first" },
    "members.bulk": { zh: "批量管理", en: "Batch" },
    "members.bulkExit": { zh: "退出批量", en: "Exit batch" },
    "members.selectAll": { zh: "全选", en: "Select all" },
    "members.selectClear": { zh: "清空选择", en: "Clear" },
    "members.selectedN": { zh: "已选 {n} 人", en: "{n} selected" },
    "members.bulkDelete": { zh: "批量删除", en: "Delete selected" },
    "members.bulkDeleteConfirm": { zh: "确定批量删除 {n} 位成员？\n其账号、档案及全部业务数据将被一并删除，且不可恢复！", en: "Delete {n} members?\nTheir accounts, profiles and ALL business data will be removed permanently!" },
    "members.bulkNoSel": { zh: "请先勾选要删除的成员", en: "Select members to delete first" },
    "members.bulkPartial": { zh: "已删除 {ok} 人，跳过 {skip} 人（含自己或不存在的账号）", en: "Deleted {ok}, skipped {skip} (self or missing accounts)" },
    "members.bulkDone": { zh: "✓ 已批量删除 {n} 位成员", en: "✓ Deleted {n} members" },
    "members.bulkSelfSkipped": { zh: "已自动跳过你自己", en: "Your own account was skipped automatically" },
    "members.bulkNeedMigration": { zh: "批量删除未就绪：请先在 Supabase SQL Editor 执行 supabase/migrations/0007_member_bulk_delete.sql", en: "Batch delete not ready: run supabase/migrations/0007_member_bulk_delete.sql in the Supabase SQL Editor first" },
    "members.pickHint": { zh: "勾选左侧复选框可批量删除（不会涉及你自己）", en: "Tick the left checkboxes to delete in bulk (yourself excluded)" },
    "members.pickHintShort": { zh: "勾选左侧复选框可批量删除", en: "Tick boxes to batch delete" },

    "share.inbox": { zh: "收件箱", en: "Inbox" },
    "share.sent": { zh: "我共享的", en: "Shared by me" },
    "share.received": { zh: "我接受的", en: "Accepted" },
    "share.pending": { zh: "待接受", en: "Pending" },
    "share.accepted": { zh: "已接受", en: "Accepted" },
    "share.from": { zh: "来自", en: "From" },
    "share.to": { zh: "给", en: "To" },
    "share.accept": { zh: "接受", en: "Accept" },
    "share.acceptedOk": { zh: "已接收并存入你的空间", en: "Received into your space" },
    "share.sourceGone": { zh: "源数据已不存在", en: "Source no longer exists" },
    "share.toUser": { zh: "共享给用户", en: "Share to user" },
    "share.tip": { zh: "输入对方登录邮箱，内容将复制进对方账号（可改删，不影响你的源数据）", en: "Enter the recipient's login email; a copy goes to their account (editable, won't affect your source)" },
    "share.userNotFound": { zh: "未找到该邮箱用户", en: "User not found" },
    "share.cannotSelf": { zh: "不能共享给自己", en: "Cannot share to yourself" },
    "share.sentOk": { zh: "已发送共享", en: "Shared" },
    "share.nothing": { zh: "没有可共享的内容", en: "Nothing to share" },
    "share.emptyInbox": { zh: "收件箱为空", en: "Inbox empty" },
    "share.emptySent": { zh: "还没有共享记录", en: "No shares sent" },
    "share.emptyRecv": { zh: "还没有接受记录", en: "No shares accepted" },
    "share.localUnsupported": { zh: "本地模式不支持云端共享", en: "Cloud sharing is unavailable in local mode" },

    "datamgr.title": { zh: "数据管理", en: "Data Manager" },
    "datamgr.sub": { zh: "本地数据概览、导出 / 导入备份、自动备份到本地文件夹", en: "Local data overview, export/import backup, auto-backup to a local folder" },
    "datamgr.mode": { zh: "当前模式", en: "Current mode" },
    "datamgr.modeLocal": { zh: "本地模式", en: "Local mode" },
    "datamgr.modeCloud": { zh: "云端模式", en: "Cloud mode" },
    "datamgr.overview": { zh: "数据概览", en: "Overview" },
    "datamgr.countPricing": { zh: "定价记录", en: "Pricing records" },
    "datamgr.countTodos": { zh: "日程待办", en: "To-Dos" },
    "datamgr.countTags": { zh: "待办标签", en: "Tags" },
    "datamgr.countKnowledge": { zh: "知识库", en: "Knowledge" },
    "datamgr.countContacts": { zh: "客户档案", en: "Contacts" },
    "datamgr.items": { zh: "条", en: "items" },
    "datamgr.storage": { zh: "存储引擎", en: "Storage engine" },
    // 通用「标签：值」分隔符。中文用全角冒号，英文用半角冒号+空格，避免英文界面出现中文标点
    "common.labelSep": { zh: "：", en: ": " },
    // 列表项连接符（枚举多个语言名/标签时使用）
    "common.listSep": { zh: "、", en: ", " },
    "common.optional": { zh: "可选", en: "Optional" },
    // ===== 首次使用时的默认标签（日程 / 知识库筛选器）：按首次创建时的界面语言落库 =====
    "seed.tag.mercado": { zh: "美客多", en: "Mercado Libre" },
    "seed.tag.amazon": { zh: "亚马逊", en: "Amazon" },
    "seed.tag.aliexpress": { zh: "速卖通", en: "AliExpress" },
    "seed.tag.dtc": { zh: "独立站", en: "DTC site" },
    "seed.tag.logistics": { zh: "物流", en: "Logistics" },
    "seed.tag.finance": { zh: "财务", en: "Finance" },
    "seed.tag.other": { zh: "其他", en: "Other" },
    "seed.tag.payment": { zh: "支付", en: "Payments" },
    "seed.tag.tax": { zh: "税务", en: "Tax" },
    "seed.tag.productDesc": { zh: "产品描述", en: "Product description" },
    "seed.tag.csScript": { zh: "客服话术", en: "Customer service script" },
    "seed.tag.marketing": { zh: "营销文案", en: "Marketing copy" },
    "seed.tag.aftersales": { zh: "售后模板", en: "After-sales template" },
    "seed.tag.inbox": { zh: "站内信", en: "On-site message" },
    // 标签后跟一组按钮时的收尾冒号（如「发送到： [按钮][按钮]」）
    "common.labelColon": { zh: "：", en: ":" },
    // 摘要文本里的列分隔（中文用全角空格，英文用两个普通空格）
    "common.colSep": { zh: "　", en: "  " },
    "common.parenL": { zh: "（", en: " (" },
    "common.parenR": { zh: "）", en: ")" },
    "datamgr.engineFallback": { zh: "localStorage（回退）", en: "localStorage (fallback)" },
    "datamgr.exportImport": { zh: "导出 / 导入", en: "Export / Import" },
    "datamgr.export": { zh: "导出全部数据", en: "Export all data" },
    "datamgr.exportHint": { zh: "导出为 JSON 文件，可保存到本机任意位置", en: "Export as a JSON file you can save anywhere" },
    "datamgr.import": { zh: "导入数据", en: "Import data" },
    "datamgr.importHint": { zh: "选择之前导出的 JSON 文件恢复数据", en: "Pick a previously exported JSON file to restore" },
    "datamgr.importMerge": { zh: "合并（保留已有，覆盖同 id）", en: "Merge (keep existing, overwrite same id)" },
    "datamgr.importOverwrite": { zh: "覆盖（清空后导入）", en: "Overwrite (clear then import)" },
    "datamgr.importedOk": { zh: "已导入", en: "Imported" },
    "datamgr.importEmpty": { zh: "文件中没有可导入的数据", en: "No importable data in file" },
    "datamgr.fileBad": { zh: "文件格式不正确", en: "Invalid file format" },
    "datamgr.autoBackup": { zh: "自动备份到本地文件夹", en: "Auto-backup to local folder" },
    "datamgr.pickFolder": { zh: "选择备份文件夹", en: "Choose backup folder" },
    "datamgr.folder": { zh: "备份文件夹", en: "Backup folder" },
    "datamgr.noFolder": { zh: "尚未选择文件夹", en: "No folder selected" },
    "datamgr.autoOn": { zh: "自动备份", en: "Auto backup" },
    "datamgr.backupNow": { zh: "立即备份", en: "Back up now" },
    "datamgr.interval": { zh: "备份间隔", en: "Interval" },
    "datamgr.lastBackup": { zh: "最近备份", en: "Last backup" },
    "datamgr.never": { zh: "从未", en: "Never" },
    "datamgr.backedUp": { zh: "已备份", en: "Backed up" },
    "datamgr.backupFail": { zh: "备份失败", en: "Backup failed" },
    "datamgr.reauthorize": { zh: "需要重新授权文件夹", en: "Folder needs re-authorization" },
    "datamgr.fsUnsupported": { zh: "当前浏览器不支持文件夹授权，将改为下载导出", en: "This browser lacks folder access; falling back to download export" },
    "datamgr.fsNote": { zh: "说明：需 Chrome/Edge 与 https/localhost；浏览器重启后需重新授权一次文件夹。", en: "Note: requires Chrome/Edge on https/localhost; re-authorize the folder once after restarting the browser." },
    "datamgr.syncCloud": { zh: "从云端同步到现在", en: "Sync from cloud now" },
    "datamgr.syncHint": { zh: "把云端账号的数据拉到本机（本地模式下也可用，用于备份）", en: "Pull cloud account data to this device (works for backup even in local mode)" },
    "datamgr.syncOk": { zh: "云端数据已同步到本地", en: "Cloud data synced locally" },
    "datamgr.migratedAt": { zh: "上次迁移", en: "Last migrated" },
    "datamgr.reset": { zh: "清空本地数据", en: "Clear local data" },
    "datamgr.resetConfirm": { zh: "确定清空所有本地数据？此操作不可恢复！", en: "Clear ALL local data? This cannot be undone!" },
    "datamgr.resetDone": { zh: "本地数据已清空", en: "Local data cleared" },

    "crm.tags": { zh: "标签（分类）", en: "Tags" },
    "crm.tagsPH": { zh: "用逗号分隔，如：VIP, 墨西哥", en: "Comma separated, e.g. VIP, Mexico" },
    "crm.untagged": { zh: "未分类", en: "Untagged" },
    "crm.shareAll": { zh: "共享全部", en: "Share all" },

    "kb.private": { zh: "私有知识库", en: "Private" },
    "kb.official": { zh: "官方知识库", en: "Official" },
    "kb.templates": { zh: "文案模板库", en: "Templates" },
    "kb.readonly": { zh: "只读", en: "read-only" },
    "kb.shareAll": { zh: "共享全部", en: "Share all" },
    "kb.addTag": { zh: "添加标签", en: "+ Tag" },
    "kb.addTagPH": { zh: "输入标签名…", en: "Tag name…" },
    "kb.delTag": { zh: "删除标签", en: "Delete tag" },
    "kb.delTagConfirm": { zh: "确定删除标签「{name}」吗？\n将同时从 {n} 条知识中移除。", en: "Delete tag \"{name}\"?\nIt will be removed from {n} item(s)." },
    "kb.tagReadonly": { zh: "标签栏只读", en: "Tag bar is read-only" },
  };

  function t(key, vars) {
    const e = dict[key];
    let s = e ? (e[lang] || e.en || key) : key;
    // 注意：同一占位符可能在文案里出现多次，必须全局替换（String.replace 传字符串只换第一次）
    if (vars) for (const k in vars) s = s.split("{" + k + "}").join(vars[k]);
    return s;
  }
  function setLang(l) { lang = l; localStorage.setItem("cb_lang", l); document.documentElement.lang = l; }
  function getLang() { return lang; }
  function apply() {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const k = el.getAttribute("data-i18n");
      if (!dict[k]) return;
      // 支持 data-i18n-* 形式的变量：属性名 data-i18n-name → 占位符 {name}
      // 例如 branding.copyright 里的 {name} 由 data-i18n-name="branding.name" 提供
      const vars = {};
      let hasVars = false;
      for (const attr of Array.from(el.attributes)) {
        const m = attr.name.match(/^data-i18n-(.+)$/);
        if (!m) continue;
        hasVars = true;
        vars[m[1].replace(/-/g, "_")] = dict[attr.value] ? t(attr.value) : attr.value;
      }
      el.textContent = hasVars ? t(k, vars) : t(k);
    });
    document.querySelectorAll("[data-i18n-ph]").forEach((el) => {
      const k = el.getAttribute("data-i18n-ph");
      if (dict[k]) el.placeholder = t(k);
    });
    document.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const k = el.getAttribute("data-i18n-title");
      if (dict[k]) el.title = t(k);
    });
  }
  return { t, setLang, getLang, apply, dict };
})();

/* ===== Shared utilities ===== */
window.U = (function () {
  const ZERO_DEC = new Set(["JPY", "KRW", "CLP", "COP", "IDR", "VND", "PYG", "HUF", "ISK", "TWD", "XOF", "BIF", "XAF"]);

  function store(key, val) {
    if (val === undefined) {
      try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
    }
    localStorage.setItem(key, JSON.stringify(val));
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function money(n, code) {
    if (n == null || isNaN(n)) return "–";
    const dec = ZERO_DEC.has(code) ? 0 : 2;
    const s = new Intl.NumberFormat(I18N.getLang() === "zh" ? "zh-CN" : "en-US",
      { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n);
    return s + " " + code;
  }
  function num(n, dec = 2) {
    if (n == null || isNaN(n)) return "–";
    return new Intl.NumberFormat(I18N.getLang() === "zh" ? "zh-CN" : "en-US",
      { minimumFractionDigits: 0, maximumFractionDigits: dec }).format(n);
  }

  // 保留指定小数位（用于重量等需要固定精度的场景）
  function fixed(n, dec = 3) {
    if (n == null || isNaN(n)) return "–";
    return Number(n).toFixed(dec).replace(/\.?0+$/, "") || "0";
  }

  function precise(n, dec = 3) {
    if (n == null || isNaN(n)) return "–";
    return Number(n).toFixed(dec);
  }

  let toastTimer;
  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 1900);
  }

  function copy(text, msg) {
    const done = () => toast(msg || I18N.t("common.copied"));
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    } else fallbackCopy(text, done);
  }
  function fallbackCopy(text, done) {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); done(); } catch (e) {}
    document.body.removeChild(ta);
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // simple modal: pass HTML string, returns the modal element; close via .closeModal()
  function modal(html, opts) {
    opts = opts || {};
    const scrim = document.createElement("div");
    scrim.className = "modal-scrim show";
    scrim.innerHTML = '<div class="modal' + (opts.wide ? " modal-wide" : "") + '">' + html + "</div>";
    document.body.appendChild(scrim);
    const close = () => { scrim.classList.remove("show"); setTimeout(() => scrim.remove(), 200); };
    scrim.addEventListener("click", (e) => { if (e.target === scrim && !opts.noClose) close(); });
    scrim.closeModal = close;
    return scrim;
  }

  return { store, uid, money, num, fixed, precise, toast, copy, esc, modal };
})();

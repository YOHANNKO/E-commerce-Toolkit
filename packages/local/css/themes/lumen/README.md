# Lumen 皮肤使用说明

> 玻璃拟态 · 极简 · 轻松活泼的界面皮肤。与「经典」外观完全隔离，可随时删除。

## 如何启用

1. 登录后进入 **用户设置（右上角头像 → 设置）**
2. 在「**外观皮肤 / Appearance**」一栏点选 **Lumen**
3. 立即生效，选择会记住（`localStorage.cb_skin`）

随时切回 **经典 / Classic** 即恢复原外观。

## 如何删除（完全还原）

只需两步，**不需要动任何其它文件**：

```bash
# 1. 删除皮肤目录
rm -rf css/themes/lumen/

# 2. 删除 index.html 中的这一行（含上方注释块）
#    <link rel="stylesheet" href="css/themes/lumen/lumen.css?v=NN" id="skinLumen" disabled />
```

删完后应用的 `applySkin()` 检测不到 `#skinLumen`，会自动回退经典外观；
`localStorage.cb_skin` 里残留的 `lumen` 值会被忽略，**无需清缓存**。

## 隔离原理

| 层级 | 机制 |
|---|---|
| 作用域 | 所有规则挂在 `body[data-skin="lumen"]` 下。属性不存在 → 选择器全不匹配 |
| 优先级 | `body[data-skin="lumen"] .card`（0,2,0）恒高于 `.card`（0,1,0），无需 `!important` |
| 加载 | `<link disabled>`。未启用时浏览器不解析该文件，零开销 |
| 联动 | 切到暗色主题时自动回落经典（Lumen 仅接管浅色），避免"半套皮肤" |
| 回退 | 皮肤文件缺失时 `skinAllowed()` 返回 false，自动用经典 |

## 开发新皮肤

1. 复制本目录为 `css/themes/<新名>/`
2. 改文件名为 `<新名>.css`，把 `body[data-skin="lumen"]` 全局替换为新皮肤名
3. `index.html` 加一行 `<link id="skin新名" disabled>`
4. `js/app.js` 的 `SKINS` 对象加一项 `{ name: "新名", linkId: "skin新名" }`
5. `js/i18n.js` 加 `skin.新名` 的中英文案

## 设计规范

完整的色板、圆角/阴影分级、组件规格见项目根目录 `Lumen新皮肤设计方案.md`。

# 主题外观模块重构计划（优化点 1-3）

## Context（为什么做）

当前主题模块存在三类架构问题，相互交织：

**1. 主题数据双重定义（DRY 违规）**：每个主题的颜色在两处重复维护——[theme.ts](file:///D:/aiProject/HeTongJira/src/stores/theme.ts) 的 `THEME_PRESETS`（gradient/accent/solidColor/isLight）和 [style.css](file:///D:/aiProject/HeTongJira/src/style.css) 的 11 个 `[data-theme="xxx"]` 块。新增/改主题必须手工同步两文件。且 CSS 块定义的变量比 store 多（`accent-hover/glow/soft`、`bg`、按主题的 `success/warning/danger`），store 并未持有。

**2. store 过重 + 图像处理零测试**：[theme.ts](file:///D:/aiProject/HeTongJira/src/stores/theme.ts) 610 行塞进了图像处理算法（`hexToRgba`/`relativeLuminance`/`detectImageBrightness`/`downscaleImage`/`cropImage`，约 140 行）、localStorage 持久化、DOM 操作。这些图像函数是纯工具，却混在 store 里且**零测试覆盖**，违反项目"DDD 驱动 + 每改动必测试"约定。

**3. 文字配色方案三重重复 + 硬编码在 JS**：light/dark 两套文字+玻璃 token（各 ~18 个 CSS 变量）在三处重复——CSS `[data-theme="light-themes"]` 块（style.css:243-270）、JS `applyTextColorScheme` 巨型对象（theme.ts:385-433）、`:root` 默认。JS 还硬编码了 select-arrow 的 SVG data URL。JS 版本运行时覆盖 CSS 版本。

**目标**：① store 成为唯一数据源，运行时注入全部主题 token，删除 CSS `[data-theme]` 块；② 图像处理抽到 `src/utils/image-processing.ts` 并补纯函数测试；③ 文字方案移到 CSS `[data-text-scheme]` 选择器，JS 只切换属性，删除 `applyTextColorScheme`。

## 当前状态（已核对）

- 11 个 `[data-theme]` 块各定义：`--color-bg-gradient`、`--color-bg`、`--color-accent`、`--color-accent-hover`、`--color-accent-glow`、`--color-accent-soft`、`--color-success`、`--color-warning`、`--color-danger`；light 主题额外 `--is-light-bg:1`
- `THEME_PRESETS.accent` 与 CSS `--color-accent` 完全一致；`gradient` 与 `--color-bg-gradient` 完全一致；`solidColor` 与 `--color-bg` 一致
- `accent-glow` alpha：dark 主题 0.5、light 主题 0.4；`accent-soft` alpha：dark 0.15、light 0.12（非固定，需逐主题存）
- `success/warning/danger`：dark 主题基本 `#34d399/#fbbf24/#f87171`（sunset-orange 为 `#4ade80/#facc15`）；light 主题统一 `#059669/#d97706/#dc2626`
- 图像函数：`hexToRgba`/`relativeLuminance` 纯函数；`detectImageBrightness`/`downscaleImage`/`cropImage` 用 canvas/Image，调用方全在 theme.ts 内（setCustomBackground/applyCrop/init）
- 测试环境 `happy-dom`（无真实 canvas），canvas 函数仅能测 fallback 路径
- 仅 `theme.ts`（setAttribute）与 `style.css` 使用 `data-theme`，无其他消费方
- `ThemeConfig.vue` 用 `preset.preview`/`preset.accent`/`preset.name`/`theme.currentTheme`（均保留，无需改）

## 设计决策

### 点1：store 单一数据源 + 运行时注入

扩展 `ThemePreset` 类型，补全所有按主题 CSS token：
```ts
interface ThemePreset {
  id; name; isLight
  bgGradient: string       // 原 gradient → --color-bg-gradient
  bgSolid: string          // 原 solidColor → --color-bg
  accent: string           // --color-accent
  accentHover: string      // --color-accent-hover
  accentGlow: string       // --color-accent-glow
  accentSoft: string       // --color-accent-soft
  success: string          // --color-success
  warning: string          // --color-warning
  danger: string           // --color-danger
  preview: string          // UI 预览用（非 CSS 变量，保留）
}
```
`applyTheme()` 新增：遍历当前 preset，把上述 token 写入 `documentElement.style` 的 CSS 变量（`--color-bg-gradient` 等）。保留 `data-theme` 属性设置（devtools 调试用，无 CSS 依赖）。`:root` 保留 aurora-blue 默认值作首屏 fallback（避免 FOUC——默认主题无闪烁，其他主题仅在 JS 初始化前短暂显示 aurora-blue，与现有文字方案行为一致）。

### 点3：文字方案移到 CSS（先于删 [data-theme]）

在 style.css 新增两块（内容取自 `applyTextColorScheme` 的 JS 对象，逐字搬迁）：
```css
:root, [data-text-scheme="dark"] { /* dark 文字+玻璃 token 18 个 + select-arrow dark SVG */ }
[data-text-scheme="light"] { /* light 文字+玻璃 token 18 个 + select-arrow light SVG + color-scheme:light */ }
```
`applyTheme()` 改为 `documentElement.setAttribute('data-text-scheme', isLight ? 'light' : 'dark')`。**删除** `applyTextColorScheme` 整个函数。`--is-light-bg` 由 `[data-text-scheme="light"]{--is-light-bg:1}` 和 `:root{--is-light-bg:0}` 提供（若发现无消费方则一并清理）。

### 点2：图像处理抽 utils + 测试

新建 `src/utils/image-processing.ts`，迁入 5 个函数（签名不变，theme.ts import 复用）。从 `detectImageBrightness` 抽出纯函数 `isLightLuminance(avgLuminance): boolean`（阈值 0.25），便于单测核心判定逻辑。

测试策略（happy-dom 无真实 canvas）：
- `hexToRgba`：纯 → 黄金值（#818cf8→rgba(129,140,248,1)、alpha 0.5、非法输入兜底）
- `relativeLuminance`：纯 → WCAG 黄金值（白≈1、黑=0、中灰区间）
- `isLightLuminance`：纯 → 阈值边界（0.25→false、0.26→true、0→false）
- `detectImageBrightness`/`downscaleImage`/`cropImage`：测 fallback 路径（canvas 不支持时 resolve false / 原值回退），不测像素级

## 迁移步骤（每步后 `npx vitest run` 保持全绿）

| # | 动作 | 风险 |
|---|------|------|
| 1 | 新建 `src/utils/image-processing.ts`，迁入 5 函数 + 抽 `isLightLuminance`；theme.ts 改为 import | 低（纯搬迁，行为不变） |
| 2 | 新建 `src/test/utils/image-processing.test.ts`（hexToRgba/relativeLuminance/isLightLuminance 黄金值 + canvas fallback） | 无（新测试） |
| 3 | theme.ts 扩展 `ThemePreset` 类型 + `THEME_PRESETS` 补全 9 个 token 字段；`applyTheme()` 运行时注入 token | 中（数据搬运，需逐主题核对 CSS 值） |
| 4 | style.css 新增 `[data-text-scheme="dark"]`/`[data-text-scheme="light"]` 块（搬迁 18 变量）；theme.ts `applyTheme()` 改设属性、删 `applyTextColorScheme` | 中（JS↔CSS 搬迁，需核对一致） |
| 5 | style.css 删除全部 11 个 `[data-theme="xxx"]` 块 + light-themes 分组覆盖块（保留 `:root` aurora-blue 默认） | 中（确认无残留 CSS 依赖） |
| 6 | 核对 `--is-light-bg` 消费方，无则清理；核对 ThemeConfig.vue 无受影响 | 低 |
| 7 | 全量 `npx vitest run` + `npx vue-tsc --noEmit` + `npx vite build` + 浏览器 QA | — |

## 明确不做
- 不改 localStorage 持久化方式（背景图存 IndexedDB 是优化点4，本次不做）
- 不统一亮度决策（优化点5，本次不做）
- 不抽 CropModal 组件（优化点6，本次不做）
- 不改 ThemeConfig.vue 的 UI/交互逻辑
- 不改 11 个主题的任何颜色值（纯结构搬迁，视觉零变化）
- 不动其他设置子模块

## 验证
每步后：`npx vitest run`（当前 120 测试，重构后 120+ 全绿）
完成时：
- `npx vue-tsc --noEmit` 无类型错误
- `npx vite build` 通过
- 浏览器 QA：http://localhost:5173/#/settings → 主题外观
  - 切换 11 个主题，accent 色、背景渐变、按钮/输入框强调色均正确变化
  - light 主题（纯白/明亮黄/少女粉/轻柔绿/灵动蓝）文字为深色、玻璃卡片为亮色磨砂
  - dark 主题文字为浅色
  - 上传背景图 → 自动亮度检测 → 文字色自适应；手动覆盖深/浅色字正常
  - 裁剪模态、遮罩透明度滑块、启用开关均正常
  - 视觉与重构前完全一致（纯结构搬迁）

# 流式响应式毛玻璃 UI 设计规范

## 角色
专精于现代交互与视觉设计的 CSS 架构师。

## 任务
将当前页面重构为「流式响应式毛玻璃（Glassmorphism + Fluid）」风格。既要像水一样流动适配，又要像玻璃一样晶莹通透。

---

## 第一部分：字体系统（核心要求）

### 字体家族
| 用途 | 字体 | 备选 |
|------|------|------|
| 英文标题 | **Clash Display** | `'Clash Display', 'Inter', system-ui, sans-serif` |
| 英文正文 | **DM Sans** | `'DM Sans', 'Inter', system-ui, sans-serif` |
| 中文 | **HarmonyOS Sans** | `'HarmonyOS Sans SC', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif` |

### 字体加载
```css
/* DM Sans - Google Fonts */
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');

/* Clash Display - Fontshare API */
@import url('https://api.fontshare.com/v2/css?f[]=clash-display@400,500,600,700&display=swap');

/* HarmonyOS Sans SC - 通过系统字体回退链加载 */
```

### 字体应用规则
- 标题元素（h1-h3, .glass-h1, .glass-h2, .glass-h3）：`Clash Display` + `HarmonyOS Sans SC`
- 正文元素（.glass-body, .glass-body-sm, .glass-caption, 表单输入）：`DM Sans` + `HarmonyOS Sans SC`
- 全局 `font-family`：`'DM Sans', 'HarmonyOS Sans SC', 'Noto Sans SC', system-ui, sans-serif`

---

## 第二部分：流式响应式布局

### 流体容器
- 主容器：`max-width: clamp(320px, 92%, 1400px); margin: 0 auto;`
- 最小内边距：`padding: clamp(1rem, 2vw, 2rem);`

### 流体栅格
```css
display: grid;
grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
gap: clamp(0.5rem, 1vw, 1.5rem);
```

### 移动优先堆叠
```css
@media (max-width: 640px) {
  .force-col-mobile { flex-direction: column !important; }
  .hide-mobile { display: none !important; }
  .glass-card-header { flex-direction: column; align-items: flex-start; }
}
```

### 流体排版（含平板优化）
| 级别 | clamp() 范围 | 适用设备 |
|------|-------------|----------|
| `.glass-h1` | `clamp(1.8rem, 5vw, 4.5rem)` | 手机→4K屏 |
| `.glass-h2` | `clamp(1.25rem, 3.5vw, 3rem)` | 手机→4K屏 |
| `.glass-h3` | `clamp(1rem, 2.5vw, 2rem)` | 手机→4K屏 |
| `.glass-body` | `clamp(0.9rem, 1.8vw, 1.4rem)` | 手机→4K屏 |
| `.glass-body-sm` | `clamp(0.8rem, 1.4vw, 1.15rem)` | 手机→4K屏 |
| `.glass-caption` | `clamp(0.75rem, 1.2vw, 1rem)` | 手机→4K屏 |

### 平板优化断点（2752×2046）
```css
/* 大平板/桌面优化：1921px+ */
@media (min-width: 1921px) {
  .fluid-container { max-width: clamp(1400px, 90vw, 2000px); }
  .glass-card-body { padding: clamp(1.5rem, 3vw, 3rem); }
  .glass-nav-item { font-size: clamp(0.9rem, 1.4vw, 1.1rem); }
  .glass-input, .glass-select { font-size: clamp(0.95rem, 1.3vw, 1.1rem); }
  .glass-btn { font-size: clamp(0.9rem, 1.2vw, 1.05rem); }
  .glass-table { font-size: clamp(0.95rem, 1.3vw, 1.1rem); }
  .glass-nav { width: clamp(200px, 14vw, 280px); }
}
```

### 内容内边距标准
- 卡片 body：`padding: clamp(1rem, 2vw, 2rem);`
- 卡片 header：`padding: clamp(0.75rem, 1.5vw, 1.5rem) clamp(1rem, 2vw, 2rem);`
- 表单控件：`padding: clamp(0.5rem, 1vw, 0.875rem) clamp(0.75rem, 1.5vw, 1rem);`

---

## 第三部分：玻璃态毛玻璃质感

### 环境背景
- 默认：`linear-gradient(135deg, #0f0c29, #302b63, #24243e)`
- 支持预设主题切换 + 自定义图片背景

### 毛玻璃材质
- 卡片：`background: rgba(255, 255, 255, 0.10);`
- `backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);`

### 高光边框
- `border: 1px solid rgba(255, 255, 255, 0.20);`

### 悬浮动态
- `transform: translateY(-6px);`
- `background: rgba(255, 255, 255, 0.18);`
- `box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);`

---

## 第四部分：主题系统（换色 + 自定义背景）

### 预设主题色板
| 主题名 | 渐变 | 强调色 | 适用场景 |
|--------|------|--------|----------|
| 深空蓝（默认） | `#0f0c29 → #302b63 → #24243e` | `#818cf8` | 专业/科技 |
| 极光绿 | `#0a2a2e → #0d3b3e → #1a5a52` | `#34d399` | 自然/清新 |
| 日落橙 | `#2d1b3d → #4a2040 → #6b2d3f` | `#fb923c` | 温暖/创意 |
| 暮色紫 | `#1a0b2e → #3d1f5c → #2d1b4e` | `#c084fc` | 神秘/艺术 |
| 樱花粉 | `#2d1a2e → #5c2e4e → #3d1a3d` | `#f9a8d4` | 柔美/插画 |
| 赛博青 | `#0a1628 → #0d2944 → #0a3040` | `#22d3ee` | 未来/潮流 |

### 主题 CSS 变量系统
```css
:root, [data-theme="aurora-blue"] {
  --color-bg-gradient: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
  --color-accent: #818cf8;
  --color-accent-hover: #6366f1;
  --color-accent-glow: rgba(129, 140, 248, 0.5);
  /* ... 其他变量 */
}

[data-theme="aurora-green"] {
  --color-bg-gradient: linear-gradient(135deg, #0a2a2e, #0d3b3e, #1a5a52);
  --color-accent: #34d399;
  --color-accent-hover: #10b981;
  --color-accent-glow: rgba(52, 211, 153, 0.5);
}
/* ... 其他主题 */
```

### 自定义背景图片
```css
body {
  background-image:
    var(--user-bg-image, none),
    var(--color-bg-gradient);
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
}

/* 背景图片半透明遮罩，保证可读性 */
body::after {
  content: '';
  position: fixed;
  inset: 0;
  background: var(--user-bg-overlay, linear-gradient(135deg, rgba(15,12,41,0.6), rgba(48,43,99,0.6)));
  z-index: -1;
  pointer-events: none;
}
```

---

## 第五部分：红线约束

- **严禁修改**任何 JavaScript 函数、`onclick` 事件和 `id` 名称
- 只允许调整 CSS 和包裹容器的 Class/HTML 结构
- 保持所有原有功能逻辑不变

---

## 设计令牌（Design Tokens）

### 颜色系统
```
--color-bg-gradient: linear-gradient(135deg, #0f0c29, #302b63, #24243e)
--color-glass-bg: rgba(255, 255, 255, 0.10)
--color-glass-bg-hover: rgba(255, 255, 255, 0.18)
--color-glass-border: rgba(255, 255, 255, 0.20)
--color-glass-blur: 20px
--color-text: rgba(255, 255, 255, 0.95)
--color-text-secondary: rgba(255, 255, 255, 0.70)
--color-text-muted: rgba(255, 255, 255, 0.50)
--color-accent: #818cf8
--color-accent-glow: rgba(129, 140, 248, 0.5)
```

### 字体系统
```
--font-heading: 'Clash Display', 'HarmonyOS Sans SC', system-ui, sans-serif
--font-body: 'DM Sans', 'HarmonyOS Sans SC', 'Noto Sans SC', system-ui, sans-serif
--font-chinese: 'HarmonyOS Sans SC', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif
```

### 间距系统（基于 4px 基准）
```
--space-1: 0.25rem
--space-2: 0.5rem
--space-3: 0.75rem
--space-4: 1rem
--space-5: 1.5rem
--space-6: 2rem
--space-8: 3rem
```

### 圆角系统
```
--radius-sm: 0.375rem
--radius-md: 0.625rem
--radius-lg: 0.875rem
--radius-xl: 1.25rem
--radius-full: 9999px
```

### 阴影系统
```
--shadow-glass: 0 8px 32px rgba(0, 0, 0, 0.3)
--shadow-glass-hover: 0 25px 50px -12px rgba(0, 0, 0, 0.5)
--shadow-glow: 0 0 30px rgba(129, 140, 248, 0.35)
--shadow-inner-glass: inset 0 1px 0 rgba(255, 255, 255, 0.15)
```

---

## 响应式断点

| 断点 | 宽度 | 行为 |
|------|------|------|
| Mobile | ≤ 640px | Flex → column, 隐藏导航文字, 单列栅格 |
| Tablet | 641-1920px | 双栏/多栏栅格, 中等间距, 紧凑字体 |
| Large Tablet / Desktop | > 1920px | 大平板优化, 放大字体和间距, 侧边栏加宽 |

---

## 实施检查清单
- [x] 字体系统：Clash Display (Fontshare) / DM Sans (Google Fonts) / HarmonyOS Sans (系统回退)
- [x] 流体排版支持 4K 屏（clamp 最大值 4.5rem/3rem/2rem）
- [x] 平板断点优化（>1921px，覆盖字体/间距/按钮/表格等）
- [x] 内容内边距标准统一（clamp 响应式 padding）
- [x] 预设主题色板（6 套配色：深空蓝/极光绿/日落橙/暮色紫/樱花粉/赛博青）
- [x] CSS 变量驱动主题切换（data-theme 属性 + Pinia store 管理）
- [x] 自定义背景图片上传 + 半透明遮罩（支持拖拽上传 + 实时预览）
- [x] 主题持久化（localStorage 保存用户偏好）
- [x] 主题配置 UI（设置 → 主题外观 标签页）
- [x] 流体容器 clamp 宽度
- [x] 毛玻璃材质 + backdrop-filter
- [x] 悬浮 translateY(-6px)
- [x] 移动端响应式堆叠
- [x] 无固定 px 宽度值
- [x] 文字颜色适配深色背景
- [x] 所有 JS 逻辑未被修改
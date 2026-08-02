# 列表分页功能实现计划

## Context（背景）

用户要求所有展示用列表支持分页。当前 5 个配置列表全部用 `v-for` 渲染 store 里的全量数组、无分页；订单/客户列表尚未实现（占位 mockup）。

本次为现存 3 个配置列表（客户类型、稿件类别、订单来源）接入分页，并产出可复用分页组件供未来订单/客户列表直接使用。

- **绘图阶段不分页**：StageConfig 有固定阶段（待开始/完成/退单）+ 上下移动功能，分页会破坏位置感知。
- **跟进类型本次不新建**：FollowUpTypeConfig.vue 不存在（只有 store 数据），待其管理页真正开发时复用本组件接入。
- **分页器形态**：完整版——首页/上页/页码按钮/下页/末页 + 跳至X页输入框(电梯) + 每页条数选择(10/20/50 默认10) + 总数显示。

## 实施步骤

### 1. 新建 domain 纯函数
**文件**：`src/domain/shared/pagination.ts`

4 个纯函数（零副作用，不依赖 Vue/Dexie，防御式 clamp 不抛错）：
- `computeTotalPages(total, pageSize)` — `total<=0||pageSize<=0` 返回 0；否则 `max(1, ceil(total/pageSize))`
- `computePageItems(total, pageSize, currentPage)` → `{ start, end, slice: [start, end] }` — 越界页先 clamp；`slice` 可直接 `arr.slice(slice[0], slice[1])`
- `computePageWindow(currentPage, totalPages, siblingCount=1)` → `(number | 'ellipsis')[]` — 含省略号；`totalPages<=2*siblingCount+3` 时全列；用 Set 去重保证页码唯一
- `clampPageInput(raw, totalPages, fallback)` → `number` — 跳页输入校验：空/非数字回退 fallback；越界 clamp；`totalPages=0` 返回 1

### 2. 新建单元测试
**文件**：`src/test/domain/shared/pagination.test.ts`（目录不存在会自动创建）

覆盖用例：常规整除/不整除、`total=0`、`pageSize=0`、负数、currentPage 越界 clamp、单页、省略号双侧/单侧/无、`siblingCount=2`、页码去重、跳页输入（合法/空/abc/0/负数/超大数/小数/含空格）。

### 3. domain barrel 导出
**文件**：`src/domain/index.ts` — 末尾追加 `export * from './shared/pagination'`

### 4. 新建分页组件
**文件**：`src/components/common/Pagination.vue`（该目录现存为空，此为其首个组件）

受控组件契约：
- **props**：`currentPage`、`pageSize`、`total`、`pageSizeOptions=[10,20,50]`、`siblingCount=1`、`pageSizeStorageKey?`
- **emits**：`update:currentPage`、`update:pageSize`（配合 `v-model:current-page` / `v-model:page-size`）
- **模板**：`nav.glass-pagination` 内含 → 总数 `span` / 每页条数 `select.glass-select` / 按钮组（首页 `ChevronsLeft`、上页 `ChevronLeft`、页码窗口、下页 `ChevronRight`、末页 `ChevronsRight`）/ 跳页电梯（`hide-mobile`）
- **复用样式**：`.glass-btn`（`-ghost/-secondary/-primary/-sm`，`:disabled` 内置禁用态）、`.glass-select`、`.glass-input`、`.glass-caption`；新增 `.glass-select-sm`/`.glass-input-sm` 覆盖 `.glass-select` 的 `w-full` 为 `width:auto`
- **跳页逻辑**：`inputmode="numeric"`，`v-model` 字符串中间态不校验，`@keyup.enter` + `@blur` 调 `commitJump`（用 `clampPageInput` 规范化并回写显示）；`watch(currentPage)` 同步输入框
- **pageSize 切换**：emit 新 size；若 `currentPage` 超出新总页数则同步 emit 修正；有 `pageSizeStorageKey` 时写 localStorage
- **`total<=0`** 时 `v-if` 不渲染整个 nav
- **颜色全用 CSS 变量**（`--glass-*`/`--color-text-*`/`--color-accent-*`），移动端跳页电梯用 `hide-mobile` 隐藏，其余 `flex-wrap` 换行
- 图标来源：`@lucide/vue` 的 `ChevronsLeft/ChevronLeft/ChevronRight/ChevronsRight`

### 5. 改造 3 个配置列表（统一模式）
以 `CustomerTypeConfig.vue` 为代表：
- 本地 `ref`：`currentPage=1`、`pageSize=Number(localStorage.getItem(key))||10`
- `computed pagedX`：用 `computePageItems` 取 `slice`，`store.X.slice(slice[0], slice[1])`
- `watch(() => store.X.length)`：CRUD 后修正越界 `currentPage`（删除末页项时自动回退）
- 新增成功后跳末页：`currentPage = computeTotalPages(store.X.length, pageSize)`
- 模板：`v-for` 改为 `pagedX`；列表下方、弹窗前插入 `<Pagination v-model:current-page v-model:page-size :total="store.X.length" :page-size-storage-key="..." />`
- 各列表 `pageSizeStorageKey` 独立：`pagination.settings.{customerType|category|source}.pageSize`

各列表特殊点：
| 列表 | 渲染形式 | 特殊处理 |
|---|---|---|
| CustomerTypeConfig | 纵向卡片 | 直接接入 |
| SourceConfig | `.glass-table` 表格 | tbody `v-for` 改 `pagedSources`；分页器放 `overflow-x-auto` 之后、`glass-card-body` 内 |
| CategoryConfig | 网格卡片 | **删除网格末尾的"新增类别"虚线卡片**（与 header 的 `+新增类别` 按钮功能重复，且占网格位导致每页少显示1条），仅保留 header 按钮 |

### 6. 不改 store
`fetchX()` 全量加载保留，分页是纯视图状态放组件本地 ref。未来迁服务端分页时再改 store（`fetchX({page,pageSize})` + `db.X.offset().limit()` + 单独 count），Pagination 组件接口不变，迁移成本仅在父组件 + store。

## 关键文件清单

**新建**：
- `src/domain/shared/pagination.ts`
- `src/test/domain/shared/pagination.test.ts`
- `src/components/common/Pagination.vue`

**修改**：
- `src/domain/index.ts`（追加导出）
- `src/views/Settings/CustomerTypeConfig.vue`
- `src/views/Settings/CategoryConfig.vue`（+ 删除虚线卡片）
- `src/views/Settings/SourceConfig.vue`

**不改**：`src/stores/settings.ts`、`src/style.css`（仅复用现有 `.glass-*` 类）

## 复用的现有资源
- 样式类：`src/style.css` 的 `.glass-btn`/变体、`.glass-select`、`.glass-input`、`.glass-badge`、`.glass-caption`、`.hide-mobile`
- 图标：`@lucide/vue`（项目已在 App.vue 使用）
- domain 组织约定：`src/domain/<子域>/` 纯函数 + JSDoc，`src/domain/index.ts` barrel 导出
- 测试约定：`src/test/domain/<子域>/xxx.test.ts`，vitest

## 验证

1. **单测**：`npm run test:run` — 新增 pagination 测试 + 既有 145 个全绿
2. **类型**：`npm run build`（`vue-tsc -b`）无报错
3. **手动**（http://localhost:5173/#/settings 各 tab）：
   - 默认数据(4-6条)仅1页，首/上/下/末页按钮 disabled
   - 临时加 >10 条数据测多页：页码窗口省略号正确（双侧/单侧/无）
   - 切换 pageSize 10→20→50，越界 currentPage 自动修正
   - 跳页输入合法页码回车跳转；输入 0/-1/abc/空 blur 后回退；超大数 clamp 末页
   - 新增项跳末页；删除末页唯一项自动回退前一页
   - 切换 11 套主题 + 亮/暗文字方案，分页器颜色跟随，DevTools 确认无 `rgba(...)` 硬编码
   - 移动端 ≤640px 跳页电梯隐藏，其余 flex-wrap 换行
   - 刷新页面 pageSize 从 localStorage 恢复，currentPage 重置为 1
   - 三种渲染形式（卡片/网格/表格）分页器视觉一致

## 风险注意
- CategoryConfig 虚线卡片必须删除，否则每页少1条真实数据
- CRUD 后 currentPage 越界必须 `watch(store.X.length)` 修正，否则显示空列表
- `.glass-select` 默认 `w-full`，必须用 `.glass-select-sm` 覆盖为 `width:auto`
- 页码按钮 `min-width:2em; justify-content:center` 固定等宽，避免单/双位页码跳动
- domain 纯函数保持纯 TS，不引入 `ref/computed`

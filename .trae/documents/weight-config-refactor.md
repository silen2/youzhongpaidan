# 客户权重配置 全面重构计划

## Context（为什么做）

当前权重配置存在三类相互交织的问题：

**1. 公式数学缺陷（根本）**：`src/domain/customer/weight-calculator.ts` 的 `weight = Σ(wi × scorei)`，`wi` 是百分比（如 25）、`scorei` 是 0–100，导致 `wi×scorei` 经常远超 100，最终 `Math.min(100,…)` 把结果钳到 100。后果：新客户（creditScore 默认 50）直接饱和到 100，看板按权重排序失效；调滑块几乎看不到效果——这与用户"让滑块真正生效、能自主调整比例"的诉求直接冲突。

**2. isArchived 查询 bug**：`src/db/index.ts:125` 和 `src/stores/settings.ts:151` 用 `where({ field, isArchived: 0 })`（boolean 字段对 0，无复合索引），生产环境返回空。导致所有客户权重实际基于空订单数据计算。

**3. UI/UX**：5 个滑块独立凑 100% 体验差、无实时预览、无预设方案、公式说明密集。

**目标**：重写公式为正确加权平均 + 修复 isArchived bug + 重做 UI（预设方案切换 + 实时预览 + 自定义调整），让权重真正可区分、滑块真正生效、用户能直观看到效果。

## 当前状态（已重新核对）

- `src/domain/customer/weight-calculator.ts`：仍是旧饱和公式（`config.w1 * priceScore`），未拆分函数
- `src/domain/config/weight-presets.ts`：**不存在**，需新建
- `src/types/index.ts` `WeightConfig`：无 `activePreset` 字段
- `src/views/Settings/WeightConfig.vue`：旧版（无预设、无预览、单卡两列）
- `src/stores/settings.ts`：无 `fetchWeightPreviewData`，无 `activePreset` 回填；`deleteStage` 仍有 isArchived bug
- `src/db/index.ts`：`calculateWeight` wrapper 仍有 `where({ customerId, isArchived: 0 })` bug；种子默认无 `activePreset`
- `src/test/domain/weight-calculator.test.ts`：13 个黄金值仍是旧饱和期望（空订单→100 等）
- `src/test/mocks/data-factory.ts` `createMockWeightConfig`：无 `activePreset` 字段
- `useCustomerStore` 暴露 `customers` ref ✓（预览下拉可用）

## 设计决策

### 新公式（`src/domain/customer/weight-calculator.ts`）
```
weight = Σ (wi/100 × scorei)   // 标准加权平均，结果自然落在 [0,100]
```
- 每个 `scorei` 单独钳制到 `[0,100]`（防止 fulfillScore 超 100 等情况）
- `creditScore` 默认 **保持 50**（冷启动中性先验；新客户在加权平均下仅贡献 w5/100×50=10 分，不再饱和。改 0 会把下大单的新客户压到底，对业务不利）
- `timeScore` 去掉魔数 `/10`，改为**全局最大 income/hour 归一化**（与 priceScore/freqScore 一致）：
  - `incomePerHour = totalCompletedIncome / totalHours`
  - `globalMaxIncomePerHour = max(各客户 incomePerHour)`（按 customerId 分组算）
  - `timeScore = clamp(incomePerHour / max(globalMaxIncomePerHour,1) × 100)`
- 拆分为两个导出函数支持实时预览：
  - `computeWeightFactors(customerOrders, allCustomers, allOrders): WeightFactors` — 返回 5 个钳制后的 score
  - `calculateWeightFromFactors(factors, config): number` — 加权平均
  - `calculateWeight(...)` 保留为组合入口（签名不变，兼容 db wrapper）

### 预设方案（新 `src/domain/config/weight-presets.ts`，纯常量可测）
| id | 名称 | w1 | w2 | w3 | w4 | w5 | 说明 |
|----|------|----|----|----|----|----|------|
| balanced | 均衡考量 | 25 | 20 | 20 | 15 | 20 | 与现种子默认一致 |
| money | 金额贡献优先 | 40 | 25 | 20 | 5 | 10 | 偏单价+频次 |
| stable | 合作稳定优先 | 15 | 20 | 15 | 20 | 30 | 偏信用+兑现 |

导出：`WEIGHT_PRESETS`、`WeightPresetId`（'balanced'|'money'|'stable'|'custom'）、`WeightPreset` 类型、`findWeightPreset(id)`、`matchPreset(weights)`（返回 preset id 或 'custom'）

### 数据模型
`WeightConfig`（`src/types/index.ts`）增加 `activePreset: WeightPresetId` 字段。**非索引字段，无需 Dexie schema 版本升级**。旧 DB 行无此字段时，`fetchWeightConfig` 用 `matchPreset` 回填（内存中补 'balanced' 或匹配项），并持久化回填值。

切换规则：点预设卡 → `activePreset=preset.id` + w1-w5 覆盖；拖任一滑块 → `activePreset='custom'`；保存 → 持久化两者。

### 实时预览
- view 用 `useCustomerStore().customers` 填客户下拉（已确认 store 暴露 `customers`）
- 选客户时调 `useSettingsStore().fetchWeightPreviewData(customerId)` 取 `{customerOrders, allCustomers, allOrders}`（store 只取数，不算权重；用修复后的 `where('customerId').equals().and(o=>!o.isArchived)` 查询）
- 调一次 `computeWeightFactors(...)` 缓存到 ref
- 拖滑块时 `weight = calculateWeightFromFactors(factors, currentConfig)` 作为 computed，无 DB 调用，实时更新
- 展示大数字权重 + 5 个因子得分分解条

### isArchived 修复
- `src/db/index.ts:125`：`db.orders.where('customerId').equals(customerId).and(o => !o.isArchived).toArray()`
- `src/stores/settings.ts:151`：`db.orders.where('currentStage').equals(id).and(o => !o.isArchived).count()`
- 用现有单字段索引 + `.and()` 过滤，无需加复合索引。**生产行为变化预期**：存储的 Customer.weight 会变化（多数从饱和的 100 降为真实值），下次阶段流转时自然重算。不做批量重算脚本。

## UI 结构（`src/views/Settings/WeightConfig.vue` 重写）

遵循项目 Glassmorphism + Fluid 约束（卡片 `rgba(255,255,255,0.08-0.12)` + `backdrop-filter: blur(20px)`，网格 `repeat(auto-fit, minmax(min(100%, 280px), 1fr))`，移动端单列堆叠）。单 `glass-card`，自上而下：

1. **Header**：标题 + 副标题 + 右侧"恢复默认"ghost 按钮（回到 balanced）
2. **预设卡片区**：`grid grid-cols-3 gap-3`（移动 1 列），复用 `theme-preset-card`/`theme-preset-active` 类 + Check 图标；每卡显示名称 + 权重摘要；`activePreset==='custom'` 时无卡片高亮，滑块区上方显示"自定义配置"badge
3. **双列 fluid-grid**（min 280px，移动堆叠）：
   - 左：5 滑块（label + 实时% + 描述）+ 总和大数字（=100 用 accent，≠100 用 danger）
   - 右：客户下拉 + 实时权重数字 + 5 因子分解条 + 公式展示 + 保存按钮（total≠100 禁用）+ 保存反馈

## 迁移步骤（每步后 `npx vitest run` 保持全绿）

| # | 动作 | 风险 |
|---|------|------|
| 1 | 修 isArchived bug（db/index.ts:125 + settings.ts:151），删"保留 bug"注释 | 低（无测试覆盖此路径） |
| 2 | 新建 `domain/config/weight-presets.ts` + `test/domain/weight-presets.test.ts` | 无（新隔离模块） |
| 3 | 重写 `domain/customer/weight-calculator.ts`（拆分函数+新公式+timeScore 归一化）+ 同步重写 `test/domain/weight-calculator.test.ts` 13 个黄金值 + 新增 factors 测试 | **最高**（黄金值大改，已手工演算验证） |
| 4 | `types/index.ts` WeightConfig 加 `activePreset`；`db/index.ts` 种子默认加 `activePreset:'balanced'`；`test/mocks/data-factory.ts` createMockWeightConfig 加字段；`test/domain/weight-config.test.ts` cfg() 辅助加字段 | 低（机械类型补充，validateWeightConfig 逻辑不变，5 测试仍绿） |
| 5 | `stores/settings.ts`：fetchWeightConfig 回填 activePreset；saveWeightConfig 持久化；新增 fetchWeightPreviewData | 低（无 store 测试） |
| 6 | 重写 `views/Settings/WeightConfig.vue`（预设卡+滑块+预览+操作） | UI 需手动 QA |
| 7 | 全量 `npx vitest run` + `npx vite build` + 浏览器手动 QA | — |

## 测试计划

### 重写 `src/test/domain/weight-calculator.test.ts`（13 个黄金值重算，已验证）
| 场景 | 旧值 | 新值 | 原因 |
|------|------|------|------|
| 空订单 | 100 | **10** | creditScore=50 → 0.20×50=10，不饱和 |
| 钳制到 0 | 0 | 0 | 不变 |
| 按时+高价 | 100 | **80** | 25+0.2+20+15+20=80.2→80 |
| 晚完成+低频 | 20 | **0** | 0.20×1=0.2→0（旧 20×1=20 是 bug） |
| 按时（actualAmount=0） | 100 | **20** | 0.2+20=20.2→20，仍 > 晚完成(0) |
| 无完成单 | 100 | **10** | creditScore=50 |
| allOrders 空 | 20 | **0** | 同晚完成 |
| allCustomers 空 | 100 | **20** | freqScore=100 → 0.20×100=20 |
| expectedTotal=0 | 20 | **0** | 同晚完成 |
| 无日期 | 20 | **0** | totalHours 兜底 1，income=0 |
| timeScore 上限 | 100 | **80** | 改为断言 computeWeightFactors.timeScore===100 + 最终 80 |
| 整数/确定性 | 通过 | 通过 | Math.round 保留 |

### 新增 factors 级测试
- `computeWeightFactors`：fulfillScore 超 100 时钳制；无完成单 creditScore=50；唯一最高收入者 timeScore=100；无完成单 timeScore=0
- `calculateWeightFromFactors`：全 0→0；全 100→100

### 新建 `src/test/domain/weight-presets.test.ts`
- 每个预设 w1-w5 和=100
- `findWeightPreset('balanced')` 返回正确；未知 id 返回 undefined
- `matchPreset({25,20,20,15,20})==='balanced'`；`matchPreset({1,1,1,1,96})==='custom'`

### 不变 `src/test/domain/weight-config.test.ts`
5 个校验测试不动（sum=100 契约不变），仅 `cfg()` 辅助加 `activePreset` 字段满足类型。

## 明确不做
- 不动其他设置子模块（Stage/Source/Category/CustomerType/Theme/Notification）
- 不重命名 w1–w5（兼容既有 DB 行）
- 不升级 Dexie schema 版本（activePreset 非索引）
- 不建 weightPresets DB 表（预设是代码常量）
- 不改 Order/Customer 类型
- 不动 `src/stores/order.ts`（calculateWeight 调用方，wrapper 签名不变）
- 不改 validateWeightConfig 错误消息/code
- 不改 DomainError
- 不加批量权重重算脚本（下次阶段流转自然重算）
- 不改 calculateWeight(customerOrders, config, allCustomers, allOrders) 签名
- 不在 store 里放权重计算逻辑（store 只取数）

## 验证
每步后：`npx vitest run`（当前 100 测试，重构后约 100+ 测试全绿）
完成时：
- `npx vite build` 通过（domain 层不引入新类型错误）
- 浏览器 QA：http://localhost:5173/#/settings → 权重配置
  - 切换 3 个预设卡片，滑块跟随变化
  - 拖滑块变"自定义"，预设卡无高亮
  - 选客户下拉，实时权重 + 5 因子分解随滑块实时变
  - 总和≠100 时保存禁用；=100 时保存成功，提示出现
  - 移动端单列堆叠正常

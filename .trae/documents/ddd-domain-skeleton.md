# DDD 领域层骨架搭建计划

## Context（为什么做这件事）

当前项目业务逻辑散落在三处：`src/db/index.ts`（`generateOrderNo`/`calculateWeight`）、`src/stores/order.ts`（状态机映射 `transitionStage`/`updatePaymentStatus`）、`src/stores/customer.ts`（删除校验）、`src/stores/settings.ts`（权重配置校验）。这些逻辑与 Dexie/IndexedDB 耦合，无法纯单测。

现有 [order-status-machine.test.ts](file:///d:/aiProject/HeTongJira/src/test/modules/order-status-machine.test.ts) 19 个测试只断言字符串常量（`expect('in_progress').toBe('in_progress')`），不测真实流转行为，是测试假象。

**目标**：建立 `src/domain/` 纯领域层，把已有业务逻辑提取为无 DB 依赖的纯函数，配真实行为单测。Stores 退化为应用服务，调领域函数 + 直接写 DB。**不改任何 .vue 文件、不改类型定义、不破坏 49 个既有测试**。

## 最终目录结构（骨架范围，8 个新文件）

```
src/domain/
  errors.ts                          # DomainError 类型化异常
  index.ts                           # barrel 导出
  repositories.ts                    # 前瞻性 Repository 接口（骨架期不实现）
  order/
    order-status.ts                  # 纯：stageId → OrderStatus 映射 + KANBAN_STATUSES
    payment-status.ts                # 纯：applyPaymentEvent(order, status, paidAmount, now) → PaymentResult
    order-number.ts                  # 纯：generateOrderNo(now?) —— 保留 Math.random 行为
  customer/
    weight-calculator.ts             # 纯：calculateWeight(customer, customerOrders, config, allCustomers, allOrders)
    customer-rules.ts                # 纯：assertCanDeleteCustomer(orderCount) —— 抛 DomainError
  config/
    weight-config.ts                 # 纯：validateWeightConfig(config) —— 抛 DomainError
```

修改的既有文件（4 个，仅替换函数体为委托调用，签名/导出不变）：
- [src/db/index.ts](file:///d:/aiProject/HeTongJira/src/db/index.ts) — `generateOrderNo`、`calculateWeight` 改为委托纯函数（保留 `isArchived: 0` bug 行为，加注释）
- [src/stores/order.ts](file:///d:/aiProject/HeTongJira/src/stores/order.ts) — `transitionStage` 用 `stageIdToOrderStatus`；`updatePaymentStatus` 用 `applyPaymentEvent`；`kanbanOrders` 用 `KANBAN_STATUSES`
- [src/stores/customer.ts](file:///d:/aiProject/HeTongJira/src/stores/customer.ts) — `deleteCustomer` 用 `assertCanDeleteCustomer`（错误消息字面量 `'该客户存在关联订单，无法删除'` 不变）
- [src/stores/settings.ts](file:///d:/aiProject/HeTongJira/src/stores/settings.ts) — `saveWeightConfig` 用 `validateWeightConfig`（错误消息 `'权重总和必须为 100%'` 不变）

## 关键纯函数签名与行为契约

### `domain/order/order-status.ts`
- `stageIdToOrderStatus(stageId: string): OrderStatus` —— 行为必须与 [stores/order.ts:79-83](file:///d:/aiProject/HeTongJira/src/stores/order.ts) 逐字一致：`st-pending`→`not_started`、`st-done`→`awaiting_final`、`st-void`→`voided`、其他→`in_progress`
- `KANBAN_STATUSES: ReadonlySet<OrderStatus>` —— 包含 `awaiting_deposit`/`not_started`/`in_progress`/`awaiting_final`（与 [stores/order.ts:17](file:///d:/aiProject/HeTongJira/src/stores/order.ts) 一致）

### `domain/order/payment-status.ts`
- `applyPaymentEvent(order, status, paidAmount, now): PaymentResult` —— 行为必须与 [stores/order.ts:114-124](file:///d:/aiProject/HeTongJira/src/stores/order.ts) 一致：`deposit_paid` 设 `depositActual = paidAmount ?? depositExpected` + `depositPaidAt = now` + `orderStatus = not_started`；`final_paid` 设 `finalActual`/`finalPaidAt`/`orderStatus = completed`；`unpaid`/`arrears`/`waived` 仅改 `paymentStatus`

### `domain/order/order-number.ts`
- `generateOrderNo(now: Date = new Date()): string` —— 格式 `HT + YYMMDD + 3位随机`，保留 `Math.random`（utils 测试依赖随机性，不能用真实序号替换）

### `domain/customer/weight-calculator.ts`
- `calculateWeight(customer, customerOrders, config, allCustomers, allOrders): number` —— 纯移植 [db/index.ts:120-166](file:///d:/aiProject/HeTongJira/src/db/index.ts)，返回 0-100 取整。5 因子：price(maxAmount/globalMax)、freq(orderCount/maxOrders)、time(min(income/hours/10,100))、fulfill(actualTotal/expectedTotal*100)、credit(按时完成率，无完成单时默认 50)。**保留 `isArchived` 过滤 bug** —— 纯函数不感知归档，由 wrapper 决定传哪些订单

### `domain/customer/customer-rules.ts` & `domain/config/weight-config.ts`
- `assertCanDeleteCustomer(orderCount)` / `validateWeightConfig(config)` —— 抛 `DomainError`，错误消息字面量严格匹配既有测试断言

### `domain/repositories.ts`
- 前瞻接口：`OrderRepository`、`CustomerRepository`、`ConfigRepository` —— **骨架期不实现**，stores 继续直接用 `db`。文件头注释明确标注"未实现，仅示意目标架构"

## 迁移步骤（每步独立提交，每步后跑 `npx vitest run` 必须保持 49 测试全绿）

| # | 动作 | 风险 | 必看测试 |
|---|------|------|---------|
| 1 | 建 `errors.ts` + `index.ts`（barrel 可空） | 无 | 49 全绿 |
| 2 | 建 `order/order-number.ts`（未被引用） | 无 | 49 全绿 |
| 3 | 改 `db/index.ts`：`generateOrderNo` 委托纯函数 | 中 | utils.test.ts 5个 + order-store 创建订单 |
| 4 | 建 `order/order-status.ts`（未被引用） | 无 | 49 全绿 |
| 5 | 改 `stores/order.ts`：`transitionStage` + `kanbanOrders` 用纯函数 | 中高 | order-store 3个阶段流转 + 1个看板过滤 |
| 6 | 建 `order/payment-status.ts`（未被引用） | 无 | 49 全绿 |
| 7 | 改 `stores/order.ts`：`updatePaymentStatus` 用 `applyPaymentEvent` | 中 | order-store 4个收款测试 |
| 8 | 建 `customer/customer-rules.ts`（未被引用） | 无 | 49 全绿 |
| 9 | 改 `stores/customer.ts`：`deleteCustomer` 用 `assertCanDeleteCustomer` | 低 | customer-store 删除测试（错误消息字面量） |
| 10 | 建 `config/weight-config.ts`（未被引用） | 无 | 49 全绿 |
| 11 | 改 `stores/settings.ts`：`saveWeightConfig` 用 `validateWeightConfig` | 低 | 无 settings 测试，纯函数单测覆盖 |
| 12 | 建 `customer/weight-calculator.ts`（未被引用） | 无 | 49 全绿 |
| 13 | 改 `db/index.ts`：`calculateWeight` 改为读 DB + 调纯函数的 wrapper | 低 | store 测试 mock 了 calculateWeight，不触达 wrapper |
| 14 | 建 `repositories.ts`（仅接口） | 无 | 49 全绿 + `npx vue-tsc -b` 通过 |
| 15 | 新增 `src/test/domain/` 6 个测试文件（~44 测试） | 无（纯新增） | 49 + 44 = ~93 全绿 |

## 新增测试计划（`src/test/domain/`，全部纯单测，无 mock 无 DB）

| 文件 | 测试数 | 覆盖 |
|------|--------|------|
| `order-status.test.ts` | ~6 | stageId→状态映射全分支 + KANBAN_STATUSES 成员 |
| `payment-status.test.ts` | ~8 | 定金/尾款 各带/不带 paidAmount + 欠款/免收/未付 仅改状态 + now 注入 |
| `order-number.test.ts` | ~5 | 注入固定日期验证格式 + 随机性 + 年份跨年 |
| `weight-calculator.test.ts` | ~12 | 空订单边界 + 各因子独立 + 0/100 钳制 + credit 默认 50 + 除零兜底 |
| `customer-rules.test.ts` | ~4 | orderCount=0 通过 / >0 抛 DomainError + 消息匹配 |
| `weight-config.test.ts` | ~5 | sum=100 通过 / 99/101/0 抛错 + 消息匹配 |
| `errors.test.ts` | ~4 | DomainError 是 Error 子类 + code/name/message |

新增约 **44 测试**，总计 ~93。

## 明确不做（骨架范围之外）

1. **不建** `src/infrastructure/` —— 不实现 Dexie Repository
2. **不改** `src/types/index.ts` —— 实体保持接口形式，不迁入 domain/，不改 class
3. **不引入** `Result<T>` —— 保持 `throw` 语义（测试用 `.rejects.toThrow`）
4. **不修** `isArchived: 0` bug（db/index.ts:124 + settings.ts:150）—— 保留行为，仅加注释，修复另开任务
5. **不替换** `generateOrderNo` 的 `Math.random` 为真实序号 —— utils 测试依赖随机性
6. **不删** 19 个弱 `order-status-machine.test.ts` —— 加 `// TODO` 注释，留待订单模块期替换
7. **不建** `fee-calculator.ts` —— 无既有逻辑可提取，属新功能，延后
8. **不建** payment/stage/followup/notification/attachment 聚合文件夹 —— 无逻辑可提取
9. **不改** `src/test/setup.ts`、`test-db.ts`、`pinia-helper.ts`、`data-factory.ts`
10. **不动** 任何 `.vue` 文件 —— 已 grep 确认视图无业务逻辑（仅 SourceConfig.vue 有显示分支）
11. **不改** `db/index.ts` 的 `db`/`generateId`/`initializeDb` 导出签名 —— store 测试 `vi.importActual<typeof import('@/db')>('@/db')` 依赖

## 已知问题（记录，不在骨架期修）

- `isArchived: 0` 查询 bug（boolean 字段对 0，生产可能返回空）—— 2 处
- `generateOrderNo` 用 `Math.random` 序号，高并发碰撞风险
- 无 settings store 集成测试
- `createTestDb`/`seedTestDatabase`/`createTestPinia` 是死代码
- `vite.config.ts` coverage 排除了 `src/db/**`，骨架后应调整让 domain 进覆盖率
- 19 个同义反复测试待订单模块期替换

## 验证方式

每步后：
```powershell
npx vitest run
```
必须保持原有 49 测试全绿；第 15 步后总数 ~93 全绿。

骨架完成时：
```powershell
npx vue-tsc -b
```
TypeScript 编译无错误（验证 repositories.ts 接口文件类型正确）。

最终交付时在 `docs/design/test-cases.md` 顶部"变更记录"追加一行，记录领域层骨架落地 + 新增 ~44 纯单测，但**不勾选任何验收用例 ⬜→✅**（验收用例按模块完成度勾选，骨架期不勾）。

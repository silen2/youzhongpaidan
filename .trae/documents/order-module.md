# 订单模块开发计划（Order Module）

## 需求确认（2026-07-31 与用户对齐）

- 范围：订单列表 + 新建/编辑表单 + 订单详情页（数据化）
- 列表形态：表格 + 状态筛选 + 搜索 + **排序** + **分页**（沿用 `computePageItems` 纯函数）
- 金额规则：选择来源自动带出手续费类型/费率；**实际到手 = 预计金额 − 手续费**（百分比：`报价×费率%`；固定：`报价−固定额`）
- 收款流程：沿用现有双状态机（收定金→未开始；阶段完成→待收尾款；收尾款→已完成；退单→作废）
- 排序规则（6 项，用户在列表页下拉选择）：
  1. `createdAt_desc` 创建时间最新优先（默认）
  2. `createdAt_asc` 创建时间最早优先
  3. `closedAt_desc` 结单时间最新优先（未结单排最后）
  4. `closedAt_asc` 结单时间最早优先（未结单排最后）
  5. `expectedEnd_asc` 预计交付最近优先（未设置排最后）
  6. `expectedAmount_desc` 预计金额从高到低

## DDD 领域层（纯函数，本次新增 2 个文件）

### `src/domain/order/fee-calculator.ts`
```ts
calcFee(quote: number, feeType: 'percentage' | 'fixed', feeValue: number): { feeAmount: number; actualAmount: number }
```
- percentage：`fee = quote × feeValue/100`
- fixed：`fee = feeValue`
- `actualAmount = max(0, quote − fee)`（手续费最多吃光报价，不出现负数）
- 防御：`quote ≤ 0` → 返回 `{ feeAmount: 0, actualAmount: 0 }`

### `src/domain/order/order-sort.ts`
```ts
type OrderSortKey = 'createdAt' | 'closedAt' | 'expectedEnd' | 'expectedAmount'
type OrderSortDirection = 'asc' | 'desc'
sortOrders(orders: Order[], key: OrderSortKey, direction: OrderSortDirection): Order[]
```
- `closedAt`：结单时间取 `finalPaidAt ?? actualEndDate`；**未结单（orderStatus !== 'completed'）恒排最后**（与方向无关）
- `expectedEnd`：无 `expectedEndDate` 排最后
- `createdAt` / `expectedAmount`：标准比较，稳定排序

## 数据流（与骨架期架构一致）

```
OrderList.vue ──store(orders)──┐
                               ├─► 组件内：筛选(kw/status) → sortOrders(排序) → computePageItems(分页) → 渲染
OrderFormModal.vue ─store.create/updateOrder──► DB(IndexedDB) ─► fetchOrders
OrderDetail.vue ─store.getOrder + stageTransitions + paymentRecords──► 展示
```

Store 不新增逻辑（已有 CRUD/transitionStage/updatePaymentStatus/archive），复用 settings 页的分页模式。

## UI 结构

- **OrderList.vue**：PageHeader(+新建按钮) → 工具栏（搜索框 + 状态筛选 select + 排序 select） → 表格（编号/名称/客户/来源/阶段/状态/预计金额/交付） → Pagination；行内操作：详情/归档/删除
- **OrderFormModal.vue**：新建/编辑复用。字段：名称/内容/客户/来源(带手续费)/来源链接/用途/紧急/预计金额/定金/尾款/预计开始/预计结束/备注；实际到手实时预览
- **OrderDetail.vue**：基本信息 + 金额财务（来源手续费明细、实收/应收）+ 状态流转时间线（stageTransitions）+ 收款操作（收定金/收尾款）

## 验证方式

- 每步后 `npx vitest run` 全绿（新增 fee-calculator/order-sort 单测）
- 完成时 `npx vue-tsc --noEmit` 无错误
- 交付时在 `docs/design/test-cases.md` 变更记录追加订单模块落地

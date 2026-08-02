/**
 * 客户价值矩阵（纯函数）：
 * 散点图「客户权重 vs 区间贡献」：
 * - x = 区间内实际收入（入账到手，与收入排行同口径）
 * - y = 客户权重（全局权重分 0-100）
 * - 气泡大小 = 区间内新建订单数
 * 只保留区间内有活动（收入 > 0 或新建订单 > 0）的客户，避免 0 点堆积。
 */
import { calcFee } from '@/domain/order/fee-calculator'
import { dateInRange, type StatsRange } from '@/domain/statistics/date-range'
import type { PaymentRecordLike, SourceLikeForStats } from '@/domain/statistics/income'

export interface CustomerValueLike {
  id: string
  name: string
  weight: number
}

export interface OrderValueLink {
  id: string
  customerId: string
  sourceId?: string
  createdAt: string
}

export interface CustomerValuePoint {
  customerId: string
  customerName: string
  /** 区间内实际收入（到手） */
  contribution: number
  /** 全局客户权重 0-100 */
  weight: number
  /** 区间内新建订单数 */
  orderCount: number
}

/**
 * 客户价值矩阵数据点。
 * @param customers 客户（含权重）
 * @param records 账单记录
 * @param orders 订单（含 customerId / sourceId / createdAt）
 * @param sourceOf 来源查询
 * @param range 时间范围
 */
export function aggregateCustomerValue(
  customers: CustomerValueLike[],
  records: PaymentRecordLike[],
  orders: OrderValueLink[],
  sourceOf: (sourceId: string | undefined) => SourceLikeForStats | null | undefined,
  range: StatsRange,
): CustomerValuePoint[] {
  const orderMap = new Map(orders.map(o => [o.id, o]))
  const reversedIds = new Set(
    records.filter(r => r.direction === 'out' && r.refundOf).map(r => r.refundOf as string),
  )

  const incomeMap = new Map<string, number>()
  const countMap = new Map<string, number>()

  for (const o of orders) {
    if (dateInRange(o.createdAt, range)) {
      countMap.set(o.customerId, (countMap.get(o.customerId) ?? 0) + 1)
    }
  }

  for (const r of records) {
    if (r.direction !== 'in') continue
    if (!dateInRange(r.receivedAt, range)) continue
    if (r.id && reversedIds.has(r.id)) continue
    const order = orderMap.get(r.orderId)
    if (!order) continue
    const source = order.sourceId ? sourceOf(order.sourceId) : null
    const income = calcFee(isFinite(r.amount) ? r.amount : 0, source).actualAmount
    incomeMap.set(order.customerId, (incomeMap.get(order.customerId) ?? 0) + income)
  }

  return customers
    .map(c => ({
      customerId: c.id,
      customerName: c.name,
      contribution: round2(incomeMap.get(c.id) ?? 0),
      weight: c.weight,
      orderCount: countMap.get(c.id) ?? 0,
    }))
    .filter(p => p.contribution > 0 || p.orderCount > 0)
    .sort((a, b) => b.contribution - a.contribution)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

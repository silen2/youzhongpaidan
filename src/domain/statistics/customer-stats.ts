/**
 * 客户分析（纯函数）：
 * - 客户收入排行 = 区间内各客户入账到手金额排行（按实际收入，与时间筛选联动）
 * - 平台构成 = 区间内客户收入按客户平台分组（无平台归「其他」）
 */
import { calcFee } from '@/domain/order/fee-calculator'
import { dateInRange, type StatsRange } from '@/domain/statistics/date-range'
import type { PaymentRecordLike, SourceLikeForStats } from '@/domain/statistics/income'

export interface CustomerLikeForStats {
  id: string
  name: string
  platform?: string
}

export interface OrderCustomerLink {
  id: string
  customerId: string
  sourceId?: string
}

function reversedInIds(records: PaymentRecordLike[]): Set<string> {
  return new Set(records.filter(r => r.direction === 'out' && r.refundOf).map(r => r.refundOf as string))
}

export interface CustomerIncomeRank {
  customerId: string
  customerName: string
  income: number
}

/**
 * 客户收入排行（TOP N）。
 * @param records 账单记录（需已含区间外记录以识别红冲，或调用方保证传入全量）
 * @param orders 订单（含 customerId / sourceId 关联）
 * @param customers 客户
 * @param sourceOf 来源查询
 * @param range 时间范围
 * @param topN 返回条数（默认 10）
 */
export function aggregateCustomerIncome(
  records: PaymentRecordLike[],
  orders: OrderCustomerLink[],
  customers: CustomerLikeForStats[],
  sourceOf: (sourceId: string | undefined) => SourceLikeForStats | null | undefined,
  range: StatsRange,
  topN = 10,
): CustomerIncomeRank[] {
  const orderMap = new Map(orders.map(o => [o.id, o]))
  const customerMap = new Map(customers.map(c => [c.id, c]))
  const reversedIds = reversedInIds(records)
  const map = new Map<string, number>()

  for (const r of records) {
    if (r.direction !== 'in') continue
    if (!dateInRange(r.receivedAt, range)) continue
    if (r.id && reversedIds.has(r.id)) continue
    const order = orderMap.get(r.orderId)
    if (!order) continue
    const source = order.sourceId ? sourceOf(order.sourceId) : null
    const income = calcFee(isFinite(r.amount) ? r.amount : 0, source).actualAmount
    const customerId = order.customerId || 'unknown'
    map.set(customerId, (map.get(customerId) ?? 0) + income)
  }

  return [...map.entries()]
    .map(([customerId, income]) => ({
      customerId,
      customerName: customerMap.get(customerId)?.name ?? '未知客户',
      income: round2(income),
    }))
    .sort((a, b) => b.income - a.income)
    .slice(0, topN)
}

export interface PlatformIncome {
  platform: string
  income: number
}

/** 平台构成：区间内客户收入按平台分组（无平台/未知客户归「其他」） */
export function aggregateIncomeByPlatform(
  records: PaymentRecordLike[],
  orders: OrderCustomerLink[],
  customers: CustomerLikeForStats[],
  sourceOf: (sourceId: string | undefined) => SourceLikeForStats | null | undefined,
  range: StatsRange,
): PlatformIncome[] {
  const orderMap = new Map(orders.map(o => [o.id, o]))
  const customerMap = new Map(customers.map(c => [c.id, c]))
  const reversedIds = reversedInIds(records)
  const map = new Map<string, number>()

  for (const r of records) {
    if (r.direction !== 'in') continue
    if (!dateInRange(r.receivedAt, range)) continue
    if (r.id && reversedIds.has(r.id)) continue
    const order = orderMap.get(r.orderId)
    if (!order) continue
    const source = order.sourceId ? sourceOf(order.sourceId) : null
    const income = calcFee(isFinite(r.amount) ? r.amount : 0, source).actualAmount
    const customer = customerMap.get(order.customerId)
    const platform = customer?.platform?.trim() || '其他'
    map.set(platform, (map.get(platform) ?? 0) + income)
  }

  return [...map.entries()]
    .map(([platform, income]) => ({ platform, income: round2(income) }))
    .sort((a, b) => b.income - a.income)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

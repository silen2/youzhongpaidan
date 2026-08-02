/**
 * 收入聚合（纯函数，实收到手口径——与账单页统计一致）：
 * - 收入 = 入账金额 − 来源手续费（实际到手）
 * - 被红冲的入账（存在出账记录 refundOf 指向它）不计收入
 * - 红冲出账（refundOf 有值）是冲销标记，不计退款；手动退款出账计入退款
 * 时间归属：按账单 receivedAt 的日期部分是否落在范围内。
 */
import { calcFee } from '@/domain/order/fee-calculator'
import { dateInRange, type StatsRange, type StatsBucket } from '@/domain/statistics/date-range'

export interface PaymentRecordLike {
  id?: string
  orderId: string
  type?: string
  direction?: string
  refundOf?: string
  amount: number
  receivedAt: string
}

export interface OrderLikeForStats {
  id: string
  sourceId?: string
}

export interface SourceLikeForStats {
  feeType: 'percentage' | 'fixed'
  feeValue: number
}

export type SourceOf = (sourceId: string | undefined) => SourceLikeForStats | null | undefined

/** 有效入账记录：排除出账与被红冲的入账 */
export function activeInRecords(records: PaymentRecordLike[]): PaymentRecordLike[] {
  const reversedIds = new Set(records.filter(r => r.direction === 'out' && r.refundOf).map(r => r.refundOf as string))
  return records.filter(r => r.direction !== 'out' && !(r.id && reversedIds.has(r.id)))
}

function sourceOfOrder(orderMap: Map<string, OrderLikeForStats>, sourceOf: SourceOf, orderId: string) {
  const order = orderMap.get(orderId)
  return order ? sourceOf(order.sourceId) : null
}

export interface IncomeStats {
  /** 区间内入账到手合计 */
  totalIncome: number
  /** 区间内手动退款出账合计（红冲不计） */
  totalRefunded: number
  /** 净收入 = 入账到手 − 退款 */
  netIncome: number
}

export function computeIncomeStats(
  records: PaymentRecordLike[],
  orders: OrderLikeForStats[],
  sourceOf: SourceOf,
  range: StatsRange,
): IncomeStats {
  const orderMap = new Map(orders.map(o => [o.id, o]))
  let totalIncome = 0
  let totalRefunded = 0

  for (const r of records) {
    if (!dateInRange(r.receivedAt, range)) continue
    const amount = isFinite(r.amount) ? r.amount : 0
    if (r.direction === 'out') {
      if (r.refundOf) continue // 红冲是冲销，不计退款
      totalRefunded += amount
    } else {
      if (r.id && reversedInIds(records).has(r.id)) continue // 被红冲入账不计收入
      const source = sourceOfOrder(orderMap, sourceOf, r.orderId)
      totalIncome += amount - calcFee(amount, source).feeAmount
    }
  }

  return {
    totalIncome: round2(totalIncome),
    totalRefunded: round2(totalRefunded),
    netIncome: round2(totalIncome - totalRefunded),
  }
}

/** 已被红冲的入账 id 集合 */
function reversedInIds(records: PaymentRecordLike[]): Set<string> {
  return new Set(records.filter(r => r.direction === 'out' && r.refundOf).map(r => r.refundOf as string))
}

export interface IncomeTrendPoint {
  label: string
  income: number
  refund: number
  net: number
}

/** 收入趋势：按时间桶聚合入账到手 / 退款 / 净收入 */
export function aggregateIncomeTrend(
  records: PaymentRecordLike[],
  orders: OrderLikeForStats[],
  sourceOf: SourceOf,
  buckets: StatsBucket[],
): IncomeTrendPoint[] {
  const orderMap = new Map(orders.map(o => [o.id, o]))
  const reversedIds = reversedInIds(records)

  return buckets.map(bucket => {
    let income = 0
    let refund = 0
    for (const r of records) {
      const d = r.receivedAt?.slice(0, 10) ?? ''
      if (d < bucket.start || d > bucket.end) continue
      const amount = isFinite(r.amount) ? r.amount : 0
      if (r.direction === 'out') {
        if (r.refundOf) continue
        refund += amount
      } else {
        if (r.id && reversedIds.has(r.id)) continue
        const source = sourceOfOrder(orderMap, sourceOf, r.orderId)
        income += amount - calcFee(amount, source).feeAmount
      }
    }
    return {
      label: bucket.label,
      income: round2(income),
      refund: round2(refund),
      net: round2(income - refund),
    }
  })
}

export interface SourceIncome {
  sourceId: string
  sourceName: string
  income: number
  fee: number
}

/** 来源构成：区间内各接单来源的入账到手与手续费 */
export function aggregateIncomeBySource(
  records: PaymentRecordLike[],
  orders: OrderLikeForStats[],
  sourceOf: SourceOf,
  range: StatsRange,
): SourceIncome[] {
  const orderMap = new Map(orders.map(o => [o.id, o]))
  const reversedIds = reversedInIds(records)
  const map = new Map<string, { income: number; fee: number }>()

  for (const r of records) {
    if (r.direction !== 'in') continue
    if (!dateInRange(r.receivedAt, range)) continue
    if (r.id && reversedIds.has(r.id)) continue
    const order = orderMap.get(r.orderId)
    const source = sourceOfOrder(orderMap, sourceOf, r.orderId)
    const fee = calcFee(isFinite(r.amount) ? r.amount : 0, source)
    const sourceId = order?.sourceId ?? 'unknown'
    const entry = map.get(sourceId) ?? { income: 0, fee: 0 }
    entry.income += fee.actualAmount
    entry.fee += fee.feeAmount
    map.set(sourceId, entry)
  }

  return [...map.entries()]
    .map(([sourceId, v]) => ({
      sourceId,
      sourceName: sourceId,
      income: round2(v.income),
      fee: round2(v.fee),
    }))
    .sort((a, b) => b.income - a.income)
}

export interface TypeIncome {
  type: string
  label: string
  income: number
}

/** 收款类型构成：区间内定金 / 尾款入账到手（出账不参与） */
export function aggregateIncomeByType(
  records: PaymentRecordLike[],
  orders: OrderLikeForStats[],
  sourceOf: SourceOf,
  range: StatsRange,
): TypeIncome[] {
  const orderMap = new Map(orders.map(o => [o.id, o]))
  const reversedIds = reversedInIds(records)
  const deposits = { type: 'deposit', label: '定金', income: 0 }
  const finals = { type: 'final', label: '尾款', income: 0 }

  for (const r of records) {
    if (r.direction !== 'in') continue
    if (!dateInRange(r.receivedAt, range)) continue
    if (r.id && reversedIds.has(r.id)) continue
    const source = sourceOfOrder(orderMap, sourceOf, r.orderId)
    const income = calcFee(isFinite(r.amount) ? r.amount : 0, source).actualAmount
    if (r.type === 'deposit') deposits.income += income
    else if (r.type === 'final') finals.income += income
  }

  return [deposits, finals].map(t => ({ ...t, income: round2(t.income) }))
}

export interface IncomeTrendByTypePoint {
  label: string
  /** 定金入账到手 */
  deposit: number
  /** 尾款入账到手 */
  final: number
  /** 净收入 = 定金 + 尾款 − 退款 */
  net: number
}

/**
 * 收入趋势（按收款类型）：每个时间桶的定金/尾款到手收入（堆积柱）+ 净收入（折线）。
 * 口径与收入趋势一致：入账扣手续费、被红冲入账不计；退款按桶计入净收入扣减。
 */
export function aggregateIncomeTrendByType(
  records: PaymentRecordLike[],
  orders: OrderLikeForStats[],
  sourceOf: SourceOf,
  buckets: StatsBucket[],
): IncomeTrendByTypePoint[] {
  const orderMap = new Map(orders.map(o => [o.id, o]))
  const reversedIds = reversedInIds(records)

  return buckets.map(bucket => {
    let deposit = 0
    let final = 0
    let refund = 0
    for (const r of records) {
      const d = r.receivedAt?.slice(0, 10) ?? ''
      if (d < bucket.start || d > bucket.end) continue
      const amount = isFinite(r.amount) ? r.amount : 0
      if (r.direction === 'out') {
        if (r.refundOf) continue
        refund += amount
      } else {
        if (r.id && reversedIds.has(r.id)) continue
        const source = sourceOfOrder(orderMap, sourceOf, r.orderId)
        const net = calcFee(amount, source).actualAmount
        if (r.type === 'deposit') deposit += net
        else if (r.type === 'final') final += net
        else deposit += net // 无类型入账归入定金侧（兼容旧数据）
      }
    }
    const total = deposit + final
    return {
      label: bucket.label,
      deposit: round2(deposit),
      final: round2(final),
      net: round2(total - refund),
    }
  })
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * 支付分析聚合（纯函数）：
 * - 收付类型构成：区间内定金/尾款入账（到手）+ 手动退款出账
 *   （口径与收入统计一致：入账扣手续费、被红冲入账不计；退款为手动出账，红冲是冲销不计）
 * - 收款状态构成：全部订单当前收款状态分布（快照，不受时间范围影响）
 * - 待收账款排行：按客户聚合「正常待收」金额（排除已结单/已退单/免收，欠款仍属待收）
 */
import { calcFee } from '@/domain/order/fee-calculator'
import { dateInRange, type StatsRange } from '@/domain/statistics/date-range'
import type { PaymentRecordLike, OrderLikeForStats, SourceLikeForStats } from '@/domain/statistics/income'

export type SourceOf = (sourceId: string | undefined) => SourceLikeForStats | null | undefined

/** 已被红冲的入账 id 集合（红冲记录 refundOf 指向它们） */
function reversedInIds(records: PaymentRecordLike[]): Set<string> {
  return new Set(records.filter(r => r.direction === 'out' && r.refundOf).map(r => r.refundOf as string))
}

export interface PaymentTypeDistItem {
  /** deposit 定金入账 / final 尾款入账 / refund 手动退款出账 */
  type: 'deposit' | 'final' | 'refund'
  value: number
}

/**
 * 收付类型构成：区间内发生额。
 * - deposit：type='deposit' 的有效入账到手合计
 * - final：type='final' 的有效入账到手合计
 * - refund：手动退款出账合计（红冲是冲销不计）
 */
export function aggregatePaymentTypeDist(
  records: PaymentRecordLike[],
  orders: OrderLikeForStats[],
  sourceOf: SourceOf,
  range: StatsRange,
): PaymentTypeDistItem[] {
  const orderMap = new Map(orders.map(o => [o.id, o]))
  const reversedIds = reversedInIds(records)
  const deposit = { type: 'deposit' as const, value: 0 }
  const final = { type: 'final' as const, value: 0 }
  const refund = { type: 'refund' as const, value: 0 }

  for (const r of records) {
    if (!dateInRange(r.receivedAt, range)) continue
    const amount = isFinite(r.amount) ? r.amount : 0
    if (r.direction === 'out') {
      if (r.refundOf) continue // 红冲是冲销，不计退款
      refund.value += amount
      continue
    }
    if (r.id && reversedIds.has(r.id)) continue // 被红冲入账不计
    const order = orderMap.get(r.orderId)
    const source = order ? sourceOf(order.sourceId) : null
    const net = calcFee(amount, source).actualAmount
    if (r.type === 'final') final.value += net
    else deposit.value += net // 无类型入账归入定金侧（兼容旧数据）
  }

  return [deposit, final, refund].map(i => ({ type: i.type, value: round2(i.value) }))
}

export interface PaymentStatusDistItem {
  status: string
  count: number
}

/**
 * 收款状态构成：全部订单当前收款状态分布（快照，不受时间范围影响）。
 * 含已结清（final_paid）与已退单（voided 的收款历史保留），反映整体收款健康度。
 * @param orders 订单（仅需 paymentStatus；缺省视为 unpaid）
 */
export function aggregatePaymentStatusDist(orders: { paymentStatus?: string }[]): PaymentStatusDistItem[] {
  const order: string[] = ['unpaid', 'deposit_paid', 'final_paid', 'arrears', 'waived']
  return order
    .map(status => ({
      status,
      count: orders.filter(o => (o.paymentStatus ?? 'unpaid') === status).length,
    }))
    .filter(x => x.count > 0)
}

export interface OrderLikeForPending {
  id: string
  customerId?: string
  sourceId?: string
  orderStatus?: string
  paymentStatus?: string
  expectedAmount: number
  depositActual: number
  finalActual: number
}

export interface PendingCustomerRow {
  customerId: string
  customerName: string
  /** 待收金额（剩余应收到手合计） */
  amount: number
  /** 待收订单数 */
  orderCount: number
}

/**
 * 待收账款排行：按客户聚合「正常待收」金额。
 * 待收订单 = 非 completed / 非 voided / 非 waived（欠款 arrears 仍属待收，未收到钱）；
 * 剩余应收 = max(0, expectedAmount − 已收定金 − 已收尾款)，扣手续费为到手金额。
 * 结果按待收金额降序（调用方可截断 TOP N）。
 */
export function aggregatePendingByCustomer(
  orders: OrderLikeForPending[],
  customers: { id: string; name: string }[],
  sourceOf: SourceOf,
): PendingCustomerRow[] {
  const customerMap = new Map(customers.map(c => [c.id, c.name]))
  const map = new Map<string, { amount: number; orderCount: number }>()

  for (const o of orders) {
    if (o.orderStatus === 'completed' || o.orderStatus === 'voided') continue
    if (o.paymentStatus === 'waived') continue
    const remaining = Math.max(
      0,
      (isFinite(o.expectedAmount) ? o.expectedAmount : 0) -
        (isFinite(o.depositActual) ? o.depositActual : 0) -
        (isFinite(o.finalActual) ? o.finalActual : 0),
    )
    if (remaining <= 0) continue
    const source = sourceOf(o.sourceId)
    const entry = map.get(o.customerId ?? 'unknown') ?? { amount: 0, orderCount: 0 }
    entry.amount += calcFee(remaining, source).actualAmount
    entry.orderCount++
    map.set(o.customerId ?? 'unknown', entry)
  }

  return [...map.entries()]
    .map(([customerId, v]) => ({
      customerId,
      customerName: customerMap.get(customerId) ?? '未知客户',
      amount: round2(v.amount),
      orderCount: v.orderCount,
    }))
    .sort((a, b) => b.amount - a.amount)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

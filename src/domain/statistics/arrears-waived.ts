/**
 * 账款异常统计（纯函数）：
 * 按订单最终状态（paymentStatus）统计区间内（按订单创建时间）的欠款/免单：
 * - 欠款订单：paymentStatus === 'arrears'，欠款金额 = 应收 − 已收定金 − 已收尾款（到手前的账面应收）
 * - 免单订单：paymentStatus === 'waived'，金额按订单原价（expectedAmount）
 * 客户维度：按 customerId 聚合欠款/免单客户详情。
 */
import { dateInRange, type StatsRange } from '@/domain/statistics/date-range'

export interface OrderLikeForDebt {
  id: string
  orderNo?: string
  name: string
  customerId?: string
  expectedAmount: number
  depositActual: number
  finalActual: number
  paymentStatus?: string
  createdAt: string
  expectedEndDate?: string
}

export interface CustomerLikeForDebt {
  id: string
  name: string
}

export interface ArrearsWaivedSummary {
  /** 欠款客户数 */
  arrearsCustomerCount: number
  /** 欠款订单数 */
  arrearsOrderCount: number
  /** 欠款总额 */
  arrearsTotal: number
  /** 免单客户数 */
  waivedCustomerCount: number
  /** 免单订单数 */
  waivedOrderCount: number
  /** 免单金额（订单原价合计） */
  waivedTotal: number
}

export interface DebtOrderItem {
  orderId: string
  orderNo: string
  orderName: string
  customerId?: string
  customerName?: string
  /** 欠款金额（免单为订单原价） */
  amount: number
  createdAt: string
  expectedEndDate?: string
}

export interface CustomerDebtRow {
  customerId: string
  customerName: string
  /** 欠款/免单单数 */
  count: number
  /** 欠款/免单金额合计 */
  amount: number
}

export interface ArrearsWaivedResult {
  summary: ArrearsWaivedSummary
  /** 欠款订单明细（按创建时间倒序） */
  arrearsOrders: DebtOrderItem[]
  /** 免单订单明细（按创建时间倒序） */
  waivedOrders: DebtOrderItem[]
  /** 客户欠款汇总（按金额倒序） */
  arrearsCustomers: CustomerDebtRow[]
  /** 客户免单汇总（按金额倒序） */
  waivedCustomers: CustomerDebtRow[]
}

/**
 * 计算欠款/免单统计。
 * @param orders 订单（需含 paymentStatus 与金额字段；按 createdAt 是否在区间内过滤）
 * @param customers 客户（关联客户名）
 * @param range 时间范围
 */
export function computeArrearsWaived(
  orders: OrderLikeForDebt[],
  customers: CustomerLikeForDebt[],
  range: StatsRange,
): ArrearsWaivedResult {
  const customerMap = new Map(customers.map(c => [c.id, c.name]))
  const arrearsOrders: DebtOrderItem[] = []
  const waivedOrders: DebtOrderItem[] = []

  for (const o of orders) {
    if (!dateInRange(o.createdAt, range)) continue
    const customerName = o.customerId ? customerMap.get(o.customerId) : undefined
    if (o.paymentStatus === 'arrears') {
      const amount = Math.max(
        0,
        (isFinite(o.expectedAmount) ? o.expectedAmount : 0) -
          (isFinite(o.depositActual) ? o.depositActual : 0) -
          (isFinite(o.finalActual) ? o.finalActual : 0),
      )
      if (amount <= 0) continue
      arrearsOrders.push({
        orderId: o.id,
        orderNo: o.orderNo ?? '',
        orderName: o.name,
        customerId: o.customerId,
        customerName,
        amount: round2(amount),
        createdAt: o.createdAt,
        expectedEndDate: o.expectedEndDate,
      })
    } else if (o.paymentStatus === 'waived') {
      const amount = Math.max(0, isFinite(o.expectedAmount) ? o.expectedAmount : 0)
      if (amount <= 0) continue
      waivedOrders.push({
        orderId: o.id,
        orderNo: o.orderNo ?? '',
        orderName: o.name,
        customerId: o.customerId,
        customerName,
        amount: round2(amount),
        createdAt: o.createdAt,
        expectedEndDate: o.expectedEndDate,
      })
    }
  }

  const sortByTimeDesc = (a: DebtOrderItem, b: DebtOrderItem) => b.createdAt.localeCompare(a.createdAt)
  arrearsOrders.sort(sortByTimeDesc)
  waivedOrders.sort(sortByTimeDesc)

  const aggregateCustomers = (items: DebtOrderItem[]): CustomerDebtRow[] => {
    const map = new Map<string, { customerName: string; count: number; amount: number }>()
    for (const item of items) {
      const key = item.customerId ?? 'unknown'
      const entry = map.get(key) ?? { customerName: item.customerName ?? '未知客户', count: 0, amount: 0 }
      entry.count++
      entry.amount = round2(entry.amount + item.amount)
      map.set(key, entry)
    }
    return [...map.entries()]
      .map(([customerId, v]) => ({ customerId, customerName: v.customerName, count: v.count, amount: v.amount }))
      .sort((a, b) => b.amount - a.amount)
  }

  const arrearsCustomers = aggregateCustomers(arrearsOrders)
  const waivedCustomers = aggregateCustomers(waivedOrders)

  const summary: ArrearsWaivedSummary = {
    arrearsCustomerCount: arrearsCustomers.length,
    arrearsOrderCount: arrearsOrders.length,
    arrearsTotal: round2(arrearsOrders.reduce((s, i) => s + i.amount, 0)),
    waivedCustomerCount: waivedCustomers.length,
    waivedOrderCount: waivedOrders.length,
    waivedTotal: round2(waivedOrders.reduce((s, i) => s + i.amount, 0)),
  }

  return { summary, arrearsOrders, waivedOrders, arrearsCustomers, waivedCustomers }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

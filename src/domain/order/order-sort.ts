import type { Order, OrderStatus } from '@/types'

/**
 * 订单排序（纯函数）
 *
 * 排序键与方向：
 * - createdAt      创建时间（ISO 字符串可直接比较）
 * - closedAt       结单时间：取 finalPaidAt ?? actualEndDate；未结单（orderStatus !== 'completed'）恒排最后
 * - expectedEnd    预计交付：按 expectedEndDate；无值排最后
 * - expectedAmount 预计金额：数值
 * - actualAmount   实付金额：数值
 * - orderNo        订单编号：字符串
 * - name           订单名称：字符串
 * - orderStatus    订单状态：按工作流顺序（未排期 → … → 已完成 → 已退单）
 *
 * 排序稳定（现代引擎 Array.prototype.sort 稳定），相等项保持原顺序。
 */

export type OrderSortKey =
  | 'createdAt'
  | 'closedAt'
  | 'expectedEnd'
  | 'expectedAmount'
  | 'actualAmount'
  | 'orderNo'
  | 'name'
  | 'orderStatus'
export type OrderSortDirection = 'asc' | 'desc'

/** 订单状态工作流顺序（排序用，数值越小越靠前） */
const ORDER_STATUS_RANK: Record<OrderStatus, number> = {
  unscheduled: 0,
  awaiting_deposit: 1,
  not_started: 2,
  in_progress: 3,
  awaiting_final: 4,
  completed: 5,
  voided: 6,
}

/** 结单时间取值：已结单订单的 finalPaidAt ?? actualEndDate；未结单返回 null */
function closedAtOf(order: Order): string | null {
  if (order.orderStatus !== 'completed') return null
  return order.finalPaidAt ?? order.actualEndDate ?? null
}

export function compareOrders(
  a: Order,
  b: Order,
  key: OrderSortKey,
  direction: OrderSortDirection,
): number {
  const factor = direction === 'asc' ? 1 : -1

  if (key === 'closedAt') {
    const av = closedAtOf(a)
    const bv = closedAtOf(b)
    // 未结单（null）恒排最后：asc 时 null 应大于一切，desc 时 null 也应大于一切
    if (av === null && bv === null) return 0
    if (av === null) return 1
    if (bv === null) return -1
    return av < bv ? -factor : av > bv ? factor : 0
  }

  if (key === 'expectedEnd') {
    const av = a.expectedEndDate || null
    const bv = b.expectedEndDate || null
    if (av === null && bv === null) return 0
    if (av === null) return 1
    if (bv === null) return -1
    return av < bv ? -factor : av > bv ? factor : 0
  }

  if (key === 'expectedAmount') {
    return (a.expectedAmount - b.expectedAmount) * factor
  }

  if (key === 'actualAmount') {
    return (a.actualAmount - b.actualAmount) * factor
  }

  if (key === 'orderStatus') {
    return (ORDER_STATUS_RANK[a.orderStatus] - ORDER_STATUS_RANK[b.orderStatus]) * factor
  }

  if (key === 'orderNo') {
    return a.orderNo < b.orderNo ? -factor : a.orderNo > b.orderNo ? factor : 0
  }

  if (key === 'name') {
    return a.name < b.name ? -factor : a.name > b.name ? factor : 0
  }

  // createdAt
  return a.createdAt < b.createdAt ? -factor : a.createdAt > b.createdAt ? factor : 0
}

export function sortOrders(
  orders: Order[],
  key: OrderSortKey,
  direction: OrderSortDirection,
): Order[] {
  return [...orders].sort((a, b) => compareOrders(a, b, key, direction))
}

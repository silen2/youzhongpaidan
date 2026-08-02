import type { Customer } from '@/types'

/**
 * 客户排序（纯函数）
 *
 * 排序键与方向：
 * - weight           权重分（合作价值）
 * - totalSpent       累计消费额
 * - maxOrderAmount   最高单笔金额
 * - orderCount       订单数
 * - completedCount   已完成订单数
 * - waivedCount      免单数
 * - arrearsCount     欠款数（负债）
 * - latePaymentCount 未及时付尾款数（逾期）
 * - createdAt        创建时间（ISO 字符串可直接比较）
 *
 * 排序稳定（现代引擎 Array.prototype.sort 稳定），相等项保持原顺序。
 */

export type CustomerSortKey =
  | 'weight'
  | 'totalSpent'
  | 'maxOrderAmount'
  | 'orderCount'
  | 'completedCount'
  | 'waivedCount'
  | 'arrearsCount'
  | 'latePaymentCount'
  | 'createdAt'
export type CustomerSortDirection = 'asc' | 'desc'

export function compareCustomers(
  a: Customer,
  b: Customer,
  key: CustomerSortKey,
  direction: CustomerSortDirection,
): number {
  const factor = direction === 'asc' ? 1 : -1

  if (key === 'createdAt') {
    return a.createdAt < b.createdAt ? -factor : a.createdAt > b.createdAt ? factor : 0
  }

  // 数值键：weight / totalSpent / maxOrderAmount / orderCount / completedCount / waivedCount / arrearsCount / latePaymentCount
  return (a[key] - b[key]) * factor
}

export function sortCustomers(
  customers: Customer[],
  key: CustomerSortKey,
  direction: CustomerSortDirection,
): Customer[] {
  return [...customers].sort((a, b) => compareCustomers(a, b, key, direction))
}

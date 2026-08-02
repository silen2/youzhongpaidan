/**
 * 客户统计字段计算（纯函数，需求文档 2.2.1 统计字段）。
 * 输入为某客户的订单数组（全量历史订单，含已完成/退单），输出全部统计字段。
 *
 * 口径（与订单双维度状态机一致）：
 * - totalSpent：非退单订单的「实际到账」总和（实收口径）
 * - maxOrderAmount：非退单订单的「预计金额」最大值
 * - orderCount：非退单订单数
 * - completedCount：已完成订单数
 * - voidedCount：已退单订单数
 * - waivedCount：免收（paymentStatus = 'waived'）订单数
 * - arrearsCount：欠款（paymentStatus = 'arrears'）订单数
 * - latePaymentCount：尾款迟付次数（已完成且尾款到账日晚于预计交付日）
 */

export interface OrderLike {
  orderStatus: string
  paymentStatus: string
  expectedAmount: number
  actualAmount: number
  expectedEndDate?: string
  finalPaidAt?: string
}

export interface CustomerStats {
  totalSpent: number
  maxOrderAmount: number
  orderCount: number
  completedCount: number
  voidedCount: number
  waivedCount: number
  arrearsCount: number
  latePaymentCount: number
}

export function computeCustomerStats(orders: OrderLike[]): CustomerStats {
  let totalSpent = 0
  let maxOrderAmount = 0
  let orderCount = 0
  let completedCount = 0
  let voidedCount = 0
  let waivedCount = 0
  let arrearsCount = 0
  let latePaymentCount = 0

  for (const o of orders) {
    const isVoided = o.orderStatus === 'voided'
    if (isVoided) {
      voidedCount++
      continue
    }

    // 正常/进行中订单：消费额与订单数
    totalSpent += isFinite(o.actualAmount) ? o.actualAmount : 0
    maxOrderAmount = Math.max(maxOrderAmount, isFinite(o.expectedAmount) ? o.expectedAmount : 0)
    orderCount++

    if (o.orderStatus === 'completed') {
      completedCount++
      // 尾款迟付：已完成且尾款到账日晚于预计交付日
      if (o.finalPaidAt && o.expectedEndDate && o.finalPaidAt.slice(0, 10) > o.expectedEndDate.slice(0, 10)) {
        latePaymentCount++
      }
    }

    if (o.paymentStatus === 'waived') waivedCount++
    if (o.paymentStatus === 'arrears') arrearsCount++
  }

  return {
    totalSpent: round2(totalSpent),
    maxOrderAmount: round2(maxOrderAmount),
    orderCount,
    completedCount,
    voidedCount,
    waivedCount,
    arrearsCount,
    latePaymentCount,
  }
}

/** 金额保留两位小数（浮点累加误差收敛） */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

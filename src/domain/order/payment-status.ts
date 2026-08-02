import type { Order, OrderStatus, PaymentStatus } from '@/types'

/**
 * 收款事件对订单产生的字段补丁（纯数据，不含 updatedAt 等持久化字段）
 *
 * 调用方（store）负责把 result 合并到 DB 写入，并补上 updatedAt。
 */
export interface PaymentResult {
  paymentStatus: PaymentStatus
  depositActual?: number
  depositPaidAt?: string
  finalActual?: number
  finalPaidAt?: string
  orderStatus?: OrderStatus
  /** 实收金额 = 定金实收 + 尾款实收（客户统计/权重/实付排序的单一事实来源） */
  actualAmount?: number
}

/** applyPaymentEvent 依赖的订单字段：金额 + 当前工作状态（用于判定收定金是否回退工作状态） */
export type PaymentEventOrder = Pick<Order, 'depositExpected' | 'finalExpected' | 'depositActual' | 'finalActual' | 'orderStatus'>

/**
 * 应用收款事件，计算订单应更新的字段（纯函数）
 *
 * 行为契约与原 src/stores/order.ts updatePaymentStatus 内联逻辑一致：
 * - deposit_paid：depositActual = paidAmount ?? order.depositExpected，
 *   depositPaidAt = now；仅当订单「尚未开工」（待付定金/未开始）时
 *   工作状态置为 not_started——已开工（进行中）或已完成绘制（待付尾款）
 *   的订单收定金不得回退工作状态（防止「完成」阶段被改回「未开始」）
 * - final_paid：finalActual = paidAmount ?? order.finalExpected，
 *   finalPaidAt = now，orderStatus = completed（收尾款后结单）
 * - unpaid / arrears / waived：仅改 paymentStatus，不动金额、日期、工作状态
 * - 两种收款事件都会同步 actualAmount = 定金实收 + 尾款实收（红冲/退款由
 *   recomputeOrderPaymentPatch 按剩余流水重算，同样维护该字段）
 *
 * @param order 只读依赖订单的金额字段与当前工作状态
 * @param status 目标收款状态
 * @param paidAmount 实际收款金额；undefined 时回退到订单预计值
 * @param now 可注入的时间点，便于单测确定性验证
 */
export function applyPaymentEvent(
  order: PaymentEventOrder,
  status: PaymentStatus,
  paidAmount: number | undefined,
  now: Date,
): PaymentResult {
  const result: PaymentResult = { paymentStatus: status }

  if (status === 'deposit_paid') {
    const depositActual = paidAmount ?? order.depositExpected
    result.depositActual = depositActual
    result.depositPaidAt = now.toISOString()
    // 仅「尚未开工」的订单收定金后置为未开始；已开工/已完成绘制保持原工作状态
    if (order.orderStatus === 'awaiting_deposit' || order.orderStatus === 'not_started') {
      result.orderStatus = 'not_started'
    }
    result.actualAmount = round2(depositActual + finite(order.finalActual))
  } else if (status === 'final_paid') {
    const finalActual = paidAmount ?? order.finalExpected
    result.finalActual = finalActual
    result.finalPaidAt = now.toISOString()
    result.orderStatus = 'completed'
    result.actualAmount = round2(finite(order.depositActual) + finalActual)
  }

  return result
}

/** NaN/Infinity 归 0，浮点累加保留两位小数 */
function finite(n: number | undefined): number {
  return isFinite(n as number) ? (n as number) : 0
}
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

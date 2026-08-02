import type { OrderStatus, PaymentStatus } from '@/types'

/** 订单工作状态 → 中文标签 */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  unscheduled: '未排期',
  awaiting_deposit: '待付定金',
  not_started: '未开始',
  in_progress: '进行中',
  awaiting_final: '待付尾款',
  completed: '已完成',
  voided: '已退单',
}

/** 收款状态 → 中文标签 */
export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: '未收款',
  deposit_paid: '已收定金',
  final_paid: '已收尾款',
  arrears: '欠款',
  waived: '免收',
}

/** 订单状态 → glass-badge 样式类 */
export function orderStatusBadgeClass(status: OrderStatus): string {
  switch (status) {
    case 'completed': return 'glass-badge-success'
    case 'awaiting_deposit': return 'glass-badge-warning'
    case 'awaiting_final': return 'glass-badge-primary'
    case 'voided': return 'glass-badge-default'
    default: return 'glass-badge-default'
  }
}

/** 收款状态 → glass-badge 样式类 */
export function paymentStatusBadgeClass(status: PaymentStatus): string {
  switch (status) {
    case 'final_paid': return 'glass-badge-success'
    case 'deposit_paid': return 'glass-badge-primary'
    case 'arrears': return 'glass-badge-danger'
    case 'waived': return 'glass-badge-default'
    default: return 'glass-badge-default'
  }
}

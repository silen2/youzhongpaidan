import type { OrderStatus } from '@/types'

/**
 * 阶段 ID → 订单工作状态 映射（纯函数）
 *
 * 行为契约与原 src/stores/order.ts transitionStage 内联逻辑逐字一致：
 * - st-pending → not_started（待开始阶段 = 已排期未开工）
 * - st-done    → awaiting_final（完成阶段 = 待收尾款）
 * - st-void    → voided（退单阶段 = 作废）
 * - 其他自定义阶段 → in_progress（线稿/色稿/细化/收尾等中间阶段）
 *
 * 注意：st-pending 映射为 not_started 而非 awaiting_deposit。
 * awaiting_deposit 是「未排期」的初始态，由订单创建时设定，不通过阶段流转产生。
 */
export function stageIdToOrderStatus(stageId: string): OrderStatus {
  if (stageId === 'st-pending') return 'not_started'
  if (stageId === 'st-done') return 'awaiting_final'
  if (stageId === 'st-void') return 'voided'
  return 'in_progress'
}

/**
 * 看板可见的订单工作状态集合（纯常量）
 *
 * 与原 src/stores/order.ts kanbanOrders 计算属性过滤逻辑一致：
 * 看板展示「待付定金 / 未开始 / 进行中 / 待付尾款」四态，
 * 已完成 completed 与作废 voided 不出现在看板（订单列表同样只展示活跃订单，
 * 已完成/退单的历史订单在客户详情中查看）。
 */
export const KANBAN_STATUSES: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  'awaiting_deposit',
  'not_started',
  'in_progress',
  'awaiting_final',
])

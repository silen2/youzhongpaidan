import { describe, it, expect } from 'vitest'
import { stageIdToOrderStatus, KANBAN_STATUSES } from '@/domain/order/order-status'

describe('stageIdToOrderStatus', () => {
  it('st-pending → not_started', () => {
    expect(stageIdToOrderStatus('st-pending')).toBe('not_started')
  })

  it('st-done → awaiting_final', () => {
    expect(stageIdToOrderStatus('st-done')).toBe('awaiting_final')
  })

  it('st-void → voided', () => {
    expect(stageIdToOrderStatus('st-void')).toBe('voided')
  })

  it('中间自定义阶段 → in_progress（线稿）', () => {
    expect(stageIdToOrderStatus('st-sketch')).toBe('in_progress')
  })

  it('中间自定义阶段 → in_progress（色稿/细化/收尾）', () => {
    expect(stageIdToOrderStatus('st-color')).toBe('in_progress')
    expect(stageIdToOrderStatus('st-detail')).toBe('in_progress')
    expect(stageIdToOrderStatus('st-finish')).toBe('in_progress')
  })

  it('未知阶段 ID → in_progress（默认分支）', () => {
    expect(stageIdToOrderStatus('st-unknown')).toBe('in_progress')
    expect(stageIdToOrderStatus('')).toBe('in_progress')
  })
})

describe('KANBAN_STATUSES', () => {
  it('包含看板四态', () => {
    expect(KANBAN_STATUSES.has('awaiting_deposit')).toBe(true)
    expect(KANBAN_STATUSES.has('not_started')).toBe(true)
    expect(KANBAN_STATUSES.has('in_progress')).toBe(true)
    expect(KANBAN_STATUSES.has('awaiting_final')).toBe(true)
  })

  it('排除已完成与作废', () => {
    expect(KANBAN_STATUSES.has('completed')).toBe(false)
    expect(KANBAN_STATUSES.has('voided')).toBe(false)
    expect(KANBAN_STATUSES.has('unscheduled')).toBe(false)
  })

  it('恰好包含 4 个状态', () => {
    expect(KANBAN_STATUSES.size).toBe(4)
  })
})

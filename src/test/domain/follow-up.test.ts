import { describe, it, expect } from 'vitest'
import {
  FOLLOWUP_PRIORITIES,
  isFollowUpPriority,
  priorityLabel,
  priorityBadgeClass,
} from '@/domain/followup/follow-up'

describe('follow-up 优先级', () => {
  it('三档优先级齐全且顺序固定', () => {
    expect(FOLLOWUP_PRIORITIES).toEqual(['high', 'medium', 'low'])
  })

  it('isFollowUpPriority 校验', () => {
    expect(isFollowUpPriority('high')).toBe(true)
    expect(isFollowUpPriority('low')).toBe(true)
    expect(isFollowUpPriority('urgent')).toBe(false)
    expect(isFollowUpPriority(undefined)).toBe(false)
  })

  it('priorityLabel 中文映射（未知兜底低）', () => {
    expect(priorityLabel('high')).toBe('高')
    expect(priorityLabel('medium')).toBe('中')
    expect(priorityLabel('low')).toBe('低')
  })

  it('priorityBadgeClass 徽章映射', () => {
    expect(priorityBadgeClass('high')).toBe('glass-badge-danger')
    expect(priorityBadgeClass('medium')).toBe('glass-badge-warning')
    expect(priorityBadgeClass('low')).toBe('glass-badge-default')
  })
})

/**
 * 跟进领域模型：优先级、标签等纯函数（无 DOM/DB 依赖，可单测）。
 */

export const FOLLOWUP_PRIORITIES = ['high', 'medium', 'low'] as const

export type FollowUpPriority = (typeof FOLLOWUP_PRIORITIES)[number]

export const PRIORITY_LABEL: Record<FollowUpPriority, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

export function isFollowUpPriority(value: unknown): value is FollowUpPriority {
  return FOLLOWUP_PRIORITIES.includes(value as FollowUpPriority)
}

export function priorityLabel(p: FollowUpPriority): string {
  return PRIORITY_LABEL[p] ?? '低'
}

/** 优先级徽章样式：高→danger / 中→warning / 低→default */
export function priorityBadgeClass(p: FollowUpPriority): string {
  switch (p) {
    case 'high': return 'glass-badge-danger'
    case 'medium': return 'glass-badge-warning'
    default: return 'glass-badge-default'
  }
}

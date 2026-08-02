/**
 * 排期状态判定（纯函数）。
 *
 * 基于订单的排期字段（expectedStartDate/expectedEndDate）与实际进度（ScheduleProgress）
 * 判定排期状态，供甘特图染色、超期徽章、完工标记使用。
 */

import type { ScheduleProgress } from './schedule-progress'

/** 排期状态 */
export type ScheduleStatus =
  | 'not_started' // 已排期未开工（仍在待开始）
  | 'in_progress' // 进行中（已开工未完工）
  | 'overdue' // 超期（未完工且 expectedEndDate 已过）
  | 'completed' // 已完工（进入过完成栏）
  | 'completed_early' // 提前完工（完工日早于 expectedEndDate）

/**
 * 判定订单排期状态。
 *
 * @param expectedStart 预计开始 'YYYY-MM-DD'（可为空字符串）
 * @param expectedEnd   预计结束 'YYYY-MM-DD'
 * @param progress      由流转记录推导的实际进度
 * @param today         'YYYY-MM-DD' 当天日期
 *
 * 优先级：已完工（含提前完工） > 超期 > 进行中 > 未开工。
 * 超期判定仅针对未完工订单：expectedEnd < today 且尚未进入完成栏。
 */
export function computeScheduleStatus(
  _expectedStart: string | undefined | null,
  expectedEnd: string | undefined | null,
  progress: ScheduleProgress,
  today: string,
): ScheduleStatus {
  // 已完工：提前完工 vs 按期/逾期完工
  if (progress.finished) {
    if (progress.actualEndDate && expectedEnd && progress.actualEndDate < expectedEnd) {
      return 'completed_early'
    }
    return 'completed'
  }

  // 未完工且预计结束已过 → 超期
  if (expectedEnd && expectedEnd < today) {
    return 'overdue'
  }

  return progress.started ? 'in_progress' : 'not_started'
}

/** 状态中文标签（图例/徽章用） */
export const SCHEDULE_STATUS_LABEL: Record<ScheduleStatus, string> = {
  not_started: '未开工',
  in_progress: '进行中',
  overdue: '超期',
  completed: '已完工',
  completed_early: '提前完工',
}

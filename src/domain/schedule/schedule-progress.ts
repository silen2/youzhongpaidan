/**
 * 排期实际进度推导（纯函数）。
 *
 * 从订单的阶段流转记录（stageTransitions）推导实际开始/实际完工日期：
 * - 实际开工 = 订单第一次离开 st-pending（拖入任意自定义阶段）的流转日。
 * - 跳步订单：从 st-pending 直接拖到 st-done → 实际开工 = 实际完工 = 进完成栏日。
 * - 实际完工 = 进入 st-done 的流转日。
 *
 * 推导结果用于甘特图双轨条带（实际层）、订单详情实际周期、完工标记等。
 */

/** 系统内置阶段 ID */
export const PENDING_STAGE = 'st-pending'
export const DONE_STAGE = 'st-done'

/** 排期进度快照（由流转记录推导，不落库，视图层消费） */
export interface ScheduleProgress {
  /** 实际开工日 'YYYY-MM-DD'；未开工则为 null */
  actualStartDate: string | null
  /** 实际完工日 'YYYY-MM-DD'；未完工则为 null */
  actualEndDate: string | null
  /** 是否已开工（离开过待开始） */
  started: boolean
  /** 是否已完工（进入过完成栏） */
  finished: boolean
}

/** 归一化为 'YYYY-MM-DD'：已是日期字符串直接返回；ISO 时间戳按本地时区转日期；非法输入返回 null */
export function toLocalDay(isoOrDay: string | undefined | null): string | null {
  if (typeof isoOrDay !== 'string' || !isoOrDay) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrDay)) return isoOrDay
  const d = new Date(isoOrDay)
  if (Number.isNaN(d.getTime())) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * 从流转记录推导排期实际进度。
 * transitions 需按时间升序排列（由调用方保证）。
 */
export function deriveScheduleProgress(transitions: Array<{ toStageId?: string; transitionDate: string }>): ScheduleProgress {
  let actualStartDate: string | null = null
  let actualEndDate: string | null = null
  let finished = false

  for (const t of transitions) {
    const day = toLocalDay(t.transitionDate)
    if (!day) continue
    if (t.toStageId === DONE_STAGE) {
      finished = true
      actualEndDate = day
      // 跳步订单：进完成栏前未离开过待开始 → 实际开工 = 完工日
      if (actualStartDate === null) actualStartDate = day
    } else if (t.toStageId !== PENDING_STAGE && actualStartDate === null) {
      // 第一次离开待开始（进入自定义阶段）即开工
      actualStartDate = day
    }
  }

  return { actualStartDate, actualEndDate, started: actualStartDate !== null, finished }
}

/**
 * 回写字段推导：进入完成栏时应回写订单上的实际时间字段。
 * 返回 Partial<Order> 中实际时间相关字段；无变化返回 null。
 */
export function buildActualWriteBack(
  order: {
    actualStartDate?: string | null
    actualEndDate?: string | null
  },
  progress: ScheduleProgress,
): { actualStartDate: string; actualEndDate: string } | null {
  if (!progress.finished || !progress.actualStartDate || !progress.actualEndDate) return null
  if (order.actualStartDate === progress.actualStartDate && order.actualEndDate === progress.actualEndDate) return null
  return {
    actualStartDate: progress.actualStartDate,
    actualEndDate: progress.actualEndDate,
  }
}

/** 实际层按阶段分段色块（由流转记录按时间戳精准染色） */
export interface StageSegment {
  /** 阶段名（悬浮提示用） */
  stageName: string
  /** 阶段颜色 */
  color: string
  /** 段开始时间戳（ms） */
  startTs: number
  /** 段结束时间戳（ms，不含，即下一阶段流转时刻 / 完工时刻 / 今天日末） */
  endTs: number
}

/** 解析流转时间：'YYYY-MM-DD' 按本地 0 点，ISO 时间戳按原样解析 */
function parseTransitionTs(value: string): number {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00`).getTime()
  return Date.parse(value)
}

/** 今天日末时间戳（本地 0 点 + 1 天），供未完工的最后一段延伸到今天 */
function endOfDayTs(ts: number): number {
  const d = new Date(ts)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime()
}

/**
 * 由流转记录构建「实际层」的阶段分段：每条进入非待开始阶段的流转开启一个分段，
 * 分段以该阶段颜色染色、按流转时间戳精确定界，持续到下一次流转（或完工时刻 / 今天日末）。
 * transitions 需按时间升序排列；零宽分段（如进完成栏当天）被跳过。
 * 同日内的反复流转（如 色稿→草稿→色稿）各自成段，不因按天取整而塌缩。
 */
export function buildStageSegments(
  transitions: Array<{ toStageId?: string; toStageName?: string; toStageColor?: string; transitionDate: string }>,
  nowTs: number,
): StageSegment[] {
  const entries: Array<{ ts: number; name: string; color: string; isDone: boolean }> = []
  for (const t of transitions) {
    if (!t.toStageId || t.toStageId === PENDING_STAGE) continue
    const ts = parseTransitionTs(t.transitionDate)
    if (!Number.isFinite(ts)) continue
    entries.push({
      ts,
      name: t.toStageName ?? t.toStageId,
      color: t.toStageColor ?? 'var(--color-text-muted)',
      isDone: t.toStageId === DONE_STAGE,
    })
  }
  if (entries.length === 0) return []

  const segments: StageSegment[] = []
  for (let i = 0; i < entries.length; i++) {
    const cur = entries[i]
    // 结束时刻：下一分段开始时刻；最后一段——完工则到完工时刻（自身零宽被跳过），否则到今天日末
    const endTs = i + 1 < entries.length
      ? entries[i + 1].ts
      : cur.isDone
        ? cur.ts
        : endOfDayTs(nowTs)
    if (endTs <= cur.ts) continue // 零宽分段跳过（进完成栏当天 / 异常乱序）
    segments.push({ stageName: cur.name, color: cur.color, startTs: cur.ts, endTs })
  }
  return segments
}

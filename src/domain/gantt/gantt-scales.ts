/**
 * 甘特图缩放刻度（纯函数）。
 *
 * 连续缩放：像素密度（pxPerDay）由用户通过滚轮/双指自由调整，
 * 刻度粒度（日/周/月/季）根据当前密度自动推断，无需手动选择档位。
 * 时间↔像素换算基于「本地日 0 点时间戳」与像素密度（pxPerDay）。
 */
import { DAY_MS, addUnit, formatLocalDay, startOfDay, startOfWeek } from './gantt-time'

/** 密度下限/上限（px/天）：太密看不清、太疏内容溢出 */
export const MIN_PX_PER_DAY = 3
export const MAX_PX_PER_DAY = 56

/** 内部刻度粒度（按密度自动推断，不暴露给用户选择） */
export type GanttTickUnit = 'day' | 'week' | 'month' | 'quarter'

/** 时间戳 → 相对 rangeStart 的像素 x（rangeStart 为本地日 0 点时间戳） */
export function timeToX(ts: number, rangeStart: number, pxPerDay: number): number {
  return ((ts - rangeStart) / DAY_MS) * pxPerDay
}

/** 像素 x → 时间戳（未吸附的原始值，供拖拽吸附） */
export function xToTime(x: number, rangeStart: number, pxPerDay: number): number {
  return rangeStart + (x / pxPerDay) * DAY_MS
}

export interface GanttTick {
  ts: number
  label: string
}

/** 按密度推断刻度粒度：密（日）→ 疏（季） */
export function inferTickUnit(pxPerDay: number): GanttTickUnit {
  if (pxPerDay >= 20) return 'day'
  if (pxPerDay >= 9) return 'week'
  if (pxPerDay >= 4) return 'month'
  return 'quarter'
}

/** 生成刻度序列：从 rangeStart 起按推断粒度步进，直到超过 rangeEnd。
 * 周刻度对齐周一（项目日期约定），其余粒度对齐 rangeStart 当天。 */
export function buildTicks(rangeStart: number, rangeEnd: number, pxPerDay: number): GanttTick[] {
  const unit = inferTickUnit(pxPerDay)
  const ticks: GanttTick[] = []
  const start = unit === 'week' ? startOfWeek(rangeStart) : rangeStart
  for (let ts = start; ts <= rangeEnd; ts = addUnit(ts, unit, 1)) {
    ticks.push({ ts, label: tickLabel(ts, unit) })
  }
  return ticks
}

function tickLabel(ts: number, unit: GanttTickUnit): string {
  const d = new Date(ts)
  if (unit === 'day' || unit === 'week') return formatLocalDay(ts).slice(5) // MM-DD
  if (unit === 'month') return formatLocalDay(ts).slice(0, 7) // YYYY-MM
  return `${d.getFullYear()} Q${Math.floor(d.getMonth() / 3) + 1}` // YYYY-QN
}

/** 拖拽吸附：统一按「日」粒度（当天 0 点），保证条带不会因密度变化而跳档 */
export function snapToUnit(ts: number): number {
  return startOfDay(ts)
}

/** 最小时间窗（单侧天数）：默认 ±45 天，保证低密度下单子不糊成一团；可经偏好设置调整 */
export const MIN_RANGE_DAYS = 45

/** 计算甘特图显示范围：以「今天」为中心，窗口宽度由缩放密度与视口宽度共同决定——
 * 至少 minDays 天（默认 ±45）；缩到极限（低密度）时窗口自动扩大，恰好铺满视口，避免时间轴右侧出现大片空白。
 * 今天恒在视野中央；订单超出窗口时条带部分超出，可拖动/缩放查看。 */
export function computeRange(
  _dayStrs: { start: string; end: string }[],
  todayTs: number,
  pxPerDay: number,
  viewportWidth: number,
  minDays: number = MIN_RANGE_DAYS,
): { start: number; end: number } {
  const halfDays = Math.max(minDays, Math.ceil(viewportWidth / pxPerDay / 2))
  return {
    start: snapToUnit(todayTs - halfDays * DAY_MS),
    end: snapToUnit(todayTs + halfDays * DAY_MS),
  }
}

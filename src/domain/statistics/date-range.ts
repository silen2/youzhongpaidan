/**
 * 统计时间范围与粒度（纯函数）。
 * 统计页全局时间控件：快捷预设（本月/上月/近3月/近12月/今年）+ 自定义区间。
 * 范围用日期字符串（YYYY-MM-DD，含端点）；所有聚合按日期归属（订单 createdAt /
 * 账单 receivedAt / 结单 finalPaidAt 等字段的日期部分）。
 */

export type StatsRangePreset =
  | 'this-month'
  | 'last-month'
  | 'last-3-months'
  | 'last-12-months'
  | 'this-year'
  | 'custom'

export interface StatsRange {
  /** 起始日期 YYYY-MM-DD（含） */
  start: string
  /** 结束日期 YYYY-MM-DD（含） */
  end: string
}

export type StatsGranularity = 'day' | 'week' | 'month'

/** 按粒度切分后的时间桶（聚合趋势用） */
export interface StatsBucket {
  label: string
  start: string
  end: string
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function shiftDays(d: Date, days: number): Date {
  const c = new Date(d)
  c.setDate(c.getDate() + days)
  return c
}

/**
 * 构建统计范围：预设优先，custom 时使用传入的起止日期。
 * @param preset 预设
 * @param customStart 自定义起始（YYYY-MM-DD）
 * @param customEnd 自定义结束（YYYY-MM-DD）
 * @param today 基准日期（默认今天）
 */
export function buildStatsRange(
  preset: StatsRangePreset,
  customStart?: string,
  customEnd?: string,
  today: Date = new Date(),
): StatsRange {
  if (preset === 'custom') {
    const start = customStart || toDateStr(today)
    const end = customEnd || toDateStr(today)
    return start <= end ? { start, end } : { start: end, end: start }
  }

  const now = new Date(today)
  switch (preset) {
    case 'this-month':
      return { start: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`, end: toDateStr(now) }
    case 'last-month': {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const last = new Date(now.getFullYear(), now.getMonth(), 0)
      return { start: toDateStr(first), end: toDateStr(last) }
    }
    case 'last-3-months':
      return { start: toDateStr(shiftDays(now, -89)), end: toDateStr(now) }
    case 'last-12-months':
      return { start: toDateStr(shiftDays(now, -364)), end: toDateStr(now) }
    case 'this-year':
      return { start: `${now.getFullYear()}-01-01`, end: toDateStr(now) }
  }
}

/**
 * 按范围跨度推断聚合粒度（保证点数适中）：
 * - 跨度 ≤ 45 天 → 按天
 * - 跨度 ≤ 180 天 → 按周（7 天一段）
 * - 其余 → 按自然月
 */
export function guessGranularity(range: StatsRange): StatsGranularity {
  const days = diffDays(range) + 1
  if (days <= 45) return 'day'
  if (days <= 180) return 'week'
  return 'month'
}

/** 范围跨度（自然日数，含端点） */
export function diffDays(range: StatsRange): number {
  const start = parseDate(range.start)
  const end = parseDate(range.end)
  return Math.round((end.getTime() - start.getTime()) / 86400000)
}

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * 将范围按粒度切分为时间桶序列。
 * - day：每天一段
 * - week：每 7 天一段（最后一段可能不足 7 天，按 range.end 收口）
 * - month：按自然月
 */
export function splitRangeByGranularity(range: StatsRange, granularity: StatsGranularity): StatsBucket[] {
  const buckets: StatsBucket[] = []
  let cursor = parseDate(range.start)
  const endDate = parseDate(range.end)

  while (cursor <= endDate) {
    let segEnd: Date
    if (granularity === 'day') {
      segEnd = cursor
    } else if (granularity === 'week') {
      segEnd = shiftDays(cursor, 6)
      if (segEnd > endDate) segEnd = endDate
    } else {
      // 自然月：本月最后一天
      segEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)
      if (segEnd > endDate) segEnd = endDate
    }

    buckets.push({
      label: granularity === 'month'
        ? `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}`
        : toDateStr(cursor).slice(5),
      start: toDateStr(cursor),
      end: toDateStr(segEnd),
    })

    cursor = shiftDays(segEnd, 1)
  }
  return buckets
}

/** 日期字符串是否落在范围内（按日期部分比较） */
export function dateInRange(dateStr: string | undefined, range: StatsRange): boolean {
  if (!dateStr) return false
  const d = dateStr.slice(0, 10)
  return d >= range.start && d <= range.end
}

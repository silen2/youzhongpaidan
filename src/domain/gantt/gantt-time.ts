/**
 * 甘特图日期工具（纯函数，本地时区日历运算）。
 *
 * 订单排期字段（expectedStartDate/expectedEndDate）存储为 'YYYY-MM-DD' 本地日期字符串，
 * 甘特图全部按「本地日 0 点时间戳」换算，避免 UTC 偏移跨天。
 */

export const DAY_MS = 86400000

/** 'YYYY-MM-DD' → 本地日 0 点时间戳；非法/缺失返回 NaN */
export function parseLocalDay(dayStr: string | undefined | null): number {
  if (typeof dayStr !== 'string') return NaN
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayStr.trim())
  if (!m) return NaN
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const ts = new Date(y, mo - 1, d).getTime()
  // 回查合法性（如 2026-02-30 会被 Date 进位为 3 月）
  return new Date(ts).getDate() === d ? ts : NaN
}

/** 本地日 0 点时间戳 → 'YYYY-MM-DD' */
export function formatLocalDay(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function startOfDay(ts: number): number {
  const d = new Date(ts)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/** 周一 0 点（项目日期约定：周一开始） */
export function startOfWeek(ts: number): number {
  const d = new Date(ts)
  const day = d.getDay() === 0 ? 7 : d.getDay() // 周日算本周第 7 天
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - (day - 1)).getTime()
}

export function startOfMonth(ts: number): number {
  const d = new Date(ts)
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime()
}

export function startOfQuarter(ts: number): number {
  const d = new Date(ts)
  const qMonth = Math.floor(d.getMonth() / 3) * 3
  return new Date(d.getFullYear(), qMonth, 1).getTime()
}

/** 按单位加 n 个单位（月/季为日历月运算，其余按天） */
export function addUnit(ts: number, unit: 'day' | 'week' | 'month' | 'quarter', n: number): number {
  const d = new Date(ts)
  if (unit === 'month') return new Date(d.getFullYear(), d.getMonth() + n, d.getDate()).getTime()
  if (unit === 'quarter') return new Date(d.getFullYear(), d.getMonth() + n * 3, d.getDate()).getTime()
  return ts + n * (unit === 'week' ? 7 * DAY_MS : DAY_MS)
}

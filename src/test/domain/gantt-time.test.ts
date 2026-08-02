import { describe, it, expect } from 'vitest'
import { parseLocalDay, formatLocalDay, startOfDay, startOfWeek, startOfMonth, startOfQuarter, addUnit, DAY_MS } from '@/domain/gantt/gantt-time'

describe('甘特图时间工具', () => {
  it('parseLocalDay：YYYY-MM-DD → 本地日 0 点时间戳，往返一致', () => {
    const ts = parseLocalDay('2026-08-01')
    expect(Number.isFinite(ts)).toBe(true)
    expect(formatLocalDay(ts)).toBe('2026-08-01')
    const d = new Date(ts)
    expect(d.getHours()).toBe(0)
    expect(d.getMinutes()).toBe(0)
  })

  it('parseLocalDay：非法输入返回 NaN（空串/格式错/日期进位）', () => {
    expect(parseLocalDay('')).toBeNaN()
    expect(parseLocalDay('2026/08/01')).toBeNaN()
    expect(parseLocalDay('abc')).toBeNaN()
    // 2026-02-30 会被 Date 进位到 3 月，回查拒绝
    expect(parseLocalDay('2026-02-30')).toBeNaN()
  })

  it('startOfDay/startOfWeek：取当天 0 点与所在周周一 0 点', () => {
    // 2026-08-01 是周六（项目约定周一为一周首日）
    const sat = parseLocalDay('2026-08-01')
    expect(startOfDay(sat)).toBe(sat)
    const mon = startOfWeek(sat)
    expect(formatLocalDay(mon)).toBe('2026-07-27') // 8-01 周六所在周的周一
    expect(new Date(mon).getDay()).toBe(1)
  })

  it('startOfMonth/startOfQuarter：取当月 1 号与当季首月 1 号', () => {
    const ts = parseLocalDay('2026-08-15')
    expect(formatLocalDay(startOfMonth(ts))).toBe('2026-08-01')
    expect(formatLocalDay(startOfQuarter(ts))).toBe('2026-07-01') // 8 月属 Q3（7 月起）
  })

  it('addUnit：日/周按天，月/季按日历月', () => {
    const ts = parseLocalDay('2026-08-01')
    expect(formatLocalDay(addUnit(ts, 'day', 1))).toBe('2026-08-02')
    expect(formatLocalDay(addUnit(ts, 'week', 1))).toBe('2026-08-08')
    expect(formatLocalDay(addUnit(ts, 'month', 1))).toBe('2026-09-01')
    expect(formatLocalDay(addUnit(ts, 'quarter', 1))).toBe('2026-11-01')
    // 跨年
    expect(formatLocalDay(addUnit(ts, 'month', 5))).toBe('2027-01-01')
  })

  it('addUnit：月末进位（1-31 加一月 → 3-3 由 Date 自动处理）', () => {
    const ts = parseLocalDay('2026-01-31')
    expect(formatLocalDay(addUnit(ts, 'month', 1))).toBe('2026-03-03')
  })

  it('DAY_MS 常量为 24 小时', () => {
    expect(DAY_MS).toBe(86400000)
  })
})

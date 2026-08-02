import { describe, it, expect } from 'vitest'
import { timeToX, xToTime, buildTicks, snapToUnit, computeRange, inferTickUnit, MIN_PX_PER_DAY, MAX_PX_PER_DAY } from '@/domain/gantt/gantt-scales'
import { parseLocalDay, DAY_MS } from '@/domain/gantt/gantt-time'

describe('甘特图缩放刻度（连续缩放）', () => {
  const start = parseLocalDay('2026-08-01')

  it('timeToX / xToTime 互逆（任意密度）', () => {
    const px = 12
    const ts = start + 3 * DAY_MS
    const x = timeToX(ts, start, px)
    expect(x).toBe(36)
    expect(xToTime(x, start, px)).toBe(ts)
  })

  it('inferTickUnit：密度越高粒度越细', () => {
    expect(inferTickUnit(30)).toBe('day')
    expect(inferTickUnit(20)).toBe('day')
    expect(inferTickUnit(15)).toBe('week')
    expect(inferTickUnit(9)).toBe('week')
    expect(inferTickUnit(6)).toBe('month')
    expect(inferTickUnit(4)).toBe('month')
    expect(inferTickUnit(3)).toBe('quarter')
  })

  it('buildTicks：高密度（30px/天）为日刻度', () => {
    const end = start + 5 * DAY_MS
    const ticks = buildTicks(start, end, 30)
    expect(ticks.length).toBe(6)
    expect(ticks[0].ts).toBe(start)
    expect(ticks[5].ts).toBe(end)
    expect(ticks[1].label).toBe('08-02')
  })

  it('buildTicks：中密度（12px/天）为周刻度', () => {
    const end = start + 20 * DAY_MS
    const ticks = buildTicks(start, end, 12)
    expect(ticks.every(t => new Date(t.ts).getDay() === 1)).toBe(true) // 周一起点
  })

  it('buildTicks：低密度（6px/天）为月刻度', () => {
    const end = parseLocalDay('2026-09-10')
    const ticks = buildTicks(start, end, 6)
    expect(ticks.map(t => t.label)).toEqual(['2026-08', '2026-09'])
  })

  it('buildTicks：极低密度（3px/天）为季刻度', () => {
    const end = parseLocalDay('2026-12-01')
    const ticks = buildTicks(start, end, 3)
    expect(ticks.map(t => t.label)).toEqual(['2026 Q3', '2026 Q4'])
  })

  it('snapToUnit：统一按日吸附（当天 0 点）', () => {
    const ts = parseLocalDay('2026-08-05')
    expect(snapToUnit(ts)).toBe(ts)
    // 子日时间取整到当天 0 点
    expect(snapToUnit(ts + DAY_MS / 2)).toBe(ts)
  })

  it('computeRange：默认密度下保持最小窗口 ±45 天', () => {
    const today = parseLocalDay('2026-08-15')
    const orders = [
      { start: '2026-08-01', end: '2026-08-10' },
      { start: '2026-09-01', end: '2026-09-20' },
    ]
    const range = computeRange(orders, today, 12, 880)
    expect(range.start).toBe(today - 45 * DAY_MS)
    expect(range.end).toBe(today + 45 * DAY_MS)
    expect(range.start).toBeLessThanOrEqual(today)
    expect(range.end).toBeGreaterThanOrEqual(today)
  })

  it('computeRange：缩到极限（低密度）时窗口扩大到铺满视口', () => {
    const today = parseLocalDay('2026-08-15')
    const range = computeRange([], today, 3, 1300)
    const halfDays = Math.ceil(1300 / 3 / 2) // 217
    expect(range.start).toBe(today - halfDays * DAY_MS)
    expect(range.end).toBe(today + halfDays * DAY_MS)
  })

  it('computeRange：高密度下仍保持最小窗口', () => {
    const today = parseLocalDay('2026-08-15')
    const range = computeRange([], today, 56, 1300)
    expect(range.start).toBe(today - 45 * DAY_MS)
    expect(range.end).toBe(today + 45 * DAY_MS)
  })

  it('computeRange：自定义 minDays 生效（偏好设置接入）', () => {
    const today = parseLocalDay('2026-08-15')
    // 视口所需单侧天数（ceil(880/12/2)=37）小于自定义 60 → 取 60
    const range = computeRange([], today, 12, 880, 60)
    expect(range.start).toBe(today - 60 * DAY_MS)
    expect(range.end).toBe(today + 60 * DAY_MS)
  })

  it('computeRange：自定义 minDays 更小（14）时仍不低于视口需求', () => {
    const today = parseLocalDay('2026-08-15')
    // 视口所需单侧天数（ceil(1300/3/2)=217）大于 14 → 取 217
    const range = computeRange([], today, 3, 1300, 14)
    const halfDays = Math.ceil(1300 / 3 / 2)
    expect(range.start).toBe(today - halfDays * DAY_MS)
    expect(range.end).toBe(today + halfDays * DAY_MS)
  })

  it('computeRange：无排期订单时范围围绕今天', () => {
    const today = parseLocalDay('2026-08-15')
    const range = computeRange([], today, 12, 0)
    expect(range.start).toBeLessThanOrEqual(today)
    expect(range.end).toBeGreaterThanOrEqual(today)
  })

  it('密度边界常量合理', () => {
    expect(MIN_PX_PER_DAY).toBeLessThan(MAX_PX_PER_DAY)
    expect(MIN_PX_PER_DAY).toBe(3)
    expect(MAX_PX_PER_DAY).toBe(56)
  })
})

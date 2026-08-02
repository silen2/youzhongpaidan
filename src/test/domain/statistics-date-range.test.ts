import { describe, it, expect } from 'vitest'
import {
  buildStatsRange,
  guessGranularity,
  splitRangeByGranularity,
  diffDays,
  dateInRange,
} from '@/domain/statistics/date-range'

const TODAY = new Date(2026, 7, 2) // 2026-08-02

describe('buildStatsRange', () => {
  it('本月：1 号到今天', () => {
    expect(buildStatsRange('this-month', undefined, undefined, TODAY)).toEqual({ start: '2026-08-01', end: '2026-08-02' })
  })

  it('上月：完整自然月', () => {
    expect(buildStatsRange('last-month', undefined, undefined, TODAY)).toEqual({ start: '2026-07-01', end: '2026-07-31' })
  })

  it('近 3 月 / 近 12 月：今天往前推', () => {
    expect(buildStatsRange('last-3-months', undefined, undefined, TODAY)).toEqual({ start: '2026-05-05', end: '2026-08-02' })
    expect(buildStatsRange('last-12-months', undefined, undefined, TODAY)).toEqual({ start: '2025-08-03', end: '2026-08-02' })
  })

  it('今年：1-1 到今天', () => {
    expect(buildStatsRange('this-year', undefined, undefined, TODAY)).toEqual({ start: '2026-01-01', end: '2026-08-02' })
  })

  it('custom：使用传入起止；起止颠倒时自动纠正', () => {
    expect(buildStatsRange('custom', '2026-06-01', '2026-06-30', TODAY)).toEqual({ start: '2026-06-01', end: '2026-06-30' })
    expect(buildStatsRange('custom', '2026-06-30', '2026-06-01', TODAY)).toEqual({ start: '2026-06-01', end: '2026-06-30' })
  })

  it('custom 缺省值：回退到今天', () => {
    expect(buildStatsRange('custom', undefined, undefined, TODAY)).toEqual({ start: '2026-08-02', end: '2026-08-02' })
  })
})

describe('guessGranularity / diffDays', () => {
  it('45 天内按天', () => {
    expect(guessGranularity({ start: '2026-08-01', end: '2026-08-30' })).toBe('day')
  })
  it('46~180 天按周', () => {
    expect(guessGranularity({ start: '2026-05-01', end: '2026-08-02' })).toBe('week')
  })
  it('超过 180 天按月', () => {
    expect(guessGranularity({ start: '2025-08-03', end: '2026-08-02' })).toBe('month')
  })
  it('diffDays 含端点', () => {
    expect(diffDays({ start: '2026-08-01', end: '2026-08-02' })).toBe(1)
  })
})

describe('splitRangeByGranularity', () => {
  it('day：每天一段', () => {
    const buckets = splitRangeByGranularity({ start: '2026-08-01', end: '2026-08-03' }, 'day')
    expect(buckets.map(b => b.label)).toEqual(['08-01', '08-02', '08-03'])
    expect(buckets[0]).toEqual({ label: '08-01', start: '2026-08-01', end: '2026-08-01' })
  })

  it('week：7 天一段，末段收口到 end', () => {
    const buckets = splitRangeByGranularity({ start: '2026-08-01', end: '2026-08-12' }, 'week')
    expect(buckets).toHaveLength(2)
    expect(buckets[0]).toEqual({ label: '08-01', start: '2026-08-01', end: '2026-08-07' })
    expect(buckets[1]).toEqual({ label: '08-08', start: '2026-08-08', end: '2026-08-12' })
  })

  it('month：按自然月，跨月切分', () => {
    const buckets = splitRangeByGranularity({ start: '2026-07-15', end: '2026-08-02' }, 'month')
    expect(buckets.map(b => b.label)).toEqual(['2026-07', '2026-08'])
    expect(buckets[0].end).toBe('2026-07-31')
    expect(buckets[1].end).toBe('2026-08-02')
  })
})

describe('dateInRange', () => {
  const range = { start: '2026-08-01', end: '2026-08-31' }
  it('范围内/范围外/空值', () => {
    expect(dateInRange('2026-08-15T10:00:00.000Z', range)).toBe(true)
    expect(dateInRange('2026-08-31T00:00:00.000Z', range)).toBe(true)
    expect(dateInRange('2026-09-01T00:00:00.000Z', range)).toBe(false)
    expect(dateInRange(undefined, range)).toBe(false)
    expect(dateInRange('', range)).toBe(false)
  })
})

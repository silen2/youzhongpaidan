import { describe, it, expect } from 'vitest'
import { assignTracks, trackCount } from '@/domain/gantt/gantt-tracks'
import { parseLocalDay, DAY_MS } from '@/domain/gantt/gantt-time'

describe('甘特图 track 分配', () => {
  const d = (s: string) => parseLocalDay(s)

  it('无重叠订单全部落在 track 0', () => {
    const items = [
      { id: 'a', start: d('2026-08-01'), end: d('2026-08-03') + DAY_MS },
      { id: 'b', start: d('2026-08-04'), end: d('2026-08-06') + DAY_MS },
    ]
    const map = assignTracks(items)
    expect(map.get('a')).toBe(0)
    expect(map.get('b')).toBe(0)
    expect(trackCount(map)).toBe(1)
  })

  it('两个重叠订单分到不同 track', () => {
    const items = [
      { id: 'a', start: d('2026-08-01'), end: d('2026-08-05') + DAY_MS },
      { id: 'b', start: d('2026-08-03'), end: d('2026-08-08') + DAY_MS },
    ]
    const map = assignTracks(items)
    expect(map.get('a')).not.toBe(map.get('b'))
    expect(trackCount(map)).toBe(2)
  })

  it('区间结束时间相同不重叠（end <= start 可复用）', () => {
    const end = d('2026-08-05') + DAY_MS
    const items = [
      { id: 'a', start: d('2026-08-01'), end },
      { id: 'b', start: end, end: d('2026-08-10') + DAY_MS },
    ]
    const map = assignTracks(items)
    expect(map.get('a')).toBe(0)
    expect(map.get('b')).toBe(0)
  })

  it('三个连续重叠正确分配（1-2-3 重叠）', () => {
    const items = [
      { id: 'a', start: d('2026-08-01'), end: d('2026-08-06') + DAY_MS },
      { id: 'b', start: d('2026-08-02'), end: d('2026-08-07') + DAY_MS },
      { id: 'c', start: d('2026-08-03'), end: d('2026-08-08') + DAY_MS },
    ]
    const map = assignTracks(items)
    const values = [map.get('a')!, map.get('b')!, map.get('c')!]
    expect(new Set(values).size).toBe(3)
    expect(trackCount(map)).toBe(3)
  })

  it('结果与输入顺序无关', () => {
    const items = [
      { id: 'a', start: d('2026-08-01'), end: d('2026-08-05') + DAY_MS },
      { id: 'b', start: d('2026-08-03'), end: d('2026-08-08') + DAY_MS },
      { id: 'c', start: d('2026-08-02'), end: d('2026-08-04') + DAY_MS },
    ]
    const sorted = [...items].reverse()
    const m1 = assignTracks(items)
    const m2 = assignTracks(sorted)
    expect(m1.get('a')).toBe(m2.get('a'))
    expect(m1.get('b')).toBe(m2.get('b'))
    expect(m1.get('c')).toBe(m2.get('c'))
  })

  it('空数组返回空 Map，trackCount 为 0', () => {
    const map = assignTracks([])
    expect(map.size).toBe(0)
    expect(trackCount(map)).toBe(0)
  })
})

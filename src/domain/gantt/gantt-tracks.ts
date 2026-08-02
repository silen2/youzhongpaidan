/**
 * 甘特图并行订单 track 分配（纯函数）。
 *
 * 多个订单时间区间重叠时，条带必须纵向错开（不同 track）不遮挡。
 * 贪心算法：按开始时间升序处理，为每个区间寻找第一个已结束（end <= start）的 track 复用，
 * 否则新开一个 track。结果与输入顺序无关（先排序再分配）。
 */

export interface GanttInterval {
  id: string
  start: number
  end: number
}

/** 分配 track：返回 Map<id, trackIndex>；无重叠时全部落在 track 0 */
export function assignTracks(items: GanttInterval[]): Map<string, number> {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end)
  const trackEnds: number[] = [] // 每个 track 当前占用到的结束时间
  const result = new Map<string, number>()

  for (const item of sorted) {
    let placed = -1
    for (let i = 0; i < trackEnds.length; i++) {
      if (trackEnds[i] <= item.start) {
        placed = i
        break
      }
    }
    if (placed === -1) {
      placed = trackEnds.length
      trackEnds.push(item.end)
    } else {
      trackEnds[placed] = item.end
    }
    result.set(item.id, placed)
  }
  return result
}

/** 由 track 分配结果求总 track 数（用于行高布局） */
export function trackCount(trackMap: Map<string, number>): number {
  if (trackMap.size === 0) return 0
  return Math.max(...trackMap.values()) + 1
}

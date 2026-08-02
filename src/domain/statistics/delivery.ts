/**
 * 交付分析（纯函数）：
 * - 按期交付率：区间内结单（finalPaidAt 在范围内）的订单，实际结单日 ≤ 预计交付日 → 按期
 * - 平均绘制周期：区间内结单订单「开工 → 完工」的自然日均值
 *   开工 = 该订单第一条阶段流转时间（离开待开始）；无流转记录时回退 actualStartDate
 *   完工 = 流转到 st-done 的时间；无则回退 finalPaidAt
 */
import { dateInRange, type StatsRange, type StatsBucket } from '@/domain/statistics/date-range'

export interface OrderLikeForDelivery {
  id: string
  finalPaidAt?: string
  expectedEndDate?: string
  actualStartDate?: string
}

export interface TransitionLike {
  orderId: string
  toStageId?: string
  transitionDate: string
}

export interface DeliveryStats {
  /** 区间内结单订单数 */
  completedCount: number
  /** 按期交付数（结单日 ≤ 预计交付日） */
  onTimeCount: number
  /** 逾期交付数 */
  lateCount: number
  /** 按期率 0-100（无结单订单时为 0） */
  onTimeRate: number
  /** 平均绘制周期（自然日，保留 1 位小数；无完整周期数据时为 0） */
  avgCycleDays: number
}

export interface DeliveryTrendPoint {
  label: string
  /** 该桶结单且按期数 */
  onTime: number
  /** 该桶结单且逾期数 */
  late: number
  /** 按期率 0-100 */
  rate: number
}

/**
 * 交付趋势：按时间桶统计区间内结单订单的按期 / 逾期数量与按期率。
 * 按期判定与 computeDeliveryStats 一致：结单日期（finalPaidAt 日期部分）≤ 预计交付日。
 * @param orders 订单（含 finalPaidAt / expectedEndDate，按 finalPaidAt 归属桶）
 * @param buckets 时间桶
 */
export function aggregateDeliveryTrend(
  orders: OrderLikeForDelivery[],
  buckets: StatsBucket[],
): DeliveryTrendPoint[] {
  return buckets.map(bucket => {
    let onTime = 0
    let late = 0
    for (const o of orders) {
      if (!o.finalPaidAt) continue
      const paid = o.finalPaidAt.slice(0, 10)
      if (paid < bucket.start || paid > bucket.end) continue
      const expected = o.expectedEndDate?.slice(0, 10)
      if (expected && paid <= expected) onTime++
      else late++
    }
    const total = onTime + late
    return {
      label: bucket.label,
      onTime,
      late,
      rate: total > 0 ? Math.round((onTime / total) * 1000) / 10 : 0,
    }
  })
}

export function computeDeliveryStats(
  orders: OrderLikeForDelivery[],
  transitions: TransitionLike[],
  range: StatsRange,
): DeliveryStats {
  const byOrder = new Map<string, TransitionLike[]>()
  for (const t of transitions) {
    if (!byOrder.has(t.orderId)) byOrder.set(t.orderId, [])
    byOrder.get(t.orderId)!.push(t)
  }

  let completedCount = 0
  let onTimeCount = 0
  let cycleSum = 0
  let cycleCount = 0

  for (const o of orders) {
    if (!dateInRange(o.finalPaidAt, range)) continue
    completedCount++

    // 按期判定：结单日期（日期部分）≤ 预计交付日期
    const paid = o.finalPaidAt!.slice(0, 10)
    const expected = o.expectedEndDate?.slice(0, 10)
    if (expected && paid <= expected) onTimeCount++

    // 绘制周期：开工 → 完工
    const list = (byOrder.get(o.id) ?? []).slice().sort((a, b) => a.transitionDate.localeCompare(b.transitionDate))
    const start = list.length > 0 ? list[0].transitionDate : o.actualStartDate
    const done = list.find(t => t.toStageId === 'st-done')?.transitionDate
    const finish = done ?? o.finalPaidAt
    if (start && finish) {
      cycleSum += diffDays(start, finish)
      cycleCount++
    }
  }

  return {
    completedCount,
    onTimeCount,
    lateCount: completedCount - onTimeCount,
    onTimeRate: completedCount > 0 ? Math.round((onTimeCount / completedCount) * 1000) / 10 : 0,
    avgCycleDays: cycleCount > 0 ? Math.round((cycleSum / cycleCount) * 10) / 10 : 0,
  }
}

function diffDays(from: string, to: string): number {
  const a = parseDate(from)
  const b = parseDate(to)
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000))
}

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

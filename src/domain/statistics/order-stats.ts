/**
 * 订单聚合（纯函数）。
 * - 本期订单 = 区间内新建（createdAt 日期在范围内）
 * - 本期结单 = 区间内收尾款结单（finalPaidAt 日期在范围内）
 * - 阶段分布 / 类别分布 = 区间内新建订单的当前状态分布
 * - 订单量趋势 = 按时间桶聚合新建订单数
 */
import { dateInRange, type StatsRange, type StatsBucket } from '@/domain/statistics/date-range'

export interface OrderLikeForStats {
  id: string
  createdAt: string
  finalPaidAt?: string
  orderStatus: string
  currentStage?: string
  isUrgent: boolean
  expectedAmount?: number
}

export interface OrderStats {
  /** 区间内新建订单数 */
  createdCount: number
  /** 区间内结单订单数（finalPaidAt 在范围内） */
  completedCount: number
  /** 区间内新建的紧急订单数 */
  urgentCount: number
}

export function computeOrderStats(orders: OrderLikeForStats[], range: StatsRange): OrderStats {
  let createdCount = 0
  let completedCount = 0
  let urgentCount = 0
  for (const o of orders) {
    if (dateInRange(o.createdAt, range)) {
      createdCount++
      if (o.isUrgent) urgentCount++
    }
    if (dateInRange(o.finalPaidAt, range)) completedCount++
  }
  return { createdCount, completedCount, urgentCount }
}

export interface StageDist {
  stageId: string
  stageName: string
  count: number
}

/** 阶段分布：区间内新建订单的当前阶段分布（按设置中的阶段顺序输出，0 计数的阶段也保留） */
export function aggregateOrdersByStage(
  orders: OrderLikeForStats[],
  stages: { id: string; name: string }[],
  range: StatsRange,
): StageDist[] {
  const countMap = new Map<string, number>()
  for (const o of orders) {
    if (!dateInRange(o.createdAt, range)) continue
    const stageId = o.currentStage || ''
    countMap.set(stageId, (countMap.get(stageId) ?? 0) + 1)
  }
  return stages.map(s => ({ stageId: s.id, stageName: s.name, count: countMap.get(s.id) ?? 0 }))
}

export interface CategoryDist {
  categoryId: string
  categoryName: string
  count: number
}

/** 稿件类别分布：区间内新建订单的类别计数（一单可多类别，按关联计数） */
export function aggregateOrdersByCategory(
  orders: OrderLikeForStats[],
  orderCategories: { orderId: string; categoryId: string }[],
  categories: { id: string; name: string }[],
  range: StatsRange,
): CategoryDist[] {
  const createdOrderIds = new Set(
    orders.filter(o => dateInRange(o.createdAt, range)).map(o => o.id),
  )
  const countMap = new Map<string, number>()
  for (const oc of orderCategories) {
    if (!createdOrderIds.has(oc.orderId)) continue
    countMap.set(oc.categoryId, (countMap.get(oc.categoryId) ?? 0) + 1)
  }
  return categories.map(c => ({ categoryId: c.id, categoryName: c.name, count: countMap.get(c.id) ?? 0 }))
}

export interface OrderTrendPoint {
  label: string
  count: number
}

/** 订单量趋势：按时间桶聚合区间内新建订单数 */
export function aggregateOrderTrend(
  orders: OrderLikeForStats[],
  buckets: StatsBucket[],
): OrderTrendPoint[] {
  return buckets.map(bucket => {
    let count = 0
    for (const o of orders) {
      const d = o.createdAt?.slice(0, 10) ?? ''
      if (d >= bucket.start && d <= bucket.end) count++
    }
    return { label: bucket.label, count }
  })
}

export interface AmountRangeBucket {
  label: string
  /** 区间下限（含） */
  min: number
  /** 区间上限（含）；null 表示无上限 */
  max: number | null
  count: number
}

/** 金额分布等宽档位数（含末档开区间） */
export const AMOUNT_RANGE_COUNT = 8

/**
 * 按步长生成等宽价位区间：≤step / step-2step / … / 末档 >(N-1)·step。
 * 步长由用户输入（x 轴单位长度），默认 100。
 */
export function buildAmountRanges(step: number): { label: string; min: number; max: number | null }[] {
  const safeStep = Number.isFinite(step) && step > 0 ? Math.round(step) : 100
  const ranges: { label: string; min: number; max: number | null }[] = []
  for (let i = 0; i < AMOUNT_RANGE_COUNT; i++) {
    const min = i * safeStep
    const max = (i + 1) * safeStep
    if (i === AMOUNT_RANGE_COUNT - 1) {
      ranges.push({ label: `>${min}`, min, max: null })
    } else if (i === 0) {
      ranges.push({ label: `≤${max}`, min, max })
    } else {
      ranges.push({ label: `${min}-${max}`, min, max })
    }
  }
  return ranges
}

/** 订单金额分布：区间内新建订单按预计金额（expectedAmount）分等宽价位区间计数，步长可配置 */
export function aggregateOrderAmountRange(
  orders: OrderLikeForStats[],
  range: StatsRange,
  step = 100,
): AmountRangeBucket[] {
  return buildAmountRanges(step).map((r, i) => {
    const isFirst = i === 0
    const isLast = r.max === null
    const count = orders.filter(o => {
      if (!dateInRange(o.createdAt, range)) return false
      const amount = isFinite(o.expectedAmount as number) ? (o.expectedAmount as number) : 0
      if (isFirst) return amount <= (r.max as number)
      if (isLast) return amount > r.min
      return amount > r.min && amount <= (r.max as number)
    }).length
    return { label: r.label, min: r.min, max: r.max, count }
  })
}

/**
 * 阶段耗时分析（纯函数）：
 * - 阶段耗时分布 = 区间内结单订单在各绘制阶段的停留天数（跨订单聚合，
 *   每阶段停留 = 进入该阶段到进入下一阶段的时间差，最后阶段停留到完工日）
 * - 订单耗时明细 = 区间内结单订单「开工 → 完工」周期逐单明细
 * 数据来源：订单的阶段流转记录（StageTransition）+ 结单时间（finalPaidAt）。
 */
import { dateInRange, type StatsRange } from '@/domain/statistics/date-range'

export interface StageTransitionLike {
  orderId: string
  toStageId?: string
  toStageName?: string
  toStageColor?: string
  transitionDate: string
}

export interface OrderLikeForDuration {
  id: string
  orderNo?: string
  name: string
  customerId?: string
  finalPaidAt?: string
  actualStartDate?: string
}

export interface StageDuration {
  stageId: string
  stageName: string
  stageColor?: string
  /** 该阶段累计停留天数（跨订单） */
  totalDays: number
  /** 经历过该阶段的结单订单数 */
  count: number
  /** 平均停留天数（1 位小数） */
  avgDays: number
}

/** 绘制阶段模板（设置里配置的顺序：待开始 → 自定义阶段 → 完成） */
export interface StageTemplateLike {
  id: string
  name: string
  color?: string
}

export interface OrderDurationRow {
  orderId: string
  orderNo: string
  orderName: string
  customerId?: string
  customerName?: string
  /** 开工日期 YYYY-MM-DD */
  startDate: string
  /** 完工日期 YYYY-MM-DD */
  finishDate: string
  /** 绘制周期（自然日） */
  cycleDays: number
}

/** 区间内结单订单（finalPaidAt 在范围内） */
function completedOrders(orders: OrderLikeForDuration[], range: StatsRange): OrderLikeForDuration[] {
  return orders.filter(o => dateInRange(o.finalPaidAt, range))
}

function groupTransitions(
  transitions: StageTransitionLike[],
): Map<string, StageTransitionLike[]> {
  const map = new Map<string, StageTransitionLike[]>()
  for (const t of transitions) {
    const list = map.get(t.orderId) ?? []
    list.push(t)
    map.set(t.orderId, list)
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.transitionDate.localeCompare(b.transitionDate))
  }
  return map
}

/**
 * 阶段耗时分布：对区间内结单订单的流转记录，计算每个绘制阶段的累计/平均停留天数。
 * 传入 templateStages（设置模板顺序：待开始 → 自定义阶段 → 完成）时，
 * 结果按模板顺序输出且补全所有阶段（无停留数据的阶段 totalDays=0），
 * 供雷达图按模板顺序顺时针展示；不传则仅返回有数据的阶段（按耗时降序）。
 * @param orders 订单（含 finalPaidAt，仅统计区间内结单订单）
 * @param transitions 全部阶段流转记录（内部按订单分组排序）
 * @param range 时间范围
 * @param templateStages 可选：绘制阶段模板（决定输出顺序与完整性）
 */
export function aggregateStageDuration(
  orders: OrderLikeForDuration[],
  transitions: StageTransitionLike[],
  range: StatsRange,
  templateStages?: StageTemplateLike[],
): StageDuration[] {
  const byOrder = groupTransitions(transitions)
  const agg = new Map<string, { stageId: string; stageName: string; stageColor?: string; total: number; count: number }>()

  for (const o of completedOrders(orders, range)) {
    const list = byOrder.get(o.id) ?? []
    if (list.length === 0) continue
    const finish = o.finalPaidAt!.slice(0, 10)
    for (let i = 0; i < list.length; i++) {
      const cur = list[i]
      const stageId = cur.toStageId ?? `stage-${i}`
      const stageName = cur.toStageName ?? stageId
      const entry = agg.get(stageId) ?? { stageId, stageName, stageColor: cur.toStageColor, total: 0, count: 0 }
      const enter = cur.transitionDate.slice(0, 10)
      const leave = i + 1 < list.length ? list[i + 1].transitionDate.slice(0, 10) : finish
      const days = diffDays(enter, leave)
      if (days > 0) {
        entry.total += days
        entry.count++
        agg.set(stageId, entry)
      }
    }
  }

  const build = (s: { stageId: string; stageName: string; stageColor?: string; total: number; count: number }): StageDuration => ({
    stageId: s.stageId,
    stageName: s.stageName,
    stageColor: s.stageColor,
    totalDays: s.total,
    count: s.count,
    avgDays: s.count > 0 ? Math.round((s.total / s.count) * 10) / 10 : 0,
  })

  // 按模板顺序输出并补全：模板之外的聚合阶段（如遗留 id）忽略
  if (templateStages && templateStages.length > 0) {
    return templateStages.map(tpl => {
      const found = agg.get(tpl.id)
      return found
        ? { ...build(found), stageName: tpl.name, stageColor: tpl.color ?? found.stageColor }
        : { stageId: tpl.id, stageName: tpl.name, stageColor: tpl.color, totalDays: 0, count: 0, avgDays: 0 }
    })
  }

  return [...agg.values()].map(build).sort((a, b) => b.totalDays - a.totalDays)
}

/**
 * 订单耗时明细：区间内结单订单逐单绘制周期。
 * 开工 = 该订单第一条流转时间；无流转回退 actualStartDate。
 * 完工 = 流转到 st-done 的时间；无则回退 finalPaidAt。
 * @param customers 客户（用于订单行关联客户名）
 */
export function aggregateOrderDurations(
  orders: OrderLikeForDuration[],
  transitions: StageTransitionLike[],
  customers: { id: string; name: string }[],
  range: StatsRange,
): OrderDurationRow[] {
  const byOrder = groupTransitions(transitions)
  const customerMap = new Map(customers.map(c => [c.id, c.name]))
  const rows: OrderDurationRow[] = []

  for (const o of completedOrders(orders, range)) {
    const list = byOrder.get(o.id) ?? []
    const start = list.length > 0 ? list[0].transitionDate.slice(0, 10) : o.actualStartDate?.slice(0, 10)
    const done = list.find(t => t.toStageId === 'st-done')?.transitionDate.slice(0, 10)
    const finish = done ?? o.finalPaidAt!.slice(0, 10)
    if (!start || !finish) continue
    rows.push({
      orderId: o.id,
      orderNo: o.orderNo ?? '',
      orderName: o.name,
      customerId: o.customerId,
      customerName: o.customerId ? customerMap.get(o.customerId) : undefined,
      startDate: start,
      finishDate: finish,
      cycleDays: diffDays(start, finish),
    })
  }

  return rows.sort((a, b) => b.cycleDays - a.cycleDays)
}

function diffDays(from: string, to: string): number {
  return Math.max(0, Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86400000))
}

function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

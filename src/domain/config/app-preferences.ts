/**
 * 应用偏好配置（纯函数 + 类型）。
 *
 * 属于「展示/交互类」偏好（甘特图、货币、订单编号、看板/列表阈值等），
 * 与业务模板（来源/阶段/类别等，存 Dexie）不同，偏好用 localStorage 持久化。
 */

export interface AppPreferences {
  /** 甘特图默认行高（px） */
  ganttRowHeight: number
  /** 甘特图最小行高（px） */
  ganttMinRowHeight: number
  /** 甘特图最大行高（px） */
  ganttMaxRowHeight: number
  /** 甘特图默认缩放密度（px/天） */
  ganttDefaultPxPerDay: number
  /** 甘特图左侧任务栏宽度（px） */
  ganttLabelWidth: number
  /** 甘特图最小时间窗（单侧天数，±N 天） */
  ganttMinRangeDays: number
  /** 金额显示货币符号 */
  currencySymbol: string
  /** 订单编号前缀 */
  orderNoPrefix: string
  /** 订单编号日期样式 */
  orderNoDateStyle: 'yyMMdd' | 'yyyyMMdd'
  /** 订单编号序列位数（随机数补零位数） */
  orderNoSeqDigits: number
  /** 看板「剩余 N 天」标红阈值 */
  kanbanUrgentDays: number
  /** 列表默认每页条数 */
  listPageSize: number
  /** 列表默认排序字段 */
  listDefaultSortKey: string
  /** 列表默认排序方向 */
  listDefaultSortDirection: 'asc' | 'desc'
  /** 统计页「订单金额分布」x 轴单位长度（每档金额） */
  statsAmountStep: number
}

export const DEFAULT_PREFERENCES: AppPreferences = {
  ganttRowHeight: 64,
  ganttMinRowHeight: 32,
  ganttMaxRowHeight: 120,
  ganttDefaultPxPerDay: 12,
  ganttLabelWidth: 210,
  ganttMinRangeDays: 45,
  currencySymbol: '¥',
  orderNoPrefix: 'HT',
  orderNoDateStyle: 'yyMMdd',
  orderNoSeqDigits: 3,
  kanbanUrgentDays: 2,
  listPageSize: 10,
  listDefaultSortKey: 'createdAt',
  listDefaultSortDirection: 'desc',
  statsAmountStep: 50,
}

/** 整数钳制：非法/越界回落默认值 */
function clampInt(raw: unknown, min: number, max: number, fallback: number): number {
  const n = Number(raw)
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : fallback
}

/** 合并持久化值：缺省/非法字段回落默认值 */
export function sanitizePreferences(raw: Partial<AppPreferences> | null | undefined): AppPreferences {
  const d = DEFAULT_PREFERENCES
  const r = raw ?? {}
  return {
    ganttRowHeight: clampInt(r.ganttRowHeight, 32, 160, d.ganttRowHeight),
    ganttMinRowHeight: clampInt(r.ganttMinRowHeight, 24, 120, d.ganttMinRowHeight),
    ganttMaxRowHeight: clampInt(r.ganttMaxRowHeight, 48, 240, d.ganttMaxRowHeight),
    ganttDefaultPxPerDay: clampInt(r.ganttDefaultPxPerDay, 3, 56, d.ganttDefaultPxPerDay),
    ganttLabelWidth: clampInt(r.ganttLabelWidth, 120, 360, d.ganttLabelWidth),
    ganttMinRangeDays: clampInt(r.ganttMinRangeDays, 14, 180, d.ganttMinRangeDays),
    currencySymbol: typeof r.currencySymbol === 'string' && r.currencySymbol.trim() ? r.currencySymbol.trim().slice(0, 4) : d.currencySymbol,
    orderNoPrefix: typeof r.orderNoPrefix === 'string' && r.orderNoPrefix.trim() ? r.orderNoPrefix.trim().slice(0, 6) : d.orderNoPrefix,
    orderNoDateStyle: r.orderNoDateStyle === 'yyyyMMdd' ? 'yyyyMMdd' : 'yyMMdd',
    orderNoSeqDigits: clampInt(r.orderNoSeqDigits, 2, 6, d.orderNoSeqDigits),
    kanbanUrgentDays: clampInt(r.kanbanUrgentDays, 0, 30, d.kanbanUrgentDays),
    listPageSize: clampInt(r.listPageSize, 5, 100, d.listPageSize),
    listDefaultSortKey: typeof r.listDefaultSortKey === 'string' && r.listDefaultSortKey ? r.listDefaultSortKey : d.listDefaultSortKey,
    listDefaultSortDirection: r.listDefaultSortDirection === 'asc' ? 'asc' : 'desc',
    statsAmountStep: clampInt(r.statsAmountStep, 1, 100000, d.statsAmountStep),
  }
}

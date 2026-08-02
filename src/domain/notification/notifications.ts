/**
 * 通知领域模型：候选通知生成（纯函数，today 注入便于测试）。
 * 生成规则（需求文档 4.1）：
 * - 紧急催收：待付定金/尾款状态超过「预计交付日」且逾期天数 ≥ 阈值
 * - 即将到期：进行中订单距「预计交付日」≤ N 天
 * - 跟进催办：跟进条目「截止日期」到期且未完成
 * - 每日汇总：打开应用时若已到推送时间且今天未发过日报，生成「今日待处理」汇总
 */

export interface NotificationCandidate {
  /** 通知类型：overdue（催收）/ due-soon（即将到期）/ followup-due（跟进到期）/ daily-summary（日报） */
  type: 'overdue' | 'due-soon' | 'followup-due' | 'daily-summary'
  title: string
  content: string
  relatedId?: string
  relatedType?: string
}

/** 幂等去重键：同类型 + 同关联对象只生成/保留一条（日报除外，按日期去重见 store） */
export function notificationDedupKey(n: { type: string; relatedId?: string }): string {
  return `${n.type}:${n.relatedId ?? ''}`
}

/** 本地日期 YYYY-MM-DD（日报按本地「今天」去重，避免 UTC 偏移跨天） */
export function localDateStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 当前时间是否已到每日汇总推送时间（HH:mm 字符串比较，本地时区） */
export function isSummaryTime(today: Date, time: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(time)) return false
  const pad = (n: number) => String(n).padStart(2, '0')
  const now = `${pad(today.getHours())}:${pad(today.getMinutes())}`
  return now >= time
}

/** date 距今的天数（今天=0，已过为正、未到为负） */
export function daysFromToday(dateStr: string, today: Date): number {
  const d = new Date(dateStr)
  const t = new Date(today)
  d.setHours(0, 0, 0, 0)
  t.setHours(0, 0, 0, 0)
  return Math.round((t.getTime() - d.getTime()) / 86400000)
}

/** 距 date 还有几天（未到为正、已过为负） */
export function daysUntil(dateStr: string, today: Date): number {
  return -daysFromToday(dateStr, today)
}

interface OrderLike {
  id: string
  name: string
  customerId?: string
  orderStatus: string
  paymentStatus: string
  expectedEndDate?: string
}

interface CustomerLike {
  id: string
  name: string
}

interface FollowUpLike {
  id: string
  title: string
  dueDate?: string
  status: string
}

function customerNameOf(customerId: string | undefined, customers: CustomerLike[]): string {
  return customers.find(c => c.id === customerId)?.name ?? '未知客户'
}

/**
 * 紧急催收通知：待付定金（unpaid）或待付尾款（deposit_paid 未结单）且
 * 超过预计交付日逾期天数 ≥ thresholdDays。
 */
export function buildOverdueNotifications(
  orders: OrderLike[],
  customers: CustomerLike[],
  thresholdDays: number,
  today: Date,
): NotificationCandidate[] {
  const result: NotificationCandidate[] = []
  for (const o of orders) {
    if (!o.expectedEndDate) continue
    if (o.orderStatus === 'completed' || o.orderStatus === 'voided') continue
    const overdue = daysFromToday(o.expectedEndDate, today)
    if (overdue < thresholdDays) continue
    const isDeposit = o.paymentStatus === 'unpaid'
    const kind = isDeposit ? '定金' : '尾款'
    const name = customerNameOf(o.customerId, customers)
    result.push({
      type: 'overdue',
      title: `[紧急] ${kind}逾期提醒`,
      content: `客户「${name}」的订单「${o.name}」${kind}已逾期 ${overdue} 天`,
      relatedId: o.id,
      relatedType: 'order',
    })
  }
  return result
}

/**
 * 即将到期通知：进行中订单距预计交付日 ≤ days 天（含今天到期）。
 */
export function buildDueSoonNotifications(
  orders: OrderLike[],
  days: number,
  today: Date,
): NotificationCandidate[] {
  const result: NotificationCandidate[] = []
  for (const o of orders) {
    if (!o.expectedEndDate) continue
    if (o.orderStatus === 'completed' || o.orderStatus === 'voided') continue
    const remaining = daysUntil(o.expectedEndDate, today)
    if (remaining < 0 || remaining > days) continue
    result.push({
      type: 'due-soon',
      title: `[交付] 即将到期`,
      content: `订单「${o.name}」距预计交付${remaining === 0 ? '仅剩今天' : `还有 ${remaining} 天`}`,
      relatedId: o.id,
      relatedType: 'order',
    })
  }
  return result
}

/**
 * 跟进催办通知：未完成跟进且截止日期已到（今天或已过）。
 */
export function buildFollowUpNotifications(
  followUps: FollowUpLike[],
  today: Date,
): NotificationCandidate[] {
  const result: NotificationCandidate[] = []
  for (const f of followUps) {
    if (!f.dueDate || f.status === 'completed') continue
    const overdue = daysFromToday(f.dueDate, today)
    if (overdue < 0) continue
    result.push({
      type: 'followup-due',
      title: `[跟进] 跟进到期`,
      content: `「${f.title}」${overdue === 0 ? '今日到期' : `已逾期 ${overdue} 天`}，请及时处理`,
      relatedId: f.id,
      relatedType: 'followup',
    })
  }
  return result
}

/**
 * 每日汇总通知（需求 4.1.2 日报）：统计今日待处理订单与到期跟进。
 * - 待处理订单：未完成未退单（非 completed/voided）
 * - 今日到期/逾期：其中预计交付 ≤ 今天（无交付日期不计入到期）
 * - 到期跟进：未完成且截止日期 ≤ 今天
 * 无任何待处理时返回 null（今日无事不打扰）
 */
export function buildDailySummaryNotification(
  orders: OrderLike[],
  followUps: FollowUpLike[],
  today: Date,
): NotificationCandidate | null {
  const pendingOrders = orders.filter(o => o.orderStatus !== 'completed' && o.orderStatus !== 'voided')
  const dueCount = pendingOrders.filter(o => o.expectedEndDate && daysFromToday(o.expectedEndDate, today) >= 0).length
  const dueFollowUps = followUps.filter(f => f.status !== 'completed' && f.dueDate && daysFromToday(f.dueDate, today) >= 0).length

  if (pendingOrders.length === 0 && dueFollowUps === 0) return null

  const parts: string[] = []
  if (pendingOrders.length > 0) {
    parts.push(`今日有 ${pendingOrders.length} 个待处理订单${dueCount > 0 ? `（含 ${dueCount} 个今日到期/逾期）` : ''}`)
  }
  if (dueFollowUps > 0) {
    parts.push(`${dueFollowUps} 条跟进到期`)
  }

  return {
    type: 'daily-summary',
    title: '[日报] 今日待处理汇总',
    content: parts.join('，'),
  }
}

/** 汇总全部候选通知（催收 + 到期 + 跟进 + 日报），按类型分组顺序输出 */
export function buildAllNotifications(
  orders: OrderLike[],
  customers: CustomerLike[],
  followUps: FollowUpLike[],
  config: { overdueDays: number; dueDays: number; dailySummaryEnabled: boolean; summaryTime: string },
  today: Date,
): NotificationCandidate[] {
  const daily = config.dailySummaryEnabled && isSummaryTime(today, config.summaryTime)
    ? buildDailySummaryNotification(orders, followUps, today)
    : null
  return [
    ...buildOverdueNotifications(orders, customers, config.overdueDays, today),
    ...buildDueSoonNotifications(orders, config.dueDays, today),
    ...buildFollowUpNotifications(followUps, today),
    ...(daily ? [daily] : []),
  ]
}

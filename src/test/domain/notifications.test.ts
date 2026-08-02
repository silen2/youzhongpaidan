import { describe, it, expect } from 'vitest'
import {
  daysFromToday,
  daysUntil,
  notificationDedupKey,
  isSummaryTime,
  buildOverdueNotifications,
  buildDueSoonNotifications,
  buildFollowUpNotifications,
  buildDailySummaryNotification,
  buildAllNotifications,
} from '@/domain/notification/notifications'

const TODAY = new Date('2026-08-01T12:00:00')

const customers = [{ id: 'c1', name: '客户A' }]

const orders = [
  // 待付尾款、逾期 5 天（> 阈值 3）→ 催收
  { id: 'o1', name: '单1', customerId: 'c1', orderStatus: 'awaiting_final', paymentStatus: 'deposit_paid', expectedEndDate: '2026-07-27' },
  // 待付定金、逾期 2 天（< 阈值 3）→ 不催收
  { id: 'o2', name: '单2', customerId: 'c1', orderStatus: 'in_progress', paymentStatus: 'unpaid', expectedEndDate: '2026-07-30' },
  // 进行中、距交付 1 天 → 即将到期
  { id: 'o3', name: '单3', customerId: 'c1', orderStatus: 'in_progress', paymentStatus: 'deposit_paid', expectedEndDate: '2026-08-02' },
  // 已完成 → 不参与任何提醒
  { id: 'o4', name: '单4', customerId: 'c1', orderStatus: 'completed', paymentStatus: 'final_paid', expectedEndDate: '2026-07-01' },
]

const followUps = [
  { id: 'f1', title: '催配色', dueDate: '2026-08-01', status: 'pending' }, // 今日到期
  { id: 'f2', title: '发样图', dueDate: '2026-07-30', status: 'pending' }, // 逾期 2 天
  { id: 'f3', title: '已完结', dueDate: '2026-07-28', status: 'completed' }, // 已完成不提醒
  { id: 'f4', title: '未来', dueDate: '2026-08-05', status: 'pending' }, // 未到不提醒
]

describe('日期计算', () => {
  it('daysFromToday：今天=0、已过为正、未到为负', () => {
    expect(daysFromToday('2026-08-01', TODAY)).toBe(0)
    expect(daysFromToday('2026-07-27', TODAY)).toBe(5)
    expect(daysFromToday('2026-08-05', TODAY)).toBe(-4)
  })

  it('daysUntil 与 daysFromToday 相反', () => {
    expect(daysUntil('2026-08-02', TODAY)).toBe(1)
    expect(daysUntil('2026-07-27', TODAY)).toBe(-5)
  })

  it('notificationDedupKey：类型+关联对象唯一', () => {
    expect(notificationDedupKey({ type: 'overdue', relatedId: 'o1' })).toBe('overdue:o1')
    expect(notificationDedupKey({ type: 'overdue', relatedId: 'o2' })).toBe('overdue:o2')
    expect(notificationDedupKey({ type: 'due-soon', relatedId: 'o1' })).toBe('due-soon:o1')
  })
})

describe('buildOverdueNotifications', () => {
  it('逾期 ≥ 阈值才催收，且区分定金/尾款', () => {
    const list = buildOverdueNotifications(orders, customers, 3, TODAY)
    expect(list).toHaveLength(1)
    expect(list[0].relatedId).toBe('o1')
    expect(list[0].title).toContain('尾款')
    expect(list[0].content).toContain('已逾期 5 天')
  })

  it('阈值放宽后逾期 2 天也催收（定金）', () => {
    const list = buildOverdueNotifications(orders, customers, 1, TODAY)
    expect(list.map(n => n.relatedId)).toEqual(['o1', 'o2'])
    expect(list[1].title).toContain('定金')
  })

  it('已完成/退单订单不催收', () => {
    const all = buildOverdueNotifications([...orders, { id: 'o5', name: '退单', customerId: 'c1', orderStatus: 'voided', paymentStatus: 'unpaid', expectedEndDate: '2026-07-01' }], customers, 1, TODAY)
    expect(all.every(n => n.relatedId !== 'o4' && n.relatedId !== 'o5')).toBe(true)
  })
})

describe('buildDueSoonNotifications', () => {
  it('距交付 ≤ 2 天提醒，今天到期显示「仅剩今天」', () => {
    const list = buildDueSoonNotifications([...orders, { id: 'o5', name: '今天交', customerId: 'c1', orderStatus: 'in_progress', paymentStatus: 'deposit_paid', expectedEndDate: '2026-08-01' }], 2, TODAY)
    expect(list.map(n => n.relatedId).sort()).toEqual(['o3', 'o5'])
    expect(list.find(n => n.relatedId === 'o5')?.content).toContain('仅剩今天')
  })

  it('已完成订单不参与到期提醒', () => {
    const list = buildDueSoonNotifications(orders, 10, TODAY)
    expect(list.every(n => n.relatedId !== 'o4')).toBe(true)
  })
})

describe('buildFollowUpNotifications', () => {
  it('只提醒未完成且已到期/逾期的跟进', () => {
    const list = buildFollowUpNotifications(followUps, TODAY)
    expect(list.map(n => n.relatedId).sort()).toEqual(['f1', 'f2'])
    expect(list.find(n => n.relatedId === 'f1')?.content).toContain('今日到期')
    expect(list.find(n => n.relatedId === 'f2')?.content).toContain('已逾期 2 天')
  })
})

describe('buildAllNotifications', () => {
  it('汇总三类通知（关闭日报）', () => {
    const list = buildAllNotifications(orders, customers, followUps, { overdueDays: 3, dueDays: 2, dailySummaryEnabled: false, summaryTime: '09:00' }, TODAY)
    const types = list.map(n => n.type)
    expect(types).toContain('overdue')
    expect(types).toContain('due-soon')
    expect(types).toContain('followup-due')
    expect(list).toHaveLength(1 + 1 + 2)
  })
})

describe('每日汇总 daily-summary', () => {
  it('isSummaryTime：到达推送时间 true、未到 false、非法格式 false', () => {
    expect(isSummaryTime(new Date('2026-08-01T09:00:00'), '09:00')).toBe(true)
    expect(isSummaryTime(new Date('2026-08-01T08:59:00'), '09:00')).toBe(false)
    expect(isSummaryTime(new Date('2026-08-01T12:00:00'), '12:30')).toBe(false)
    expect(isSummaryTime(new Date('2026-08-01T12:00:00'), 'abc')).toBe(false)
  })

  it('buildDailySummaryNotification：统计待处理订单 + 今日到期/逾期 + 到期跟进', () => {
    const d = buildDailySummaryNotification(orders, followUps, TODAY)!
    expect(d.type).toBe('daily-summary')
    expect(d.title).toContain('日报')
    // 待处理 o1/o2/o3（o4 已完成不计）；到期/逾期 o1、o2；跟进到期 f1、f2
    expect(d.content).toBe('今日有 3 个待处理订单（含 2 个今日到期/逾期），2 条跟进到期')
  })

  it('仅订单无跟进到期也生成', () => {
    const d = buildDailySummaryNotification(orders, [], TODAY)!
    expect(d.content).toBe('今日有 3 个待处理订单（含 2 个今日到期/逾期）')
  })

  it('无任何待处理订单/到期跟进返回 null（今日无事不打扰）', () => {
    const allCompleted = [{ id: 'o4', name: '单4', customerId: 'c1', orderStatus: 'completed', paymentStatus: 'final_paid', expectedEndDate: '2026-07-01' }]
    expect(buildDailySummaryNotification(allCompleted, [], TODAY)).toBeNull()
    expect(buildDailySummaryNotification([], followUps.filter(f => f.status === 'completed'), TODAY)).toBeNull()
  })

  it('待处理订单不含已完成/退单', () => {
    const mixed = [
      ...orders,
      { id: 'o9', name: '退单', customerId: 'c1', orderStatus: 'voided', paymentStatus: 'unpaid', expectedEndDate: '2026-08-01' },
    ]
    const d = buildDailySummaryNotification(mixed, [], TODAY)!
    expect(d.content).toBe('今日有 3 个待处理订单（含 2 个今日到期/逾期）')
  })

  it('buildAllNotifications：开关开且到推送时间才含日报；关/未到时间不含', () => {
    const base = { overdueDays: 3, dueDays: 2 }
    const on = buildAllNotifications(orders, customers, followUps, { ...base, dailySummaryEnabled: true, summaryTime: '09:00' }, TODAY)
    expect(on.map(n => n.type)).toContain('daily-summary')
    const off = buildAllNotifications(orders, customers, followUps, { ...base, dailySummaryEnabled: false, summaryTime: '09:00' }, TODAY)
    expect(off.map(n => n.type)).not.toContain('daily-summary')
    const early = buildAllNotifications(orders, customers, followUps, { ...base, dailySummaryEnabled: true, summaryTime: '23:59' }, TODAY)
    expect(early.map(n => n.type)).not.toContain('daily-summary')
  })
})

import { describe, it, expect } from 'vitest'
import {
  computeIncomeStats,
  aggregateIncomeTrend,
  aggregateIncomeTrendByType,
  aggregateIncomeBySource,
  aggregateIncomeByType,
  type PaymentRecordLike,
} from '@/domain/statistics/income'

const RANGE = { start: '2026-08-01', end: '2026-08-31' }

function record(overrides: Partial<PaymentRecordLike>): PaymentRecordLike {
  return {
    id: 'r1',
    orderId: 'o1',
    type: 'deposit',
    direction: 'in',
    amount: 1000,
    receivedAt: '2026-08-10T00:00:00.000Z',
    ...overrides,
  }
}

const orders = [
  { id: 'o1', sourceId: 's1' },
  { id: 'o2', sourceId: 's2' },
]
// 米画师 10%：到手 = 金额 × 0.9
const sources = new Map([
  ['s1', { feeType: 'percentage' as const, feeValue: 10 }],
  ['s2', { feeType: 'percentage' as const, feeValue: 0 }],
])
const sourceOf = (id: string | undefined) => (id ? (sources.get(id) ?? null) : null)

describe('computeIncomeStats', () => {
  it('区间内入账到手合计（扣手续费）', () => {
    const records = [record({ amount: 1000 }), record({ id: 'r2', amount: 500 })]
    expect(computeIncomeStats(records, orders, sourceOf, RANGE)).toEqual({
      totalIncome: 1350, // 1000×0.9 + 500×0.9
      totalRefunded: 0,
      netIncome: 1350,
    })
  })

  it('区间外记录不计入', () => {
    const records = [record({ receivedAt: '2026-07-31T00:00:00.000Z' }), record({ receivedAt: '2026-09-01T00:00:00.000Z' })]
    expect(computeIncomeStats(records, orders, sourceOf, RANGE).totalIncome).toBe(0)
  })

  it('手动退款出账计入退款，红冲出账不计', () => {
    const records = [
      record({ id: 'in1', amount: 1000 }),
      record({ id: 'out1', orderId: 'o1', type: undefined, direction: 'out', amount: 300, receivedAt: '2026-08-15T00:00:00.000Z' }),
      record({ id: 'out2', orderId: 'o1', type: undefined, direction: 'out', refundOf: 'in2', amount: 500, receivedAt: '2026-08-16T00:00:00.000Z' }),
      record({ id: 'in2', amount: 500, receivedAt: '2026-08-16T00:00:00.000Z' }),
    ]
    const stats = computeIncomeStats(records, orders, sourceOf, RANGE)
    expect(stats.totalIncome).toBe(900) // in1 1000×0.9 计入；in2 被红冲互抵为 0
    expect(stats.totalRefunded).toBe(300)
    expect(stats.netIncome).toBe(600)
  })
})

describe('aggregateIncomeTrend', () => {
  const buckets = [
    { label: '08-01', start: '2026-08-01', end: '2026-08-07' },
    { label: '08-08', start: '2026-08-08', end: '2026-08-14' },
  ]
  it('按桶聚合收入/退款/净收入', () => {
    const records = [
      record({ amount: 1000, receivedAt: '2026-08-05T00:00:00.000Z' }), // 桶1
      record({ id: 'r2', amount: 500, receivedAt: '2026-08-10T00:00:00.000Z' }), // 桶2
    ]
    const trend = aggregateIncomeTrend(records, orders, sourceOf, buckets)
    expect(trend).toEqual([
      { label: '08-01', income: 900, refund: 0, net: 900 },
      { label: '08-08', income: 450, refund: 0, net: 450 },
    ])
  })
})

describe('aggregateIncomeTrendByType', () => {
  const buckets = [
    { label: '08-01', start: '2026-08-01', end: '2026-08-07' },
    { label: '08-08', start: '2026-08-08', end: '2026-08-14' },
  ]
  it('按桶聚合定金/尾款到手与净收入（含退款扣减）', () => {
    const records = [
      record({ type: 'deposit', amount: 1000, receivedAt: '2026-08-05T00:00:00.000Z' }), // 桶1 定金 900
      record({ id: 'r2', type: 'final', amount: 600, receivedAt: '2026-08-10T00:00:00.000Z' }), // 桶2 尾款 540
      record({ id: 'r3', type: 'deposit', amount: 200, receivedAt: '2026-08-12T00:00:00.000Z' }), // 桶2 定金 180
      record({ id: 'r4', orderId: 'o1', type: undefined, direction: 'out', amount: 100, receivedAt: '2026-08-13T00:00:00.000Z' }), // 桶2 退款 100
    ]
    const trend = aggregateIncomeTrendByType(records, orders, sourceOf, buckets)
    expect(trend).toEqual([
      { label: '08-01', deposit: 900, final: 0, net: 900 },
      { label: '08-08', deposit: 180, final: 540, net: 620 }, // 720 − 100
    ])
  })

  it('被红冲的入账不计入定金/尾款', () => {
    const records = [
      record({ id: 'in1', type: 'deposit', amount: 1000, receivedAt: '2026-08-05T00:00:00.000Z' }),
      record({ id: 'out1', orderId: 'o1', type: undefined, direction: 'out', refundOf: 'in1', amount: 1000, receivedAt: '2026-08-06T00:00:00.000Z' }),
    ]
    const trend = aggregateIncomeTrendByType(records, orders, sourceOf, buckets)
    expect(trend[0]).toEqual({ label: '08-01', deposit: 0, final: 0, net: 0 })
  })
})

describe('aggregateIncomeBySource', () => {
  it('按来源聚合收入与手续费，收入降序', () => {
    const records = [
      record({ orderId: 'o1', amount: 1000 }), // s1 10% → 900/100
      record({ id: 'r2', orderId: 'o2', amount: 800 }), // s2 0% → 800/0
      record({ id: 'r3', orderId: 'o1', amount: 200 }), // s1 → 180/20
    ]
    const list = aggregateIncomeBySource(records, orders, sourceOf, RANGE)
    expect(list[0]).toEqual({ sourceId: 's1', sourceName: 's1', income: 1080, fee: 120 })
    expect(list[1]).toEqual({ sourceId: 's2', sourceName: 's2', income: 800, fee: 0 })
  })
})

describe('aggregateIncomeByType', () => {
  it('定金/尾款到手构成', () => {
    const records = [
      record({ type: 'deposit', amount: 1000 }), // 900
      record({ id: 'r2', type: 'final', amount: 600 }), // 540
      record({ id: 'r3', type: 'final', amount: 400 }), // 360
    ]
    const list = aggregateIncomeByType(records, orders, sourceOf, RANGE)
    expect(list).toEqual([
      { type: 'deposit', label: '定金', income: 900 },
      { type: 'final', label: '尾款', income: 900 },
    ])
  })
})

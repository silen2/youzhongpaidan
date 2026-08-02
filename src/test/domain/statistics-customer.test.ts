import { describe, it, expect } from 'vitest'
import { aggregateCustomerIncome, aggregateIncomeByPlatform } from '@/domain/statistics/customer-stats'

const RANGE = { start: '2026-08-01', end: '2026-08-31' }

const orders = [
  { id: 'o1', customerId: 'c1', sourceId: 's1' },
  { id: 'o2', customerId: 'c2', sourceId: 's2' },
  { id: 'o3', customerId: 'c1', sourceId: 's1' },
]
const customers = [
  { id: 'c1', name: '客户甲', platform: '米画师' },
  { id: 'c2', name: '客户乙', platform: '' },
]
const sources = new Map([
  ['s1', { feeType: 'percentage' as const, feeValue: 10 }],
  ['s2', { feeType: 'percentage' as const, feeValue: 0 }],
])
const sourceOf = (id: string | undefined) => (id ? (sources.get(id) ?? null) : null)

function record(overrides: Partial<{ id: string; orderId: string; direction: string; refundOf: string; amount: number; receivedAt: string }> = {}) {
  return {
    id: 'r1',
    orderId: 'o1',
    direction: 'in',
    amount: 1000,
    receivedAt: '2026-08-10T00:00:00.000Z',
    ...overrides,
  }
}

describe('aggregateCustomerIncome', () => {
  it('按区间内入账到手排行 TOP N，收入降序', () => {
    const records = [
      record({ id: 'r1', orderId: 'o1', amount: 1000 }), // 甲 900
      record({ id: 'r2', orderId: 'o2', amount: 800 }), // 乙 800
      record({ id: 'r3', orderId: 'o3', amount: 500 }), // 甲 450
      record({ id: 'r4', orderId: 'o1', amount: 1000, receivedAt: '2026-07-01T00:00:00.000Z' }), // 区间外不计
    ]
    const list = aggregateCustomerIncome(records, orders, customers, sourceOf, RANGE)
    expect(list).toEqual([
      { customerId: 'c1', customerName: '客户甲', income: 1350 },
      { customerId: 'c2', customerName: '客户乙', income: 800 },
    ])
  })

  it('被红冲的入账不计入排行', () => {
    const records = [
      record({ id: 'in1', orderId: 'o1', amount: 1000 }),
      record({ id: 'out1', orderId: 'o1', direction: 'out', refundOf: 'in1', amount: 1000, receivedAt: '2026-08-11T00:00:00.000Z' }),
    ]
    const list = aggregateCustomerIncome(records, orders, customers, sourceOf, RANGE)
    expect(list).toEqual([])
  })

  it('topN 限制条数', () => {
    const records = [
      record({ id: 'r1', orderId: 'o1', amount: 100 }),
      record({ id: 'r2', orderId: 'o2', amount: 50 }),
    ]
    expect(aggregateCustomerIncome(records, orders, customers, sourceOf, RANGE, 1)).toHaveLength(1)
  })
})

describe('aggregateIncomeByPlatform', () => {
  it('按客户平台聚合区间收入，空平台归「其他」', () => {
    const records = [
      record({ id: 'r1', orderId: 'o1', amount: 1000 }), // 米画师 900
      record({ id: 'r2', orderId: 'o2', amount: 500 }), // 其他 500
      record({ id: 'r3', orderId: 'o3', amount: 200 }), // 米画师 180
    ]
    const list = aggregateIncomeByPlatform(records, orders, customers, sourceOf, RANGE)
    expect(list).toEqual([
      { platform: '米画师', income: 1080 },
      { platform: '其他', income: 500 },
    ])
  })
})

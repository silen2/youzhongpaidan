import { describe, it, expect } from 'vitest'
import { aggregateCustomerValue } from '@/domain/statistics/customer-value'

const RANGE = { start: '2026-08-01', end: '2026-08-31' }

function customer(id: string, name: string, weight: number) {
  return { id, name, weight }
}

function order(id: string, customerId: string, createdAt: string, sourceId = 's1') {
  return { id, customerId, sourceId, createdAt }
}

function record(orderId: string, amount: number, receivedAt: string, overrides: Partial<{ id: string; direction: string; refundOf: string }> = {}) {
  return { id: `${orderId}-${receivedAt}`, orderId, direction: 'in', amount, receivedAt, ...overrides }
}

const sourceOf = () => ({ feeType: 'percentage' as const, feeValue: 10 })

describe('aggregateCustomerValue', () => {
  it('贡献 = 区间内入账到手（扣手续费），权重/订单数取自客户与区间新建订单', () => {
    const customers = [
      customer('c1', '客户甲', 80),
      customer('c2', '客户乙', 60),
    ]
    const orders = [
      order('o1', 'c1', '2026-08-05T00:00:00.000Z'),
      order('o2', 'c1', '2026-08-20T00:00:00.000Z'),
      order('o3', 'c2', '2026-08-10T00:00:00.000Z'),
      order('o4', 'c2', '2026-09-01T00:00:00.000Z'), // 区间外新建不计
    ]
    const records = [
      record('o1', 1000, '2026-08-06T00:00:00.000Z'),
      record('o2', 500, '2026-08-21T00:00:00.000Z'),
      record('o3', 2000, '2026-08-11T00:00:00.000Z'),
    ]
    const result = aggregateCustomerValue(customers, records, orders, sourceOf, RANGE)
    expect(result).toHaveLength(2)
    const c1 = result.find(p => p.customerId === 'c1')!
    const c2 = result.find(p => p.customerId === 'c2')!
    expect(c1.contribution).toBe(1350) // (1000+500) * 0.9
    expect(c1.weight).toBe(80)
    expect(c1.orderCount).toBe(2)
    expect(c2.contribution).toBe(1800) // 2000 * 0.9
    expect(c2.orderCount).toBe(1)
  })

  it('被红冲的入账不计入贡献', () => {
    const customers = [customer('c1', '客户甲', 50)]
    const orders = [order('o1', 'c1', '2026-08-05T00:00:00.000Z')]
    const records = [
      record('o1', 1000, '2026-08-06T00:00:00.000Z'),
      record('o1', 1000, '2026-08-07T00:00:00.000Z', { id: 'r2', direction: 'out', refundOf: `${'o1-2026-08-06T00:00:00.000Z'}` }),
    ]
    const result = aggregateCustomerValue(customers, records, orders, sourceOf, RANGE)
    expect(result[0].contribution).toBe(0) // 唯一入账被红冲
  })

  it('区间内无收入且无新建订单的客户被过滤', () => {
    const customers = [
      customer('c1', '活跃客户', 70),
      customer('c2', '沉睡客户', 90),
    ]
    const orders = [order('o1', 'c1', '2026-08-05T00:00:00.000Z')]
    const records = [record('o1', 1000, '2026-08-06T00:00:00.000Z')]
    const result = aggregateCustomerValue(customers, records, orders, sourceOf, RANGE)
    expect(result.map(p => p.customerId)).toEqual(['c1'])
  })

  it('全部无活动时返回空数组', () => {
    const customers = [customer('c1', '客户甲', 50)]
    const result = aggregateCustomerValue(customers, [], [], sourceOf, RANGE)
    expect(result).toEqual([])
  })
})

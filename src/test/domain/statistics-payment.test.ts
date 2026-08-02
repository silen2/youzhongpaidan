import { describe, it, expect } from 'vitest'
import {
  aggregatePaymentTypeDist,
  aggregatePaymentStatusDist,
  aggregatePendingByCustomer,
} from '@/domain/statistics/payment-stats'

const RANGE = { start: '2026-08-01', end: '2026-08-31' }

function record(orderId: string, amount: number, receivedAt: string, overrides: Partial<{ id: string; type: string; direction: string; refundOf: string }> = {}) {
  return { id: `${orderId}-${receivedAt}`, orderId, type: 'deposit', direction: 'in', amount, receivedAt, ...overrides }
}

function order(id: string, overrides: Partial<{ customerId: string; sourceId: string; orderStatus: string; paymentStatus: string; expectedAmount: number; depositActual: number; finalActual: number }> = {}) {
  return { id, customerId: 'c0', sourceId: 's1', expectedAmount: 0, depositActual: 0, finalActual: 0, ...overrides }
}

const sourceOf = () => ({ feeType: 'percentage' as const, feeValue: 10 })

describe('aggregatePaymentTypeDist（收付类型构成）', () => {
  it('定金/尾款入账到手（扣手续费）+ 手动退款出账', () => {
    const orders = [order('o1'), order('o2'), order('o3')]
    const records = [
      record('o1', 1000, '2026-08-05T00:00:00.000Z', { type: 'deposit' }),
      record('o2', 2000, '2026-08-10T00:00:00.000Z', { type: 'final' }),
      record('o3', 500, '2026-08-12T00:00:00.000Z', { direction: 'out' }),
    ]
    const result = aggregatePaymentTypeDist(records, orders, sourceOf, RANGE)
    const byType = Object.fromEntries(result.map(r => [r.type, r.value]))
    expect(byType.deposit).toBe(900) // 1000 * 0.9
    expect(byType.final).toBe(1800) // 2000 * 0.9
    expect(byType.refund).toBe(500)
  })

  it('被红冲的入账不计入收付；红冲是冲销不计退款', () => {
    const orders = [order('o1')]
    const records = [
      record('o1', 1000, '2026-08-05T00:00:00.000Z', { id: 'r1' }),
      record('o1', 1000, '2026-08-06T00:00:00.000Z', { id: 'r2', direction: 'out', refundOf: 'r1' }),
    ]
    const result = aggregatePaymentTypeDist(records, orders, sourceOf, RANGE)
    const byType = Object.fromEntries(result.map(r => [r.type, r.value]))
    expect(byType.deposit).toBe(0)
    expect(byType.refund).toBe(0)
  })

  it('区间外的账单不计入', () => {
    const orders = [order('o1')]
    const records = [record('o1', 1000, '2026-09-01T00:00:00.000Z')]
    const result = aggregatePaymentTypeDist(records, orders, sourceOf, RANGE)
    expect(result.every(r => r.value === 0)).toBe(true)
  })
})

describe('aggregatePaymentStatusDist（收款状态构成）', () => {
  it('按收款状态统计全部订单，过滤空档', () => {
    const orders = [
      order('o1', { paymentStatus: 'unpaid' }),
      order('o2', { paymentStatus: 'deposit_paid' }),
      order('o3', { paymentStatus: 'deposit_paid' }),
      order('o4', { paymentStatus: 'final_paid' }),
    ]
    const result = aggregatePaymentStatusDist(orders)
    const byStatus = Object.fromEntries(result.map(r => [r.status, r.count]))
    expect(byStatus.unpaid).toBe(1)
    expect(byStatus.deposit_paid).toBe(2)
    expect(byStatus.final_paid).toBe(1)
    expect(result.find(r => r.status === 'arrears')).toBeUndefined()
  })

  it('缺省 paymentStatus 视为未收款', () => {
    const orders = [order('o1')]
    const result = aggregatePaymentStatusDist(orders)
    expect(result).toEqual([{ status: 'unpaid', count: 1 }])
  })
})

describe('aggregatePendingByCustomer（待收账款排行）', () => {
  it('按客户聚合剩余应收到手金额，排除结单/退单/免收', () => {
    const customers = [{ id: 'c1', name: '客户甲' }, { id: 'c2', name: '客户乙' }]
    const orders = [
      // c1：应收 5000，已收定金 1000 → 待收 4000 * 0.9 = 3600
      order('o1', { customerId: 'c1', expectedAmount: 5000, depositActual: 1000 }),
      // c2：应收 2000，已收 2000 → 无待收
      order('o2', { customerId: 'c2', expectedAmount: 2000, depositActual: 2000 }),
      // 结单订单不参与
      order('o3', { customerId: 'c1', expectedAmount: 1000, orderStatus: 'completed' }),
      // 免收不参与
      order('o4', { customerId: 'c2', expectedAmount: 1000, paymentStatus: 'waived' }),
    ]
    const result = aggregatePendingByCustomer(orders, customers, sourceOf)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ customerId: 'c1', customerName: '客户甲', amount: 3600, orderCount: 1 })
  })

  it('按待收金额降序', () => {
    const customers = [{ id: 'c1', name: '客户甲' }, { id: 'c2', name: '客户乙' }]
    const orders = [
      order('o1', { customerId: 'c1', expectedAmount: 3000 }),
      order('o2', { customerId: 'c2', expectedAmount: 8000 }),
    ]
    const result = aggregatePendingByCustomer(orders, customers, sourceOf)
    expect(result.map(r => r.customerId)).toEqual(['c2', 'c1'])
  })
})

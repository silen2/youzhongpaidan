import { describe, it, expect } from 'vitest'
import { computeArrearsWaived } from '@/domain/statistics/arrears-waived'

const RANGE = { start: '2026-08-01', end: '2026-08-31' }

function order(overrides: Partial<{
  id: string
  orderNo: string
  name: string
  customerId: string
  expectedAmount: number
  depositActual: number
  finalActual: number
  paymentStatus: string
  createdAt: string
}> = {}) {
  return {
    id: 'o1',
    orderNo: 'HT001',
    name: '测试单',
    customerId: 'c1',
    expectedAmount: 1000,
    depositActual: 300,
    finalActual: 0,
    paymentStatus: 'arrears',
    createdAt: '2026-08-05T00:00:00.000Z',
    ...overrides,
  }
}

const customers = [
  { id: 'c1', name: '客户甲' },
  { id: 'c2', name: '客户乙' },
]

describe('computeArrearsWaived', () => {
  it('欠款金额 = 应收 − 已收定金 − 已收尾款', () => {
    const orders = [order({ id: 'a', expectedAmount: 1000, depositActual: 300, finalActual: 200 })]
    const result = computeArrearsWaived(orders, customers, RANGE)
    expect(result.summary.arrearsOrderCount).toBe(1)
    expect(result.summary.arrearsTotal).toBe(500)
    expect(result.arrearsOrders[0].amount).toBe(500)
    expect(result.arrearsOrders[0].customerName).toBe('客户甲')
  })

  it('已收满不产生欠款（金额 ≤ 0 跳过）', () => {
    const orders = [order({ id: 'a', expectedAmount: 1000, depositActual: 500, finalActual: 500 })]
    const result = computeArrearsWaived(orders, customers, RANGE)
    expect(result.summary.arrearsOrderCount).toBe(0)
    expect(result.summary.arrearsTotal).toBe(0)
  })

  it('免单按订单原价计，客户维度分别聚合', () => {
    const orders = [
      order({ id: 'w1', customerId: 'c1', paymentStatus: 'waived', expectedAmount: 800 }),
      order({ id: 'w2', customerId: 'c1', paymentStatus: 'waived', expectedAmount: 200 }),
      order({ id: 'a1', customerId: 'c2', paymentStatus: 'arrears', expectedAmount: 600, depositActual: 100 }),
      order({ id: 'a2', customerId: 'c2', paymentStatus: 'arrears', expectedAmount: 400, depositActual: 0 }),
    ]
    const result = computeArrearsWaived(orders, customers, RANGE)
    expect(result.summary.waivedOrderCount).toBe(2)
    expect(result.summary.waivedTotal).toBe(1000)
    expect(result.summary.waivedCustomerCount).toBe(1)
    expect(result.waivedCustomers[0]).toMatchObject({ customerId: 'c1', count: 2, amount: 1000 })
    expect(result.summary.arrearsOrderCount).toBe(2)
    expect(result.summary.arrearsTotal).toBe(900) // (600-100) + 400
    expect(result.arrearsCustomers[0]).toMatchObject({ customerId: 'c2', count: 2, amount: 900 })
  })

  it('区间外创建（createdAt）的欠款/免单订单不计', () => {
    const orders = [
      order({ id: 'a', createdAt: '2026-09-01T00:00:00.000Z' }), // 区间外
    ]
    const result = computeArrearsWaived(orders, customers, RANGE)
    expect(result.summary.arrearsOrderCount).toBe(0)
    expect(result.summary.arrearsCustomerCount).toBe(0)
  })

  it('无欠款免单时全 0', () => {
    const orders = [order({ id: 'a', paymentStatus: 'completed' })]
    const result = computeArrearsWaived(orders, customers, RANGE)
    expect(result.summary).toEqual({
      arrearsCustomerCount: 0,
      arrearsOrderCount: 0,
      arrearsTotal: 0,
      waivedCustomerCount: 0,
      waivedOrderCount: 0,
      waivedTotal: 0,
    })
    expect(result.arrearsOrders).toEqual([])
    expect(result.waivedOrders).toEqual([])
    expect(result.arrearsCustomers).toEqual([])
    expect(result.waivedCustomers).toEqual([])
  })
})

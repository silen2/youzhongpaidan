import { describe, it, expect } from 'vitest'
import { computeDeliveryStats, aggregateDeliveryTrend } from '@/domain/statistics/delivery'

const RANGE = { start: '2026-08-01', end: '2026-08-31' }

function order(overrides: Partial<{ id: string; finalPaidAt: string; expectedEndDate: string; actualStartDate: string }> = {}) {
  return {
    id: 'o1',
    finalPaidAt: '2026-08-20T00:00:00.000Z',
    expectedEndDate: '2026-08-20T00:00:00.000Z',
    actualStartDate: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

function transition(orderId: string, toStageId: string, transitionDate: string) {
  return { orderId, toStageId, transitionDate }
}

describe('computeDeliveryStats', () => {
  it('按期率：结单日 ≤ 预计交付日计按期', () => {
    const orders = [
      order({ id: 'a', finalPaidAt: '2026-08-15T00:00:00.000Z', expectedEndDate: '2026-08-20T00:00:00.000Z' }), // 按期
      order({ id: 'b', finalPaidAt: '2026-08-25T00:00:00.000Z', expectedEndDate: '2026-08-20T00:00:00.000Z' }), // 逾期
      order({ id: 'c', finalPaidAt: '2026-08-20T00:00:00.000Z', expectedEndDate: '2026-08-20T00:00:00.000Z' }), // 同日按期
      order({ id: 'd', finalPaidAt: '2026-07-01T00:00:00.000Z', expectedEndDate: '2026-08-01T00:00:00.000Z' }), // 区间外结单不计
    ]
    const stats = computeDeliveryStats(orders, [], RANGE)
    expect(stats.completedCount).toBe(3)
    expect(stats.onTimeCount).toBe(2)
    expect(stats.lateCount).toBe(1)
    expect(stats.onTimeRate).toBe(66.7) // 2/3
  })

  it('无结单订单时按期率与周期为 0', () => {
    const stats = computeDeliveryStats([order({ id: 'x', finalPaidAt: '2026-09-01T00:00:00.000Z' })], [], RANGE)
    expect(stats.completedCount).toBe(0)
    expect(stats.onTimeRate).toBe(0)
    expect(stats.avgCycleDays).toBe(0)
  })

  it('平均周期：从阶段流转推导开工→完工', () => {
    const orders = [
      order({ id: 'a', finalPaidAt: '2026-08-10T00:00:00.000Z', expectedEndDate: '2026-08-20T00:00:00.000Z' }),
      order({ id: 'b', finalPaidAt: '2026-08-15T00:00:00.000Z', expectedEndDate: '2026-08-20T00:00:00.000Z' }),
    ]
    const transitions = [
      transition('a', 'st-sketch', '2026-08-01T00:00:00.000Z'), // 开工 08-01
      transition('a', 'st-done', '2026-08-10T00:00:00.000Z'), // 完工 08-10 → 9 天
      transition('b', 'st-sketch', '2026-08-05T00:00:00.000Z'), // 开工 08-05
      transition('b', 'st-done', '2026-08-12T00:00:00.000Z'), // 完工 08-12 → 7 天
    ]
    const stats = computeDeliveryStats(orders, transitions, RANGE)
    expect(stats.avgCycleDays).toBe(8) // (9+7)/2
  })

  it('无流转记录时回退 actualStartDate → finalPaidAt', () => {
    const orders = [
      order({ id: 'a', actualStartDate: '2026-08-02T00:00:00.000Z', finalPaidAt: '2026-08-12T00:00:00.000Z' }),
    ]
    const stats = computeDeliveryStats(orders, [], RANGE)
    expect(stats.avgCycleDays).toBe(10)
  })

  it('无开工或完工信息时该订单不计入周期', () => {
    const orders = [order({ id: 'a', actualStartDate: '', finalPaidAt: '2026-08-12T00:00:00.000Z' })]
    const stats = computeDeliveryStats(orders, [], RANGE)
    expect(stats.avgCycleDays).toBe(0)
  })
})

describe('aggregateDeliveryTrend', () => {
  it('按时间桶统计按期/逾期数与按期率', () => {
    const orders = [
      order({ id: 'a', finalPaidAt: '2026-08-05T00:00:00.000Z', expectedEndDate: '2026-08-10T00:00:00.000Z' }), // 第1桶按期
      order({ id: 'b', finalPaidAt: '2026-08-06T00:00:00.000Z', expectedEndDate: '2026-08-01T00:00:00.000Z' }), // 第1桶逾期
      order({ id: 'c', finalPaidAt: '2026-08-20T00:00:00.000Z', expectedEndDate: '2026-08-20T00:00:00.000Z' }), // 第2桶按期
    ]
    const buckets = [
      { label: '08-01', start: '2026-08-01', end: '2026-08-10' },
      { label: '08-11', start: '2026-08-11', end: '2026-08-20' },
    ]
    const result = aggregateDeliveryTrend(orders, buckets)
    expect(result[0]).toEqual({ label: '08-01', onTime: 1, late: 1, rate: 50 })
    expect(result[1]).toEqual({ label: '08-11', onTime: 1, late: 0, rate: 100 })
  })

  it('无结单订单的桶按期率为 0', () => {
    const orders: { id: string; finalPaidAt?: string; expectedEndDate?: string; actualStartDate?: string }[] = []
    const buckets = [{ label: '08-01', start: '2026-08-01', end: '2026-08-10' }]
    const result = aggregateDeliveryTrend(orders, buckets)
    expect(result[0]).toEqual({ label: '08-01', onTime: 0, late: 0, rate: 0 })
  })
})

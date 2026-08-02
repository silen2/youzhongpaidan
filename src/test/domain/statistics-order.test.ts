import { describe, it, expect } from 'vitest'
import {
  computeOrderStats,
  aggregateOrdersByStage,
  aggregateOrdersByCategory,
  aggregateOrderTrend,
  aggregateOrderAmountRange,
  type OrderLikeForStats,
} from '@/domain/statistics/order-stats'

const RANGE = { start: '2026-08-01', end: '2026-08-31' }

function order(overrides: Partial<OrderLikeForStats>): OrderLikeForStats {
  return {
    id: 'o1',
    createdAt: '2026-08-10T00:00:00.000Z',
    orderStatus: 'in_progress',
    currentStage: 'st-sketch',
    isUrgent: false,
    ...overrides,
  }
}

describe('computeOrderStats', () => {
  it('区间内新建/结单/紧急计数', () => {
    const orders = [
      order({ id: 'a', createdAt: '2026-08-05T00:00:00.000Z', isUrgent: true, finalPaidAt: '2026-08-20T00:00:00.000Z' }),
      order({ id: 'b', createdAt: '2026-08-15T00:00:00.000Z', finalPaidAt: '2026-08-25T00:00:00.000Z' }),
      order({ id: 'c', createdAt: '2026-07-30T00:00:00.000Z', finalPaidAt: '2026-08-30T00:00:00.000Z' }), // 区间外新建但区间内结单
      order({ id: 'd', createdAt: '2026-09-01T00:00:00.000Z', finalPaidAt: '2026-09-05T00:00:00.000Z' }), // 区间外
    ]
    const stats = computeOrderStats(orders, RANGE)
    expect(stats.createdCount).toBe(2)
    expect(stats.completedCount).toBe(3)
    expect(stats.urgentCount).toBe(1)
  })
})

describe('aggregateOrdersByStage', () => {
  const stages = [
    { id: 'st-pending', name: '待开始' },
    { id: 'st-sketch', name: '线稿' },
    { id: 'st-done', name: '完成' },
  ]
  it('区间内新建订单按当前阶段分布，0 计数的阶段保留', () => {
    const orders = [
      order({ id: 'a', createdAt: '2026-08-05T00:00:00.000Z', currentStage: 'st-sketch' }),
      order({ id: 'b', createdAt: '2026-08-15T00:00:00.000Z', currentStage: 'st-sketch' }),
      order({ id: 'c', createdAt: '2026-08-20T00:00:00.000Z', currentStage: 'st-pending' }),
      order({ id: 'd', createdAt: '2026-07-01T00:00:00.000Z', currentStage: 'st-done' }), // 区间外不计
    ]
    const dist = aggregateOrdersByStage(orders, stages, RANGE)
    expect(dist).toEqual([
      { stageId: 'st-pending', stageName: '待开始', count: 1 },
      { stageId: 'st-sketch', stageName: '线稿', count: 2 },
      { stageId: 'st-done', stageName: '完成', count: 0 },
    ])
  })
})

describe('aggregateOrdersByCategory', () => {
  it('区间内订单的类别计数（多类别一单计多次）', () => {
    const orders = [
      order({ id: 'a', createdAt: '2026-08-05T00:00:00.000Z' }),
      order({ id: 'b', createdAt: '2026-08-05T00:00:00.000Z' }),
      order({ id: 'c', createdAt: '2026-07-01T00:00:00.000Z' }), // 区间外
    ]
    const ocs = [
      { orderId: 'a', categoryId: 'c1' },
      { orderId: 'a', categoryId: 'c2' },
      { orderId: 'b', categoryId: 'c1' },
      { orderId: 'c', categoryId: 'c1' },
    ]
    const cats = [
      { id: 'c1', name: '立绘' },
      { id: 'c2', name: '插画' },
      { id: 'c3', name: '表情包' },
    ]
    expect(aggregateOrdersByCategory(orders, ocs, cats, RANGE)).toEqual([
      { categoryId: 'c1', categoryName: '立绘', count: 2 },
      { categoryId: 'c2', categoryName: '插画', count: 1 },
      { categoryId: 'c3', categoryName: '表情包', count: 0 },
    ])
  })
})

describe('aggregateOrderTrend', () => {
  const buckets = [
    { label: '08-01', start: '2026-08-01', end: '2026-08-07' },
    { label: '08-08', start: '2026-08-08', end: '2026-08-14' },
  ]
  it('按桶聚合新建订单数', () => {
    const orders = [
      order({ id: 'a', createdAt: '2026-08-05T00:00:00.000Z' }),
      order({ id: 'b', createdAt: '2026-08-10T00:00:00.000Z' }),
      order({ id: 'c', createdAt: '2026-09-01T00:00:00.000Z' }),
    ]
    expect(aggregateOrderTrend(orders, buckets)).toEqual([
      { label: '08-01', count: 1 },
      { label: '08-08', count: 1 },
    ])
  })
})

describe('aggregateOrderAmountRange', () => {
  it('按步长等宽分档（≤step、(step,2step]…、末档开区间），无金额兜底归最低档', () => {
    const orders = [
      order({ id: 'a', expectedAmount: 50 }), // ≤100
      order({ id: 'b', expectedAmount: 100 }), // 上边界 → ≤100
      order({ id: 'c', expectedAmount: 300 }), // 上边界 → 200-300
      order({ id: 'd', expectedAmount: 320 }), // 300-400
      order({ id: 'e', expectedAmount: 800 }), // >700
      order({ id: 'f', expectedAmount: 1500 }), // >700
      order({ id: 'g', expectedAmount: 3000 }), // >700
      order({ id: 'h', expectedAmount: undefined }), // 无金额 → ≤100
      order({ id: 'i', createdAt: '2026-07-01T00:00:00.000Z', expectedAmount: 9999 }), // 区间外不计
    ]
    const dist = aggregateOrderAmountRange(orders, RANGE, 100)
    expect(dist.map(d => d.label)).toEqual(['≤100', '100-200', '200-300', '300-400', '400-500', '500-600', '600-700', '>700'])
    expect(dist.map(d => d.count)).toEqual([3, 0, 1, 1, 0, 0, 0, 3])
  })

  it('步长可配置（500），区间按新步长生成', () => {
    const orders = [
      order({ id: 'a', expectedAmount: 400 }), // ≤500
      order({ id: 'b', expectedAmount: 800 }), // 500-1000
      order({ id: 'c', expectedAmount: 4200 }), // >3500
    ]
    const dist = aggregateOrderAmountRange(orders, RANGE, 500)
    expect(dist.map(d => d.label)).toEqual(['≤500', '500-1000', '1000-1500', '1500-2000', '2000-2500', '2500-3000', '3000-3500', '>3500'])
    expect(dist.map(d => d.count)).toEqual([1, 1, 0, 0, 0, 0, 0, 1])
  })

  it('非法步长兜底为 100，区间内无订单时全 0', () => {
    const dist = aggregateOrderAmountRange([order({ id: 'x', createdAt: '2026-07-01T00:00:00.000Z' })], RANGE, 0)
    expect(dist.length).toBe(8)
    expect(dist[0].label).toBe('≤100')
    expect(dist.every(d => d.count === 0)).toBe(true)
  })
})

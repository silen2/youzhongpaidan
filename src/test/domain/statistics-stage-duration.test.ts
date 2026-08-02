import { describe, it, expect } from 'vitest'
import { aggregateStageDuration, aggregateOrderDurations } from '@/domain/statistics/stage-duration'

const RANGE = { start: '2026-08-01', end: '2026-08-31' }

function order(overrides: Partial<{ id: string; orderNo: string; name: string; customerId: string; finalPaidAt: string; actualStartDate: string }> = {}) {
  return {
    id: 'o1',
    orderNo: 'HT001',
    name: '测试单',
    customerId: 'c1',
    finalPaidAt: '2026-08-20T00:00:00.000Z',
    actualStartDate: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

function transition(orderId: string, toStageId: string, toStageName: string, transitionDate: string) {
  return { orderId, toStageId, toStageName, transitionDate }
}

describe('aggregateStageDuration', () => {
  it('按进入→离开计算每阶段停留，最后阶段停留到完工', () => {
    const orders = [order({ id: 'a', finalPaidAt: '2026-08-10T00:00:00.000Z' })]
    const transitions = [
      transition('a', 'st-sketch', '线稿', '2026-08-01T00:00:00.000Z'), // 线稿 08-01 → 08-04 = 3 天
      transition('a', 'st-color', '色稿', '2026-08-04T00:00:00.000Z'), // 色稿 08-04 → 08-10 = 6 天
      transition('a', 'st-done', '完成', '2026-08-10T00:00:00.000Z'), // 完成 08-10 → 08-10 = 0 天（不计）
    ]
    const result = aggregateStageDuration(orders, transitions, RANGE)
    const sketch = result.find(s => s.stageId === 'st-sketch')!
    const color = result.find(s => s.stageId === 'st-color')!
    expect(sketch.totalDays).toBe(3)
    expect(sketch.count).toBe(1)
    expect(sketch.avgDays).toBe(3)
    expect(color.totalDays).toBe(6)
    expect(result).not.toContainEqual(expect.objectContaining({ stageId: 'st-done' }))
  })

  it('跨订单聚合阶段累计与订单数', () => {
    const orders = [
      order({ id: 'a', finalPaidAt: '2026-08-10T00:00:00.000Z' }),
      order({ id: 'b', finalPaidAt: '2026-08-15T00:00:00.000Z' }),
    ]
    const transitions = [
      transition('a', 'st-sketch', '线稿', '2026-08-01T00:00:00.000Z'),
      transition('a', 'st-done', '完成', '2026-08-10T00:00:00.000Z'), // a 线稿 9 天
      transition('b', 'st-sketch', '线稿', '2026-08-05T00:00:00.000Z'),
      transition('b', 'st-done', '完成', '2026-08-15T00:00:00.000Z'), // b 线稿 10 天
    ]
    const result = aggregateStageDuration(orders, transitions, RANGE)
    const sketch = result.find(s => s.stageId === 'st-sketch')!
    expect(sketch.totalDays).toBe(19) // 9 + 10
    expect(sketch.count).toBe(2)
    expect(sketch.avgDays).toBe(9.5)
  })

  it('区间外结单订单不计入耗时', () => {
    const orders = [
      order({ id: 'a', finalPaidAt: '2026-08-10T00:00:00.000Z' }),
      order({ id: 'b', finalPaidAt: '2026-09-05T00:00:00.000Z' }), // 区间外
    ]
    const transitions = [
      transition('a', 'st-sketch', '线稿', '2026-08-01T00:00:00.000Z'),
      transition('a', 'st-done', '完成', '2026-08-10T00:00:00.000Z'),
      transition('b', 'st-sketch', '线稿', '2026-08-20T00:00:00.000Z'),
      transition('b', 'st-done', '完成', '2026-09-05T00:00:00.000Z'),
    ]
    const result = aggregateStageDuration(orders, transitions, RANGE)
    expect(result.find(s => s.stageId === 'st-sketch')!.count).toBe(1)
  })

  it('无流转记录时阶段耗时为空', () => {
    const orders = [order({ id: 'a' })]
    const result = aggregateStageDuration(orders, [], RANGE)
    expect(result).toEqual([])
  })

  it('传入模板顺序时按模板输出并补全（无数据阶段为 0）', () => {
    const orders = [order({ id: 'a', finalPaidAt: '2026-08-10T00:00:00.000Z' })]
    const transitions = [
      transition('a', 'st-sketch', '线稿', '2026-08-01T00:00:00.000Z'),
      transition('a', 'st-color', '色稿', '2026-08-04T00:00:00.000Z'),
      transition('a', 'st-done', '完成', '2026-08-10T00:00:00.000Z'),
    ]
    const template = [
      { id: 'st-pending', name: '待开始', color: '#94a3b8' },
      { id: 'st-sketch', name: '线稿', color: '#ef4444' },
      { id: 'st-color', name: '色稿', color: '#3b82f6' },
      { id: 'st-done', name: '完成', color: '#22c55e' },
    ]
    const result = aggregateStageDuration(orders, transitions, RANGE, template)
    expect(result.map(s => s.stageId)).toEqual(['st-pending', 'st-sketch', 'st-color', 'st-done'])
    expect(result[0]).toEqual({ stageId: 'st-pending', stageName: '待开始', stageColor: '#94a3b8', totalDays: 0, count: 0, avgDays: 0 })
    expect(result[1].totalDays).toBe(3) // 线稿
    expect(result[2].totalDays).toBe(6) // 色稿
    expect(result[3].totalDays).toBe(0) // 完成无停留
  })
})

describe('aggregateOrderDurations', () => {
  it('逐单明细：开工→完工周期、关联客户名', () => {
    const orders = [
      order({ id: 'a', orderNo: 'HT-A', name: '单A', customerId: 'c1', finalPaidAt: '2026-08-10T00:00:00.000Z' }),
      order({ id: 'b', orderNo: 'HT-B', name: '单B', customerId: 'c2', finalPaidAt: '2026-08-15T00:00:00.000Z' }),
    ]
    const transitions = [
      transition('a', 'st-sketch', '线稿', '2026-08-01T00:00:00.000Z'),
      transition('a', 'st-done', '完成', '2026-08-10T00:00:00.000Z'), // a 9 天
      transition('b', 'st-sketch', '线稿', '2026-08-05T00:00:00.000Z'),
      transition('b', 'st-done', '完成', '2026-08-15T00:00:00.000Z'), // b 10 天
    ]
    const customers = [
      { id: 'c1', name: '客户甲' },
      { id: 'c2', name: '客户乙' },
    ]
    const rows = aggregateOrderDurations(orders, transitions, customers, RANGE)
    expect(rows).toHaveLength(2)
    expect(rows[0].orderNo).toBe('HT-B') // 周期长的在前
    expect(rows[0].cycleDays).toBe(10)
    expect(rows[0].customerName).toBe('客户乙')
    expect(rows[1].cycleDays).toBe(9)
  })

  it('无流转记录时回退 actualStartDate → finalPaidAt', () => {
    const orders = [
      order({ id: 'a', actualStartDate: '2026-08-02T00:00:00.000Z', finalPaidAt: '2026-08-12T00:00:00.000Z' }),
    ]
    const rows = aggregateOrderDurations(orders, [], [], RANGE)
    expect(rows).toHaveLength(1)
    expect(rows[0].cycleDays).toBe(10)
    expect(rows[0].customerName).toBeUndefined()
  })
})

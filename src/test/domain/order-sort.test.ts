import { describe, it, expect } from 'vitest'
import { sortOrders, compareOrders } from '@/domain/order/order-sort'
import type { Order } from '@/types'

function makeOrder(partial: Partial<Order> & Pick<Order, 'id'>): Order {
  return {
    orderNo: 'HT260101001',
    name: '订单',
    content: '',
    customerId: '',
    sourceId: '',
    expectedAmount: 0,
    actualAmount: 0,
    depositExpected: 0,
    depositActual: 0,
    finalExpected: 0,
    finalActual: 0,
    expectedStartDate: '',
    expectedEndDate: '',
    orderStatus: 'unscheduled',
    paymentStatus: 'unpaid',
    currentStage: '',
    usage: 'personal',
    isUrgent: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  }
}

describe('sortOrders', () => {
  it('空数组返回空数组', () => {
    expect(sortOrders([], 'createdAt', 'desc')).toEqual([])
  })

  it('createdAt desc：最新创建优先（默认）', () => {
    const orders = [
      makeOrder({ id: 'a', createdAt: '2026-01-01T00:00:00.000Z' }),
      makeOrder({ id: 'b', createdAt: '2026-03-01T00:00:00.000Z' }),
      makeOrder({ id: 'c', createdAt: '2026-02-01T00:00:00.000Z' }),
    ]
    expect(sortOrders(orders, 'createdAt', 'desc').map(o => o.id)).toEqual(['b', 'c', 'a'])
  })

  it('createdAt asc：最早创建优先', () => {
    const orders = [
      makeOrder({ id: 'a', createdAt: '2026-01-01T00:00:00.000Z' }),
      makeOrder({ id: 'b', createdAt: '2026-03-01T00:00:00.000Z' }),
      makeOrder({ id: 'c', createdAt: '2026-02-01T00:00:00.000Z' }),
    ]
    expect(sortOrders(orders, 'createdAt', 'asc').map(o => o.id)).toEqual(['a', 'c', 'b'])
  })

  it('closedAt desc：已结单按结单时间倒序，未结单恒排最后', () => {
    const orders = [
      makeOrder({ id: 'done-old', orderStatus: 'completed', finalPaidAt: '2026-02-01T00:00:00.000Z' }),
      makeOrder({ id: 'running', orderStatus: 'in_progress' }),
      makeOrder({ id: 'done-new', orderStatus: 'completed', finalPaidAt: '2026-03-01T00:00:00.000Z' }),
      makeOrder({ id: 'unscheduled', orderStatus: 'unscheduled' }),
    ]
    expect(sortOrders(orders, 'closedAt', 'desc').map(o => o.id)).toEqual([
      'done-new', 'done-old', 'running', 'unscheduled',
    ])
  })

  it('closedAt asc：已结单按结单时间正序，未结单恒排最后', () => {
    const orders = [
      makeOrder({ id: 'done-old', orderStatus: 'completed', finalPaidAt: '2026-02-01T00:00:00.000Z' }),
      makeOrder({ id: 'done-new', orderStatus: 'completed', finalPaidAt: '2026-03-01T00:00:00.000Z' }),
      makeOrder({ id: 'running', orderStatus: 'in_progress' }),
    ]
    expect(sortOrders(orders, 'closedAt', 'asc').map(o => o.id)).toEqual([
      'done-old', 'done-new', 'running',
    ])
  })

  it('closedAt 结单时间回退到 actualEndDate（无 finalPaidAt 时）', () => {
    const orders = [
      makeOrder({ id: 'a', orderStatus: 'completed', actualEndDate: '2026-05-01T00:00:00.000Z' }),
      makeOrder({ id: 'b', orderStatus: 'completed', finalPaidAt: '2026-06-01T00:00:00.000Z', actualEndDate: '2026-04-01T00:00:00.000Z' }),
    ]
    expect(sortOrders(orders, 'closedAt', 'desc').map(o => o.id)).toEqual(['b', 'a'])
  })

  it('expectedEnd asc：预计交付最近优先，无值排最后', () => {
    const orders = [
      makeOrder({ id: 'none', expectedEndDate: '' }),
      makeOrder({ id: 'later', expectedEndDate: '2026-08-10' }),
      makeOrder({ id: 'sooner', expectedEndDate: '2026-08-01' }),
    ]
    expect(sortOrders(orders, 'expectedEnd', 'asc').map(o => o.id)).toEqual([
      'sooner', 'later', 'none',
    ])
  })

  it('expectedAmount desc：预计金额从高到低', () => {
    const orders = [
      makeOrder({ id: 'mid', expectedAmount: 500 }),
      makeOrder({ id: 'high', expectedAmount: 2000 }),
      makeOrder({ id: 'low', expectedAmount: 100 }),
    ]
    expect(sortOrders(orders, 'expectedAmount', 'desc').map(o => o.id)).toEqual([
      'high', 'mid', 'low',
    ])
  })

  it('排序稳定：金额相等时保持原顺序', () => {
    const orders = [
      makeOrder({ id: 'a', expectedAmount: 100 }),
      makeOrder({ id: 'b', expectedAmount: 100 }),
    ]
    expect(sortOrders(orders, 'expectedAmount', 'desc').map(o => o.id)).toEqual(['a', 'b'])
  })

  it('compareOrders 方向反转正确（asc 与 desc 互为镜像）', () => {
    const a = makeOrder({ id: 'a', expectedAmount: 100 })
    const b = makeOrder({ id: 'b', expectedAmount: 200 })
    expect(compareOrders(a, b, 'expectedAmount', 'asc')).toBe(-100)
    expect(compareOrders(a, b, 'expectedAmount', 'desc')).toBe(100)
    expect(compareOrders(b, a, 'expectedAmount', 'asc')).toBe(100)
  })

  it('actualAmount desc：实付金额从高到低', () => {
    const orders = [
      makeOrder({ id: 'mid', actualAmount: 500 }),
      makeOrder({ id: 'high', actualAmount: 2000 }),
      makeOrder({ id: 'low', actualAmount: 100 }),
    ]
    expect(sortOrders(orders, 'actualAmount', 'desc').map(o => o.id)).toEqual([
      'high', 'mid', 'low',
    ])
  })

  it('orderNo asc：订单编号正序', () => {
    const orders = [
      makeOrder({ id: 'b', orderNo: 'HT260102002' }),
      makeOrder({ id: 'a', orderNo: 'HT260101001' }),
      makeOrder({ id: 'c', orderNo: 'HT260103003' }),
    ]
    expect(sortOrders(orders, 'orderNo', 'asc').map(o => o.id)).toEqual(['a', 'b', 'c'])
  })

  it('name desc：订单名称倒序', () => {
    const orders = [
      makeOrder({ id: 'a', name: '半身像' }),
      makeOrder({ id: 'b', name: '立绘' }),
    ]
    expect(sortOrders(orders, 'name', 'desc').map(o => o.id)).toEqual(['b', 'a'])
  })

  it('orderStatus asc：按工作流顺序（未排期 → 已完成 → 已退单）', () => {
    const orders = [
      makeOrder({ id: 'done', orderStatus: 'completed' }),
      makeOrder({ id: 'start', orderStatus: 'not_started' }),
      makeOrder({ id: 'void', orderStatus: 'voided' }),
      makeOrder({ id: 'wait', orderStatus: 'awaiting_deposit' }),
    ]
    expect(sortOrders(orders, 'orderStatus', 'asc').map(o => o.id)).toEqual([
      'wait', 'start', 'done', 'void',
    ])
  })
})

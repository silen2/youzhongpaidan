import { describe, it, expect } from 'vitest'
import { sortCustomers, compareCustomers } from '@/domain/customer/customer-sort'
import type { Customer } from '@/types'

function makeCustomer(partial: Partial<Customer> & Pick<Customer, 'id'>): Customer {
  return {
    name: '客户',
    weight: 0,
    totalSpent: 0,
    maxOrderAmount: 0,
    orderCount: 0,
    completedCount: 0,
    voidedCount: 0,
    waivedCount: 0,
    arrearsCount: 0,
    latePaymentCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  }
}

describe('sortCustomers', () => {
  it('空数组返回空数组', () => {
    expect(sortCustomers([], 'weight', 'desc')).toEqual([])
  })

  it('weight desc：权重高→低', () => {
    const list = [
      makeCustomer({ id: 'a', weight: 40 }),
      makeCustomer({ id: 'b', weight: 90 }),
      makeCustomer({ id: 'c', weight: 10 }),
    ]
    expect(sortCustomers(list, 'weight', 'desc').map(c => c.id)).toEqual(['b', 'a', 'c'])
  })

  it('totalSpent desc：累计消费高→低', () => {
    const list = [
      makeCustomer({ id: 'a', totalSpent: 100 }),
      makeCustomer({ id: 'b', totalSpent: 5000 }),
      makeCustomer({ id: 'c', totalSpent: 800 }),
    ]
    expect(sortCustomers(list, 'totalSpent', 'desc').map(c => c.id)).toEqual(['b', 'c', 'a'])
  })

  it('orderCount desc：订单数多→少', () => {
    const list = [
      makeCustomer({ id: 'a', orderCount: 2 }),
      makeCustomer({ id: 'b', orderCount: 9 }),
      makeCustomer({ id: 'c', orderCount: 5 }),
    ]
    expect(sortCustomers(list, 'orderCount', 'desc').map(c => c.id)).toEqual(['b', 'c', 'a'])
  })

  it('maxOrderAmount desc：最大单金额高→低', () => {
    const list = [
      makeCustomer({ id: 'a', maxOrderAmount: 300 }),
      makeCustomer({ id: 'b', maxOrderAmount: 5000 }),
      makeCustomer({ id: 'c', maxOrderAmount: 800 }),
    ]
    expect(sortCustomers(list, 'maxOrderAmount', 'desc').map(c => c.id)).toEqual(['b', 'c', 'a'])
  })

  it('completedCount desc：已完成订单数多→少', () => {
    const list = [
      makeCustomer({ id: 'a', completedCount: 1 }),
      makeCustomer({ id: 'b', completedCount: 7 }),
      makeCustomer({ id: 'c', completedCount: 4 }),
    ]
    expect(sortCustomers(list, 'completedCount', 'desc').map(c => c.id)).toEqual(['b', 'c', 'a'])
  })

  it('waivedCount desc：免单数多→少', () => {
    const list = [
      makeCustomer({ id: 'a', waivedCount: 3 }),
      makeCustomer({ id: 'b', waivedCount: 0 }),
      makeCustomer({ id: 'c', waivedCount: 1 }),
    ]
    expect(sortCustomers(list, 'waivedCount', 'desc').map(c => c.id)).toEqual(['a', 'c', 'b'])
  })

  it('arrearsCount desc：欠款数多→少', () => {
    const list = [
      makeCustomer({ id: 'a', arrearsCount: 0 }),
      makeCustomer({ id: 'b', arrearsCount: 5 }),
      makeCustomer({ id: 'c', arrearsCount: 2 }),
    ]
    expect(sortCustomers(list, 'arrearsCount', 'desc').map(c => c.id)).toEqual(['b', 'c', 'a'])
  })

  it('latePaymentCount asc：逾期数少→多', () => {
    const list = [
      makeCustomer({ id: 'a', latePaymentCount: 3 }),
      makeCustomer({ id: 'b', latePaymentCount: 0 }),
      makeCustomer({ id: 'c', latePaymentCount: 1 }),
    ]
    expect(sortCustomers(list, 'latePaymentCount', 'asc').map(c => c.id)).toEqual(['b', 'c', 'a'])
  })

  it('createdAt desc/asc：创建时间倒序/正序', () => {
    const list = [
      makeCustomer({ id: 'a', createdAt: '2026-01-01T00:00:00.000Z' }),
      makeCustomer({ id: 'b', createdAt: '2026-03-01T00:00:00.000Z' }),
      makeCustomer({ id: 'c', createdAt: '2026-02-01T00:00:00.000Z' }),
    ]
    expect(sortCustomers(list, 'createdAt', 'desc').map(c => c.id)).toEqual(['b', 'c', 'a'])
    expect(sortCustomers(list, 'createdAt', 'asc').map(c => c.id)).toEqual(['a', 'c', 'b'])
  })

  it('排序稳定：数值相等时保持原顺序', () => {
    const list = [
      makeCustomer({ id: 'a', weight: 50 }),
      makeCustomer({ id: 'b', weight: 50 }),
    ]
    expect(sortCustomers(list, 'weight', 'desc').map(c => c.id)).toEqual(['a', 'b'])
  })

  it('compareCustomers 方向反转正确', () => {
    const a = makeCustomer({ id: 'a', totalSpent: 100 })
    const b = makeCustomer({ id: 'b', totalSpent: 300 })
    expect(compareCustomers(a, b, 'totalSpent', 'asc')).toBe(-200)
    expect(compareCustomers(a, b, 'totalSpent', 'desc')).toBe(200)
  })
})

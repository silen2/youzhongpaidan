import { describe, it, expect } from 'vitest'
import { assertCanDeleteCustomer } from '@/domain/customer/customer-rules'
import { DomainError } from '@/domain/errors'

describe('assertCanDeleteCustomer', () => {
  it('orderCount = 0 时不抛', () => {
    expect(() => assertCanDeleteCustomer(0)).not.toThrow()
  })

  it('orderCount = 1 时抛 DomainError', () => {
    expect(() => assertCanDeleteCustomer(1)).toThrow(DomainError)
  })

  it('orderCount > 1 时抛 DomainError', () => {
    expect(() => assertCanDeleteCustomer(5)).toThrow(DomainError)
  })

  it('错误消息字面量与 store 测试断言一致', () => {
    try {
      assertCanDeleteCustomer(3)
      throw new Error('应抛未抛')
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError)
      expect((e as DomainError).message).toBe('该客户存在关联订单，无法删除')
      expect((e as DomainError).code).toBe('CUSTOMER_HAS_ORDERS')
    }
  })
})

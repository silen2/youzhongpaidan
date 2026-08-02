import { describe, it, expect } from 'vitest'
import { DomainError } from '@/domain/errors'

describe('DomainError', () => {
  it('是 Error 的子类', () => {
    const err = new DomainError('出错了', 'TEST_CODE')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(DomainError)
  })

  it('name 为 DomainError', () => {
    const err = new DomainError('出错了', 'TEST_CODE')
    expect(err.name).toBe('DomainError')
  })

  it('保留 message 与 code', () => {
    const err = new DomainError('该客户存在关联订单，无法删除', 'CUSTOMER_HAS_ORDERS')
    expect(err.message).toBe('该客户存在关联订单，无法删除')
    expect(err.code).toBe('CUSTOMER_HAS_ORDERS')
  })

  it('可用 throw 抛出并被 catch 捕获', () => {
    const thrower = () => {
      throw new DomainError('权重总和必须为 100%', 'WEIGHT_SUM_NOT_100')
    }
    expect(thrower).toThrow(DomainError)
    expect(thrower).toThrow('权重总和必须为 100%')
    try {
      thrower()
    } catch (e) {
      expect((e as DomainError).code).toBe('WEIGHT_SUM_NOT_100')
    }
  })
})

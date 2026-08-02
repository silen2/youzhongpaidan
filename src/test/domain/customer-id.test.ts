import { describe, it, expect } from 'vitest'
import { nextCustomerId } from '@/domain/customer/customer-id'

describe('nextCustomerId 客户自增 ID', () => {
  it('无现有客户时从 1 开始', () => {
    expect(nextCustomerId([])).toBe('1')
  })

  it('取最大 ID + 1', () => {
    expect(nextCustomerId(['1', '2', '3'])).toBe('4')
  })

  it('ID 乱序时仍取最大值', () => {
    expect(nextCustomerId(['3', '1', '9', '2'])).toBe('10')
  })

  it('忽略非数值的历史 ID', () => {
    expect(nextCustomerId(['cus_abc', '5', 'old-id'])).toBe('6')
  })

  it('全部为非数值时从 1 开始', () => {
    expect(nextCustomerId(['cus_a', 'cus_b'])).toBe('1')
  })

  it('含 0 时返回 1', () => {
    expect(nextCustomerId(['0'])).toBe('1')
  })

  it('支持大数值', () => {
    expect(nextCustomerId(['100', '101', '42'])).toBe('102')
  })

  it('删除最大 ID 后可复用该序号', () => {
    // 删除后现存最大为 4，下一个取 5（不回溯补洞，但复用删除后的最大值）
    expect(nextCustomerId(['1', '4', '2'])).toBe('5')
  })
})

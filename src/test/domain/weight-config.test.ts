import { describe, it, expect } from 'vitest'
import { validateWeightConfig } from '@/domain/config/weight-config'
import { DomainError } from '@/domain/errors'
import type { WeightConfig } from '@/types'

function cfg(w1: number, w2: number, w3: number, w4: number, w5: number): Omit<WeightConfig, 'id'> {
  return { w1, w2, w3, w4, w5, activePreset: 'balanced' }
}

describe('validateWeightConfig', () => {
  it('总和=100 不抛', () => {
    expect(() => validateWeightConfig(cfg(25, 20, 20, 15, 20))).not.toThrow()
    expect(() => validateWeightConfig(cfg(100, 0, 0, 0, 0))).not.toThrow()
    expect(() => validateWeightConfig(cfg(0, 0, 0, 0, 100))).not.toThrow()
  })

  it('总和=99 抛 DomainError', () => {
    expect(() => validateWeightConfig(cfg(25, 20, 20, 15, 19))).toThrow(DomainError)
  })

  it('总和=101 抛 DomainError', () => {
    expect(() => validateWeightConfig(cfg(25, 20, 20, 15, 21))).toThrow(DomainError)
  })

  it('总和=0 抛 DomainError', () => {
    expect(() => validateWeightConfig(cfg(0, 0, 0, 0, 0))).toThrow(DomainError)
  })

  it('错误消息与 store 测试断言一致', () => {
    try {
      validateWeightConfig(cfg(10, 10, 10, 10, 10))
      throw new Error('应抛未抛')
    } catch (e) {
      expect(e).toBeInstanceOf(DomainError)
      expect((e as DomainError).message).toBe('权重总和必须为 100%')
      expect((e as DomainError).code).toBe('WEIGHT_SUM_NOT_100')
    }
  })
})

import { describe, it, expect } from 'vitest'
import { validateFeeValue, formatFeeValue } from '@/domain/source/fee-value'

describe('validateFeeValue - 百分比', () => {
  it('0 和 100 边界值通过', () => {
    expect(validateFeeValue('percentage', 0)).toBe('')
    expect(validateFeeValue('percentage', 100)).toBe('')
  })

  it('最多一位小数：10.5 通过、10.55 报错', () => {
    expect(validateFeeValue('percentage', 10.5)).toBe('')
    expect(validateFeeValue('percentage', 10.55)).toBe('百分比最多一位小数')
    expect(validateFeeValue('percentage', 0.01)).toBe('百分比最多一位小数')
  })

  it('范围 0-100：-1 与 100.1 报错', () => {
    expect(validateFeeValue('percentage', -1)).toBe('百分比范围需在 0-100 之间')
    expect(validateFeeValue('percentage', 100.1)).toBe('百分比范围需在 0-100 之间')
    expect(validateFeeValue('percentage', 150)).toBe('百分比范围需在 0-100 之间')
  })

  it('NaN/Infinity 报「请输入数字」', () => {
    expect(validateFeeValue('percentage', NaN)).toBe('请输入数字')
    expect(validateFeeValue('percentage', Infinity)).toBe('请输入数字')
  })
})

describe('validateFeeValue - 固定金额', () => {
  it('大于 0：0 与负数报错', () => {
    expect(validateFeeValue('fixed', 0)).toBe('固定金额需大于 0')
    expect(validateFeeValue('fixed', -5)).toBe('固定金额需大于 0')
  })

  it('最多两位小数：59.9 通过、59.999 与 0.001 报错', () => {
    expect(validateFeeValue('fixed', 59.9)).toBe('')
    expect(validateFeeValue('fixed', 59.99)).toBe('')
    expect(validateFeeValue('fixed', 59.999)).toBe('固定金额最多两位小数')
    expect(validateFeeValue('fixed', 0.001)).toBe('固定金额最多两位小数')
  })
})

describe('formatFeeValue', () => {
  it('百分比取一位小数（四舍五入）', () => {
    expect(formatFeeValue('percentage', 10)).toBe(10)
    expect(formatFeeValue('percentage', 10.5)).toBe(10.5)
    expect(formatFeeValue('percentage', 10.55)).toBe(10.6)
    expect(formatFeeValue('percentage', 10.54)).toBe(10.5)
  })

  it('固定金额取两位小数（四舍五入）', () => {
    expect(formatFeeValue('fixed', 59.9)).toBe(59.9)
    expect(formatFeeValue('fixed', 59.999)).toBe(60)
    expect(formatFeeValue('fixed', 59.994)).toBe(59.99)
  })

  it('NaN/Infinity/空值归一为 0', () => {
    expect(formatFeeValue('percentage', NaN)).toBe(0)
    expect(formatFeeValue('fixed', Infinity)).toBe(0)
  })
})

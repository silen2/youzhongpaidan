import { describe, it, expect } from 'vitest'
import { calcFee } from '@/domain/order/fee-calculator'

const percentageSource = { feeType: 'percentage' as const, feeValue: 10 }
const fixedSource = { feeType: 'fixed' as const, feeValue: 30 }

describe('calcFee', () => {
  it('百分比手续费：报价 100、费率 10% → 手续费 10、到手 90', () => {
    expect(calcFee(100, percentageSource)).toEqual({ feeAmount: 10, actualAmount: 90 })
  })

  it('百分比手续费：报价 666、费率 5% → 到手 632.7', () => {
    const r = calcFee(666, { feeType: 'percentage', feeValue: 5 })
    expect(r.feeAmount).toBeCloseTo(33.3)
    expect(r.actualAmount).toBeCloseTo(632.7)
  })

  it('固定手续费：报价 100、固定 30 → 手续费 30、到手 70', () => {
    expect(calcFee(100, fixedSource)).toEqual({ feeAmount: 30, actualAmount: 70 })
  })

  it('固定手续费超过报价时到手钳制为 0（不吃负）', () => {
    expect(calcFee(20, fixedSource)).toEqual({ feeAmount: 30, actualAmount: 0 })
  })

  it('source 为空时按 0 手续费处理，到手等于报价（无来源 = 线下直客 = 全额到手）', () => {
    expect(calcFee(100, undefined)).toEqual({ feeAmount: 0, actualAmount: 100 })
    expect(calcFee(100, null)).toEqual({ feeAmount: 0, actualAmount: 100 })
  })

  it('报价为 0 或负数时返回全 0（防御）', () => {
    expect(calcFee(0, percentageSource)).toEqual({ feeAmount: 0, actualAmount: 0 })
    expect(calcFee(-50, percentageSource)).toEqual({ feeAmount: 0, actualAmount: 0 })
  })

  it('报价为 NaN/Infinity 时返回全 0（防御）', () => {
    expect(calcFee(NaN, percentageSource)).toEqual({ feeAmount: 0, actualAmount: 0 })
    expect(calcFee(Infinity, percentageSource)).toEqual({ feeAmount: 0, actualAmount: 0 })
  })

  it('费率 0 的百分比来源 → 手续费 0、到手等于报价', () => {
    expect(calcFee(100, { feeType: 'percentage', feeValue: 0 })).toEqual({ feeAmount: 0, actualAmount: 100 })
  })

  it('费率 100% 时手续费等于报价、到手为 0', () => {
    expect(calcFee(100, { feeType: 'percentage', feeValue: 100 })).toEqual({ feeAmount: 100, actualAmount: 0 })
  })
})

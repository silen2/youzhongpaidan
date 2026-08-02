import { describe, it, expect } from 'vitest'
import { WEIGHT_PRESETS, findWeightPreset, matchPreset } from '@/domain/config/weight-presets'
import type { WeightConfig } from '@/types'

describe('WEIGHT_PRESETS', () => {
  it('包含 balanced / money / stable 三个预设', () => {
    const ids = WEIGHT_PRESETS.map(p => p.id)
    expect(ids).toEqual(['balanced', 'money', 'stable'])
  })

  it('每个预设 w1-w5 总和为 100', () => {
    for (const p of WEIGHT_PRESETS) {
      const sum = p.weights.w1 + p.weights.w2 + p.weights.w3 + p.weights.w4 + p.weights.w5
      expect(sum).toBe(100)
    }
  })

  it('每个预设都有名称和描述', () => {
    for (const p of WEIGHT_PRESETS) {
      expect(p.name.length).toBeGreaterThan(0)
      expect(p.description.length).toBeGreaterThan(0)
    }
  })
})

describe('findWeightPreset', () => {
  it('balanced 返回对应预设', () => {
    const p = findWeightPreset('balanced')
    expect(p).toBeDefined()
    expect(p?.name).toBe('均衡考量')
    expect(p?.weights).toEqual({ w1: 25, w2: 20, w3: 20, w4: 15, w5: 20 })
  })

  it('money 返回金额贡献优先', () => {
    const p = findWeightPreset('money')
    expect(p?.name).toBe('金额贡献优先')
    expect(p?.weights.w1).toBe(40)
  })

  it('stable 返回合作稳定优先', () => {
    const p = findWeightPreset('stable')
    expect(p?.name).toBe('合作稳定优先')
    expect(p?.weights.w5).toBe(30)
  })

  it('custom 返回 undefined', () => {
    expect(findWeightPreset('custom')).toBeUndefined()
  })
})

describe('matchPreset', () => {
  function w(w1: number, w2: number, w3: number, w4: number, w5: number): Pick<WeightConfig, 'w1' | 'w2' | 'w3' | 'w4' | 'w5'> {
    return { w1, w2, w3, w4, w5 }
  }

  it('匹配 balanced', () => {
    expect(matchPreset(w(25, 20, 20, 15, 20))).toBe('balanced')
  })

  it('匹配 money', () => {
    expect(matchPreset(w(40, 25, 20, 5, 10))).toBe('money')
  })

  it('匹配 stable', () => {
    expect(matchPreset(w(15, 20, 15, 20, 30))).toBe('stable')
  })

  it('不匹配任何预设时返回 custom', () => {
    expect(matchPreset(w(1, 1, 1, 1, 96))).toBe('custom')
  })

  it('与 balanced 仅差 1 也返回 custom', () => {
    expect(matchPreset(w(25, 20, 20, 15, 21))).toBe('custom')
  })
})

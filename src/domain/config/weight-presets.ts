import type { WeightConfig, WeightPresetId } from '@/types'

/**
 * 权重预设方案（纯常量，可测）
 *
 * 让用户一键切换不同的客户权重策略，避免手动凑 100%。
 * 预设是代码常量而非 DB 表，切换时仅持久化 w1-w5 + activePreset 到 WeightConfig。
 */
export interface WeightPreset {
  /** 预设 id（'custom' 不是一个预设，故不含 'custom'） */
  id: Exclude<WeightPresetId, 'custom'>
  name: string
  description: string
  weights: Pick<WeightConfig, 'w1' | 'w2' | 'w3' | 'w4' | 'w5'>
}

export const WEIGHT_PRESETS: readonly WeightPreset[] = [
  {
    id: 'balanced',
    name: '均衡考量',
    description: '五项因子均衡加权，适合大多数情况',
    weights: { w1: 25, w2: 20, w3: 20, w4: 15, w5: 20 },
  },
  {
    id: 'money',
    name: '金额贡献优先',
    description: '看重单价与下单频次，优先服务高价值客户',
    weights: { w1: 40, w2: 25, w3: 20, w4: 5, w5: 10 },
  },
  {
    id: 'stable',
    name: '合作稳定优先',
    description: '看重按时付款与履约稳定，优先服务省心客户',
    weights: { w1: 15, w2: 20, w3: 15, w4: 20, w5: 30 },
  },
]

/** 按 id 查找预设；'custom' 或未知 id 返回 undefined */
export function findWeightPreset(id: WeightPresetId): WeightPreset | undefined {
  if (id === 'custom') return undefined
  return WEIGHT_PRESETS.find(p => p.id === id)
}

/**
 * 判断给定权重组合是否恰好匹配某个预设；不匹配则返回 'custom'。
 * 用于回填旧 DB 行缺失的 activePreset 字段。
 */
export function matchPreset(
  weights: Pick<WeightConfig, 'w1' | 'w2' | 'w3' | 'w4' | 'w5'>,
): WeightPresetId {
  const matched = WEIGHT_PRESETS.find(
    p =>
      p.weights.w1 === weights.w1 &&
      p.weights.w2 === weights.w2 &&
      p.weights.w3 === weights.w3 &&
      p.weights.w4 === weights.w4 &&
      p.weights.w5 === weights.w5,
  )
  return matched ? matched.id : 'custom'
}

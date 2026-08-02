import type { WeightConfig } from '@/types'
import { DomainError } from '../errors'

/**
 * 权重配置校验（纯函数）
 *
 * 业务规则：5 个因子权重总和必须为 100%。
 * 行为契约与原 src/stores/settings.ts saveWeightConfig 内联校验一致，
 * 错误消息字面量 '权重总和必须为 100%' 严格保持不变。
 *
 * @param config 不含 id 的权重配置（w1-w5）
 */
export function validateWeightConfig(config: Omit<WeightConfig, 'id'>): void {
  const total = config.w1 + config.w2 + config.w3 + config.w4 + config.w5
  if (total !== 100) {
    throw new DomainError('权重总和必须为 100%', 'WEIGHT_SUM_NOT_100')
  }
}

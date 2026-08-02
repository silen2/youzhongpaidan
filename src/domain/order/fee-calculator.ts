import type { Source } from '@/types'

/**
 * 订单手续费计算（纯函数）
 *
 * 规则（与来源模板字段一致）：
 * - feeType = 'percentage'：手续费 = 报价 × feeValue%
 * - feeType = 'fixed'：手续费 = feeValue（固定金额）
 * - 无来源（线下/直客）或手续费字段缺失：手续费 = 0
 *
 * 实际到手 = max(0, 报价 − 手续费)，手续费最多吃光报价，不产生负数。
 *
 * @param quote 客户报价（预计金额）
 * @param source 来源模板；为空时按 0 手续费处理（到手即全额）
 */
export interface FeeResult {
  /** 手续费金额 */
  feeAmount: number
  /** 实际到手金额 = max(0, 报价 − 手续费) */
  actualAmount: number
}

export function calcFee(
  quote: number,
  source: Pick<Source, 'feeType' | 'feeValue'> | undefined | null,
): FeeResult {
  if (!isFinite(quote) || quote <= 0) {
    return { feeAmount: 0, actualAmount: 0 }
  }

  const fee = source
    ? source.feeType === 'fixed'
      ? source.feeValue
      : (quote * source.feeValue) / 100
    : 0

  const actualAmount = Math.max(0, quote - fee)
  return { feeAmount: fee, actualAmount }
}

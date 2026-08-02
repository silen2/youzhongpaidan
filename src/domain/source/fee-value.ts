/** 手续费值校验：百分比 0-100 最多一位小数；固定金额 >0 两位小数 */

export type FeeType = 'percentage' | 'fixed'

/** 校验手续费值，返回错误文案；空字符串表示通过 */
export function validateFeeValue(feeType: FeeType, value: number): string {
  if (!isFinite(value)) return '请输入数字'
  if (feeType === 'percentage') {
    if (value < 0 || value > 100) return '百分比范围需在 0-100 之间'
    if (!isOneDecimal(value)) return '百分比最多一位小数'
  } else {
    if (value <= 0) return '固定金额需大于 0'
    if (!isTwoDecimal(value)) return '固定金额最多两位小数'
  }
  return ''
}

/** 按类型规范化数值：百分比取一位小数、固定金额取两位小数 */
export function formatFeeValue(feeType: FeeType, value: number): number {
  const n = Number(value)
  if (!isFinite(n)) return 0
  const d = feeType === 'percentage' ? 10 : 100
  return Math.round(n * d) / d
}

function isOneDecimal(v: number) {
  return Math.abs(v * 10 - Math.round(v * 10)) < 1e-9
}

function isTwoDecimal(v: number) {
  return Math.abs(v * 100 - Math.round(v * 100)) < 1e-9
}

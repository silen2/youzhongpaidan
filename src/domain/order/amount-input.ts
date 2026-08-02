/**
 * 金额输入清洗与格式化（纯函数）。
 * 用于所有金额输入框（订单表单/订单列表筛选/收款弹窗）：
 * - sanitizeAmountInput：实时输入清洗——只留数字与一个小数点，小数最多两位
 * - formatAmountInput：失焦格式化——有效数字保留两位小数，空/0 显示空串
 */

/** 输入清洗：只留数字与一个小数点，小数最多两位 */
export function sanitizeAmountInput(raw: string): string {
  let v = raw.replace(/[^\d.]/g, '')
  const dot = v.indexOf('.')
  if (dot !== -1) {
    v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '')
    const [int, dec] = v.split('.')
    v = `${int}.${(dec ?? '').slice(0, 2)}`
  }
  return v
}

/** 失焦格式化：有效数字（>0）保留两位小数，否则显示空串 */
export function formatAmountInput(raw: string): string {
  const num = Number(raw)
  return isFinite(num) && num > 0 ? num.toFixed(2) : ''
}

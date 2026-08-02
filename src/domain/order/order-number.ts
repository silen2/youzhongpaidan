/**
 * 订单编号生成（纯函数）
 *
 * 默认格式：HT + YY + MM + DD + 3位随机数字（示例：HT260731001）。
 * 支持通过 config 定制前缀 / 日期样式（yyMMdd | yyyyMMdd）/ 序列位数。
 *
 * 注意：序列位使用 Math.random 而非真实每日序号。
 * 这保留了 src/db/index.ts 原有行为（utils 测试依赖该随机性）。
 * 真实序号需 Dexie 计数器，属后续优化，不在领域骨架范围。
 *
 * @param now 可注入的当前时间，便于单测确定性地验证日期部分
 * @param config 可选定制：prefix 前缀、dateStyle 日期样式、seqDigits 序列位数
 */
export interface OrderNoConfig {
  prefix?: string
  dateStyle?: 'yyMMdd' | 'yyyyMMdd'
  seqDigits?: number
}

export function generateOrderNo(now: Date = new Date(), config: OrderNoConfig = {}): string {
  const prefix = config.prefix ?? 'HT'
  const dateStyle = config.dateStyle ?? 'yyMMdd'
  const seqDigits = config.seqDigits ?? 3
  const pad = (n: number, len = 2) => String(n).padStart(len, '0')
  const year = now.getFullYear()
  const datePart = dateStyle === 'yyyyMMdd'
    ? `${year}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
    : `${String(year).slice(-2)}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const seq = Math.floor(Math.random() * 10 ** seqDigits).toString().padStart(seqDigits, '0')
  return `${prefix}${datePart}${seq}`
}

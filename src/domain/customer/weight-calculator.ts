import type { Customer, Order, WeightConfig } from '@/types'

/** 5 个权重因子的得分（均钳制到 [0, 100]） */
export interface WeightFactors {
  priceScore: number
  freqScore: number
  timeScore: number
  fulfillScore: number
  creditScore: number
}

function clamp100(v: number): number {
  return Math.max(0, Math.min(100, v))
}

/** 计算一组订单的总工时（小时）；无起止日期的订单按 1 小时兜底。 */
function computeTotalHours(orders: Order[]): number {
  return orders.reduce((sum, o) => {
    if (o.expectedStartDate && o.expectedEndDate) {
      const start = new Date(o.expectedStartDate)
      const end = new Date(o.expectedEndDate)
      return sum + Math.max((end.getTime() - start.getTime()) / (1000 * 60 * 60), 1)
    }
    return sum + 1
  }, 0)
}

/** 计算一组订单的 income/hour（已完成订单实收金额 / 总工时）。 */
function computeIncomePerHour(orders: Order[]): number {
  const completedOrders = orders.filter(o => o.orderStatus === 'completed')
  const totalIncome = completedOrders.reduce((sum, o) => sum + o.actualAmount, 0)
  const totalHours = computeTotalHours(orders)
  return totalIncome / Math.max(totalHours, 1)
}

/**
 * 计算 5 个权重因子得分（每个钳制到 [0, 100]）。纯函数。
 *
 * - priceScore   (w1)：该客户最大单额 / 全局最大单额 × 100
 * - freqScore    (w2)：该客户订单数 / 全局客户最大订单数 × 100
 * - timeScore    (w3)：该客户 income/hour / 全局最大 income/hour × 100
 * - fulfillScore (w4)：实际到款总额 / 预计总额 × 100
 * - creditScore  (w5)：按时结单率（无完成单时默认 50，冷启动中性先验）
 *
 * 注意：customer 参数不参与算式（原实现仅用于 null 检查），故纯函数不接受 customer。
 * 调用方（wrapper）自行做 null 检查后再调用。customerOrders 由调用方决定范围（全量历史）。
 *
 * @param customerOrders 该客户名下的订单（调用方决定范围：全量历史）
 * @param allCustomers    全部客户（用于取最大 orderCount）
 * @param allOrders       全部订单（用于取全局最大单额与全局最大 income/hour）
 */
export function computeWeightFactors(
  customerOrders: Order[],
  allCustomers: Customer[],
  allOrders: Order[],
): WeightFactors {
  // priceScore
  const maxAmount = customerOrders.reduce((max, o) => Math.max(max, o.actualAmount), 0)
  const globalMax = Math.max(...allOrders.map(o => o.actualAmount), 1)
  const priceScore = clamp100((maxAmount / globalMax) * 100)

  // freqScore
  const orderCount = customerOrders.length
  const maxOrders = Math.max(...allCustomers.map(c => c.orderCount), 1)
  const freqScore = clamp100((orderCount / maxOrders) * 100)

  // timeScore：按 customerId 分组算各客户 income/hour，取全局最大归一化
  const incomePerHour = computeIncomePerHour(customerOrders)
  const byCustomer = new Map<string, Order[]>()
  for (const o of allOrders) {
    const arr = byCustomer.get(o.customerId)
    if (arr) arr.push(o)
    else byCustomer.set(o.customerId, [o])
  }
  let globalMaxIncomePerHour = 0
  for (const custOrders of byCustomer.values()) {
    globalMaxIncomePerHour = Math.max(globalMaxIncomePerHour, computeIncomePerHour(custOrders))
  }
  const timeScore = clamp100((incomePerHour / Math.max(globalMaxIncomePerHour, 1)) * 100)

  // fulfillScore
  const expectedTotal = customerOrders.reduce((sum, o) => sum + o.expectedAmount, 0) || 1
  const actualTotal = customerOrders.reduce((sum, o) => sum + o.actualAmount, 0)
  const fulfillScore = clamp100((actualTotal / expectedTotal) * 100)

  // creditScore
  const completedOrders = customerOrders.filter(o => o.orderStatus === 'completed')
  const onTimeCount = completedOrders.filter(o => {
    return o.finalPaidAt && o.expectedEndDate ? new Date(o.finalPaidAt) <= new Date(o.expectedEndDate) : false
  }).length
  const creditScore = completedOrders.length > 0 ? clamp100((onTimeCount / completedOrders.length) * 100) : 50

  return { priceScore, freqScore, timeScore, fulfillScore, creditScore }
}

/**
 * 由因子得分与权重配置计算最终权重（标准加权平均，结果自然落在 [0,100]）。纯函数。
 *
 * weight = Σ (wi/100 × scorei)
 *
 * 旧实现 weight = Σ (wi × scorei) 会饱和到 100（wi 是百分比、scorei 是 0-100），
 * 导致新客户（creditScore 默认 50）直接饱和、滑块调节无感。改为加权平均后结果可区分。
 */
export function calculateWeightFromFactors(factors: WeightFactors, config: WeightConfig): number {
  const weight =
    (config.w1 / 100) * factors.priceScore +
    (config.w2 / 100) * factors.freqScore +
    (config.w3 / 100) * factors.timeScore +
    (config.w4 / 100) * factors.fulfillScore +
    (config.w5 / 100) * factors.creditScore
  return Math.round(Math.max(0, Math.min(100, weight)))
}

/**
 * 客户权重计算（组合入口，签名不变以兼容 db wrapper）。纯函数。
 *
 * @param customerOrders 该客户名下的订单（调用方决定是否过滤归档）
 * @param config          权重配置 w1-w5
 * @param allCustomers    全部客户（用于取最大 orderCount）
 * @param allOrders       全部订单（用于取全局最大单额与全局最大 income/hour）
 */
export function calculateWeight(
  customerOrders: Order[],
  config: WeightConfig,
  allCustomers: Customer[],
  allOrders: Order[],
): number {
  const factors = computeWeightFactors(customerOrders, allCustomers, allOrders)
  return calculateWeightFromFactors(factors, config)
}

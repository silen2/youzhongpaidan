import { describe, it, expect } from 'vitest'
import {
  calculateWeight,
  computeWeightFactors,
  calculateWeightFromFactors,
  type WeightFactors,
} from '@/domain/customer/weight-calculator'
import type { Customer, Order, WeightConfig } from '@/types'

const DEFAULT_CONFIG: WeightConfig = { id: 1, w1: 25, w2: 20, w3: 20, w4: 15, w5: 20, activePreset: 'balanced' }

function buildOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'o1',
    orderNo: 'HT260731001',
    name: 'test',
    content: '',
    customerId: 'c1',
    sourceId: 's1',
    expectedAmount: 0,
    actualAmount: 0,
    depositExpected: 0,
    depositActual: 0,
    finalExpected: 0,
    finalActual: 0,
    // 默认 1 小时跨度
    expectedStartDate: '2026-07-01T00:00:00.000Z',
    expectedEndDate: '2026-07-01T01:00:00.000Z',
    orderStatus: 'completed',
    paymentStatus: 'final_paid',
    currentStage: 'st-done',
    usage: 'personal',
    isUrgent: false,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }
}

function buildCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: 'c1',
    name: 'test',
    weight: 0,
    totalSpent: 0,
    maxOrderAmount: 0,
    orderCount: 1,
    completedCount: 0,
    voidedCount: 0,
    waivedCount: 0,
    arrearsCount: 0,
    latePaymentCount: 0,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('calculateWeight - 边界与钳制', () => {
  it('空订单 → 10（creditScore 默认 50，加权平均下 0.20×50=10，不再饱和）', () => {
    const result = calculateWeight([], DEFAULT_CONFIG, [buildCustomer({ orderCount: 0 })], [])
    expect(result).toBe(10)
  })

  it('钳制到 0：晚完成 + 极低 freq + 其他因子全 0', () => {
    const order = buildOrder({
      orderStatus: 'completed',
      finalPaidAt: '2026-07-02T00:00:00.000Z', // 晚于 expectedEndDate → 不按时
      actualAmount: 0,
      expectedAmount: 0,
    })
    const big = buildCustomer({ id: 'c2', orderCount: 1_000_000 })
    const result = calculateWeight([order], DEFAULT_CONFIG, [buildCustomer(), big], [order])
    expect(result).toBe(0)
  })

  it('按时完成 + 高单价 → 80（加权平均，不再饱和到 100）', () => {
    const order = buildOrder({
      orderStatus: 'completed',
      finalPaidAt: '2026-06-30T00:00:00.000Z', // 早于 expectedEndDate → 按时
      actualAmount: 10000,
      expectedAmount: 10000,
    })
    const big = buildCustomer({ id: 'c2', orderCount: 100 })
    // priceScore=100, freqScore=1, timeScore=100, fulfillScore=100, creditScore=100
    // weight = 25 + 0.2 + 20 + 15 + 20 = 80.2 → 80
    const result = calculateWeight([order], DEFAULT_CONFIG, [buildCustomer(), big], [order])
    expect(result).toBe(80)
  })

  it('结果始终为整数', () => {
    const order = buildOrder({ actualAmount: 333, expectedAmount: 777, orderStatus: 'in_progress' })
    const result = calculateWeight([order], DEFAULT_CONFIG, [buildCustomer(), buildCustomer({ id: 'c2', orderCount: 3 })], [order])
    expect(Number.isInteger(result)).toBe(true)
  })

  it('确定性：相同输入产生相同输出', () => {
    const order = buildOrder({ actualAmount: 500, expectedAmount: 1000, orderStatus: 'completed', finalPaidAt: '2026-06-30T00:00:00.000Z' })
    const customers = [buildCustomer(), buildCustomer({ id: 'c2', orderCount: 5 })]
    const r1 = calculateWeight([order], DEFAULT_CONFIG, customers, [order])
    const r2 = calculateWeight([order], DEFAULT_CONFIG, customers, [order])
    expect(r1).toBe(r2)
  })
})

describe('calculateWeight - creditScore 逻辑', () => {
  it('晚完成 → creditScore=0，低 freq 时权重为 0（加权平均修正旧 bug）', () => {
    const order = buildOrder({
      orderStatus: 'completed',
      finalPaidAt: '2026-07-02T00:00:00.000Z', // 晚
      actualAmount: 0,
      expectedAmount: 0,
    })
    const big = buildCustomer({ id: 'c2', orderCount: 100 })
    // priceScore=0, freqScore=1, timeScore=0, fulfillScore=0, creditScore=0
    // weight = 0 + 0.2 + 0 + 0 + 0 = 0.2 → 0（旧 20×1=20 是饱和公式 bug）
    const result = calculateWeight([order], DEFAULT_CONFIG, [buildCustomer(), big], [order])
    expect(result).toBe(0)
  })

  it('按时完成 → creditScore=100，权重严格高于晚完成', () => {
    const lateOrder = buildOrder({
      orderStatus: 'completed',
      finalPaidAt: '2026-07-02T00:00:00.000Z',
      actualAmount: 0,
      expectedAmount: 0,
    })
    const onTimeOrder = buildOrder({
      orderStatus: 'completed',
      finalPaidAt: '2026-06-30T00:00:00.000Z',
      actualAmount: 0,
      expectedAmount: 0,
    })
    const big = buildCustomer({ id: 'c2', orderCount: 100 })
    const late = calculateWeight([lateOrder], DEFAULT_CONFIG, [buildCustomer(), big], [lateOrder])
    const onTime = calculateWeight([onTimeOrder], DEFAULT_CONFIG, [buildCustomer(), big], [onTimeOrder])
    expect(onTime).toBeGreaterThan(late)
    // priceScore=0, freqScore=1, timeScore=0, fulfillScore=0, creditScore=100
    // weight = 0 + 0.2 + 0 + 0 + 20 = 20.2 → 20
    expect(onTime).toBe(20)
  })

  it('无完成订单 → creditScore 默认 50，权重为 10', () => {
    // 进行中订单：completedOrders=[] → creditScore=50
    const order = buildOrder({ orderStatus: 'in_progress', actualAmount: 0, expectedAmount: 0 })
    const big = buildCustomer({ id: 'c2', orderCount: 100 })
    // priceScore=0, freqScore=1, timeScore=0, fulfillScore=0, creditScore=50
    // weight = 0 + 0.2 + 0 + 0 + 10 = 10.2 → 10
    const result = calculateWeight([order], DEFAULT_CONFIG, [buildCustomer(), big], [order])
    expect(result).toBe(10)
  })
})

describe('calculateWeight - 除零兜底', () => {
  it('allOrders 为空时 globalMax 回退到 1（不产生 NaN）', () => {
    const order = buildOrder({
      orderStatus: 'completed',
      finalPaidAt: '2026-07-02T00:00:00.000Z',
      actualAmount: 0,
      expectedAmount: 0,
    })
    const big = buildCustomer({ id: 'c2', orderCount: 100 })
    // 与 allOrders=[order] 相同（actualAmount=0 → globalMax 均为 1），晚完成 → 0
    const result = calculateWeight([order], DEFAULT_CONFIG, [buildCustomer(), big], [])
    expect(result).toBe(0)
    expect(Number.isNaN(result)).toBe(false)
  })

  it('allCustomers 为空时 maxOrders 回退到 1（freqScore=100 → 贡献 20）', () => {
    const order = buildOrder({
      orderStatus: 'completed',
      finalPaidAt: '2026-07-02T00:00:00.000Z',
      actualAmount: 0,
      expectedAmount: 0,
    })
    // maxOrders=max(...[],1)=1 → freqScore=100 → 20/100×100=20（不再饱和到 100）
    const result = calculateWeight([order], DEFAULT_CONFIG, [], [order])
    expect(result).toBe(20)
    expect(Number.isNaN(result)).toBe(false)
  })

  it('expectedAmount 全 0 时 expectedTotal 回退到 1（fulfillScore=0 不爆）', () => {
    const order = buildOrder({
      orderStatus: 'completed',
      finalPaidAt: '2026-07-02T00:00:00.000Z',
      actualAmount: 0,
      expectedAmount: 0,
    })
    const big = buildCustomer({ id: 'c2', orderCount: 100 })
    const result = calculateWeight([order], DEFAULT_CONFIG, [buildCustomer(), big], [order])
    expect(Number.isNaN(result)).toBe(false)
    expect(result).toBe(0)
  })

  it('订单无起止时间时 totalHours 每单回退 +1', () => {
    const order = buildOrder({
      orderStatus: 'completed',
      finalPaidAt: '2026-07-02T00:00:00.000Z',
      actualAmount: 0,
      expectedAmount: 0,
      expectedStartDate: undefined as unknown as string,
      expectedEndDate: undefined as unknown as string,
    })
    const big = buildCustomer({ id: 'c2', orderCount: 100 })
    // totalHours = 1（兜底），totalIncome=0 → timeScore=0；晚完成 → 0
    const result = calculateWeight([order], DEFAULT_CONFIG, [buildCustomer(), big], [order])
    expect(result).toBe(0)
  })
})

describe('calculateWeight - timeScore 钳制', () => {
  it('timeScore 上限为 100（高收入短工时归一化后不溢出）', () => {
    const order = buildOrder({
      orderStatus: 'completed',
      finalPaidAt: '2026-06-30T00:00:00.000Z',
      actualAmount: 10000, // 高收入
      expectedAmount: 10000,
      // 1 小时跨度：该客户是全局唯一最高收入者 → timeScore=100
    })
    const big = buildCustomer({ id: 'c2', orderCount: 100 })
    const factors = computeWeightFactors([order], [buildCustomer(), big], [order])
    expect(factors.timeScore).toBe(100)
    expect(Number.isFinite(factors.timeScore)).toBe(true)
    // 最终权重 = 80（与按时+高价场景一致）
    const result = calculateWeight([order], DEFAULT_CONFIG, [buildCustomer(), big], [order])
    expect(result).toBe(80)
  })
})

describe('computeWeightFactors', () => {
  it('fulfillScore 超 100 时钳制到 100', () => {
    const order = buildOrder({
      orderStatus: 'completed',
      actualAmount: 2000,
      expectedAmount: 1000, // actual > expected → 200% → 钳 100
      finalPaidAt: '2026-06-30T00:00:00.000Z',
    })
    const factors = computeWeightFactors([order], [buildCustomer()], [order])
    expect(factors.fulfillScore).toBe(100)
  })

  it('无完成单时 creditScore=50', () => {
    const order = buildOrder({ orderStatus: 'in_progress', actualAmount: 0, expectedAmount: 0 })
    const factors = computeWeightFactors([order], [buildCustomer()], [order])
    expect(factors.creditScore).toBe(50)
  })

  it('无完成单时 timeScore=0（income=0）', () => {
    const order = buildOrder({ orderStatus: 'in_progress', actualAmount: 5000, expectedAmount: 5000 })
    const factors = computeWeightFactors([order], [buildCustomer()], [order])
    expect(factors.timeScore).toBe(0)
  })

  it('全局唯一最高收入者 timeScore=100', () => {
    const order = buildOrder({
      orderStatus: 'completed',
      actualAmount: 10000,
      expectedAmount: 10000,
      finalPaidAt: '2026-06-30T00:00:00.000Z',
    })
    const factors = computeWeightFactors([order], [buildCustomer()], [order])
    expect(factors.timeScore).toBe(100)
  })

  it('所有得分均落在 [0, 100]', () => {
    const order = buildOrder({
      orderStatus: 'completed',
      actualAmount: 5000,
      expectedAmount: 3000,
      finalPaidAt: '2026-06-30T00:00:00.000Z',
    })
    const factors = computeWeightFactors([order], [buildCustomer(), buildCustomer({ id: 'c2', orderCount: 50 })], [order])
    for (const v of Object.values(factors)) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(100)
    }
  })
})

describe('calculateWeightFromFactors', () => {
  const config = DEFAULT_CONFIG

  it('全 0 因子 → 0', () => {
    const zeroFactors: WeightFactors = {
      priceScore: 0,
      freqScore: 0,
      timeScore: 0,
      fulfillScore: 0,
      creditScore: 0,
    }
    expect(calculateWeightFromFactors(zeroFactors, config)).toBe(0)
  })

  it('全 100 因子 → 100（权重和为 100）', () => {
    const fullFactors: WeightFactors = {
      priceScore: 100,
      freqScore: 100,
      timeScore: 100,
      fulfillScore: 100,
      creditScore: 100,
    }
    // 25 + 20 + 20 + 15 + 20 = 100
    expect(calculateWeightFromFactors(fullFactors, config)).toBe(100)
  })

  it('creditScore=50 单独贡献 10（w5=20）', () => {
    const factors: WeightFactors = {
      priceScore: 0,
      freqScore: 0,
      timeScore: 0,
      fulfillScore: 0,
      creditScore: 50,
    }
    expect(calculateWeightFromFactors(factors, config)).toBe(10)
  })
})

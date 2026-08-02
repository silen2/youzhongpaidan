import { describe, it, expect } from 'vitest'
import { applyPaymentEvent, type PaymentEventOrder } from '@/domain/order/payment-status'
import type { PaymentStatus } from '@/types'

const FIXED_NOW = new Date('2026-07-31T10:00:00.000Z')
const FIXED_ISO = FIXED_NOW.toISOString()

function baseOrder(overrides: Partial<PaymentEventOrder> = {}): PaymentEventOrder {
  return {
    depositExpected: 2500,
    finalExpected: 2500,
    depositActual: 0,
    finalActual: 0,
    orderStatus: 'not_started',
    ...overrides,
  }
}

describe('applyPaymentEvent - deposit_paid', () => {
  it('显式 paidAmount 时使用 paidAmount', () => {
    const result = applyPaymentEvent(baseOrder(), 'deposit_paid', 3000, FIXED_NOW)
    expect(result.paymentStatus).toBe('deposit_paid')
    expect(result.depositActual).toBe(3000)
    expect(result.depositPaidAt).toBe(FIXED_ISO)
    expect(result.orderStatus).toBe('not_started')
  })

  it('未传 paidAmount 时回退到 depositExpected', () => {
    const result = applyPaymentEvent(baseOrder({ depositExpected: 1800 }), 'deposit_paid', undefined, FIXED_NOW)
    expect(result.depositActual).toBe(1800)
    expect(result.depositPaidAt).toBe(FIXED_ISO)
    expect(result.orderStatus).toBe('not_started')
  })

  it('不设置 final 相关字段', () => {
    const result = applyPaymentEvent(baseOrder(), 'deposit_paid', 1000, FIXED_NOW)
    expect(result.finalActual).toBeUndefined()
    expect(result.finalPaidAt).toBeUndefined()
  })

  it('同步 actualAmount = 定金实收 + 已有尾款实收', () => {
    expect(applyPaymentEvent(baseOrder(), 'deposit_paid', 3000, FIXED_NOW).actualAmount).toBe(3000)
    // 已有尾款实收（如先收尾款再补定金）也计入
    expect(applyPaymentEvent(baseOrder({ finalActual: 700 }), 'deposit_paid', 300, FIXED_NOW).actualAmount).toBe(1000)
  })

  it('已开工（进行中）收定金不回退工作状态', () => {
    const result = applyPaymentEvent(baseOrder({ orderStatus: 'in_progress' }), 'deposit_paid', 1000, FIXED_NOW)
    expect(result.orderStatus).toBeUndefined()
  })

  it('已完成绘制（待付尾款）收定金不回退工作状态', () => {
    const result = applyPaymentEvent(baseOrder({ orderStatus: 'awaiting_final' }), 'deposit_paid', 1000, FIXED_NOW)
    expect(result.orderStatus).toBeUndefined()
  })

  it('待付定金（未排期初始态）收定金置为未开始', () => {
    const result = applyPaymentEvent(baseOrder({ orderStatus: 'awaiting_deposit' }), 'deposit_paid', 1000, FIXED_NOW)
    expect(result.orderStatus).toBe('not_started')
  })
})

describe('applyPaymentEvent - final_paid', () => {
  it('显式 paidAmount 时使用 paidAmount', () => {
    const result = applyPaymentEvent(baseOrder(), 'final_paid', 2600, FIXED_NOW)
    expect(result.paymentStatus).toBe('final_paid')
    expect(result.finalActual).toBe(2600)
    expect(result.finalPaidAt).toBe(FIXED_ISO)
    expect(result.orderStatus).toBe('completed')
  })

  it('未传 paidAmount 时回退到 finalExpected', () => {
    const result = applyPaymentEvent(baseOrder({ finalExpected: 2200 }), 'final_paid', undefined, FIXED_NOW)
    expect(result.finalActual).toBe(2200)
    expect(result.finalPaidAt).toBe(FIXED_ISO)
    expect(result.orderStatus).toBe('completed')
  })

  it('不设置 deposit 相关字段', () => {
    const result = applyPaymentEvent(baseOrder(), 'final_paid', 2000, FIXED_NOW)
    expect(result.depositActual).toBeUndefined()
    expect(result.depositPaidAt).toBeUndefined()
  })

  it('同步 actualAmount = 已有定金实收 + 尾款实收', () => {
    expect(applyPaymentEvent(baseOrder(), 'final_paid', 700, FIXED_NOW).actualAmount).toBe(700)
    expect(applyPaymentEvent(baseOrder({ depositActual: 300 }), 'final_paid', 700, FIXED_NOW).actualAmount).toBe(1000)
  })
})

describe('applyPaymentEvent - 仅改收款状态（无副作用）', () => {
  const pureStatuses: PaymentStatus[] = ['unpaid', 'arrears', 'waived']
  for (const status of pureStatuses) {
    it(`${status} 仅改 paymentStatus，不动金额/日期/工作状态`, () => {
      const result = applyPaymentEvent(baseOrder(), status, 9999, FIXED_NOW)
      expect(result.paymentStatus).toBe(status)
      expect(result.depositActual).toBeUndefined()
      expect(result.depositPaidAt).toBeUndefined()
      expect(result.finalActual).toBeUndefined()
      expect(result.finalPaidAt).toBeUndefined()
      expect(result.orderStatus).toBeUndefined()
      expect(result.actualAmount).toBeUndefined()
    })
  }
})

describe('applyPaymentEvent - now 注入', () => {
  it('不同 now 产生不同时间戳', () => {
    const later = new Date('2026-12-31T23:59:59.000Z')
    const r1 = applyPaymentEvent(baseOrder(), 'deposit_paid', 100, FIXED_NOW)
    const r2 = applyPaymentEvent(baseOrder(), 'deposit_paid', 100, later)
    expect(r1.depositPaidAt).toBe(FIXED_ISO)
    expect(r2.depositPaidAt).toBe(later.toISOString())
    expect(r1.depositPaidAt).not.toBe(r2.depositPaidAt)
  })
})

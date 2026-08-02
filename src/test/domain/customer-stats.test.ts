import { describe, it, expect } from 'vitest'
import { computeCustomerStats, type OrderLike } from '@/domain/customer/customer-stats'

function order(partial: Partial<OrderLike> & { orderStatus: string; paymentStatus: string }): OrderLike {
  return {
    expectedAmount: 0,
    actualAmount: 0,
    ...partial,
  }
}

describe('computeCustomerStats', () => {
  it('空订单：全部归零', () => {
    expect(computeCustomerStats([])).toEqual({
      totalSpent: 0,
      maxOrderAmount: 0,
      orderCount: 0,
      completedCount: 0,
      voidedCount: 0,
      waivedCount: 0,
      arrearsCount: 0,
      latePaymentCount: 0,
    })
  })

  it('累计消费=非退单实际到账总和；最大单=非退单预计金额最大；订单数=非退单数', () => {
    const stats = computeCustomerStats([
      order({ orderStatus: 'completed', paymentStatus: 'final_paid', expectedAmount: 800, actualAmount: 720 }),
      order({ orderStatus: 'in_progress', paymentStatus: 'deposit_paid', expectedAmount: 500, actualAmount: 0 }),
      order({ orderStatus: 'voided', paymentStatus: 'unpaid', expectedAmount: 900, actualAmount: 0 }),
    ])
    expect(stats.totalSpent).toBe(720)
    expect(stats.maxOrderAmount).toBe(800) // 退单 900 不计
    expect(stats.orderCount).toBe(2)
    expect(stats.voidedCount).toBe(1)
  })

  it('completed/waived/arrears/尾款迟付各自计数', () => {
    const stats = computeCustomerStats([
      // 已完成、尾款按时到账（08-08 ≤ 08-10）→ completed 1、不迟付
      order({ orderStatus: 'completed', paymentStatus: 'final_paid', expectedAmount: 300, actualAmount: 300, expectedEndDate: '2026-08-10', finalPaidAt: '2026-08-08' }),
      // 已完成、尾款迟付（08-12 > 08-10）→ completed 1、迟付 1
      order({ orderStatus: 'completed', paymentStatus: 'final_paid', expectedAmount: 200, actualAmount: 200, expectedEndDate: '2026-08-10', finalPaidAt: '2026-08-12' }),
      // 免收
      order({ orderStatus: 'awaiting_deposit', paymentStatus: 'waived', expectedAmount: 0, actualAmount: 0 }),
      // 欠款
      order({ orderStatus: 'in_progress', paymentStatus: 'arrears', expectedAmount: 400, actualAmount: 0 }),
    ])
    expect(stats.completedCount).toBe(2)
    expect(stats.latePaymentCount).toBe(1)
    expect(stats.waivedCount).toBe(1)
    expect(stats.arrearsCount).toBe(1)
  })

  it('完成但无预计交付/到账时间不算迟付', () => {
    const stats = computeCustomerStats([
      order({ orderStatus: 'completed', paymentStatus: 'final_paid', expectedAmount: 100, actualAmount: 100, finalPaidAt: '2026-08-12' }),
      order({ orderStatus: 'completed', paymentStatus: 'final_paid', expectedAmount: 100, actualAmount: 100, expectedEndDate: '2026-08-10' }),
    ])
    expect(stats.latePaymentCount).toBe(0)
  })

  it('金额浮点累加收敛到两位小数', () => {
    const stats = computeCustomerStats([
      order({ orderStatus: 'completed', paymentStatus: 'final_paid', expectedAmount: 0.1, actualAmount: 0.1 }),
      order({ orderStatus: 'completed', paymentStatus: 'final_paid', expectedAmount: 0.2, actualAmount: 0.2 }),
    ])
    expect(stats.totalSpent).toBe(0.3)
  })
})

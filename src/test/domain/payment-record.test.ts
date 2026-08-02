import { describe, it, expect } from 'vitest'
import {
  isPaymentType,
  paymentTypeLabel,
  isPaymentDirection,
  paymentDirectionLabel,
  generateRecordNo,
  isOrderCollectible,
  isOrderRefundable,
  orderRefundableAmount,
  recomputeOrderPaymentPatch,
  computePaymentStats,
  type PaymentRecordLike,
  type OrderLikeForPayment,
  type SourceLikeForPayment,
} from '@/domain/payment/payment-record'

const percentSource: SourceLikeForPayment = { feeType: 'percentage', feeValue: 10 }
const fixedSource: SourceLikeForPayment = { feeType: 'fixed', feeValue: 5 }
const noSource: SourceLikeForPayment | null = null

function sourceOf(sourceId: string | undefined) {
  if (!sourceId) return noSource
  if (sourceId === 's1') return percentSource
  if (sourceId === 's2') return fixedSource
  return noSource
}

function record(partial: Partial<PaymentRecordLike> & { orderId: string; type: string; amount: number }): PaymentRecordLike {
  return { receivedAt: '2026-08-01T10:00:00.000Z', ...partial }
}

function order(partial: Partial<OrderLikeForPayment> & { id: string; orderStatus: string; expectedAmount: number }): OrderLikeForPayment {
  return { sourceId: 's1', depositActual: 0, finalActual: 0, ...partial }
}

const today = new Date('2026-08-15T00:00:00.000Z')

describe('收款记录类型', () => {
  it('isPaymentType 校验 deposit/final', () => {
    expect(isPaymentType('deposit')).toBe(true)
    expect(isPaymentType('final')).toBe(true)
    expect(isPaymentType('other')).toBe(false)
    expect(isPaymentType(undefined)).toBe(false)
  })

  it('paymentTypeLabel 映射 定金/尾款', () => {
    expect(paymentTypeLabel('deposit')).toBe('定金')
    expect(paymentTypeLabel('final')).toBe('尾款')
    expect(paymentTypeLabel('xx')).toBe('—')
  })

  it('generateRecordNo 生成 RC + YYMMDD + 3 位数字', () => {
    const no = generateRecordNo(new Date('2026-08-01T10:00:00.000Z'))
    expect(no).toMatch(/^RC260801\d{3}$/)
    const no2 = generateRecordNo(new Date('2026-12-31T10:00:00.000Z'))
    expect(no2).toMatch(/^RC261231\d{3}$/)
  })

  it('isOrderCollectible：已结清/退单/免收不可再收，待收/欠款可收', () => {
    // 可收：未开始待付定金、已收定金待付尾款、欠款
    expect(isOrderCollectible({ orderStatus: 'not_started', paymentStatus: 'unpaid' })).toBe(true)
    expect(isOrderCollectible({ orderStatus: 'awaiting_final', paymentStatus: 'deposit_paid' })).toBe(true)
    expect(isOrderCollectible({ orderStatus: 'in_progress', paymentStatus: 'arrears' })).toBe(true)
    // 不可收：已完成、已退单、已结清（final_paid）、免单
    expect(isOrderCollectible({ orderStatus: 'completed', paymentStatus: 'final_paid' })).toBe(false)
    expect(isOrderCollectible({ orderStatus: 'voided', paymentStatus: 'unpaid' })).toBe(false)
    expect(isOrderCollectible({ orderStatus: 'awaiting_final', paymentStatus: 'final_paid' })).toBe(false)
    expect(isOrderCollectible({ orderStatus: 'awaiting_deposit', paymentStatus: 'waived' })).toBe(false)
  })
})

describe('账单方向（入账/出账）', () => {
  it('isPaymentDirection 校验 in/out', () => {
    expect(isPaymentDirection('in')).toBe(true)
    expect(isPaymentDirection('out')).toBe(true)
    expect(isPaymentDirection('x')).toBe(false)
    expect(isPaymentDirection(undefined)).toBe(false)
  })

  it('paymentDirectionLabel 映射 入账/出账', () => {
    expect(paymentDirectionLabel('in')).toBe('入账')
    expect(paymentDirectionLabel('out')).toBe('出账')
    expect(paymentDirectionLabel('xx')).toBe('—')
  })
})

describe('退单退款（isOrderRefundable / orderRefundableAmount）', () => {
  const rec = (type: string, amount: number, direction: 'in' | 'out' = 'in'): PaymentRecordLike => ({
    orderId: 'o1',
    type,
    amount,
    receivedAt: '2026-08-01T00:00:00.000Z',
    direction,
  })

  it('仅已退单（voided）且存在入账流水的订单可退款', () => {
    expect(isOrderRefundable({ orderStatus: 'voided' }, [rec('deposit', 300)])).toBe(true)
    // 未退单不可退
    expect(isOrderRefundable({ orderStatus: 'completed' }, [rec('deposit', 300)])).toBe(false)
    expect(isOrderRefundable({ orderStatus: 'in_progress' }, [rec('deposit', 300)])).toBe(false)
    // 无入账不可退
    expect(isOrderRefundable({ orderStatus: 'voided' }, [])).toBe(false)
    // 只有出账无入账不可退
    expect(isOrderRefundable({ orderStatus: 'voided' }, [rec('deposit', 300, 'out')])).toBe(false)
  })

  it('可退金额 = 入账合计 − 已出账合计（部分退款后剩可退）', () => {
    expect(orderRefundableAmount([rec('deposit', 300), rec('final', 700)])).toBe(1000)
    expect(orderRefundableAmount([rec('deposit', 300), rec('deposit', 300, 'out')])).toBe(0)
    expect(orderRefundableAmount([rec('deposit', 300), rec('final', 700), rec('final', 500, 'out')])).toBe(500)
    expect(orderRefundableAmount([])).toBe(0)
  })

  it('已被红冲的入账不再视为实收；红冲记录本身不计为出账', () => {
    const inRec: PaymentRecordLike = { id: 'r1', orderId: 'o1', type: 'deposit', amount: 300, receivedAt: '2026-08-01T00:00:00.000Z' }
    // 入账 300 被红冲：可退金额归 0（红冲出账不额外扣减）
    expect(orderRefundableAmount([
      inRec,
      { ...inRec, id: 'r2', direction: 'out', refundOf: 'r1' },
    ])).toBe(0)
    // 红冲后另有一笔独立入账 500：可退 = 500（红冲记录不抵这 500）
    expect(orderRefundableAmount([
      inRec,
      { ...inRec, id: 'r2', direction: 'out', refundOf: 'r1' },
      { ...inRec, id: 'r3', amount: 500 },
    ])).toBe(500)
    // 仅有被红冲的入账不可作为退款依据
    expect(isOrderRefundable({ orderStatus: 'voided' }, [
      inRec,
      { ...inRec, id: 'r2', direction: 'out', refundOf: 'r1' },
    ])).toBe(false)
  })
})

describe('recomputeOrderPaymentPatch（删除/编辑流水后按剩余流水重算订单）', () => {
  const rec = (type: string, amount: number, receivedAt: string): PaymentRecordLike => ({ orderId: 'o1', type, amount, receivedAt })

  it('无剩余流水：结清订单回退待付定金（unpaid），completed 回退 awaiting_final', () => {
    const patch = recomputeOrderPaymentPatch(
      { orderStatus: 'completed', paymentStatus: 'final_paid' },
      [],
    )
    expect(patch.paymentStatus).toBe('unpaid')
    expect(patch.orderStatus).toBe('awaiting_final')
    expect(patch.depositActual).toBe(0)
    expect(patch.finalActual).toBe(0)
    expect(patch.actualAmount).toBe(0)
    expect(patch.depositPaidAt).toBeUndefined()
    expect(patch.finalPaidAt).toBeUndefined()
  })

  it('只剩定金流水：订单回退已收定金（deposit_paid），金额保留', () => {
    const patch = recomputeOrderPaymentPatch(
      { orderStatus: 'completed', paymentStatus: 'final_paid' },
      [rec('deposit', 300, '2026-08-05T00:00:00.000Z')],
    )
    expect(patch.paymentStatus).toBe('deposit_paid')
    expect(patch.orderStatus).toBe('awaiting_final') // 尾款被删，completed 回退
    expect(patch.depositActual).toBe(300)
    expect(patch.finalActual).toBe(0)
    expect(patch.actualAmount).toBe(300)
  })

  it('仍剩尾款流水：保持结清（final_paid/completed）', () => {
    const patch = recomputeOrderPaymentPatch(
      { orderStatus: 'completed', paymentStatus: 'final_paid' },
      [rec('deposit', 300, '2026-08-01T00:00:00.000Z'), rec('final', 700, '2026-08-20T00:00:00.000Z')],
    )
    expect(patch.paymentStatus).toBe('final_paid')
    expect(patch.orderStatus).toBeUndefined() // 不改动工作状态
    expect(patch.depositActual).toBe(300)
    expect(patch.finalActual).toBe(700)
    expect(patch.actualAmount).toBe(1000)
  })

  it('欠款/免收为手动语义：不因流水删除而改变收款状态', () => {
    const patch = recomputeOrderPaymentPatch(
      { orderStatus: 'in_progress', paymentStatus: 'arrears' },
      [],
    )
    expect(patch.paymentStatus).toBe('arrears')
  })

  it('出账（退款/红冲）不参与订单重算：退单订单保持原状态，入账金额保留', () => {
    const patch = recomputeOrderPaymentPatch(
      { orderStatus: 'voided', paymentStatus: 'deposit_paid' },
      [
        rec('deposit', 300, '2026-08-01T00:00:00.000Z'),
        { orderId: 'o1', type: 'final', direction: 'out', amount: 300, receivedAt: '2026-08-02T00:00:00.000Z' },
      ],
    )
    // 出账不计入订单实际金额，订单状态不被出账改变
    expect(patch.depositActual).toBe(300)
    expect(patch.finalActual).toBe(0)
    expect(patch.actualAmount).toBe(300)
    expect(patch.paymentStatus).toBe('deposit_paid')
    expect(patch.orderStatus).toBeUndefined()
  })

  it('已被红冲的入账不参与订单重算：红冲尾款后结单订单回退待付尾款', () => {
    const patch = recomputeOrderPaymentPatch(
      { orderStatus: 'completed', paymentStatus: 'final_paid' },
      [
        { id: 'r1', orderId: 'o1', type: 'deposit', amount: 300, receivedAt: '2026-08-01T00:00:00.000Z' },
        { id: 'r2', orderId: 'o1', type: 'final', amount: 700, receivedAt: '2026-08-20T00:00:00.000Z' },
        { id: 'r3', orderId: 'o1', type: 'final', direction: 'out', refundOf: 'r2', amount: 700, receivedAt: '2026-08-21T00:00:00.000Z' },
      ],
    )
    // 被红冲的尾款不再计入，定金保留 → 回退已收定金/待付尾款
    expect(patch.paymentStatus).toBe('deposit_paid')
    expect(patch.orderStatus).toBe('awaiting_final')
    expect(patch.depositActual).toBe(300)
    expect(patch.finalActual).toBe(0)
    expect(patch.actualAmount).toBe(300)
    expect(patch.finalPaidAt).toBeUndefined()
  })

  it('金额浮点累加收敛到两位小数', () => {
    const patch = recomputeOrderPaymentPatch(
      { orderStatus: 'awaiting_final', paymentStatus: 'deposit_paid' },
      [rec('deposit', 0.1, '2026-08-01T00:00:00.000Z'), rec('deposit', 0.2, '2026-08-02T00:00:00.000Z')],
    )
    expect(patch.depositActual).toBe(0.3)
    expect(patch.actualAmount).toBe(0.3)
  })
})

describe('computePaymentStats', () => {
  it('本月入账（实收）= 有效入账的到手金额合计（扣手续费；跨月记录不计）', () => {
    const stats = computePaymentStats(
      [
        record({ orderId: 'o1', type: 'deposit', amount: 500, receivedAt: '2026-08-05T00:00:00.000Z' }),
        record({ orderId: 'o2', type: 'final', amount: 300, receivedAt: '2026-08-20T00:00:00.000Z' }),
        record({ orderId: 'o3', type: 'final', amount: 999, receivedAt: '2026-07-30T00:00:00.000Z' }), // 上月不计
      ],
      [order({ id: 'o1', orderStatus: 'in_progress', expectedAmount: 800 }), order({ id: 'o2', orderStatus: 'awaiting_final', expectedAmount: 800 })],
      sourceOf,
      today,
    )
    // 500×0.9 + 300×0.9 = 450 + 270（订单默认来源 s1，10% 手续费）
    expect(stats.monthReceived).toBe(720)
  })

  it('本月净收入 = 本月入账到手合计（按订单来源扣手续费）', () => {
    const stats = computePaymentStats(
      [
        // o1 来源 s1（10%）：到手 450
        record({ orderId: 'o1', type: 'deposit', amount: 500, receivedAt: '2026-08-05T00:00:00.000Z' }),
        // o2 来源 s2（固定 5）：到手 295
        record({ orderId: 'o2', type: 'final', amount: 300, receivedAt: '2026-08-06T00:00:00.000Z' }),
        // o4 无来源：到手 100
        record({ orderId: 'o4', type: 'final', amount: 100, receivedAt: '2026-08-07T00:00:00.000Z' }),
      ],
      [
        order({ id: 'o1', orderStatus: 'in_progress', expectedAmount: 800, sourceId: 's1' }),
        order({ id: 'o2', orderStatus: 'awaiting_final', expectedAmount: 300, sourceId: 's2' }),
        order({ id: 'o4', orderStatus: 'in_progress', expectedAmount: 100, sourceId: '' }),
      ],
      sourceOf,
      today,
    )
    expect(stats.monthReceived).toBe(450 + 295 + 100)
    expect(stats.monthNetIncome).toBe(450 + 295 + 100)
  })

  it('本月出账（实出）= 手动退款出账合计；净收入扣减出账（跨月出账不计）', () => {
    const stats = computePaymentStats(
      [
        record({ orderId: 'o1', type: 'deposit', amount: 500, receivedAt: '2026-08-05T00:00:00.000Z' }),
        // 本月手动退款出账：全额实出（不扣手续费，也不退手续费）
        record({ orderId: 'o1', type: 'final', direction: 'out', amount: 500, receivedAt: '2026-08-10T00:00:00.000Z' }),
        // 上月出账不计入本月
        record({ orderId: 'o2', type: 'final', direction: 'out', amount: 999, receivedAt: '2026-07-30T00:00:00.000Z' }),
      ],
      [
        order({ id: 'o1', orderStatus: 'voided', expectedAmount: 800, sourceId: 's1' }),
        order({ id: 'o2', orderStatus: 'voided', expectedAmount: 900, sourceId: 's1' }),
      ],
      sourceOf,
      today,
    )
    // 入账到手 450 − 手动退款 500 = −50（退单退款是真实业务亏损，扣手续费）
    expect(stats.monthReceived).toBe(450)
    expect(stats.monthRefunded).toBe(500)
    expect(stats.monthNetIncome).toBe(450 - 500)
  })

  it('红冲对在统计中互抵为 0：被红冲入账不计入账、红冲不计出账（明细仍保留两笔）', () => {
    const stats = computePaymentStats(
      [
        // 入账 500（米画师 10% 手续费 50），随后被红冲——纠错已全额退回，统计不体现
        { id: 'r1', orderId: 'o1', type: 'deposit', amount: 500, receivedAt: '2026-08-05T00:00:00.000Z' },
        { id: 'r2', orderId: 'o1', type: 'deposit', direction: 'out', refundOf: 'r1', amount: 500, receivedAt: '2026-08-06T00:00:00.000Z' },
      ],
      [order({ id: 'o1', orderStatus: 'completed', expectedAmount: 500, sourceId: 's1' })],
      sourceOf,
      today,
    )
    expect(stats.monthReceived).toBe(0)
    expect(stats.monthRefunded).toBe(0)
    expect(stats.monthNetIncome).toBe(0)
  })

  it('手动退款（非红冲）计入出账：入账到手 − 退款全额', () => {
    const stats = computePaymentStats(
      [
        { id: 'r1', orderId: 'o1', type: 'deposit', amount: 500, receivedAt: '2026-08-05T00:00:00.000Z' },
        // 手动退款出账（refundOf 无值，不指向原入账）
        { id: 'r2', orderId: 'o1', type: 'final', direction: 'out', amount: 500, receivedAt: '2026-08-06T00:00:00.000Z' },
      ],
      [order({ id: 'o1', orderStatus: 'voided', expectedAmount: 500, sourceId: 's1' })],
      sourceOf,
      today,
    )
    expect(stats.monthReceived).toBe(450)
    expect(stats.monthRefunded).toBe(500)
    expect(stats.monthNetIncome).toBe(450 - 500)
  })

  it('待收总额 = 非结单/退单订单剩余应收的到手金额（扣手续费）', () => {
    const stats = computePaymentStats(
      [],
      [
        // 进行中，剩余 500 → 到手 450（10%）
        order({ id: 'o1', orderStatus: 'in_progress', expectedAmount: 800, depositActual: 300, sourceId: 's1' }),
        // 待付尾款，剩余 500 → 固定手续费 5 → 495
        order({ id: 'o2', orderStatus: 'awaiting_final', expectedAmount: 500, finalActual: 0, sourceId: 's2' }),
        // 已完成：不计
        order({ id: 'o3', orderStatus: 'completed', expectedAmount: 900, sourceId: 's1' }),
        // 退单：不计
        order({ id: 'o4', orderStatus: 'voided', expectedAmount: 900, sourceId: 's1' }),
        // 已收齐：剩余 0，不计
        order({ id: 'o5', orderStatus: 'in_progress', expectedAmount: 300, depositActual: 100, finalActual: 200, sourceId: 's1' }),
      ],
      sourceOf,
      today,
    )
    expect(stats.pendingTotal).toBe(450 + 495)
  })

  it('today 为 null 时不过滤月份，统计全部传入记录；待收只算传入订单（跟随筛选）', () => {
    const stats = computePaymentStats(
      [
        // 跨月记录也计入
        record({ orderId: 'o1', type: 'deposit', amount: 500, receivedAt: '2026-07-05T00:00:00.000Z' }),
        record({ orderId: 'o2', type: 'final', amount: 300, receivedAt: '2026-08-20T00:00:00.000Z' }),
        { id: 'r3', orderId: 'o3', type: 'final', direction: 'out', amount: 200, receivedAt: '2026-06-10T00:00:00.000Z' },
      ],
      [
        order({ id: 'o1', orderStatus: 'in_progress', expectedAmount: 800, sourceId: 's1' }),
        order({ id: 'o2', orderStatus: 'awaiting_final', expectedAmount: 300, sourceId: 's2' }),
        order({ id: 'o3', orderStatus: 'voided', expectedAmount: 900, sourceId: 's1' }),
      ],
      sourceOf,
      null,
    )
    // 入账到手：500→450（s1 10%）+ 300→295（s2 固定 5）= 745；出账 200（手动退款）
    expect(stats.monthReceived).toBe(450 + 295)
    expect(stats.monthRefunded).toBe(200)
    expect(stats.monthNetIncome).toBe(450 + 295 - 200)
    // 待收只算传入订单：o1 剩余 800→720 + o2 剩余 300→295；o3 退单不计
    expect(stats.pendingTotal).toBe(720 + 295)
  })

  it('金额浮点累加收敛到两位小数', () => {
    const stats = computePaymentStats(
      [
        record({ orderId: 'o1', type: 'deposit', amount: 0.1, receivedAt: '2026-08-01T00:00:00.000Z' }),
        record({ orderId: 'o1', type: 'deposit', amount: 0.2, receivedAt: '2026-08-02T00:00:00.000Z' }),
      ],
      [order({ id: 'o1', orderStatus: 'in_progress', expectedAmount: 1, sourceId: '' })],
      sourceOf,
      today,
    )
    expect(stats.monthReceived).toBe(0.3)
  })
})

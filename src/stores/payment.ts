import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db, generateId, refreshCustomerStats } from '@/db'
import { applyPaymentEvent } from '@/domain/order/payment-status'
import {
  generateRecordNo,
  isOrderCollectible,
  isOrderRefundable,
  orderRefundableAmount,
  recomputeOrderPaymentPatch,
  type PaymentRecordType,
} from '@/domain/payment/payment-record'
import type { PaymentRecord, PaymentStatus, Order } from '@/types'

export const usePaymentStore = defineStore('payment', () => {
  const records = ref<PaymentRecord[]>([])
  const loading = ref(false)

  /** 拉取全部账单（按到账日期倒序，最新在前） */
  async function fetchPaymentRecords() {
    loading.value = true
    try {
      const all = await db.paymentRecords.orderBy('receivedAt').reverse().toArray()
      // 旧数据兼容：direction 是账单化重构后新增的字段，历史收款记录缺省且语义均为入账（in）——
      // 加载时惰性回填一次，避免列表中方向显示「—」
      const missing = all.filter(r => !r.direction)
      if (missing.length > 0) {
        await Promise.all(missing.map(r => db.paymentRecords.update(r.id, { direction: 'in' })))
        all.forEach(r => { if (!r.direction) r.direction = 'in' })
      }
      records.value = all
    } finally {
      loading.value = false
    }
  }

  /** 查询某订单的全部账单（按到账时间升序） */
  async function recordsOfOrder(orderId: string): Promise<PaymentRecord[]> {
    return db.paymentRecords.where('orderId').equals(orderId).sortBy('receivedAt')
  }

  /**
   * 新增一条入账账单（收到客户的钱），并联动更新订单（需求 5.2.3）：
   * - 写入 paymentRecords（direction='in'）
   * - 按账单类型应用收款事件（deposit → deposit_paid / final → final_paid），
   *   更新订单的收款状态、实际金额、支付时间、工作状态（收定金→未开始 / 收尾款→已完成）
   * - 实时重算客户统计与权重
   */
  async function addPaymentRecord(data: {
    orderId: string
    type: PaymentRecordType
    amount?: number
    receivedAt?: string
    notes?: string
  }) {
    const order = await db.orders.get(data.orderId)
    if (!order) throw new Error('关联订单不存在')
    if (!isOrderCollectible(order)) throw new Error('该订单已结清，不能再登记收款')

    const receivedAt = data.receivedAt ?? new Date().toISOString()
    const amount = data.amount ?? (data.type === 'deposit' ? order.depositExpected : order.finalExpected)

    const record: PaymentRecord = {
      id: generateId(),
      recordNo: generateRecordNo(new Date(receivedAt)),
      orderId: order.id,
      type: data.type,
      direction: 'in',
      amount,
      receivedAt,
      notes: data.notes,
    }
    await db.paymentRecords.add(record)

    // 联动订单：应用收款事件（含收款状态、实际金额、支付时间、工作状态）
    const status: PaymentStatus = data.type === 'deposit' ? 'deposit_paid' : 'final_paid'
    const patch = applyPaymentEvent(order, status, amount, new Date(receivedAt))
    await db.orders.update(order.id, { ...patch, updatedAt: new Date().toISOString() })

    if (order.customerId) await refreshCustomerStats(order.customerId)
    await fetchPaymentRecords()
    return record
  }

  /**
   * 新增一条出账账单（退单退款：把已收的钱退回客户）。
   * - 仅已退单（voided）且存在入账流水的订单可退款
   * - 金额缺省为「可退金额」（入账合计 − 已出账合计）
   * - 出账不改变订单收款状态（退单订单保持 voided）；客户累计消费在 refreshCustomerStats 中扣减
   */
  async function addRefundRecord(data: {
    orderId: string
    type?: PaymentRecordType
    amount?: number
    receivedAt?: string
    notes?: string
  }) {
    const order = await db.orders.get(data.orderId)
    if (!order) throw new Error('关联订单不存在')
    const orderRecords = await recordsOfOrder(order.id)
    if (!isOrderRefundable(order, orderRecords)) throw new Error('该订单未退单或没有可退的入账')

    const receivedAt = data.receivedAt ?? new Date().toISOString()
    const refundable = orderRefundableAmount(orderRecords)
    const amount = data.amount ?? refundable
    if (amount <= 0) throw new Error('该订单没有可退金额')
    if (amount > refundable) throw new Error('退款金额不能超过可退金额')

    const record: PaymentRecord = {
      id: generateId(),
      recordNo: generateRecordNo(new Date(receivedAt)),
      orderId: order.id,
      // 出账（退款）无定金/尾款语义，不携带 type
      ...(data.type ? { type: data.type } : {}),
      direction: 'out',
      amount,
      receivedAt,
      notes: data.notes ?? '退单退款',
    }
    await db.paymentRecords.add(record)

    if (order.customerId) await refreshCustomerStats(order.customerId)
    await fetchPaymentRecords()
    return record
  }

  /**
   * 红冲（代替删除）：对指定账单生成一条方向相反、金额相同的出账账单（refundOf 指向被冲销账单），
   * 保留原始凭证（账单不可删除）。入账被红冲后，订单收款状态按剩余入账流水重算。
   */
  async function reversePaymentRecord(id: string, notes?: string) {
    const rec = await db.paymentRecords.get(id)
    if (!rec) return
    if (rec.direction === 'out') throw new Error('出账账单不能再次红冲')

    const now = new Date().toISOString()
    const reversed: PaymentRecord = {
      id: generateId(),
      recordNo: generateRecordNo(new Date()),
      orderId: rec.orderId,
      type: rec.type,
      direction: 'out',
      refundOf: rec.id,
      amount: rec.amount,
      receivedAt: now,
      notes: notes ?? `红冲 ${rec.recordNo}`,
    }
    await db.paymentRecords.add(reversed)

    // 入账被冲销：订单收款状态按剩余入账流水重算
    await recomputeOrderAfterPaymentChange(rec.orderId)
    await fetchPaymentRecords()
    return reversed
  }

  /**
   * 撤销一笔手动退款（出账账单，非红冲生成）。
   * 误录退款时用于恢复订单可退金额；红冲生成的出账（refundOf 有值）是审计凭证，不可撤销。
   * 出账不影响订单收款状态与客户统计（退单订单整体排除消费），仅刷新账单列表。
   */
  async function deleteRefundRecord(id: string) {
    const rec = await db.paymentRecords.get(id)
    if (!rec) return
    if (rec.direction !== 'out') throw new Error('只有出账（退款）记录可以撤销')
    if (rec.refundOf) throw new Error('红冲记录不可撤销')
    await db.paymentRecords.delete(id)
    await fetchPaymentRecords()
  }

  /** 编辑一条入账账单（金额/到账日期/备注），并联动重算订单收款状态。 */
  async function updatePaymentRecord(id: string, data: { amount?: number; receivedAt?: string; notes?: string }) {
    const rec = await db.paymentRecords.get(id)
    if (!rec) return
    const patch: Partial<PaymentRecord> = {}
    if (data.amount !== undefined && isFinite(data.amount)) patch.amount = data.amount
    if (data.receivedAt) patch.receivedAt = data.receivedAt
    if (data.notes !== undefined) patch.notes = data.notes
    await db.paymentRecords.update(id, patch)
    await recomputeOrderAfterPaymentChange(rec.orderId)
    await fetchPaymentRecords()
  }

  /** 账单变更后，按该订单剩余入账流水重算收款状态/金额/支付时间，并刷新客户统计 */
  async function recomputeOrderAfterPaymentChange(orderId: string) {
    const order = await db.orders.get(orderId)
    if (!order) return
    const remaining = await recordsOfOrder(orderId)
    const patch = recomputeOrderPaymentPatch(order, remaining)
    await db.orders.update(orderId, { ...patch, updatedAt: new Date().toISOString() } as Partial<Order>)
    if (order.customerId) await refreshCustomerStats(order.customerId)
  }

  return {
    records,
    loading,
    fetchPaymentRecords,
    addPaymentRecord,
    addRefundRecord,
    reversePaymentRecord,
    deleteRefundRecord,
    updatePaymentRecord,
  }
})

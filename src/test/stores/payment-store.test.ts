import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { Order } from '@/types'

// Simple in-memory database for testing
class InMemoryDb {
  private data: Map<string, Map<string, any[]>> = new Map()

  getTable(tableName: string) {
    if (!this.data.has(tableName)) {
      this.data.set(tableName, new Map())
    }
    return this.data.get(tableName)!
  }

  async clear(tableName: string) {
    const table = this.getTable(tableName)
    table.clear()
  }

  async getAll(tableName: string): Promise<any[]> {
    const table = this.getTable(tableName)
    const result: any[] = []
    table.forEach((value) => result.push(...value))
    return result
  }

  async get(tableName: string, id: string): Promise<any> {
    const table = this.getTable(tableName)
    for (const values of table.values()) {
      const found = values.find((v: any) => v.id === id)
      if (found) return found
    }
    return undefined
  }

  async add(tableName: string, item: any): Promise<string> {
    const table = this.getTable(tableName)
    const bucket = table.get(item.id) || []
    bucket.push(item)
    table.set(item.id, bucket)
    return item.id
  }

  async update(tableName: string, id: string, changes: any): Promise<number> {
    const table = this.getTable(tableName)
    for (const values of table.values()) {
      const idx = values.findIndex((v: any) => v.id === id)
      if (idx !== -1) {
        values[idx] = { ...values[idx], ...changes }
        return 1
      }
    }
    return 0
  }

  async delete(tableName: string, id: string): Promise<void> {
    const table = this.getTable(tableName)
    for (const [key, values] of table.entries()) {
      const idx = values.findIndex((v: any) => v.id === id)
      if (idx !== -1) {
        values.splice(idx, 1)
        if (values.length === 0) {
          table.delete(key)
        } else {
          table.set(key, values)
        }
        return
      }
    }
  }

  async count(tableName: string): Promise<number> {
    const items = await this.getAll(tableName)
    return items.length
  }

  /** where 支持两种调用：对象模式 where(table, {key: val})；字段名模式 where(table, 'key').equals(val) */
  where(tableName: string, conditions: Record<string, any> | string) {
    const self = this
    // 字段名模式：记录字段名，等待 .equals(value) 补值
    let field: string | null = null
    let value: any
    if (typeof conditions === 'string') {
      field = conditions
    } else {
      field = null
      value = conditions
    }
    const match = (item: any) => {
      if (field) return item[field] === value
      return Object.entries(value).every(([k, v]) => item[k] === v)
    }
    const chain = {
      equals(v: any) {
        value = v
        return chain
      },
      async toArray(): Promise<any[]> {
        const all = await self.getAll(tableName)
        return all.filter(match)
      },
      async sortBy(key: string): Promise<any[]> {
        const items = await chain.toArray()
        return items.sort((a: any, b: any) => {
          const av = String(a[key] ?? '')
          const bv = String(b[key] ?? '')
          return av < bv ? -1 : av > bv ? 1 : 0
        })
      },
      async count(): Promise<number> {
        const results = await chain.toArray()
        return results.length
      },
      async delete(): Promise<number> {
        const items = await chain.toArray()
        for (const item of items) {
          await self.delete(tableName, item.id)
        }
        return items.length
      },
      async modify(callback: (item: any) => void): Promise<number> {
        const items = await chain.toArray()
        for (const item of items) {
          callback(item)
          await self.update(tableName, item.id, item)
        }
        return items.length
      },
    }
    return chain
  }

  orderBy(tableName: string, key: string) {
    const self = this
    return {
      reverse() {
        return {
          async toArray(): Promise<any[]> {
            const all = await self.getAll(tableName)
            return all.sort((a: any, b: any) => {
              const av = String(a[key] ?? '')
              const bv = String(b[key] ?? '')
              return av < bv ? 1 : av > bv ? -1 : 0
            })
          },
        }
      },
    }
  }

  bulkAdd(tableName: string, items: any[]) {
    return Promise.all(items.map(item => this.add(tableName, item)))
  }
}

const mockDb = new InMemoryDb()

vi.mock('@/db', async () => {
  const actual = await vi.importActual<typeof import('@/db')>('@/db')
  return {
    db: {
      orders: {
        clear: () => mockDb.clear('orders'),
        toArray: () => mockDb.getAll('orders'),
        get: (id: string) => mockDb.get('orders', id),
        add: (item: any) => mockDb.add('orders', item),
        update: (id: string, changes: any) => mockDb.update('orders', id, changes),
        delete: (id: string) => mockDb.delete('orders', id),
        where: (conditions: any) => mockDb.where('orders', conditions),
      },
      customers: {
        clear: () => mockDb.clear('customers'),
        toArray: () => mockDb.getAll('customers'),
        get: (id: string) => mockDb.get('customers', id),
        add: (item: any) => mockDb.add('customers', item),
        update: (id: string, changes: any) => mockDb.update('customers', id, changes),
        delete: (id: string) => mockDb.delete('customers', id),
        where: (conditions: any) => mockDb.where('customers', conditions),
        count: () => mockDb.count('customers'),
      },
      stages: {
        clear: () => mockDb.clear('stages'),
        toArray: () => mockDb.getAll('stages'),
        get: (id: string) => mockDb.get('stages', id),
        add: (item: any) => mockDb.add('stages', item),
        bulkAdd: (items: any[]) => mockDb.bulkAdd('stages', items),
        count: () => mockDb.count('stages'),
      },
      stageTransitions: {
        clear: () => mockDb.clear('stageTransitions'),
        add: (item: any) => mockDb.add('stageTransitions', item),
        where: (conditions: any) => mockDb.where('stageTransitions', conditions),
      },
      sources: {
        clear: () => mockDb.clear('sources'),
        bulkAdd: (items: any[]) => mockDb.bulkAdd('sources', items),
      },
      categories: {
        bulkAdd: (items: any[]) => mockDb.bulkAdd('categories', items),
      },
      customerTypes: {
        bulkAdd: (items: any[]) => mockDb.bulkAdd('customerTypes', items),
      },
      paymentRecords: {
        clear: () => mockDb.clear('paymentRecords'),
        toArray: () => mockDb.getAll('paymentRecords'),
        get: (id: string) => mockDb.get('paymentRecords', id),
        add: (item: any) => mockDb.add('paymentRecords', item),
        delete: (id: string) => mockDb.delete('paymentRecords', id),
        update: (id: string, changes: any) => mockDb.update('paymentRecords', id, changes),
        orderBy: (key: string) => mockDb.orderBy('paymentRecords', key),
        where: (conditions: any) => mockDb.where('paymentRecords', conditions),
      },
      followUps: {
        clear: () => mockDb.clear('followUps'),
        add: (item: any) => mockDb.add('followUps', item),
      },
      notifications: {
        clear: () => mockDb.clear('notifications'),
      },
      weightConfig: {
        clear: () => mockDb.clear('weightConfig'),
        add: (item: any) => mockDb.add('weightConfig', item),
        get: (id: number) => mockDb.get('weightConfig', String(id)),
      },
      followUpTypes: {
        bulkAdd: (items: any[]) => mockDb.bulkAdd('followUpTypes', items),
      },
    },
    generateId: actual.generateId,
    generateOrderNo: actual.generateOrderNo,
    calculateWeight: async () => 50,
    refreshCustomerStats: async () => {},
  }
})

import { usePaymentStore } from '@/stores/payment'

function createTestOrder(overrides: Partial<Omit<Order, 'id' | 'orderNo' | 'createdAt' | 'updatedAt'>> & { id?: string } = {}) {
  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - 3)
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() + 7)

  return {
    id: overrides.id,
    name: '测试订单',
    content: '测试内容',
    customerId: 'cu-1',
    sourceId: 's1',
    expectedAmount: 1000,
    actualAmount: 0,
    depositExpected: 300,
    depositActual: 0,
    finalExpected: 700,
    finalActual: 0,
    expectedStartDate: startDate.toISOString(),
    expectedEndDate: endDate.toISOString(),
    orderStatus: 'awaiting_deposit' as const,
    paymentStatus: 'unpaid' as const,
    currentStage: 'st-pending',
    usage: 'commercial' as const,
    isUrgent: false,
    ...overrides,
  }
}

describe('收款 Store 测试', () => {
  beforeEach(async () => {
    const tables = ['orders', 'customers', 'stages', 'stageTransitions', 'sources', 'weightConfig', 'paymentRecords']
    for (const table of tables) {
      await mockDb.clear(table)
    }
    const now = new Date().toISOString()
    await mockDb.bulkAdd('sources', [
      { id: 's1', name: '米画师', feeType: 'percentage', feeValue: 10, isEnabled: true, createdAt: now, updatedAt: now },
    ])
    await mockDb.add('weightConfig', { id: 1, w1: 25, w2: 20, w3: 20, w4: 15, w5: 20 })
    setActivePinia(createPinia())
  })

  it('新增定金记录：写入流水 + 联动订单（收款状态/实际金额/支付时间/工作状态）', async () => {
    const store = usePaymentStore()
    const orderId = 'o1'
    await mockDb.add('orders', createTestOrder({ id: orderId, orderStatus: 'awaiting_deposit', paymentStatus: 'unpaid' }))

    const record = await store.addPaymentRecord({
      orderId,
      type: 'deposit',
      amount: 300,
      receivedAt: '2026-08-05T04:00:00.000Z',
      notes: '支付宝',
    })

    expect(record.amount).toBe(300)
    expect(record.type).toBe('deposit')
    expect(record.notes).toBe('支付宝')

    // 流水已写入
    const all = await mockDb.getAll('paymentRecords')
    expect(all.length).toBe(1)
    expect(all[0].orderId).toBe(orderId)

    // 订单联动
    const order = await mockDb.get('orders', orderId)
    expect(order.paymentStatus).toBe('deposit_paid')
    expect(order.depositActual).toBe(300)
    expect(order.depositPaidAt).toBe('2026-08-05T04:00:00.000Z')
    expect(order.orderStatus).toBe('not_started')
    expect(order.actualAmount).toBe(300)

    // store 状态刷新
    expect(store.records.length).toBe(1)
  })

  it('新增尾款记录：订单结单（completed）', async () => {
    const store = usePaymentStore()
    const orderId = 'o2'
    await mockDb.add('orders', createTestOrder({
      id: orderId,
      orderStatus: 'awaiting_final',
      paymentStatus: 'deposit_paid',
      depositActual: 300,
    }))

    await store.addPaymentRecord({
      orderId,
      type: 'final',
      amount: 700,
      receivedAt: '2026-08-20T04:00:00.000Z',
    })

    const order = await mockDb.get('orders', orderId)
    expect(order.paymentStatus).toBe('final_paid')
    expect(order.finalActual).toBe(700)
    expect(order.finalPaidAt).toBe('2026-08-20T04:00:00.000Z')
    expect(order.orderStatus).toBe('completed')
    expect(order.actualAmount).toBe(1000)
  })

  it('金额缺省时回退到订单预计值（定金 300 / 尾款 700）', async () => {
    const store = usePaymentStore()
    const orderId = 'o3'
    await mockDb.add('orders', createTestOrder({ id: orderId }))

    const rec = await store.addPaymentRecord({ orderId, type: 'deposit' })
    expect(rec.amount).toBe(300)

    await mockDb.update('orders', orderId, { orderStatus: 'awaiting_final', paymentStatus: 'deposit_paid', depositActual: 300 })
    const rec2 = await store.addPaymentRecord({ orderId, type: 'final' })
    expect(rec2.amount).toBe(700)
  })

  it('订单不存在时抛错且不写流水', async () => {
    const store = usePaymentStore()
    await expect(store.addPaymentRecord({ orderId: 'not-exist', type: 'deposit' }))
      .rejects.toThrow('关联订单不存在')
    const all = await mockDb.getAll('paymentRecords')
    expect(all.length).toBe(0)
  })

  it('已结清订单（completed）拒绝登记收款', async () => {
    const store = usePaymentStore()
    const orderId = 'o-fin'
    await mockDb.add('orders', createTestOrder({
      id: orderId,
      orderStatus: 'completed',
      paymentStatus: 'final_paid',
      depositActual: 300,
      finalActual: 700,
    }))

    await expect(store.addPaymentRecord({ orderId, type: 'deposit', amount: 100, receivedAt: '2026-08-05T00:00:00.000Z' }))
      .rejects.toThrow('该订单已结清，不能再登记收款')
    const all = await mockDb.getAll('paymentRecords')
    expect(all.length).toBe(0)
    // 订单状态不受影响
    const order = await mockDb.get('orders', orderId)
    expect(order.paymentStatus).toBe('final_paid')
  })

  it('退单订单（voided）拒绝登记收款', async () => {
    const store = usePaymentStore()
    const orderId = 'o-void'
    await mockDb.add('orders', createTestOrder({ id: orderId, orderStatus: 'voided', paymentStatus: 'unpaid' }))

    await expect(store.addPaymentRecord({ orderId, type: 'deposit', amount: 100, receivedAt: '2026-08-05T00:00:00.000Z' }))
      .rejects.toThrow('该订单已结清，不能再登记收款')
    const all = await mockDb.getAll('paymentRecords')
    expect(all.length).toBe(0)
  })

  it('拉取流水按到账日期倒序', async () => {
    const store = usePaymentStore()
    await mockDb.add('orders', createTestOrder({ id: 'o1' }))
    await store.addPaymentRecord({ orderId: 'o1', type: 'deposit', amount: 100, receivedAt: '2026-08-01T00:00:00.000Z' })
    await store.addPaymentRecord({ orderId: 'o1', type: 'final', amount: 200, receivedAt: '2026-08-15T00:00:00.000Z' })

    await store.fetchPaymentRecords()
    expect(store.records.length).toBe(2)
    expect(store.records[0].receivedAt).toBe('2026-08-15T00:00:00.000Z')
    expect(store.records[1].receivedAt).toBe('2026-08-01T00:00:00.000Z')
  })

  it('红冲定金入账：生成方向相反金额相同的出账账单（refundOf 指向原单），原单保留', async () => {
    const store = usePaymentStore()
    const orderId = 'o1'
    await mockDb.add('orders', createTestOrder({ id: orderId }))
    const rec = await store.addPaymentRecord({ orderId, type: 'deposit', amount: 300, receivedAt: '2026-08-05T00:00:00.000Z' })

    await store.reversePaymentRecord(rec.id)

    const all = await mockDb.getAll('paymentRecords')
    expect(all.length).toBe(2)
    const reversed = all.find(r => r.direction === 'out')!
    expect(reversed.amount).toBe(300)
    expect(reversed.refundOf).toBe(rec.id)
    expect(reversed.orderId).toBe(orderId)
    // 原账单保留（账单不可删除）
    expect(all.some(r => r.id === rec.id)).toBe(true)
    // 入账被冲销后订单按剩余入账重算：回退待付定金
    const order = await mockDb.get('orders', orderId)
    expect(order.paymentStatus).toBe('unpaid')
    expect(order.depositActual).toBe(0)
    expect(order.depositPaidAt).toBeUndefined()
    expect(order.actualAmount).toBe(0)
    expect(store.records.length).toBe(2)
  })

  it('红冲尾款入账：结单订单回退待付尾款（completed → awaiting_final），可重新关联收款', async () => {
    const store = usePaymentStore()
    const orderId = 'o1'
    await mockDb.add('orders', createTestOrder({ id: orderId }))
    // 真实链路：先收定金（写流水），再收尾款
    await store.addPaymentRecord({ orderId, type: 'deposit', amount: 300, receivedAt: '2026-08-01T00:00:00.000Z' })
    const finalRec = await store.addPaymentRecord({ orderId, type: 'final', amount: 700, receivedAt: '2026-08-20T00:00:00.000Z' })
    // 收尾款后订单已结单
    expect((await mockDb.get('orders', orderId)).orderStatus).toBe('completed')

    await store.reversePaymentRecord(finalRec.id)

    const order = await mockDb.get('orders', orderId)
    expect(order.paymentStatus).toBe('deposit_paid')
    expect(order.orderStatus).toBe('awaiting_final')
    expect(order.finalActual).toBe(0)
    expect(order.finalPaidAt).toBeUndefined()
    expect(order.actualAmount).toBe(300)
    // 原账单保留，仅新增一条出账
    expect((await mockDb.getAll('paymentRecords')).length).toBe(3)
    // 订单重新可收款（关联下拉会显示它）
    const { isOrderCollectible } = await import('@/domain/payment/payment-record')
    expect(isOrderCollectible(order)).toBe(true)
  })

  it('红冲其中一条入账后按剩余入账重算（双流水红冲尾款 → 定金保留）', async () => {
    const store = usePaymentStore()
    const orderId = 'o1'
    await mockDb.add('orders', createTestOrder({ id: orderId, orderStatus: 'awaiting_final', paymentStatus: 'deposit_paid', depositActual: 300 }))
    await store.addPaymentRecord({ orderId, type: 'deposit', amount: 300, receivedAt: '2026-08-01T00:00:00.000Z' })
    const finalRec = await store.addPaymentRecord({ orderId, type: 'final', amount: 700, receivedAt: '2026-08-20T00:00:00.000Z' })

    await store.reversePaymentRecord(finalRec.id)

    const order = await mockDb.get('orders', orderId)
    expect(order.paymentStatus).toBe('deposit_paid')
    expect(order.depositActual).toBe(300)
    expect(order.finalActual).toBe(0)
    expect(store.records.length).toBe(3)
  })

  it('出账账单不能再次红冲', async () => {
    const store = usePaymentStore()
    const orderId = 'o1'
    await mockDb.add('orders', createTestOrder({ id: orderId }))
    const rec = await store.addPaymentRecord({ orderId, type: 'deposit', amount: 300, receivedAt: '2026-08-05T00:00:00.000Z' })
    await store.reversePaymentRecord(rec.id)
    const outRec = (await mockDb.getAll('paymentRecords')).find(r => r.direction === 'out')!

    await expect(store.reversePaymentRecord(outRec.id)).rejects.toThrow('出账账单不能再次红冲')
  })

  it('新增退款出账：仅已退单且有入账的订单可退；出账不改变订单收款状态', async () => {
    const store = usePaymentStore()
    const orderId = 'o1'
    await mockDb.add('orders', createTestOrder({ id: orderId }))
    await store.addPaymentRecord({ orderId, type: 'deposit', amount: 300, receivedAt: '2026-08-01T00:00:00.000Z' })
    // 之后订单退单
    await mockDb.update('orders', orderId, { orderStatus: 'voided', paymentStatus: 'deposit_paid' })

    const rec = await store.addRefundRecord({ orderId, amount: 300, receivedAt: '2026-08-10T00:00:00.000Z' })

    expect(rec.direction).toBe('out')
    expect(rec.amount).toBe(300)
    expect(rec.notes).toBe('退单退款')
    const all = await mockDb.getAll('paymentRecords')
    expect(all.filter(r => r.direction === 'out').length).toBe(1)
    // 出账不改变订单收款状态（退单保持 voided）
    const order = await mockDb.get('orders', orderId)
    expect(order.orderStatus).toBe('voided')
    expect(order.depositActual).toBe(300)
    expect(order.actualAmount).toBe(300)
  })

  it('退款金额缺省时默认 = 可退金额（入账合计 − 已出账合计）；出账账单无收款类型', async () => {
    const store = usePaymentStore()
    const orderId = 'o1'
    await mockDb.add('orders', createTestOrder({ id: orderId }))
    await store.addPaymentRecord({ orderId, type: 'deposit', amount: 300, receivedAt: '2026-08-01T00:00:00.000Z' })
    await store.addPaymentRecord({ orderId, type: 'final', amount: 700, receivedAt: '2026-08-20T00:00:00.000Z' })
    await mockDb.update('orders', orderId, { orderStatus: 'voided', paymentStatus: 'deposit_paid' })
    // 先部分退款 400，剩余可退 = 1000 − 400 = 600
    await store.addRefundRecord({ orderId, amount: 400, receivedAt: '2026-08-25T00:00:00.000Z' })
    const rec = await store.addRefundRecord({ orderId, receivedAt: '2026-08-28T00:00:00.000Z' })
    expect(rec.amount).toBe(600)
    expect(rec.type).toBeUndefined()
  })

  it('未退单订单拒绝退款', async () => {
    const store = usePaymentStore()
    const orderId = 'o1'
    await mockDb.add('orders', createTestOrder({ id: orderId }))
    await store.addPaymentRecord({ orderId, type: 'deposit', amount: 300, receivedAt: '2026-08-01T00:00:00.000Z' })
    // 订单未退单（进行中）
    await mockDb.update('orders', orderId, { orderStatus: 'in_progress', paymentStatus: 'deposit_paid' })

    await expect(store.addRefundRecord({ orderId, amount: 300, receivedAt: '2026-08-10T00:00:00.000Z' }))
      .rejects.toThrow('该订单未退单或没有可退的入账')
    expect((await mockDb.getAll('paymentRecords')).filter(r => r.direction === 'out').length).toBe(0)
  })

  it('退款金额不能超过可退金额（退单无入账/已全额退完均拒绝）', async () => {
    const store = usePaymentStore()
    const orderId = 'o1'
    await mockDb.add('orders', createTestOrder({ id: orderId }))
    await store.addPaymentRecord({ orderId, type: 'deposit', amount: 300, receivedAt: '2026-08-01T00:00:00.000Z' })
    await mockDb.update('orders', orderId, { orderStatus: 'voided', paymentStatus: 'deposit_paid' })
    await store.addRefundRecord({ orderId, amount: 300, receivedAt: '2026-08-10T00:00:00.000Z' })
    // 已全额退完：再退被拒
    await expect(store.addRefundRecord({ orderId, amount: 100, receivedAt: '2026-08-12T00:00:00.000Z' }))
      .rejects.toThrow('退款金额不能超过可退金额')
  })

  it('撤销手动退款：删除出账记录，可退金额恢复，订单收款状态不变', async () => {
    const store = usePaymentStore()
    const orderId = 'o1'
    await mockDb.add('orders', createTestOrder({ id: orderId }))
    await store.addPaymentRecord({ orderId, type: 'deposit', amount: 300, receivedAt: '2026-08-01T00:00:00.000Z' })
    await mockDb.update('orders', orderId, { orderStatus: 'voided', paymentStatus: 'deposit_paid' })
    // 误录退款 300
    const refund = await store.addRefundRecord({ orderId, amount: 300, receivedAt: '2026-08-10T00:00:00.000Z' })

    await store.deleteRefundRecord(refund.id)

    const all = await mockDb.getAll('paymentRecords')
    expect(all.length).toBe(1) // 仅剩原入账
    expect(all[0].direction).toBe('in')
    // 订单收款状态不受影响（退单保持 voided，实际到账保留）
    const order = await mockDb.get('orders', orderId)
    expect(order.orderStatus).toBe('voided')
    expect(order.actualAmount).toBe(300)
    // 可退金额恢复（重新可全额退）
    const { orderRefundableAmount, isOrderRefundable } = await import('@/domain/payment/payment-record')
    expect(orderRefundableAmount(all)).toBe(300)
    expect(isOrderRefundable(order, all)).toBe(true)
  })

  it('入账账单不可撤销（只有出账可撤销）', async () => {
    const store = usePaymentStore()
    const orderId = 'o1'
    await mockDb.add('orders', createTestOrder({ id: orderId }))
    const rec = await store.addPaymentRecord({ orderId, type: 'deposit', amount: 300, receivedAt: '2026-08-01T00:00:00.000Z' })

    await expect(store.deleteRefundRecord(rec.id)).rejects.toThrow('只有出账（退款）记录可以撤销')
    expect((await mockDb.getAll('paymentRecords')).length).toBe(1)
  })

  it('红冲生成的出账不可撤销（审计凭证保留）', async () => {
    const store = usePaymentStore()
    const orderId = 'o1'
    await mockDb.add('orders', createTestOrder({ id: orderId }))
    const rec = await store.addPaymentRecord({ orderId, type: 'deposit', amount: 300, receivedAt: '2026-08-01T00:00:00.000Z' })
    await store.reversePaymentRecord(rec.id)
    const reversed = (await mockDb.getAll('paymentRecords')).find(r => r.direction === 'out')!

    await expect(store.deleteRefundRecord(reversed.id)).rejects.toThrow('红冲记录不可撤销')
    // 原入账 + 红冲出账均保留
    expect((await mockDb.getAll('paymentRecords')).length).toBe(2)
  })

  it('旧数据（缺 direction）账单加载时回填为入账（in），新数据不受影响', async () => {
    const store = usePaymentStore()
    await mockDb.add('orders', createTestOrder({ id: 'o1' }))
    // 模拟账单化重构前创建的旧记录（无 direction 字段）
    await mockDb.add('paymentRecords', { id: 'old-1', recordNo: 'RCOLD001', orderId: 'o1', type: 'deposit', amount: 300, receivedAt: '2026-08-01T00:00:00.000Z' })
    await store.addPaymentRecord({ orderId: 'o1', type: 'final', amount: 700, receivedAt: '2026-08-15T00:00:00.000Z' })

    await store.fetchPaymentRecords()

    // 旧记录回填为入账
    const old = store.records.find(r => r.id === 'old-1')!
    expect(old.direction).toBe('in')
    const persisted = await mockDb.get('paymentRecords', 'old-1')
    expect(persisted.direction).toBe('in')
    // 新记录保持原有方向
    const fresh = store.records.find(r => r.id !== 'old-1')!
    expect(fresh.direction).toBe('in')
  })

  it('编辑收款记录（金额/日期/备注）后联动重算订单', async () => {
    const store = usePaymentStore()
    const orderId = 'o1'
    await mockDb.add('orders', createTestOrder({ id: orderId }))
    const rec = await store.addPaymentRecord({ orderId, type: 'deposit', amount: 300, receivedAt: '2026-08-05T00:00:00.000Z' })

    await store.updatePaymentRecord(rec.id, { amount: 350, notes: '修改后的备注' })

    const updated = await mockDb.get('paymentRecords', rec.id)
    expect(updated.amount).toBe(350)
    expect(updated.notes).toBe('修改后的备注')
    const order = await mockDb.get('orders', orderId)
    expect(order.depositActual).toBe(350)
  })
})

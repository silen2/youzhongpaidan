import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { Order, OrderStatus, PaymentStatus } from '@/types'

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

  where(tableName: string, conditions: Record<string, any> | string): any {
    const self = this
    // 字段名模式：where('orders', 'orderId').equals(value) → 转为对象模式
    if (typeof conditions === 'string') {
      const field = conditions
      return {
        equals(value: any) {
          return self.where(tableName, { [field]: value } as Record<string, any>)
        },
      }
    }
    return {
      async toArray(): Promise<any[]> {
        const all = await self.getAll(tableName)
        return all.filter((item: any) => {
          return Object.entries(conditions).every(([key, value]) => item[key] === value)
        })
      },
      async count(): Promise<number> {
        const results = await this.toArray()
        return results.length
      },
      async delete(): Promise<number> {
        const items = await this.toArray()
        for (const item of items) {
          await self.delete(tableName, item.id)
        }
        return items.length
      },
      async modify(callback: (item: any) => void): Promise<number> {
        const items = await this.toArray()
        for (const item of items) {
          callback(item)
          await self.update(tableName, item.id, item)
        }
        return items.length
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
        toArray: () => mockDb.getAll('stageTransitions'),
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
        add: (item: any) => mockDb.add('paymentRecords', item),
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

import { useOrderStore } from '@/stores/order'

function createTestOrder(overrides: Partial<Omit<Order, 'id' | 'orderNo' | 'createdAt' | 'updatedAt'>> & { id?: string } = {}) {
  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - 3)
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() + 7)

  return {
    id: overrides.id,
    name: '测试订单',
    content: '这是一个测试订单内容',
    customerId: 'cu-mock-001',
    sourceId: 's1',
    expectedAmount: 5000,
    actualAmount: 5000,
    depositExpected: 2500,
    depositActual: 2500,
    finalExpected: 2500,
    finalActual: 2500,
    expectedStartDate: startDate.toISOString(),
    expectedEndDate: endDate.toISOString(),
    orderStatus: 'awaiting_deposit' as OrderStatus,
    paymentStatus: 'unpaid' as PaymentStatus,
    currentStage: 'st-pending',
    usage: 'commercial' as const,
    isUrgent: false,
    ...overrides,
  }
}

describe('订单 Store 测试', () => {
  beforeEach(async () => {
    // Clear all tables
    const tables = ['orders', 'customers', 'stages', 'stageTransitions', 'sources', 'weightConfig']
    for (const table of tables) {
      await mockDb.clear(table)
    }

    // Seed test data
    const now = new Date().toISOString()
    await mockDb.bulkAdd('sources', [
      { id: 's1', name: '米画师', feeType: 'percentage', feeValue: 10, isEnabled: true, createdAt: now, updatedAt: now },
      { id: 's2', name: 'Pixiv', feeType: 'percentage', feeValue: 0, isEnabled: true, createdAt: now, updatedAt: now },
    ])
    await mockDb.bulkAdd('stages', [
      { id: 'st-pending', name: '待开始', color: '#94a3b8', type: 'system', position: 0 },
      { id: 'st-sketch', name: '线稿', color: '#ef4444', type: 'custom', position: 1 },
      { id: 'st-color', name: '色稿', color: '#3b82f6', type: 'custom', position: 2 },
      { id: 'st-done', name: '完成', color: '#22c55e', type: 'system', position: 5 },
      { id: 'st-void', name: '退单', color: '#64748b', type: 'system', position: 6 },
    ])
    await mockDb.add('weightConfig', { id: 1, w1: 25, w2: 20, w3: 20, w4: 15, w5: 20 })

    setActivePinia(createPinia())
  })

  describe('订单 CRUD', () => {
    it('应该创建订单', async () => {
      const store = useOrderStore()

      const orderData = createTestOrder()
      const order = await store.createOrder(orderData as any)

      expect(order).toBeDefined()
      expect(order.id).toBeDefined()
      expect(order.orderNo).toMatch(/^HT/)
      expect(order.name).toBe('测试订单')
      expect(store.orders.length).toBeGreaterThan(0)
    })

    it('应该获取订单列表', async () => {
      const store = useOrderStore()

      const orderData = createTestOrder({ orderStatus: 'in_progress' as OrderStatus, currentStage: 'st-sketch' })
      await store.createOrder(orderData as any)

      await store.fetchOrders()
      expect(store.orders.length).toBe(1)
      expect(store.orders[0].name).toBe('测试订单')
    })

    it('应该获取单个订单', async () => {
      const store = useOrderStore()

      const orderData = createTestOrder()
      const created = await store.createOrder(orderData as any)

      const fetched = await store.getOrder(created.id)
      expect(fetched).toBeDefined()
      expect(store.selectedOrder!.id).toBe(created.id)
    })

    it('应该更新订单', async () => {
      const store = useOrderStore()

      const orderData = createTestOrder({ name: '原名' })
      const created = await store.createOrder(orderData as any)

      await store.updateOrder(created.id, { name: '更新后名称' })
      expect(store.orders[0].name).toBe('更新后名称')
    })
  })

  describe('订单状态管理', () => {
    it('应该过滤活跃订单（排除已结单/退单）', async () => {
      const store = useOrderStore()

      await store.createOrder(createTestOrder({ name: '活跃订单' }) as any)
      await store.createOrder(createTestOrder({ name: '已结单', orderStatus: 'completed' as OrderStatus }) as any)
      await store.createOrder(createTestOrder({ name: '已退单', orderStatus: 'voided' as OrderStatus }) as any)

      await store.fetchOrders()
      expect(store.activeOrders.length).toBe(1)
      expect(store.activeOrders[0].name).toBe('活跃订单')
    })

    it('应该返回看板订单（进行中状态）', async () => {
      const store = useOrderStore()

      await store.createOrder(createTestOrder({ orderStatus: 'in_progress' as OrderStatus }) as any)
      await store.createOrder(createTestOrder({ orderStatus: 'completed' as OrderStatus }) as any)
      await store.createOrder(createTestOrder({ orderStatus: 'voided' as OrderStatus }) as any)

      await store.fetchOrders()
      expect(store.kanbanOrders.length).toBe(1)
      expect(store.kanbanOrders[0].orderStatus).toBe('in_progress')
    })

    it('应该按阶段分组订单', async () => {
      const store = useOrderStore()

      await store.createOrder(createTestOrder({ currentStage: 'st-sketch', orderStatus: 'in_progress' as OrderStatus }) as any)
      await store.createOrder(createTestOrder({ currentStage: 'st-color', orderStatus: 'in_progress' as OrderStatus }) as any)
      await store.createOrder(createTestOrder({ currentStage: 'st-sketch', orderStatus: 'in_progress' as OrderStatus }) as any)

      await store.fetchOrders()
      const grouped = store.ordersByStatus
      expect(grouped['st-sketch'].length).toBe(2)
      expect(grouped['st-color'].length).toBe(1)
    })
  })

  describe('阶段流转', () => {
    it('应该流转到线稿阶段', async () => {
      const store = useOrderStore()

      const created = await store.createOrder(createTestOrder({
        currentStage: 'st-pending',
        orderStatus: 'awaiting_deposit' as OrderStatus,
      }) as any)

      await store.transitionStage(created.id, 'st-sketch')

      expect(store.orders[0].currentStage).toBe('st-sketch')
      expect(store.orders[0].orderStatus).toBe('in_progress')

      const transitions = await mockDb.where('stageTransitions', { orderId: created.id }).toArray()
      expect(transitions.length).toBeGreaterThan(0)
      expect(transitions[0].toStageId).toBe('st-sketch')
    })

    it('应该流转到完成阶段', async () => {
      const store = useOrderStore()

      const created = await store.createOrder(createTestOrder({
        currentStage: 'st-sketch',
        orderStatus: 'in_progress' as OrderStatus,
      }) as any)

      await store.transitionStage(created.id, 'st-done')
      expect(store.orders[0].orderStatus).toBe('awaiting_final')
    })

    it('应该流转到退单阶段', async () => {
      const store = useOrderStore()

      const created = await store.createOrder(createTestOrder({
        currentStage: 'st-sketch',
        orderStatus: 'in_progress' as OrderStatus,
      }) as any)

      await store.transitionStage(created.id, 'st-void')
      expect(store.orders[0].orderStatus).toBe('voided')
    })
  })

  describe('收款状态管理', () => {
    it('应该标记为已收定金', async () => {
      const store = useOrderStore()

      const created = await store.createOrder(createTestOrder({
        paymentStatus: 'unpaid' as PaymentStatus,
        depositExpected: 2500,
      }) as any)

      await store.updatePaymentStatus(created.id, 'deposit_paid')

      expect(store.orders[0].paymentStatus).toBe('deposit_paid')
      expect(store.orders[0].depositPaidAt).toBeDefined()
      expect(store.orders[0].orderStatus).toBe('not_started')
    })

    it('应该标记为已收尾款', async () => {
      const store = useOrderStore()

      const created = await store.createOrder(createTestOrder({
        paymentStatus: 'deposit_paid' as PaymentStatus,
        finalExpected: 2500,
      }) as any)

      await store.updatePaymentStatus(created.id, 'final_paid')

      expect(store.orders[0].paymentStatus).toBe('final_paid')
      expect(store.orders[0].finalPaidAt).toBeDefined()
      expect(store.orders[0].orderStatus).toBe('completed')
    })

    it('应该标记为欠款', async () => {
      const store = useOrderStore()

      const created = await store.createOrder(createTestOrder() as any)
      await store.updatePaymentStatus(created.id, 'arrears')
      expect(store.orders[0].paymentStatus).toBe('arrears')
    })

    it('应该标记为免收', async () => {
      const store = useOrderStore()

      const created = await store.createOrder(createTestOrder() as any)
      await store.updatePaymentStatus(created.id, 'waived')
      expect(store.orders[0].paymentStatus).toBe('waived')
    })
  })
})

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { Customer } from '@/types'

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

  where(tableName: string, conditions: Record<string, any> | string) {
    const self = this
    // 字段名模式：where('followUps', 'customerId').equals(value) → 转为对象模式
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

  filter(tableName: string, fn: (item: any) => boolean) {
    const self = this
    return {
      async delete(): Promise<number> {
        const all = await self.getAll(tableName)
        const targets = all.filter(fn)
        for (const t of targets) {
          await self.delete(tableName, t.id)
        }
        return targets.length
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
        add: (item: any) => mockDb.add('paymentRecords', item),
      },
      followUps: {
        clear: () => mockDb.clear('followUps'),
        add: (item: any) => mockDb.add('followUps', item),
        where: (conditions: any) => mockDb.where('followUps', conditions),
      },
      notifications: {
        clear: () => mockDb.clear('notifications'),
        add: (item: any) => mockDb.add('notifications', item),
        filter: (fn: (n: any) => boolean) => mockDb.filter('notifications', fn),
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
  }
})

import { useCustomerStore } from '@/stores/customer'

function createTestCustomerData(overrides: Partial<Customer> = {}): Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'weight' | 'totalSpent' | 'maxOrderAmount' | 'orderCount' | 'completedCount' | 'waivedCount' | 'arrearsCount' | 'latePaymentCount'> {
  return {
    name: '测试客户',
    platform: '测试平台',
    email: 'test@example.com',
    qq: '123456',
    wechat: 'test_wx',
    phone: '13800000000',
    voidedCount: 0,
    ...overrides,
  }
}

describe('客户 Store 测试', () => {
  beforeEach(async () => {
    const tables = ['orders', 'customers', 'stages', 'stageTransitions', 'sources', 'weightConfig', 'followUps', 'notifications']
    for (const table of tables) {
      await mockDb.clear(table)
    }

    setActivePinia(createPinia())
  })

  describe('客户 CRUD', () => {
    it('应该创建客户', async () => {
      const store = useCustomerStore()

      const customerData = createTestCustomerData({ name: '新客户' })
      const customer = await store.createCustomer(customerData as any)

      expect(customer).toBeDefined()
      expect(customer.id).toBeDefined()
      expect(customer.name).toBe('新客户')
      expect(customer.weight).toBe(0)
      expect(store.customers.length).toBe(1)
    })

    it('应该获取客户列表', async () => {
      const store = useCustomerStore()

      await mockDb.add('customers', {
        id: 'cu-test-001',
        name: '测试客户A',
        weight: 50,
        totalSpent: 1000,
        maxOrderAmount: 500,
        orderCount: 3,
        completedCount: 2,
        waivedCount: 0,
        arrearsCount: 1,
        latePaymentCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      await store.fetchCustomers()
      expect(store.customers.length).toBe(1)
      expect(store.customers[0].name).toBe('测试客户A')
    })

    it('应该更新客户', async () => {
      const store = useCustomerStore()

      await mockDb.add('customers', {
        id: 'cu-test-002',
        name: '原名',
        weight: 0,
        totalSpent: 0,
        maxOrderAmount: 0,
        orderCount: 0,
        completedCount: 0,
        waivedCount: 0,
        arrearsCount: 0,
        latePaymentCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      await store.updateCustomer('cu-test-002', { name: '更新后名称' })
      expect(store.customers[0].name).toBe('更新后名称')
    })

    it('应该删除无关联订单的客户', async () => {
      const store = useCustomerStore()

      await mockDb.add('customers', {
        id: 'cu-test-003',
        name: '待删除客户',
        weight: 0,
        totalSpent: 0,
        maxOrderAmount: 0,
        orderCount: 0,
        completedCount: 0,
        waivedCount: 0,
        arrearsCount: 0,
        latePaymentCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      await store.fetchCustomers()
      expect(store.customers.length).toBe(1)

      await store.deleteCustomer('cu-test-003')
      expect(store.customers.length).toBe(0)
    })

    it('不应该删除有关联订单的客户', async () => {
      const store = useCustomerStore()

      await mockDb.add('customers', {
        id: 'cu-test-004',
        name: '有关联订单的客户',
        weight: 0,
        totalSpent: 0,
        maxOrderAmount: 0,
        orderCount: 1,
        completedCount: 0,
        waivedCount: 0,
        arrearsCount: 0,
        latePaymentCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      await mockDb.add('orders', {
        id: 'o-test-001',
        customerId: 'cu-test-004',
        orderNo: 'HT260730001',
        name: '测试订单',
        createdAt: new Date().toISOString(),
      })

      await expect(store.deleteCustomer('cu-test-004')).rejects.toThrow('该客户存在关联订单，无法删除')
    })

    it('删除无关联订单的客户时清理其跟进记录与关联通知（避免孤儿数据）', async () => {
      const store = useCustomerStore()

      await mockDb.add('customers', {
        id: 'cu-test-005',
        name: '带跟进的客户',
        weight: 0,
        totalSpent: 0,
        maxOrderAmount: 0,
        orderCount: 0,
        completedCount: 0,
        waivedCount: 0,
        arrearsCount: 0,
        latePaymentCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      await mockDb.add('followUps', {
        id: 'fu-001',
        customerId: 'cu-test-005',
        title: '确认需求',
        status: 'pending',
        createdAt: new Date().toISOString(),
      })
      await mockDb.add('notifications', {
        id: 'nt-001',
        type: 'followup-due',
        title: '[跟进] 跟进到期',
        content: '「确认需求」今日到期',
        relatedId: 'fu-001',
        relatedType: 'followup',
        isRead: false,
        createdAt: new Date().toISOString(),
      })

      await store.deleteCustomer('cu-test-005')

      expect(store.customers.length).toBe(0)
      const followUps = await mockDb.getAll('followUps')
      expect(followUps).toEqual([])
      const notifications = await mockDb.getAll('notifications')
      expect(notifications).toEqual([])
    })
  })

  describe('客户初始值验证', () => {
    it('新建客户应该有默认统计值', async () => {
      const store = useCustomerStore()

      const customer = await store.createCustomer({ name: '统计测试客户' } as any)

      expect(customer.weight).toBe(0)
      expect(customer.totalSpent).toBe(0)
      expect(customer.maxOrderAmount).toBe(0)
      expect(customer.orderCount).toBe(0)
      expect(customer.completedCount).toBe(0)
      expect(customer.waivedCount).toBe(0)
      expect(customer.arrearsCount).toBe(0)
      expect(customer.latePaymentCount).toBe(0)
    })
  })
})

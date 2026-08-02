import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db } from '@/db'
import { assertCanDeleteCustomer } from '@/domain/customer/customer-rules'
import { nextCustomerId } from '@/domain/customer/customer-id'
import type { Customer } from '@/types'

export const useCustomerStore = defineStore('customer', () => {
  const customers = ref<Customer[]>([])
  const loading = ref(false)
  const selectedCustomer = ref<Customer | null>(null)

  async function fetchCustomers() {
    loading.value = true
    try {
      customers.value = await db.customers.toArray()
    } finally {
      loading.value = false
    }
  }

  async function getCustomer(id: string) {
    const customer = await db.customers.get(id)
    selectedCustomer.value = customer || null
    return customer
  }

  async function createCustomer(data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'weight' | 'totalSpent' | 'maxOrderAmount' | 'orderCount' | 'completedCount' | 'voidedCount' | 'waivedCount' | 'arrearsCount' | 'latePaymentCount'>) {
    const now = new Date().toISOString()
    // 自增 ID：取现有最大数值 ID + 1（"1"、"2"、"3"...）
    const existing = await db.customers.toArray()
    const newCustomer: Customer = {
      ...data,
      id: nextCustomerId(existing.map(c => c.id)),
      weight: 0,
      totalSpent: 0,
      maxOrderAmount: 0,
      orderCount: 0,
      completedCount: 0,
      voidedCount: 0,
      waivedCount: 0,
      arrearsCount: 0,
      latePaymentCount: 0,
      createdAt: now,
      updatedAt: now,
    }
    await db.customers.add(newCustomer)
    await fetchCustomers()
    return newCustomer
  }

  async function updateCustomer(id: string, data: Partial<Customer>) {
    await db.customers.update(id, { ...data, updatedAt: new Date().toISOString() })
    await fetchCustomers()
  }

  async function deleteCustomer(id: string) {
    const orderCount = await db.orders.where({ customerId: id }).count()
    assertCanDeleteCustomer(orderCount)
    // 清理该客户的跟进记录，以及关联这些跟进的到期通知（避免孤儿数据：
    // 客户删除后跟进仍在列表显示「—」，其催办通知也失去关联对象）
    const followUpIds = (await db.followUps.where('customerId').equals(id).toArray()).map(f => f.id)
    await Promise.all([
      db.customers.delete(id),
      db.followUps.where('customerId').equals(id).delete(),
    ])
    if (followUpIds.length > 0) {
      await db.notifications
        .filter(n => n.relatedType === 'followup' && followUpIds.includes(n.relatedId ?? ''))
        .delete()
    }
    await fetchCustomers()
  }

  return { customers, loading, selectedCustomer, fetchCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer }
})

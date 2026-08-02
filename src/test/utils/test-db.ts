import Dexie from 'dexie'
import type { Db, Source, Category, CustomerType, Stage, FollowUpType, WeightConfig } from '@/types'

const DB_NAME_PREFIX = 'hetong-jira-test-'

export function createTestDb(dbName?: string): Db {
  const name = dbName || DB_NAME_PREFIX + Math.random().toString(36).substring(2, 9)
  const testDb = new Dexie(name) as Db

  testDb.version(1).stores({
    orders: '&id, orderNo, customerId, orderStatus, paymentStatus, currentStage, expectedStartDate, expectedEndDate, createdAt',
    orderCategories: '&id, orderId, categoryId',
    customers: '&id, name, typeId, weight, orderCount',
    sources: '&id, name, isEnabled',
    categories: '&id, name, isEnabled',
    customerTypes: '&id, name, isEnabled',
    stages: '&id, name, position',
    paymentRecords: '&id, orderId, type, receivedAt',
    followUps: '&id, orderId, customerId, status, dueDate, priority',
    stageTransitions: '&id, orderId, transitionDate',
    orderAttachments: '&id, orderId, type, uploadedAt',
    notifications: '&id, type, isRead, createdAt',
    weightConfig: '&id',
    followUpTypes: '&id, name',
  })

  return testDb
}

export async function seedTestDatabase(db: Db) {
  const now = new Date().toISOString()

  const sources: Source[] = [
    { id: 's1', name: '米画师', feeType: 'percentage', feeValue: 10, isEnabled: true, createdAt: now, updatedAt: now },
    { id: 's2', name: 'Pixiv', feeType: 'percentage', feeValue: 0, isEnabled: true, createdAt: now, updatedAt: now },
    { id: 's3', name: '微博', feeType: 'fixed', feeValue: 0, isEnabled: true, createdAt: now, updatedAt: now },
  ]

  const categories: Category[] = [
    { id: 'c1', name: '立绘', isEnabled: true },
    { id: 'c2', name: '插画', isEnabled: true },
    { id: 'c3', name: 'Q版', isEnabled: true },
  ]

  const customerTypes: CustomerType[] = [
    { id: 'ct1', name: '新客户', isEnabled: true },
    { id: 'ct2', name: '回头客', isEnabled: true },
    { id: 'ct3', name: 'VIP客户', isEnabled: true },
  ]

  const stages: Stage[] = [
    { id: 'st-pending', name: '待开始', color: '#94a3b8', type: 'system', position: 0 },
    { id: 'st-sketch', name: '线稿', color: '#ef4444', type: 'custom', position: 1 },
    { id: 'st-color', name: '色稿', color: '#3b82f6', type: 'custom', position: 2 },
    { id: 'st-detail', name: '细化', color: '#8b5cf6', type: 'custom', position: 3 },
    { id: 'st-finish', name: '收尾', color: '#f59e0b', type: 'custom', position: 4 },
    { id: 'st-done', name: '完成', color: '#22c55e', type: 'system', position: 5 },
    { id: 'st-void', name: '退单', color: '#64748b', type: 'system', position: 6 },
  ]

  const followUpTypes: FollowUpType[] = [
    { id: 'ft1', name: '客户反馈', isPreset: true },
    { id: 'ft2', name: '修改意见', isPreset: true },
    { id: 'ft3', name: '工作备忘', isPreset: true },
  ]

  const weightConfig: WeightConfig = { id: 1, w1: 25, w2: 20, w3: 20, w4: 15, w5: 20, activePreset: 'balanced' }

  await db.sources.bulkAdd(sources)
  await db.categories.bulkAdd(categories)
  await db.customerTypes.bulkAdd(customerTypes)
  await db.stages.bulkAdd(stages)
  await db.followUpTypes.bulkAdd(followUpTypes)
  await db.weightConfig.add(weightConfig)
}

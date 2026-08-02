import Dexie from 'dexie'
import type { Db, Source, Category, CustomerType, Stage } from '@/types'
import { generateOrderNo as generateOrderNoPure } from '@/domain/order/order-number'
import { calculateWeight as calculateWeightPure } from '@/domain/customer/weight-calculator'
import { computeCustomerStats } from '@/domain/customer/customer-stats'

export const db = new Dexie('hetong-jira') as Db

db.version(1).stores({
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

export async function initializeDb() {
  const defaultSources: Source[] = [
    { id: 's1', name: '米画师', feeType: 'percentage', feeValue: 10, isEnabled: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 's2', name: 'Pixiv', feeType: 'percentage', feeValue: 0, isEnabled: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    // 无手续费的平台统一用「百分比 0%」表示（固定金额规则要求 > 0）
    { id: 's3', name: '微博', feeType: 'percentage', feeValue: 0, isEnabled: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 's4', name: 'QQ', feeType: 'percentage', feeValue: 0, isEnabled: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 's5', name: '朋友介绍', feeType: 'percentage', feeValue: 0, isEnabled: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 's6', name: '其他', feeType: 'percentage', feeValue: 0, isEnabled: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ]

  const defaultCategories: Category[] = [
    { id: 'c1', name: '立绘', isEnabled: true },
    { id: 'c2', name: '插画', isEnabled: true },
    { id: 'c3', name: '表情包', isEnabled: true },
    { id: 'c4', name: 'Q版', isEnabled: true },
    { id: 'c5', name: '背景', isEnabled: true },
    { id: 'c6', name: '漫画页', isEnabled: true },
  ]

  const defaultCustomerTypes: CustomerType[] = [
    { id: 'ct1', name: '新客户', isEnabled: true },
    { id: 'ct2', name: '回头客', isEnabled: true },
    { id: 'ct3', name: 'VIP客户', isEnabled: true },
    { id: 'ct4', name: '合作方', isEnabled: true },
  ]

  const defaultStages: Stage[] = [
    { id: 'st-pending', name: '待开始', color: '#94a3b8', type: 'system', position: 0 },
    { id: 'st-sketch', name: '线稿', color: '#ef4444', type: 'custom', position: 1 },
    { id: 'st-color', name: '色稿', color: '#3b82f6', type: 'custom', position: 2 },
    { id: 'st-detail', name: '细化', color: '#8b5cf6', type: 'custom', position: 3 },
    { id: 'st-finish', name: '收尾', color: '#f59e0b', type: 'custom', position: 4 },
    { id: 'st-done', name: '完成', color: '#22c55e', type: 'system', position: 5 },
    { id: 'st-void', name: '退单', color: '#64748b', type: 'system', position: 6 },
  ]

  const defaultFollowUpTypes = [
    { id: 'ft1', name: '客户反馈', isPreset: true, isEnabled: true },
    { id: 'ft2', name: '修改意见', isPreset: true, isEnabled: true },
    { id: 'ft3', name: '工作备忘', isPreset: true, isEnabled: true },
    { id: 'ft4', name: '催收记录', isPreset: true, isEnabled: true },
    { id: 'ft5', name: '其他', isPreset: true, isEnabled: true },
  ]

  const defaultWeightConfig = {
    id: 1,
    w1: 25,
    w2: 20,
    w3: 20,
    w4: 15,
    w5: 20,
    activePreset: 'balanced' as const,
  }

  const count = await db.sources.count()
  if (count === 0) {
    await db.sources.bulkAdd(defaultSources)
  }

  const catCount = await db.categories.count()
  if (catCount === 0) {
    await db.categories.bulkAdd(defaultCategories)
  }

  const ctCount = await db.customerTypes.count()
  if (ctCount === 0) {
    await db.customerTypes.bulkAdd(defaultCustomerTypes)
  }

  const stCount = await db.stages.count()
  if (stCount === 0) {
    await db.stages.bulkAdd(defaultStages)
  }

  const ftCount = await db.followUpTypes.count()
  if (ftCount === 0) {
    await db.followUpTypes.bulkAdd(defaultFollowUpTypes)
  }

  const wcCount = await db.weightConfig.count()
  if (wcCount === 0) {
    await db.weightConfig.add(defaultWeightConfig)
  }
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

// 委托领域层纯函数；config 可选（store 测试用 vi.importActual 拿到的仍为原函数）。
export function generateOrderNo(config?: import('@/domain/order/order-number').OrderNoConfig): string {
  return generateOrderNoPure(new Date(), config)
}

// 委托领域层纯函数；签名保持不变以兼容 store 测试的 vi.importActual。
export async function calculateWeight(customerId: string): Promise<number> {
  const customer = await db.customers.get(customerId)
  if (!customer) return 0

  const orders = await db.orders
    .where('customerId')
    .equals(customerId)
    .toArray()
  const config = await db.weightConfig.get(1)
  if (!config) return 0

  const allCustomers = await db.customers.toArray()
  const allOrders = await db.orders.toArray()
  return calculateWeightPure(orders, config, allCustomers, allOrders)
}

/**
 * 重算单个客户的全部统计字段（累计消费/最大单/订单数/完成/退单/免单/欠款/逾期 + 权重）。
 * 在订单增删改/状态/收款变更后调用，保证详情页与列表统计实时一致。
 * 累计消费口径：非退单订单的实收金额（actualAmount = 定金+尾款实收）总和——
 * - 退单订单整体不计（收入在退单时即退出统计；退单退款出账不重复扣减）
 * - 红冲/编辑流水已在 recomputeOrderPaymentPatch 中净额化订单 actualAmount，无需额外扣减
 */
export async function refreshCustomerStats(customerId: string): Promise<void> {
  const customer = await db.customers.get(customerId)
  if (!customer) return
  const orders = await db.orders
    .where('customerId')
    .equals(customerId)
    .toArray()
  const stats = computeCustomerStats(orders)
  const weight = await calculateWeight(customerId)
  await db.customers.update(customerId, { ...stats, weight, updatedAt: new Date().toISOString() })
}

/** 全量重算所有客户的统计字段与权重（设置页修改权重公式后调用） */
export async function recalculateAllCustomers(): Promise<void> {
  const customers = await db.customers.toArray()
  await Promise.all(customers.map(c => refreshCustomerStats(c.id)))
}

/**
 * 初始化：清除全部数据（业务数据 + 模板配置），重建空数据库。
 * 调用后必须刷新页面：重启时 bootstrap 会执行 initializeDb()，
 * 重新写入默认模板数据（来源/类别/客户类型/阶段/跟进类型/权重配置）。
 */
export async function resetDatabase(): Promise<void> {
  await db.delete()
}

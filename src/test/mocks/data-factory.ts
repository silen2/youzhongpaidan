import type {
  Order,
  Customer,
  Source,
  Category,
  Stage,
  PaymentRecord,
  FollowUp,
  StageTransition,
  FollowUpType,
  WeightConfig,
} from '@/types'

export function createMockSource(overrides: Partial<Source> = {}): Source {
  return {
    id: 's-mock-' + Math.random().toString(36).substring(2, 9),
    name: '测试来源',
    feeType: 'percentage',
    feeValue: 10,
    isEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

export function createMockCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: 'c-mock-' + Math.random().toString(36).substring(2, 9),
    name: '测试类别',
    isEnabled: true,
    ...overrides,
  }
}

export function createMockStage(overrides: Partial<Stage> = {}): Stage {
  return {
    id: 'st-mock-' + Math.random().toString(36).substring(2, 9),
    name: '测试阶段',
    color: '#3b82f6',
    type: 'custom',
    position: 5,
    ...overrides,
  }
}

export function createMockCustomer(overrides: Partial<Customer> = {}): Customer {
  const id = 'cu-mock-' + Math.random().toString(36).substring(2, 9)
  return {
    id,
    name: '测试客户',
    platform: '测试平台',
    platformLink: 'https://example.com',
    qq: '123456',
    wechat: 'test_wx',
    email: 'test@example.com',
    phone: '13800000000',
    typeId: 'ct1',
    preference: '喜欢可爱风格',
    notes: 'VIP客户',
    weight: 50,
    totalSpent: 10000,
    maxOrderAmount: 5000,
    orderCount: 5,
    completedCount: 3,
    voidedCount: 0,
    waivedCount: 0,
    arrearsCount: 1,
    latePaymentCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

export function createMockOrder(overrides: Partial<Order> = {}): Order {
  const id = 'o-mock-' + Math.random().toString(36).substring(2, 9)
  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(startDate.getDate() - 3)
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() + 7)

  return {
    id,
    orderNo: 'HT260730001',
    name: '测试订单',
    content: '这是一个测试订单内容',
    customerId: 'cu-mock-001',
    sourceId: 's1',
    sourceLink: 'https://example.com/order/1',
    expectedAmount: 5000,
    actualAmount: 5000,
    depositExpected: 2500,
    depositActual: 2500,
    finalExpected: 2500,
    finalActual: 2500,
    depositPaidAt: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
    finalPaidAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
    expectedStartDate: startDate.toISOString(),
    expectedEndDate: endDate.toISOString(),
    actualStartDate: startDate.toISOString(),
    actualEndDate: endDate.toISOString(),
    orderStatus: 'in_progress',
    paymentStatus: 'deposit_paid',
    currentStage: 'st-sketch',
    usage: 'commercial',
    isUrgent: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

export function createMockPaymentRecord(overrides: Partial<PaymentRecord> = {}): PaymentRecord {
  return {
    id: 'pr-mock-' + Math.random().toString(36).substring(2, 9),
    recordNo: 'RC' + Date.now().toString().slice(-9),
    orderId: 'o-mock-001',
    type: 'deposit',
    direction: 'in',
    amount: 2500,
    receivedAt: new Date().toISOString(),
    notes: '测试备注',
    ...overrides,
  }
}

export function createMockFollowUp(overrides: Partial<FollowUp> = {}): FollowUp {
  return {
    id: 'fu-mock-' + Math.random().toString(36).substring(2, 9),
    orderId: 'o-mock-001',
    customerId: 'cu-mock-001',
    title: '测试跟进记录',
    type: '客户反馈',
    priority: 'medium',
    dueDate: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
    status: 'pending',
    content: '这是测试内容',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

export function createMockStageTransition(overrides: Partial<StageTransition> = {}): StageTransition {
  return {
    id: 'stt-mock-' + Math.random().toString(36).substring(2, 9),
    orderId: 'o-mock-001',
    fromStageId: 'st-pending',
    fromStageName: '待开始',
    fromStageColor: '#94a3b8',
    toStageId: 'st-sketch',
    toStageName: '线稿',
    toStageColor: '#ef4444',
    transitionDate: new Date().toISOString(),
    ...overrides,
  }
}

export function createMockFollowUpType(overrides: Partial<FollowUpType> = {}): FollowUpType {
  return {
    id: 'ft-mock-' + Math.random().toString(36).substring(2, 9),
    name: '测试类型',
    isPreset: false,
    ...overrides,
  }
}

export function createMockWeightConfig(overrides: Partial<WeightConfig> = {}): WeightConfig {
  return {
    id: 1,
    w1: 25,
    w2: 20,
    w3: 20,
    w4: 15,
    w5: 20,
    activePreset: 'balanced',
    ...overrides,
  }
}

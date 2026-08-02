import Dexie, { type Table } from 'dexie'

export interface Order {
  id: string
  orderNo: string
  name: string
  content: string
  notes?: string
  customerId: string
  sourceId: string
  sourceLink?: string
  expectedAmount: number
  actualAmount: number
  depositExpected: number
  depositActual: number
  finalExpected: number
  finalActual: number
  depositPaidAt?: string
  finalPaidAt?: string
  expectedStartDate: string
  expectedEndDate: string
  actualStartDate?: string
  actualEndDate?: string
  orderStatus: OrderStatus
  paymentStatus: PaymentStatus
  currentStage: string
  usage: 'personal' | 'commercial'
  isUrgent: boolean
  /** 退单后在退单栏被用户手动隐藏（不再显示） */
  voidedHidden?: boolean
  createdAt: string
  updatedAt: string
}

export type OrderStatus =
  | 'unscheduled'
  | 'awaiting_deposit'
  | 'not_started'
  | 'in_progress'
  | 'awaiting_final'
  | 'completed'
  | 'voided'

export type PaymentStatus =
  | 'unpaid'
  | 'deposit_paid'
  | 'final_paid'
  | 'arrears'
  | 'waived'

export interface OrderCategory {
  id: string
  orderId: string
  categoryId: string
}

export interface Customer {
  id: string
  name: string
  platform?: string
  platformLink?: string
  qq?: string
  wechat?: string
  email?: string
  phone?: string
  typeId?: string
  preference?: string
  notes?: string
  weight: number
  totalSpent: number
  maxOrderAmount: number
  orderCount: number
  completedCount: number
  voidedCount: number
  waivedCount: number
  arrearsCount: number
  latePaymentCount: number
  createdAt: string
  updatedAt: string
}

export interface Source {
  id: string
  name: string
  feeType: 'percentage' | 'fixed'
  feeValue: number
  isEnabled: boolean
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface Category {
  id: string
  name: string
  isEnabled: boolean
}

export interface CustomerType {
  id: string
  name: string
  isEnabled: boolean
}

export interface Stage {
  id: string
  name: string
  color: string
  type: 'system' | 'custom'
  position: number
}

export interface PaymentRecord {
  id: string
  /** 收款单号（RC + YYMMDD + 3 位随机，自动生成） */
  recordNo: string
  orderId: string
  /** 收款类型（定金/尾款）；出账（退款/红冲）账单无该语义，可为空 */
  type?: 'deposit' | 'final'
  /** 账单方向：in 入账（收款）/ out 出账（退款/红冲） */
  direction: 'in' | 'out'
  /** 出账关联的原始入账账单 id（退款/红冲时指向被冲销的入账单） */
  refundOf?: string
  amount: number
  receivedAt: string
  notes?: string
}

export interface FollowUp {
  id: string
  orderId?: string
  customerId?: string
  title: string
  /** 跟进类型模板 id（关联设置 → 跟进类型模板；模板改名后实时反映） */
  typeId?: string
  /** 跟进类型名称快照（旧数据兼容与兜底显示；模板缺失/停用时回退） */
  type: string
  priority: 'high' | 'medium' | 'low'
  dueDate?: string
  status: 'pending' | 'completed'
  content?: string
  createdAt: string
}

export interface StageTransition {
  id: string
  orderId: string
  fromStageId?: string
  fromStageName?: string
  fromStageColor?: string
  toStageId: string
  toStageName: string
  toStageColor: string
  transitionDate: string
}

export interface OrderAttachment {
  id: string
  orderId: string
  type: 'reference' | 'draft' | 'final' | 'other'
  filename: string
  fileData: Blob
  thumbnailData?: Blob
  fileSize: number
  uploadedAt: string
}

export interface Notification {
  id: string
  type: string
  title: string
  content: string
  relatedId?: string
  relatedType?: string
  isRead: boolean
  createdAt: string
}

/** 权重预设 id；'custom' 表示用户自定义（非任一预设） */
export type WeightPresetId = 'balanced' | 'money' | 'stable' | 'custom'

export interface WeightConfig {
  id: number
  w1: number
  w2: number
  w3: number
  w4: number
  w5: number
  /** 当前激活的预设方案 id；用户手动调整后变为 'custom' */
  activePreset: WeightPresetId
}

export interface FollowUpType {
  id: string
  name: string
  isPreset: boolean
  /** 启用/停用（与其他模板一致；旧记录缺省视为启用） */
  isEnabled?: boolean
}

export interface Db extends Dexie {
  orders: Table<Order, string>
  orderCategories: Table<OrderCategory, string>
  customers: Table<Customer, string>
  sources: Table<Source, string>
  categories: Table<Category, string>
  customerTypes: Table<CustomerType, string>
  stages: Table<Stage, string>
  paymentRecords: Table<PaymentRecord, string>
  followUps: Table<FollowUp, string>
  stageTransitions: Table<StageTransition, string>
  orderAttachments: Table<OrderAttachment, string>
  notifications: Table<Notification, string>
  weightConfig: Table<WeightConfig, number>
  followUpTypes: Table<FollowUpType, string>
}

import type {
  Order,
  Customer,
  Stage,
  Source,
  Category,
  CustomerType,
  FollowUpType,
  WeightConfig,
  PaymentRecord,
  FollowUp,
  StageTransition,
  Notification,
  OrderAttachment,
} from '@/types'

/**
 * 领域仓储接口（前瞻性定义）
 *
 * ⚠️ 骨架阶段不实现这些接口。Stores 继续直接使用 `src/db/index.ts` 的 `db` 实例。
 * 这些接口仅示意目标架构：未来 Dexie 实现将放在 `src/infrastructure/dexie/`，
 * Stores 通过依赖注入接收 Repository，从而与 IndexedDB 解耦。
 *
 * 待某个模块进入实现期时，再补对应 Dexie 实现并迁移 Store 的 DB 调用。
 */

export interface OrderRepository {
  get(id: string): Promise<Order | undefined>
  save(order: Order): Promise<void>
  findAll(): Promise<Order[]>
  findByCustomer(customerId: string): Promise<Order[]>
  delete(id: string): Promise<void>
}

export interface CustomerRepository {
  get(id: string): Promise<Customer | undefined>
  save(customer: Customer): Promise<void>
  findAll(): Promise<Customer[]>
  delete(id: string): Promise<void>
}

export interface ConfigRepository {
  getWeightConfig(): Promise<WeightConfig | undefined>
  saveWeightConfig(config: WeightConfig): Promise<void>
  getStages(): Promise<Stage[]>
  getSources(): Promise<Source[]>
  getCategories(): Promise<Category[]>
  getCustomerTypes(): Promise<CustomerType[]>
  getFollowUpTypes(): Promise<FollowUpType[]>
}

export interface PaymentRecordRepository {
  get(id: string): Promise<PaymentRecord | undefined>
  save(record: PaymentRecord): Promise<void>
  findByOrder(orderId: string): Promise<PaymentRecord[]>
}

export interface FollowUpRepository {
  get(id: string): Promise<FollowUp | undefined>
  save(followUp: FollowUp): Promise<void>
  findAll(): Promise<FollowUp[]>
  findByOrder(orderId: string): Promise<FollowUp[]>
  findByCustomer(customerId: string): Promise<FollowUp[]>
}

export interface StageTransitionRepository {
  save(transition: StageTransition): Promise<void>
  findByOrder(orderId: string): Promise<StageTransition[]>
}

export interface NotificationRepository {
  get(id: string): Promise<Notification | undefined>
  save(notification: Notification): Promise<void>
  findAll(): Promise<Notification[]>
  findUnread(): Promise<Notification[]>
  markRead(id: string): Promise<void>
}

export interface OrderAttachmentRepository {
  get(id: string): Promise<OrderAttachment | undefined>
  save(attachment: OrderAttachment): Promise<void>
  findByOrder(orderId: string): Promise<OrderAttachment[]>
  delete(id: string): Promise<void>
}

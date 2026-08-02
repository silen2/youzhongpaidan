/**
 * 领域层入口（barrel）
 *
 * 领域层为纯 TypeScript，不依赖 Dexie/IndexedDB/Vue，可独立单测。
 * Store 层作为应用服务编排：调用领域函数 → 直接写 DB。
 *
 * Repository 接口为前瞻性定义，骨架期不实现，详见 ./repositories.ts。
 */
export * from './errors'
export * from './order/order-number'
export * from './order/order-status'
export * from './order/payment-status'
export * from './order/fee-calculator'
export * from './order/order-sort'
export * from './customer/weight-calculator'
export * from './customer/customer-rules'
export * from './customer/customer-sort'
export * from './config/weight-config'
export * from './repositories'
export * from './shared/pagination'

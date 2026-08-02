import { DomainError } from '../errors'

/**
 * 客户删除前置校验（纯函数）
 *
 * 业务规则：存在关联订单的客户不可删除，必须先处理其订单。
 * 行为契约与原 src/stores/customer.ts deleteCustomer 内联逻辑一致，
 * 错误消息字面量 '该客户存在关联订单，无法删除' 严格保持不变
 * （customer-store 测试用 .rejects.toThrow 断言该消息）。
 *
 * @param orderCount 该客户名下的订单数量（调用方查 DB 得到）
 */
export function assertCanDeleteCustomer(orderCount: number): void {
  if (orderCount > 0) {
    throw new DomainError('该客户存在关联订单，无法删除', 'CUSTOMER_HAS_ORDERS')
  }
}

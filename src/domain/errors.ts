/**
 * 领域异常基类
 *
 * 领域层通过抛出 DomainError 表达业务规则违反，而非返回 Result<T>。
 * 保留 throw 语义以与既有 store 测试（.rejects.toThrow）兼容。
 *
 * code 字段用于程序化区分错误类型，message 用于展示。
 */
export class DomainError extends Error {
  public readonly code: string
  constructor(message: string, code: string) {
    super(message)
    this.name = 'DomainError'
    this.code = code
    // 恢复原型链（TS 编译目标可能丢失 ES5 继承）
    Object.setPrototypeOf(this, DomainError.prototype)
  }
}

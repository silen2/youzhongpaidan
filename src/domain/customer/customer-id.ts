/**
 * 客户自增 ID 规则。
 *
 * 客户 ID 采用简单自增整数（"1"、"2"、"3"...），
 * 取现有客户中最大的数值型 ID + 1；历史遗留的非数值 ID（如 "cus_xxx"）忽略不计。
 * ID 以字符串保存（兼容 Dexie 主键与现有类型），展示时即为纯数字。
 */
export function nextCustomerId(existingIds: string[]): string {
  const max = existingIds.reduce((acc, id) => {
    const n = Number(id)
    return Number.isInteger(n) && n > acc ? n : acc
  }, 0)
  return String(max + 1)
}

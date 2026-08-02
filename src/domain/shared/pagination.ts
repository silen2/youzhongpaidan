/**
 * 分页计算纯函数（跨子域通用）。
 *
 * 零副作用、不依赖 Vue/Dexie/IndexedDB，可独立单测。
 * 所有函数对越界输入做防御式 clamp，不抛错——分页是视图计算逻辑，
 * 不存在"业务规则违反"，与 validateWeightConfig 的"违反规则才抛错"语义不同。
 */

/** 页码窗口元素：具体页码或省略号占位 */
export type PageWindowItem = number | 'ellipsis'

/** 当前页的切片范围，slice 为 [start, end) 半开区间，可直接 arr.slice(slice[0], slice[1]) */
export interface PageItems {
  start: number
  end: number
  slice: [number, number]
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function range(start: number, end: number): number[] {
  const length = end - start + 1
  return Array.from({ length }, (_, i) => start + i)
}

/**
 * 计算总页数。
 * - total<=0 或 pageSize<=0 → 0（无数据，组件层不渲染分页器）
 * - 否则 ceil(total / pageSize)，total>0 时至少为 1（让"空列表第 1 页"语义成立）
 */
export function computeTotalPages(total: number, pageSize: number): number {
  if (total <= 0 || pageSize <= 0) return 0
  return Math.max(1, Math.ceil(total / pageSize))
}

/**
 * 计算当前页的切片范围。纯函数。
 *
 * currentPage 越界时先 clamp 到 [1, totalPages] 再计算。
 * total=0 / pageSize=0 → { start:0, end:0, slice:[0,0] }。
 *
 * @returns { start, end, slice } —— slice 为 [start, end) 半开区间
 */
export function computePageItems(
  total: number,
  pageSize: number,
  currentPage: number,
): PageItems {
  if (total <= 0 || pageSize <= 0) {
    return { start: 0, end: 0, slice: [0, 0] }
  }
  const totalPages = computeTotalPages(total, pageSize)
  const page = clamp(currentPage, 1, totalPages)
  const start = (page - 1) * pageSize
  const end = Math.min(start + pageSize, total)
  return { start, end, slice: [start, end] }
}

/**
 * 计算页码按钮窗口（含省略号）。纯函数。
 *
 * 采用主流分页器算法（MUI 风格）：始终显示首页与末页，当前页左右各 siblingCount 个；
 * 当靠近边界时借用对侧空间，保证页码数量稳定；两侧隐藏页数 > 1 时才显示省略号。
 *
 * 示例（siblingCount=1, totalPages=10）：
 *   currentPage=1  → [1, 2, 3, 'ellipsis', 10]
 *   currentPage=5  → [1, 'ellipsis', 4, 5, 6, 'ellipsis', 10]
 *   currentPage=10 → [1, 'ellipsis', 8, 9, 10]
 *
 * totalPages<=0 → []；totalPages===1 → [1]；totalPages 较少时直接全列（不显示省略号）。
 * currentPage 越界时先 clamp。
 */
export function computePageWindow(
  currentPage: number,
  totalPages: number,
  siblingCount = 1,
): PageWindowItem[] {
  if (totalPages <= 0) return []
  if (totalPages === 1) return [1]

  const page = clamp(currentPage, 1, totalPages)

  // totalNumbers = 首页 + 末页 + 当前页 + 左右各 siblingCount
  // totalBlocks  = totalNumbers + 2 个省略号位
  const totalNumbers = siblingCount * 2 + 3
  const totalBlocks = totalNumbers + 2

  // 页数少时全列，无需省略号
  if (totalPages <= totalBlocks) {
    return range(1, totalPages)
  }

  const leftSiblingIndex = Math.max(page - siblingCount, 1)
  const rightSiblingIndex = Math.min(page + siblingCount, totalPages)

  // 两侧隐藏的页数 > 1 才显示省略号（否则直接列出更紧凑）
  const showLeftEllipsis = leftSiblingIndex > 2
  const showRightEllipsis = rightSiblingIndex < totalPages - 1

  if (!showLeftEllipsis && showRightEllipsis) {
    // 靠近首页：左侧不省略，右侧省略
    const leftItemCount = 1 + 2 * siblingCount
    const leftRange = range(1, leftItemCount)
    return [...leftRange, 'ellipsis', totalPages]
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    // 靠近末页：左侧省略，右侧不省略
    const rightItemCount = 1 + 2 * siblingCount
    const rightRange = range(totalPages - rightItemCount + 1, totalPages)
    return [1, 'ellipsis', ...rightRange]
  }

  // 中间：两侧都省略
  const middleRange = range(leftSiblingIndex, rightSiblingIndex)
  return [1, 'ellipsis', ...middleRange, 'ellipsis', totalPages]
}

/**
 * 将跳页输入框的任意字符串规范化为合法页码。纯函数。
 *
 * 用于"跳至 X 页"输入框 blur/enter 时的校验落地。
 * - 空串 / 非数字 → 返回 fallback（当前页）
 * - <1 → 1；>totalPages → totalPages
 * - totalPages=0 → 1（占位，组件层会隐藏分页器）
 * - 小数被 parseInt 截断（"3.7"→3）
 */
export function clampPageInput(raw: string, totalPages: number, fallback: number): number {
  if (totalPages <= 0) return 1
  const n = parseInt(raw, 10)
  if (Number.isNaN(n)) return clamp(fallback, 1, totalPages)
  return clamp(n, 1, totalPages)
}

import { describe, it, expect } from 'vitest'
import {
  computeTotalPages,
  computePageItems,
  computePageWindow,
  clampPageInput,
} from '@/domain/shared/pagination'

describe('computeTotalPages', () => {
  it('常规整除', () => {
    expect(computeTotalPages(20, 10)).toBe(2)
  })
  it('常规不整除', () => {
    expect(computeTotalPages(25, 10)).toBe(3)
  })
  it('total=0 返回 0', () => {
    expect(computeTotalPages(0, 10)).toBe(0)
  })
  it('pageSize=0 返回 0 不抛错', () => {
    expect(computeTotalPages(10, 0)).toBe(0)
  })
  it('total 为负数返回 0', () => {
    expect(computeTotalPages(-5, 10)).toBe(0)
  })
  it('pageSize 为负数返回 0', () => {
    expect(computeTotalPages(10, -1)).toBe(0)
  })
  it('单条数据至少 1 页', () => {
    expect(computeTotalPages(1, 10)).toBe(1)
  })
  it('刚好多 1 条进位', () => {
    expect(computeTotalPages(11, 10)).toBe(2)
  })
})

describe('computePageItems', () => {
  it('total=0 返回空切片', () => {
    expect(computePageItems(0, 10, 1)).toEqual({ start: 0, end: 0, slice: [0, 0] })
  })
  it('pageSize=0 返回空切片', () => {
    expect(computePageItems(10, 0, 1)).toEqual({ start: 0, end: 0, slice: [0, 0] })
  })
  it('第 1 页满页切片', () => {
    expect(computePageItems(25, 10, 1)).toEqual({ start: 0, end: 10, slice: [0, 10] })
  })
  it('末页部分切片', () => {
    expect(computePageItems(25, 10, 3)).toEqual({ start: 20, end: 25, slice: [20, 25] })
  })
  it('currentPage=0 越界 clamp 到 1', () => {
    expect(computePageItems(25, 10, 0)).toEqual({ start: 0, end: 10, slice: [0, 10] })
  })
  it('currentPage 负数 clamp 到 1', () => {
    expect(computePageItems(25, 10, -3)).toEqual({ start: 0, end: 10, slice: [0, 10] })
  })
  it('currentPage 超大 clamp 到末页', () => {
    expect(computePageItems(25, 10, 999)).toEqual({ start: 20, end: 25, slice: [20, 25] })
  })
  it('slice 可直接用于 arr.slice', () => {
    const arr = Array.from({ length: 25 }, (_, i) => i)
    const { slice } = computePageItems(25, 10, 2)
    expect(arr.slice(slice[0], slice[1])).toEqual(arr.slice(10, 20))
  })
})

describe('computePageWindow', () => {
  it('totalPages=0 返回空数组', () => {
    expect(computePageWindow(1, 0)).toEqual([])
  })
  it('totalPages=1 返回 [1]', () => {
    expect(computePageWindow(1, 1)).toEqual([1])
  })
  it('totalPages=2 不显示省略号', () => {
    expect(computePageWindow(1, 2)).toEqual([1, 2])
    expect(computePageWindow(2, 2)).toEqual([1, 2])
  })
  it('totalPages=5 全列不省略', () => {
    expect(computePageWindow(3, 5, 1)).toEqual([1, 2, 3, 4, 5])
  })
  it('首页附近右侧省略', () => {
    expect(computePageWindow(1, 10)).toEqual([1, 2, 3, 'ellipsis', 10])
    expect(computePageWindow(2, 10)).toEqual([1, 2, 3, 'ellipsis', 10])
  })
  it('page=3 仍在首页区', () => {
    expect(computePageWindow(3, 10)).toEqual([1, 2, 3, 'ellipsis', 10])
  })
  it('中间双侧省略', () => {
    expect(computePageWindow(5, 10)).toEqual([1, 'ellipsis', 4, 5, 6, 'ellipsis', 10])
  })
  it('page=7 中间接近末页', () => {
    expect(computePageWindow(7, 10)).toEqual([1, 'ellipsis', 6, 7, 8, 'ellipsis', 10])
  })
  it('page=8 进入末页区', () => {
    expect(computePageWindow(8, 10)).toEqual([1, 'ellipsis', 8, 9, 10])
  })
  it('末页', () => {
    expect(computePageWindow(10, 10)).toEqual([1, 'ellipsis', 8, 9, 10])
  })
  it('currentPage 越界 clamp 到末页', () => {
    expect(computePageWindow(999, 10)).toEqual([1, 'ellipsis', 8, 9, 10])
  })
  it('currentPage 越界 clamp 到首页', () => {
    expect(computePageWindow(0, 10)).toEqual([1, 2, 3, 'ellipsis', 10])
  })
  it('siblingCount=2 中间区间更大', () => {
    expect(computePageWindow(5, 10, 2)).toEqual([1, 'ellipsis', 3, 4, 5, 6, 7, 'ellipsis', 10])
  })
  it('siblingCount=2 首页附近', () => {
    expect(computePageWindow(1, 10, 2)).toEqual([1, 2, 3, 4, 5, 'ellipsis', 10])
  })
  it('返回数组中数字页码唯一无重复', () => {
    for (let p = 1; p <= 10; p++) {
      const result = computePageWindow(p, 10, 1)
      const nums = result.filter((x): x is number => typeof x === 'number')
      expect(new Set(nums).size).toBe(nums.length)
    }
  })
})

describe('clampPageInput', () => {
  it('合法数字', () => {
    expect(clampPageInput('5', 10, 1)).toBe(5)
  })
  it('空串回退 fallback', () => {
    expect(clampPageInput('', 10, 3)).toBe(3)
  })
  it('非数字回退 fallback', () => {
    expect(clampPageInput('abc', 10, 3)).toBe(3)
  })
  it('0 clamp 到 1', () => {
    expect(clampPageInput('0', 10, 3)).toBe(1)
  })
  it('负数 clamp 到 1', () => {
    expect(clampPageInput('-3', 10, 3)).toBe(1)
  })
  it('超大数 clamp 到 totalPages', () => {
    expect(clampPageInput('999', 10, 3)).toBe(10)
  })
  it('含前导空格 parseInt 容忍', () => {
    expect(clampPageInput('  3  ', 10, 1)).toBe(3)
  })
  it('totalPages=0 返回 1', () => {
    expect(clampPageInput('5', 0, 1)).toBe(1)
  })
  it('小数截断', () => {
    expect(clampPageInput('3.7', 10, 1)).toBe(3)
  })
  it('fallback 越界时也被 clamp', () => {
    expect(clampPageInput('', 10, 999)).toBe(10)
  })
})

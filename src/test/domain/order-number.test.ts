import { describe, it, expect } from 'vitest'
import { generateOrderNo } from '@/domain/order/order-number'

describe('generateOrderNo', () => {
  it('注入固定日期生成正确前缀 HT + YYMMDD', () => {
    // 2026-07-31
    const no = generateOrderNo(new Date(2026, 6, 31, 10, 0, 0))
    expect(no).toMatch(/^HT260731\d{3}$/)
  })

  it('整体格式匹配 HT + 6位日期 + 3位序号', () => {
    const no = generateOrderNo(new Date(2026, 0, 1))
    expect(no).toMatch(/^HT\d{6}\d{3}$/)
  })

  it('同年同日两次调用产生不同序号（随机性）', () => {
    const now = new Date(2026, 6, 31)
    const no1 = generateOrderNo(now)
    const no2 = generateOrderNo(now)
    expect(no1).not.toBe(no2)
    expect(no1.slice(0, 8)).toBe(no2.slice(0, 8)) // 日期前缀相同
  })

  it('跨年正确（2030-01-01 → HT300101xxx）', () => {
    const no = generateOrderNo(new Date(2030, 0, 1))
    expect(no).toMatch(/^HT300101\d{3}$/)
  })

  it('序号始终为 3 位数字', () => {
    for (let i = 0; i < 20; i++) {
      const no = generateOrderNo(new Date(2026, 6, 31))
      const seq = no.slice(8)
      expect(seq).toMatch(/^\d{3}$/)
    }
  })

  it('不传 now 时使用当前时间（不抛错）', () => {
    const no = generateOrderNo()
    expect(no).toMatch(/^HT\d{9}$/)
  })

  it('定制前缀：AB → AB + 日期 + 序号', () => {
    const no = generateOrderNo(new Date(2026, 6, 31), { prefix: 'AB' })
    expect(no).toMatch(/^AB260731\d{3}$/)
  })

  it('定制日期样式 yyyyMMdd：HT20260731xxx', () => {
    const no = generateOrderNo(new Date(2026, 6, 31), { dateStyle: 'yyyyMMdd' })
    expect(no).toMatch(/^HT20260731\d{3}$/)
  })

  it('定制序列位数：seqDigits 4 → 4 位序号', () => {
    for (let i = 0; i < 20; i++) {
      const no = generateOrderNo(new Date(2026, 6, 31), { seqDigits: 4 })
      expect(no).toMatch(/^HT260731\d{4}$/)
    }
  })

  it('组合定制：前缀 + 日期样式 + 序列位数同时生效', () => {
    const no = generateOrderNo(new Date(2026, 6, 31), { prefix: 'IN', dateStyle: 'yyyyMMdd', seqDigits: 5 })
    expect(no).toMatch(/^IN20260731\d{5}$/)
  })
})

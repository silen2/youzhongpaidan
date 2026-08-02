import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { generateId, generateOrderNo } from '@/db'

describe('工具函数测试', () => {
  describe('generateId', () => {
    it('应该生成唯一ID', () => {
      const id1 = generateId()
      const id2 = generateId()
      expect(id1).not.toBe(id2)
    })

    it('应该包含时间戳', () => {
      const id = generateId()
      const parts = id.split('-')
      expect(parts.length).toBe(2)
      expect(Number(parts[0])).toBeGreaterThan(0)
    })

    it('应该包含随机字符', () => {
      const id = generateId()
      const parts = id.split('-')
      expect(parts[1].length).toBeGreaterThanOrEqual(6)
    })
  })

  describe('generateOrderNo', () => {
    beforeEach(() => {
      // Mock Date
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 6, 30, 10, 0, 0)) // 2026-07-30
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('应该以HT开头', () => {
      const orderNo = generateOrderNo()
      expect(orderNo.startsWith('HT')).toBe(true)
    })

    it('应该包含年月', () => {
      const orderNo = generateOrderNo()
      // 2026-07-30 => HT260730xxx
      expect(orderNo).toContain('260730')
    })

    it('应该以三位序号结尾', () => {
      const orderNo = generateOrderNo()
      const suffix = orderNo.slice(-3)
      expect(suffix).toMatch(/^\d{3}$/)
    })

    it('应该生成唯一编号', () => {
      const no1 = generateOrderNo()
      const no2 = generateOrderNo()
      expect(no1).not.toBe(no2)
    })

    it('格式应该是 HT + YYMMDD + 3位序号', () => {
      const orderNo = generateOrderNo()
      expect(orderNo).toMatch(/^HT\d{6}\d{3}$/)
    })
  })
})

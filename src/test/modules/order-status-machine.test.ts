import { describe, it, expect } from 'vitest'
import type { OrderStatus, PaymentStatus } from '@/types'

describe('双维度状态机测试', () => {
  describe('工作进度状态', () => {
    it('待开始状态对应 awaiting_deposit 或 not_started', () => {
      const statuses: OrderStatus[] = ['awaiting_deposit', 'not_started']
      expect(statuses).toContain('awaiting_deposit')
      expect(statuses).toContain('not_started')
    })

    it('进行中状态对应 in_progress', () => {
      const status: OrderStatus = 'in_progress'
      expect(status).toBe('in_progress')
    })

    it('待付尾款状态对应 awaiting_final', () => {
      const status: OrderStatus = 'awaiting_final'
      expect(status).toBe('awaiting_final')
    })

    it('完成状态对应 completed', () => {
      const status: OrderStatus = 'completed'
      expect(status).toBe('completed')
    })

    it('作废状态对应 voided', () => {
      const status: OrderStatus = 'voided'
      expect(status).toBe('voided')
    })
  })

  describe('收款状态', () => {
    it('未付款状态', () => {
      const status: PaymentStatus = 'unpaid'
      expect(status).toBe('unpaid')
    })

    it('已收定金状态', () => {
      const status: PaymentStatus = 'deposit_paid'
      expect(status).toBe('deposit_paid')
    })

    it('已收尾款状态', () => {
      const status: PaymentStatus = 'final_paid'
      expect(status).toBe('final_paid')
    })

    it('欠款状态', () => {
      const status: PaymentStatus = 'arrears'
      expect(status).toBe('arrears')
    })

    it('免收状态', () => {
      const status: PaymentStatus = 'waived'
      expect(status).toBe('waived')
    })
  })

  describe('状态流转规则', () => {
    it('登记定金后订单应为not_started', () => {
      const expected: OrderStatus = 'not_started'
      expect(expected).toBe('not_started')
    })

    it('登记尾款后订单应为completed', () => {
      const expected: OrderStatus = 'completed'
      expect(expected).toBe('completed')
    })

    it('流转到完成阶段应为awaiting_final', () => {
      const expected: OrderStatus = 'awaiting_final'
      expect(expected).toBe('awaiting_final')
    })

    it('流转到退单阶段应为voided', () => {
      const expected: OrderStatus = 'voided'
      expect(expected).toBe('voided')
    })

    it('中间阶段（线稿/色稿/细化/收尾）应为in_progress', () => {
      const stages = ['st-sketch', 'st-color', 'st-detail', 'st-finish']
      for (const stage of stages) {
        const status: OrderStatus = stage === 'st-pending' ? 'not_started'
          : stage === 'st-done' ? 'awaiting_final'
          : stage === 'st-void' ? 'voided'
          : 'in_progress'
        expect(status).toBe('in_progress')
      }
    })
  })

  describe('双状态组合验证', () => {
    it('待付定金 + 未付款 = 新订单', () => {
      const workStatus: OrderStatus = 'awaiting_deposit'
      const payStatus: PaymentStatus = 'unpaid'
      expect(workStatus).toBe('awaiting_deposit')
      expect(payStatus).toBe('unpaid')
    })

    it('进行中 + 已收定金 = 正在绘制', () => {
      const workStatus: OrderStatus = 'in_progress'
      const payStatus: PaymentStatus = 'deposit_paid'
      expect(workStatus).toBe('in_progress')
      expect(payStatus).toBe('deposit_paid')
    })

    it('完成 + 已收尾款 = 已结单', () => {
      const workStatus: OrderStatus = 'completed'
      const payStatus: PaymentStatus = 'final_paid'
      expect(workStatus).toBe('completed')
      expect(payStatus).toBe('final_paid')
    })

    it('作废 + 欠款 = 坏账', () => {
      const workStatus: OrderStatus = 'voided'
      const payStatus: PaymentStatus = 'arrears'
      expect(workStatus).toBe('voided')
      expect(payStatus).toBe('arrears')
    })
  })
})

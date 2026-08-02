import { describe, it, expect } from 'vitest'
import { DEFAULT_PREFERENCES, sanitizePreferences } from '@/domain/config/app-preferences'

describe('sanitizePreferences（偏好设置钳制合并）', () => {
  it('null / undefined 回落默认值', () => {
    expect(sanitizePreferences(null)).toEqual(DEFAULT_PREFERENCES)
    expect(sanitizePreferences(undefined)).toEqual(DEFAULT_PREFERENCES)
  })

  it('空对象补齐全部默认值', () => {
    expect(sanitizePreferences({})).toEqual(DEFAULT_PREFERENCES)
  })

  it('部分字段合并：只传一个字段，其余保持默认', () => {
    const p = sanitizePreferences({ ganttRowHeight: 80 })
    expect(p.ganttRowHeight).toBe(80)
    expect(p.currencySymbol).toBe(DEFAULT_PREFERENCES.currencySymbol)
    expect(p.orderNoSeqDigits).toBe(DEFAULT_PREFERENCES.orderNoSeqDigits)
  })

  it('整数越界钳制回落默认（上限/下限/非数字）', () => {
    expect(sanitizePreferences({ ganttRowHeight: 999 }).ganttRowHeight).toBe(DEFAULT_PREFERENCES.ganttRowHeight)
    expect(sanitizePreferences({ ganttRowHeight: 0 }).ganttRowHeight).toBe(DEFAULT_PREFERENCES.ganttRowHeight)
    expect(sanitizePreferences({ ganttRowHeight: Number.NaN }).ganttRowHeight).toBe(DEFAULT_PREFERENCES.ganttRowHeight)
    expect(sanitizePreferences({ ganttRowHeight: 80.6 }).ganttRowHeight).toBe(81)
  })

  it('货币符号：空串/纯空白回落默认，长度截断', () => {
    expect(sanitizePreferences({ currencySymbol: '' }).currencySymbol).toBe(DEFAULT_PREFERENCES.currencySymbol)
    expect(sanitizePreferences({ currencySymbol: '   ' }).currencySymbol).toBe(DEFAULT_PREFERENCES.currencySymbol)
    expect(sanitizePreferences({ currencySymbol: 'USD$' }).currencySymbol).toBe('USD$')
    expect(sanitizePreferences({ currencySymbol: 'ABCDE' }).currencySymbol.length).toBe(4)
  })

  it('订单编号前缀：空串回落默认，长度截断', () => {
    expect(sanitizePreferences({ orderNoPrefix: '' }).orderNoPrefix).toBe(DEFAULT_PREFERENCES.orderNoPrefix)
    expect(sanitizePreferences({ orderNoPrefix: 'ABCDEFG' }).orderNoPrefix).toBe('ABCDEF')
  })

  it('日期样式非法回落 yyMMdd，序列位数越界回落默认', () => {
    expect(sanitizePreferences({ orderNoDateStyle: 'MMdd' as any }).orderNoDateStyle).toBe('yyMMdd')
    expect(sanitizePreferences({ orderNoDateStyle: 'yyyyMMdd' }).orderNoDateStyle).toBe('yyyyMMdd')
    expect(sanitizePreferences({ orderNoSeqDigits: 9 }).orderNoSeqDigits).toBe(DEFAULT_PREFERENCES.orderNoSeqDigits)
    expect(sanitizePreferences({ orderNoSeqDigits: 4 }).orderNoSeqDigits).toBe(4)
  })

  it('看板阈值与列表分页钳制（0 合法、非法回落默认）', () => {
    expect(sanitizePreferences({ kanbanUrgentDays: 0 }).kanbanUrgentDays).toBe(0)
    expect(sanitizePreferences({ kanbanUrgentDays: 99 }).kanbanUrgentDays).toBe(DEFAULT_PREFERENCES.kanbanUrgentDays)
    expect(sanitizePreferences({ listPageSize: 20 }).listPageSize).toBe(20)
    expect(sanitizePreferences({ listPageSize: 200 }).listPageSize).toBe(DEFAULT_PREFERENCES.listPageSize)
  })

  it('列表默认排序方向非法回落 desc', () => {
    expect(sanitizePreferences({ listDefaultSortDirection: 'up' as any }).listDefaultSortDirection).toBe('desc')
    expect(sanitizePreferences({ listDefaultSortDirection: 'asc' }).listDefaultSortDirection).toBe('asc')
  })

  it('统计金额分布步长：默认 50，非法/越界回落默认', () => {
    expect(DEFAULT_PREFERENCES.statsAmountStep).toBe(50)
    expect(sanitizePreferences({}).statsAmountStep).toBe(50)
    expect(sanitizePreferences({ statsAmountStep: 200 }).statsAmountStep).toBe(200)
    expect(sanitizePreferences({ statsAmountStep: 0 }).statsAmountStep).toBe(50)
    expect(sanitizePreferences({ statsAmountStep: -5 }).statsAmountStep).toBe(50)
    expect(sanitizePreferences({ statsAmountStep: Number.NaN }).statsAmountStep).toBe(50)
  })
})

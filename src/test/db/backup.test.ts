import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { createTestDb, seedTestDatabase } from '@/test/utils/test-db'
import { exportAllData, importAllData, blobToDataUrl } from '@/db'
import { dataUrlToBlob } from '@/domain/attachment/attachment'
import type { Customer, Order } from '@/types'

const now = '2026-08-02T00:00:00.000Z'

function makeCustomer(id: string, name: string): Customer {
  return {
    id,
    name,
    weight: 10,
    totalSpent: 0,
    maxOrderAmount: 0,
    orderCount: 0,
    completedCount: 0,
    voidedCount: 0,
    waivedCount: 0,
    arrearsCount: 0,
    latePaymentCount: 0,
    createdAt: now,
    updatedAt: now,
  }
}

function makeOrder(id: string, customerId: string): Order {
  return {
    id,
    orderNo: 'BK-001',
    name: '备份订单',
    content: '',
    customerId,
    sourceId: '',
    expectedAmount: 500,
    actualAmount: 0,
    depositExpected: 200,
    depositActual: 0,
    finalExpected: 300,
    finalActual: 0,
    expectedStartDate: '2026-08-05',
    expectedEndDate: '2026-08-10',
    orderStatus: 'not_started',
    paymentStatus: 'unpaid',
    currentStage: 'st-pending',
    usage: 'personal',
    isUrgent: false,
    createdAt: now,
    updatedAt: now,
  }
}

describe('备份导出 / 导入', () => {
  it('导出包含全部业务数据与模板配置', async () => {
    const testDb = createTestDb()
    await seedTestDatabase(testDb)
    await testDb.customers.add(makeCustomer('c1', '客户A'))
    await testDb.orders.add(makeOrder('o1', 'c1'))
    await testDb.paymentRecords.add({
      id: 'p1',
      recordNo: 'RC-001',
      orderId: 'o1',
      type: 'deposit',
      direction: 'in',
      amount: 200,
      receivedAt: now,
      notes: '',
    })

    const data = await exportAllData(testDb)

    expect(data.version).toBe(1)
    expect(data.customers).toHaveLength(1)
    expect(data.customers[0].name).toBe('客户A')
    expect(data.orders).toHaveLength(1)
    expect(data.paymentRecords).toHaveLength(1)
    // 模板表也随备份导出
    expect(data.stages.length).toBeGreaterThan(0)
    expect(data.sources.length).toBeGreaterThan(0)
    expect(data.weightConfig).not.toBeNull()
  })

  it('导入恢复业务数据，模板表非空不覆盖', async () => {
    const testDb = createTestDb()
    await seedTestDatabase(testDb)
    await testDb.customers.add(makeCustomer('c1', '客户A'))
    await testDb.orders.add(makeOrder('o1', 'c1'))
    const data = await exportAllData(testDb)

    // 目标库：模板已 seed，业务表为空；改一个模板验证导入后不被覆盖
    const targetDb = createTestDb()
    await seedTestDatabase(targetDb)
    await targetDb.stages.update('st-sketch', { name: '线稿(自定义)' })

    const summary = await importAllData(data, targetDb)

    expect(summary).toEqual({ orders: 1, customers: 1, paymentRecords: 0, attachments: 0 })
    expect(await targetDb.customers.count()).toBe(1)
    expect((await targetDb.customers.get('c1'))?.name).toBe('客户A')
    expect(await targetDb.orders.count()).toBe(1)
    expect((await targetDb.orders.get('o1'))?.name).toBe('备份订单')
    // 模板表非空不覆盖
    expect((await targetDb.stages.get('st-sketch'))?.name).toBe('线稿(自定义)')
  })

  it('导入到空库时用备份恢复模板配置', async () => {
    const testDb = createTestDb()
    await seedTestDatabase(testDb)
    await testDb.customers.add(makeCustomer('c1', '客户A'))
    const data = await exportAllData(testDb)

    const emptyDb = createTestDb()
    const summary = await importAllData(data, emptyDb)

    expect(summary.customers).toBe(1)
    expect(await emptyDb.customers.count()).toBe(1)
    // 空库模板被恢复
    expect(await emptyDb.stages.count()).toBe(data.stages.length)
    expect(await emptyDb.sources.count()).toBe(data.sources.length)
  })

  it('附件 Blob 与 dataURL 可无损往返（含 mime）', async () => {
    const original = new Blob([new Uint8Array([9, 8, 7, 6, 5])], { type: 'image/png' })
    const dataUrl = await blobToDataUrl(original)

    expect(dataUrl).toMatch(/^data:image\/png;base64,/)

    const restored = dataUrlToBlob(dataUrl)
    expect(restored).toBeInstanceOf(Blob)
    expect(restored.type).toBe('image/png')
    expect(restored.size).toBe(5)
    // 内容逐字节一致
    const origBuf = new Uint8Array(await original.arrayBuffer())
    const restoredBuf = new Uint8Array(await restored.arrayBuffer())
    expect(restoredBuf).toEqual(origBuf)
  })
})

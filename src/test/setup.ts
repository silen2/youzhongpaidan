import fakeIndexedDB from 'fake-indexeddb'
import { beforeEach } from 'vitest'

// 为 Dexie 提供 fake indexedDB
globalThis.indexedDB = fakeIndexedDB

// 在每个测试前清理
beforeEach(async () => {
  // 清理所有测试数据
  if (typeof indexedDB !== 'undefined') {
    const dbs = await indexedDB.databases()
    for (const db of dbs) {
      if (db.name) {
        indexedDB.deleteDatabase(db.name)
      }
    }
  }
})

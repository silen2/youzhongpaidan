import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db, generateId } from '@/db'
import {
  buildAllNotifications,
  notificationDedupKey,
  localDateStr,
  type NotificationCandidate,
} from '@/domain/notification/notifications'
import type { Notification } from '@/types'

/** 通知设置（持久化；与设置页「通知设置」卡片一致） */
export interface NotificationSettings {
  /** 定金/尾款逾期多少天发送催收通知 */
  overdueDays: number
  /** 距预计交付 ≤ 多少天发送到期提醒 */
  dueDays: number
  /** 每日汇总开关（打开应用时若已到推送时间且今天未发过，生成日报） */
  dailySummaryEnabled: boolean
  /** 每日汇总推送时间 */
  summaryTime: string
}

const SETTINGS_KEY = 'hetong-notification-settings'

const DEFAULT_SETTINGS: NotificationSettings = {
  overdueDays: 3,
  dueDays: 2,
  dailySummaryEnabled: true,
  summaryTime: '09:00',
}

export function loadNotificationSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    // ignore
  }
  return { ...DEFAULT_SETTINGS }
}

export function saveNotificationSettings(s: NotificationSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {
    // ignore quota errors
  }
}

export const useNotificationStore = defineStore('notification', () => {
  const notifications = ref<Notification[]>([])
  const settings = ref<NotificationSettings>(loadNotificationSettings())

  const unreadCount = computed(() => notifications.value.filter(n => !n.isRead).length)

  /** 按创建时间倒序（最新在前） */
  async function fetchNotifications() {
    notifications.value = await db.notifications.orderBy('createdAt').reverse().toArray()
  }

  /**
   * 依据当前订单/跟进数据生成候选通知，与已存在的通知去重后写入新记录
   * （历史已读通知保留，避免重复打扰）。
   * 去重规则：催收/到期/跟进按「type + relatedId」永久去重；每日汇总按「本地日期」
   * 每天一条——打开应用时若已到推送时间（isSummaryTime）且今天未发过，则生成日报。
   */
  async function generateNotifications() {
    const [orders, customers, followUps] = await Promise.all([
      db.orders.toArray(),
      db.customers.toArray(),
      db.followUps.toArray(),
    ])
    const today = new Date()
    const candidates = buildAllNotifications(
      orders,
      customers.map(c => ({ id: c.id, name: c.name })),
      followUps.map(f => ({ id: f.id, title: f.title, dueDate: f.dueDate, status: f.status })),
      {
        overdueDays: settings.value.overdueDays,
        dueDays: settings.value.dueDays,
        dailySummaryEnabled: settings.value.dailySummaryEnabled,
        summaryTime: settings.value.summaryTime,
      },
      today,
    )
    const todayStr = localDateStr(today)
    const existing = new Set(notifications.value.map(n =>
      n.type === 'daily-summary'
        ? `daily-summary:${localDateStr(new Date(n.createdAt))}`
        : notificationDedupKey(n),
    ))
    const fresh = candidates.filter(c =>
      !existing.has(
        c.type === 'daily-summary' ? `daily-summary:${todayStr}` : notificationDedupKey(c),
      ),
    )
    if (fresh.length > 0) {
      const now = new Date().toISOString()
      await db.notifications.bulkAdd(fresh.map((c: NotificationCandidate) => ({
        id: generateId(),
        type: c.type,
        title: c.title,
        content: c.content,
        relatedId: c.relatedId,
        relatedType: c.relatedType,
        isRead: false,
        createdAt: now,
      })))
      await fetchNotifications()
    }
  }

  async function markRead(id: string) {
    const target = notifications.value.find(n => n.id === id)
    if (target && !target.isRead) {
      await db.notifications.update(id, { isRead: true })
      await fetchNotifications()
    }
  }

  async function markAllRead() {
    const unreadIds = notifications.value.filter(n => !n.isRead).map(n => n.id)
    if (unreadIds.length === 0) return
    await Promise.all(unreadIds.map(id => db.notifications.update(id, { isRead: true })))
    await fetchNotifications()
  }

  async function removeNotification(id: string) {
    await db.notifications.delete(id)
    await fetchNotifications()
  }

  function updateSettings(s: Partial<NotificationSettings>) {
    settings.value = { ...settings.value, ...s }
    saveNotificationSettings(settings.value)
  }

  return {
    notifications,
    settings,
    unreadCount,
    fetchNotifications,
    generateNotifications,
    markRead,
    markAllRead,
    removeNotification,
    updateSettings,
  }
})

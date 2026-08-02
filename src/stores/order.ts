import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db, generateId, generateOrderNo, refreshCustomerStats } from '@/db'
import { usePreferencesStore } from '@/stores/preferences'
import { stageIdToOrderStatus, KANBAN_STATUSES } from '@/domain/order/order-status'
import { deriveScheduleProgress, buildActualWriteBack } from '@/domain/schedule/schedule-progress'
import { applyPaymentEvent } from '@/domain/order/payment-status'
import { isImageFile, dataUrlToBlob, type AttachmentType } from '@/domain/attachment/attachment'
import { downscaleImage } from '@/utils/image-processing'
import type { Order, OrderStatus, PaymentStatus, StageTransition, OrderCategory, FollowUp, OrderAttachment } from '@/types'
import type { FollowUpPriority } from '@/domain/followup/follow-up'

export const useOrderStore = defineStore('order', () => {
  const orders = ref<Order[]>([])
  const loading = ref(false)
  const selectedOrder = ref<Order | null>(null)
  const stageTransitions = ref<StageTransition[]>([])
  /** 全量阶段流转记录（甘特图实际进度推导用，按时间升序） */
  const allStageTransitions = ref<StageTransition[]>([])
  /** 全量订单-稿件类别关联（列表筛选用） */
  const orderCategories = ref<OrderCategory[]>([])
  /** 当前订单的跟进记录（详情页时间线） */
  const orderFollowUps = ref<FollowUp[]>([])
  /** 全量跟进记录（跟进列表页） */
  const followUps = ref<FollowUp[]>([])
  /** 当前订单的图片附件（详情页附件管理） */
  const orderAttachments = ref<OrderAttachment[]>([])

  /** 活跃订单（进行中的工作流）：排除已结单（completed）与已退单（voided）。
   * 订单列表/看板只展示活跃订单；已完成与退单订单在客户详情的历史订单中查看。 */
  const activeOrders = computed(() =>
    orders.value.filter(o => o.orderStatus !== 'completed' && o.orderStatus !== 'voided')
  )

  const kanbanOrders = computed(() =>
    activeOrders.value.filter(o => KANBAN_STATUSES.has(o.orderStatus))
  )

  const ordersByStatus = computed(() => {
    const map: Record<string, Order[]> = {}
    for (const order of kanbanOrders.value) {
      const status = order.currentStage || 'pending'
      if (!map[status]) map[status] = []
      map[status].push(order)
    }
    return map
  })

  async function fetchOrders() {
    loading.value = true
    try {
      orders.value = await db.orders.toArray()
    } finally {
      loading.value = false
    }
  }

  async function getOrder(id: string) {
    const order = await db.orders.get(id)
    selectedOrder.value = order || null
    return order
  }

  async function fetchStageTransitions(orderId: string) {
    stageTransitions.value = await db.stageTransitions
      .where('orderId').equals(orderId)
      .sortBy('transitionDate')
  }

  /** 拉取全量阶段流转记录（甘特图实际进度推导用） */
  async function fetchAllStageTransitions() {
    allStageTransitions.value = await db.stageTransitions.toArray()
  }

  /** 拉取全部订单-稿件类别关联（列表筛选用） */
  async function fetchOrderCategories() {
    orderCategories.value = await db.orderCategories.toArray()
  }

  /** 按订单拉取稿件类别关联（详情页用） */
  async function getOrderCategories(orderId: string): Promise<OrderCategory[]> {
    return db.orderCategories.where('orderId').equals(orderId).toArray()
  }

  /** 覆盖式保存订单的稿件类别：先清空再批量写入 */
  async function saveOrderCategories(orderId: string, categoryIds: string[]) {
    await db.orderCategories.where('orderId').equals(orderId).delete()
    if (categoryIds.length > 0) {
      await db.orderCategories.bulkAdd(
        categoryIds.map(categoryId => ({ id: generateId(), orderId, categoryId })),
      )
    }
    await fetchOrderCategories()
  }

  /** 拉取订单的跟进记录（详情页时间线，按创建时间升序） */
  async function fetchOrderFollowUps(orderId: string) {
    orderFollowUps.value = await db.followUps
      .where('orderId').equals(orderId)
      .sortBy('createdAt')
  }

  // ===== 跟进记录 CRUD（列表页 + 看板/详情页快捷添加入口共用，数据同源） =====

  /** 拉取全量跟进记录（跟进列表页） */
  async function fetchFollowUps() {
    followUps.value = await db.followUps.toArray()
  }

  interface NewFollowUp {
    orderId?: string
    customerId?: string
    title: string
    type: string
    priority: FollowUpPriority
    dueDate?: string
    content?: string
  }

  async function addFollowUp(data: NewFollowUp) {
    const now = new Date().toISOString()
    const item: FollowUp = {
      id: generateId(),
      status: 'pending',
      createdAt: now,
      ...data,
    }
    await db.followUps.add(item)
    await fetchFollowUps()
    return item
  }

  async function updateFollowUp(id: string, data: Partial<FollowUp>) {
    await db.followUps.update(id, data)
    await fetchFollowUps()
  }

  async function deleteFollowUp(id: string) {
    await db.followUps.delete(id)
    await fetchFollowUps()
  }

  // ===== 附件管理 =====

  /** 拉取订单的图片附件（详情页附件管理，按上传时间升序） */
  async function fetchOrderAttachments(orderId: string) {
    orderAttachments.value = await db.orderAttachments
      .where('orderId').equals(orderId)
      .sortBy('uploadedAt')
  }

  function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'))
      reader.readAsDataURL(file)
    })
  }

  /**
   * 上传一张图片附件：原图 Blob 原样留档（保真），另生成 320px 缩略图用于网格展示。
   * 仅接受图片文件，否则抛错（调用方提示）。
   */
  async function addOrderAttachment(orderId: string, type: AttachmentType, file: File) {
    if (!isImageFile(file)) throw new Error('仅支持上传图片文件')
    const originalDataUrl = await readFileAsDataUrl(file)
    let thumbnailData: Blob | undefined
    try {
      const thumbDataUrl = await downscaleImage(originalDataUrl, 320, 0.8)
      thumbnailData = dataUrlToBlob(thumbDataUrl)
    } catch {
      thumbnailData = undefined
    }
    await db.orderAttachments.add({
      id: generateId(),
      orderId,
      type,
      filename: file.name,
      fileData: file,
      thumbnailData,
      fileSize: file.size,
      uploadedAt: new Date().toISOString(),
    })
    await fetchOrderAttachments(orderId)
  }

  async function deleteOrderAttachment(attachmentId: string, orderId: string) {
    await db.orderAttachments.delete(attachmentId)
    await fetchOrderAttachments(orderId)
  }

  /**
   * 客户画廊：该客户所有「已结单」订单的终稿附件（final 类型）。
   * 需求：终稿在订单结单后自动同步至客户画廊——由查询条件天然保证，
   * 无需物理复制附件，订单状态回到未结单时画廊自动移除。
   */
  async function fetchCustomerGallery(customerId: string): Promise<OrderAttachment[]> {
    const completedOrders = await db.orders
      .where('customerId').equals(customerId)
      .and(o => o.orderStatus === 'completed')
      .toArray()
    const orderIds = completedOrders.map(o => o.id)
    if (orderIds.length === 0) return []
    return db.orderAttachments
      .where('orderId').anyOf(orderIds)
      .and(a => a.type === 'final')
      .sortBy('uploadedAt')
  }

  async function createOrder(data: Omit<Order, 'id' | 'orderNo' | 'createdAt' | 'updatedAt'>) {
    const now = new Date().toISOString()
    // 订单编号遵循偏好设置（前缀 / 日期样式 / 序列位数）
    const p = usePreferencesStore().preferences
    const newOrder: Order = {
      ...data,
      id: generateId(),
      orderNo: generateOrderNo({
        prefix: p.orderNoPrefix,
        dateStyle: p.orderNoDateStyle,
        seqDigits: p.orderNoSeqDigits,
      }),
      createdAt: now,
      updatedAt: now,
    }
    await db.orders.add(newOrder)
    if (newOrder.customerId) await refreshCustomerStats(newOrder.customerId)
    await fetchOrders()
    return newOrder
  }

  async function updateOrder(id: string, data: Partial<Order>) {
    const prev = await db.orders.get(id)
    await db.orders.update(id, { ...data, updatedAt: new Date().toISOString() })
    // 订单可能改关联客户：新旧客户统计都重算
    const affected = new Set<string>()
    if (prev?.customerId) affected.add(prev.customerId)
    if (data.customerId) affected.add(data.customerId)
    await Promise.all([...affected].map(cid => refreshCustomerStats(cid)))
    await fetchOrders()
  }

  async function transitionStage(orderId: string, targetStageId: string) {
    const order = await db.orders.get(orderId)
    if (!order) return

    // 单向流转守卫（与看板/列表交互一致，收口到 store 统一约束）：
    // - 退单不可返回流程
    // - 目标列相同不流转（视图层已拦截，这里再兜底）
    // - 开工后（离开待开始）不可返回待开始
    // - 完成栏是最后一个流程：不能进入下一流程（仅允许显式退单 st-void；看板拖拽 st-done→st-void 由视图层防误触拦截）
    if (order.orderStatus === 'voided') return
    if (order.currentStage === targetStageId) return
    if (targetStageId === 'st-pending' && order.currentStage !== 'st-pending') return
    if (order.currentStage === 'st-done' && targetStageId !== 'st-void') return

    const stages = await db.stages.toArray()
    const targetStage = stages.find(s => s.id === targetStageId)
    if (!targetStage) return

    const now = new Date().toISOString()
    const newStatus: OrderStatus = stageIdToOrderStatus(targetStageId)

    // 先写流转记录，再基于全量记录推导实际开工/完工并回写（进完成栏时）
    await db.stageTransitions.add({
      id: generateId(),
      orderId,
      fromStageId: order.currentStage,
      toStageId: targetStageId,
      toStageName: targetStage.name,
      toStageColor: targetStage.color,
      transitionDate: now,
    })

    const transitions = (await db.stageTransitions
      .where('orderId').equals(orderId)
      .toArray())
      .sort((a, b) => a.transitionDate.localeCompare(b.transitionDate))
    const progress = deriveScheduleProgress(transitions)
    const writeBack = buildActualWriteBack(order, progress)

    await db.orders.update(orderId, {
      currentStage: targetStageId,
      orderStatus: newStatus,
      ...(writeBack ?? {}),
      updatedAt: now,
    })

    if (order.customerId) {
      await refreshCustomerStats(order.customerId)
    }

    await fetchOrders()
    // 甘特图实际进度依赖全量流转记录，流转后同步刷新（切页挂载也会拉取，这里兜底同页停留场景）
    await fetchAllStageTransitions()
  }

  async function updatePaymentStatus(orderId: string, status: PaymentStatus, paidAmount?: number) {
    const order = await db.orders.get(orderId)
    if (!order) return

    const now = new Date()
    const result = applyPaymentEvent(order, status, paidAmount, now)
    await db.orders.update(orderId, { ...result, updatedAt: now.toISOString() })
    if (order.customerId) await refreshCustomerStats(order.customerId)
    await fetchOrders()
  }

  return {
    orders,
    loading,
    selectedOrder,
    stageTransitions,
    allStageTransitions,
    orderCategories,
    orderFollowUps,
    followUps,
    orderAttachments,
    activeOrders,
    kanbanOrders,
    ordersByStatus,
    fetchOrders,
    getOrder,
    fetchStageTransitions,
    fetchAllStageTransitions,
    fetchOrderCategories,
    getOrderCategories,
    saveOrderCategories,
    fetchOrderFollowUps,
    fetchFollowUps,
    addFollowUp,
    updateFollowUp,
    deleteFollowUp,
    fetchOrderAttachments,
    addOrderAttachment,
    deleteOrderAttachment,
    fetchCustomerGallery,
    createOrder,
    updateOrder,
    transitionStage,
    updatePaymentStatus,
  }
})

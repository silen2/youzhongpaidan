<template>
  <div class="fluid-container dashboard-root">
    <PageHeader title="工作台" subtitle="看板视图：拖拽卡片流转绘制阶段" :icon="LayoutDashboardIcon">
      <template #actions>
        <button class="glass-btn glass-btn-primary" @click="openCreate">+ 新建订单</button>
      </template>
    </PageHeader>

    <!-- 顶部工具栏：全局筛选（只看紧急 / 今日待交），退单栏不受筛选影响 -->
    <div class="kanban-toolbar">
      <div class="kanban-filter-chips">
        <button
          type="button"
          class="kanban-filter-chip"
          :class="{ 'is-active': boardFilter === 'all' }"
          @click="boardFilter = 'all'"
        >全部</button>
        <button
          type="button"
          class="kanban-filter-chip"
          :class="{ 'is-active': boardFilter === 'urgent' }"
          @click="boardFilter = 'urgent'"
        >
          <Flame class="w-3 h-3" />
          只看紧急
        </button>
        <button
          type="button"
          class="kanban-filter-chip"
          :class="{ 'is-active': boardFilter === 'due-today' }"
          @click="boardFilter = 'due-today'"
        >
          <CalendarClock class="w-3 h-3" />
          今日待交
        </button>
      </div>
      <span v-if="boardFilter !== 'all'" class="kanban-filter-hint">
        筛选后 {{ filteredBoardCount }} 单
      </span>
    </div>

    <!-- 看板列：每个绘制阶段一列，卡片拖拽流转 -->
    <div class="kanban-board">
      <div
        v-for="col in columns"
        :key="col.stage.id"
        class="kanban-column"
        :class="{ 'is-drag-over': dragOverStageId === col.stage.id }"
        :data-stage-id="col.stage.id"
      >
        <div class="kanban-column-head" :style="{ '--stage-color': col.stage.color }">
          <span class="kanban-stage-dot" :style="{ background: col.stage.color }"></span>
          <span class="kanban-column-title">{{ col.stage.name }}</span>
          <span class="kanban-column-count">{{ col.orders.length }}</span>
        </div>

        <div class="kanban-column-body">
          <div
            v-for="order in col.orders"
            :key="order.id"
            class="kanban-card"
            :class="{ 'is-dragging': draggingOrderId === order.id, 'is-voided': order.orderStatus === 'voided' }"
            :title="order.orderNo"
            @pointerdown="onCardPointerDown($event, order)"
            @pointermove="onCardPointerMove"
            @pointerup="onCardPointerUp"
            @pointercancel="onCardPointerCancel"
            @dblclick="goDetail(order.id)"
          >
            <div class="kanban-card-title">
              <span class="kanban-card-customer-pill" :title="customerName(order.customerId)">{{ customerName(order.customerId) }}</span>
              <span class="kanban-card-name" :title="order.name">{{ order.name }}</span>
              <span v-if="order.isUrgent" class="glass-badge glass-badge-danger">紧急</span>
            </div>

            <div class="kanban-card-meta">
              <span class="kanban-card-no">{{ order.orderNo }}</span>
              <span class="glass-badge" :class="paymentStatusBadgeClass(order.paymentStatus)">
                {{ PAYMENT_STATUS_LABEL[order.paymentStatus] }}
              </span>
            </div>

            <div class="kanban-card-foot">
              <span v-if="order.expectedEndDate" class="kanban-due" :class="{ 'is-urgent': dueDays(order.expectedEndDate) <= prefs.preferences.kanbanUrgentDays }">
                剩 {{ dueDays(order.expectedEndDate) }} 天
              </span>
              <span v-for="cat in orderCategories(order.id)" :key="cat.id" class="kanban-cat-tag">{{ cat.name }}</span>
            </div>

            <!-- 悬浮快捷操作：详情 + 收款 + 编辑；退单卡片不可收款（禁止返回流程），提供「隐藏」 -->
            <div class="kanban-card-actions">
              <button
                type="button"
                class="glass-btn glass-btn-ghost glass-btn-sm"
                title="查看订单详情"
                @click.stop="goDetail(order.id)"
              ><Eye class="w-3.5 h-3.5" /> 详情</button>
              <button
                v-if="order.orderStatus !== 'voided' && order.paymentStatus === 'unpaid'"
                type="button"
                class="glass-btn glass-btn-ghost glass-btn-sm"
                @click.stop="quickPay(order, 'deposit_paid')"
              >收定金</button>
              <button
                v-if="order.orderStatus !== 'voided' && order.paymentStatus === 'deposit_paid' && order.orderStatus !== 'completed'"
                type="button"
                class="glass-btn glass-btn-ghost glass-btn-sm"
                @click.stop="quickPay(order, 'final_paid')"
              >收尾款</button>
              <button
                v-if="order.orderStatus === 'voided'"
                type="button"
                class="glass-btn glass-btn-ghost glass-btn-sm is-voided-hide"
                title="从退单栏隐藏该单"
                @click.stop="hideVoided(order)"
              ><EyeOff class="w-3.5 h-3.5" /> 隐藏</button>
              <button
                type="button"
                class="glass-btn glass-btn-ghost glass-btn-sm"
                title="快捷添加跟进"
                @click.stop="openFollowUp(order)"
              ><MessageSquare class="w-3.5 h-3.5" /> 跟进</button>
              <button type="button" class="glass-btn glass-btn-ghost glass-btn-sm" @click.stop="openEdit(order)">编辑</button>
            </div>
          </div>

          <div v-if="col.orders.length === 0" class="kanban-column-empty">暂无订单</div>
        </div>
      </div>
    </div>

    <OrderFormModal :visible="showForm" :order="editingOrder" @close="closeForm" @saved="onSaved" />
    <!-- 快捷添加跟进：预选当前订单 -->
    <FollowUpFormModal
      :visible="showFollowUpForm"
      :follow-up="null"
      :preset-order-id="followUpOrderId"
      @close="closeFollowUpForm"
      @saved="onFollowUpSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { LayoutDashboard as LayoutDashboardIcon, Eye, EyeOff, MessageSquare, Flame, CalendarClock } from '@lucide/vue'
import { useOrderStore } from '@/stores/order'
import { usePaymentStore } from '@/stores/payment'
import { useCustomerStore } from '@/stores/customer'
import { useSettingsStore } from '@/stores/settings'
import { usePreferencesStore } from '@/stores/preferences'
import { KANBAN_STATUSES } from '@/domain/order/order-status'
import { PAYMENT_STATUS_LABEL, paymentStatusBadgeClass } from '@/constants/order-labels'
import PageHeader from '@/components/common/PageHeader.vue'
import OrderFormModal from '@/views/OrderList/OrderFormModal.vue'
import FollowUpFormModal from '@/views/FollowUp/FollowUpFormModal.vue'
import type { Order } from '@/types'

const router = useRouter()
const orderStore = useOrderStore()
const paymentStore = usePaymentStore()
const customerStore = useCustomerStore()
const settingsStore = useSettingsStore()
const prefs = usePreferencesStore()

/** 系统内置「待开始」阶段 id：未排期/未开始的订单默认归入此列 */
const PENDING_STAGE_ID = 'st-pending'

const draggingOrderId = ref('')
const dragOverStageId = ref('')
const showForm = ref(false)
const editingOrder = ref<Order | null>(null)

// ===== 顶部工具栏筛选：全部 / 只看紧急 / 今日待交（今日到期或已逾期） =====
type BoardFilter = 'all' | 'urgent' | 'due-today'
const boardFilter = ref<BoardFilter>('all')
/** 筛选后仍在看板的订单数（退单卡不参与筛选，不计入） */
const filteredBoardCount = computed(() => {
  if (boardFilter.value === 'all') return orderStore.activeOrders.filter(o => KANBAN_STATUSES.has(o.orderStatus)).length
  return orderStore.activeOrders.filter(o => {
    if (!KANBAN_STATUSES.has(o.orderStatus)) return false
    if (boardFilter.value === 'urgent') return o.isUrgent
    return dueDays(o.expectedEndDate) <= 0
  }).length
})

// ===== 名称/类别/权重映射 =====
const customerMap = computed(() => new Map(customerStore.customers.map(c => [c.id, c.name])))
const weightMap = computed(() => new Map(customerStore.customers.map(c => [c.id, c.weight])))
const categoryMap = computed(() => new Map(settingsStore.categories.map(c => [c.id, c.name])))
const orderCategoryMap = computed(() => {
  const map = new Map<string, Set<string>>()
  for (const oc of orderStore.orderCategories) {
    if (!map.has(oc.orderId)) map.set(oc.orderId, new Set())
    map.get(oc.orderId)!.add(oc.categoryId)
  }
  return map
})

function customerName(id: string): string { return customerMap.value.get(id) || '—' }
function customerWeight(id: string): number { return weightMap.value.get(id) ?? 0 }

function orderCategories(orderId: string): { id: string; name: string }[] {
  const ids = orderCategoryMap.value.get(orderId)
  if (!ids) return []
  return [...ids].map(id => ({ id, name: categoryMap.value.get(id) || id }))
}

/** 距预计交付剩余天数（按自然日） */
function dueDays(dateStr: string): number {
  const end = new Date(dateStr)
  const now = new Date()
  end.setHours(0, 0, 0, 0)
  now.setHours(0, 0, 0, 0)
  return Math.ceil((end.getTime() - now.getTime()) / 86400000)
}

/**
 * 退单单是否显示在退单栏：
 * - 已手动隐藏（voidedHidden）→ 不显示
 * - 无排期（缺预计开始/预计交付）→ 不显示
 * - 今日在 [预计开始, 预计交付] 范围内 → 显示；超出窗口（过期太久）自动离开退单栏
 */
function isVoidedVisible(order: Order): boolean {
  if (order.voidedHidden) return false
  if (!order.expectedStartDate || !order.expectedEndDate) return false
  const start = new Date(order.expectedStartDate)
  const end = new Date(order.expectedEndDate)
  const now = new Date()
  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)
  now.setHours(0, 0, 0, 0)
  return now >= start && now <= end
}

/** 退单栏隐藏该退单（持久化 voidedHidden，不再出现在退单栏） */
async function hideVoided(order: Order) {
  await orderStore.updateOrder(order.id, { voidedHidden: true })
}

// ===== 看板列：阶段列 + 归列订单（按客户权重降序） =====
const columns = computed(() => {
  const stages = settingsStore.stagesByPosition
  const byStage = new Map<string, Order[]>()
  for (const s of stages) byStage.set(s.id, [])

  // 看板展示进行中工作流（待付定金/未开始/进行中/待付尾款）+ 退单栏展示排期窗口内的退单单。
  // 新建订单即 not_started + 待开始阶段，直接落在「待开始」列；历史待付定金订单也归入该列；
  // 已退单（voided）满足 isVoidedVisible（排期窗口内且未隐藏）才进入退单栏。
  // 顶部工具栏筛选（只看紧急/今日待交）只作用于进行中订单，退单栏保持独立不受影响。
  const boardOrders = orderStore.activeOrders.filter(o => {
    if (o.orderStatus === 'voided') return o.orderStatus === 'voided' && isVoidedVisible(o)
    if (boardFilter.value === 'urgent') return KANBAN_STATUSES.has(o.orderStatus) && o.isUrgent
    if (boardFilter.value === 'due-today') return KANBAN_STATUSES.has(o.orderStatus) && dueDays(o.expectedEndDate) <= 0
    return KANBAN_STATUSES.has(o.orderStatus)
  })
  for (const order of boardOrders) {
    const col = order.currentStage && byStage.has(order.currentStage) ? order.currentStage : PENDING_STAGE_ID
    byStage.get(col)?.push(order)
  }

  return stages.map(stage => ({
    stage,
    orders: (byStage.get(stage.id) ?? [])
      .slice()
      .sort((a, b) => (customerWeight(b.customerId) - customerWeight(a.customerId)) || b.createdAt.localeCompare(a.createdAt)),
  }))
})

// ===== 拖拽流转：Pointer Events（鼠标 + 触摸 + 触笔统一支持，平板可拖） =====
// HTML5 原生 DnD 在触屏设备不派发 drag 事件，故用 pointerdown/move/up 实现；
// 卡片 touch-action: pan-y —— 横向手势交给 JS 拖拽、纵向手势留给浏览器滚动。
const dragState = { orderId: '', pointerId: -1, startX: 0, startY: 0, active: false }

function onCardPointerDown(e: PointerEvent, order: Order) {
  if ((e.target as HTMLElement).closest('button')) return // 操作按钮不触发拖拽
  if (order.orderStatus === 'voided') return // 已退单不可再拖回流程
  dragState.orderId = order.id
  dragState.pointerId = e.pointerId
  dragState.startX = e.clientX
  dragState.startY = e.clientY
  dragState.active = false
  try {
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  } catch { /* 指针已释放等场景忽略 */ }
}

function onCardPointerMove(e: PointerEvent) {
  if (dragState.pointerId !== e.pointerId || !dragState.orderId) return
  // 超过 5px 位移才算拖拽（区分点击/双击）
  if (!dragState.active) {
    if (Math.abs(e.clientX - dragState.startX) < 5 && Math.abs(e.clientY - dragState.startY) < 5) return
    dragState.active = true
    draggingOrderId.value = dragState.orderId
  }
  // 指针当前悬停的列 → 高亮
  const el = document.elementFromPoint(e.clientX, e.clientY)
  const colEl = el?.closest('.kanban-column')
  dragOverStageId.value = colEl?.getAttribute('data-stage-id') ?? ''
}

function onCardPointerUp(e: PointerEvent) {
  if (dragState.pointerId !== e.pointerId) return
  const orderId = dragState.orderId
  const targetStageId = dragOverStageId.value
  const wasActive = dragState.active
  // 清理拖拽状态
  dragState.orderId = ''
  dragState.pointerId = -1
  dragState.active = false
  draggingOrderId.value = ''
  dragOverStageId.value = ''
  // 点击（未拖拽）：触屏设备单击即进详情（平板无双击，桌面保留双击）
  if (!wasActive && orderId && (e.pointerType === 'touch' || e.pointerType === 'pen')) {
    const order = orderStore.orders.find(o => o.id === orderId)
    if (order) goDetail(order.id)
    return
  }
  if (!wasActive || !orderId || !targetStageId) return
  const order = orderStore.orders.find(o => o.id === orderId)
  // 已退单不可返回流程；目标列相同不流转；
  // 完成栏（st-done）是最后一个流程：不能再进入下一个流程（拖到退单列无效，防误触；退单走列表操作菜单显式确认）
  const isDoneToVoid = order?.currentStage === 'st-done' && targetStageId === 'st-void'
  if (order && order.orderStatus !== 'voided' && order.currentStage !== targetStageId && !isDoneToVoid) {
    void orderStore.transitionStage(orderId, targetStageId)
  }
}

function onCardPointerCancel(e: PointerEvent) {
  if (dragState.pointerId !== e.pointerId) return
  dragState.orderId = ''
  dragState.pointerId = -1
  dragState.active = false
  draggingOrderId.value = ''
  dragOverStageId.value = ''
}

/** 卡片快捷收款：走账单入账（生成流水 + 联动订单），与账单模块同源 */
async function quickPay(order: Order, status: 'deposit_paid' | 'final_paid') {
  try {
    await paymentStore.addPaymentRecord({
      orderId: order.id,
      type: status === 'deposit_paid' ? 'deposit' : 'final',
    })
  } catch (e) {
    alert((e as Error).message)
    return
  }
  await orderStore.fetchOrders()
}

// ===== 新建/编辑/跳转 =====
function openCreate() {
  editingOrder.value = null
  showForm.value = true
}
function openEdit(order: Order) {
  editingOrder.value = order
  showForm.value = true
}
function closeForm() { showForm.value = false; editingOrder.value = null }
function onSaved() { showForm.value = false; editingOrder.value = null }
function goDetail(id: string) { router.push(`/orders/${id}`) }

// ===== 快捷添加跟进：预选当前订单 =====
const showFollowUpForm = ref(false)
const followUpOrderId = ref('')
function openFollowUp(order: Order) {
  followUpOrderId.value = order.id
  showFollowUpForm.value = true
}
function closeFollowUpForm() { showFollowUpForm.value = false; followUpOrderId.value = '' }
function onFollowUpSaved() { showFollowUpForm.value = false; followUpOrderId.value = '' }

onMounted(async () => {
  await Promise.all([
    orderStore.fetchOrders(),
    orderStore.fetchOrderCategories(),
    customerStore.fetchCustomers(),
    settingsStore.fetchStages(),
    settingsStore.fetchCategories(),
    settingsStore.fetchFollowUpTypes(),
  ])
})
</script>

<style scoped>
/* 看板页撑满布局：根容器占满内容区高度，看板弹性撑满剩余空间 */
.dashboard-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 100%;
}

/* ===== 顶部工具栏筛选：玻璃胶囊 chips（全部 / 只看紧急 / 今日待交） ===== */
.kanban-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.kanban-filter-chips {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
}
/* ===== 筛选 chips：玻璃胶囊（全部 / 只看紧急 / 今日待交） ===== */
.kanban-filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.32em 0.8em;
  border-radius: var(--radius-full);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--color-text-secondary);
  font-size: 0.8rem;
  font-weight: 500;
  font-family: var(--font-body);
  line-height: 1.4;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s ease;
}
.kanban-filter-chip:hover {
  color: var(--color-accent);
  border-color: var(--color-accent-glow);
  background: var(--glass-bg-hover);
  box-shadow: 0 4px 14px var(--color-accent-glow);
  transform: translateY(-1px);
}
.kanban-filter-chip.is-active {
  color: var(--color-accent);
  background: linear-gradient(135deg, var(--color-accent-soft), transparent);
  border-color: var(--color-accent-glow);
  box-shadow: 0 0 12px var(--color-accent-glow), inset 0 1px 0 var(--glass-border-soft);
}
.kanban-filter-hint {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  white-space: nowrap;
}

/* ===== 看板：横向滚动列 ===== */
.kanban-board {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: flex-start;
  gap: var(--space-4);
  overflow-x: auto;
  padding: var(--space-1) var(--space-1) var(--space-2);
  /* Firefox 滚动条：标准宽度（thin 太细难抓取） */
  scrollbar-width: auto;
  scrollbar-color: var(--color-accent-soft) transparent;
}
/* 右上角装饰光斑：透过半透明列的玻璃底透出，强化玻璃拟态层次 */
.kanban-board::before {
  content: '';
  position: absolute;
  top: -18%;
  right: -6%;
  width: 44%;
  height: 65%;
  background: radial-gradient(circle, var(--color-accent-glow), transparent 70%);
  opacity: 0.3;
  filter: blur(44px);
  pointer-events: none;
}
/* 看板横向滚动条滑块：accent 渐变胶囊，hover 加深 */
.kanban-board::-webkit-scrollbar {
  height: 10px;
}
.kanban-board::-webkit-scrollbar-track {
  background: transparent;
}
.kanban-board::-webkit-scrollbar-thumb {
  background: linear-gradient(90deg, var(--color-accent-soft), var(--color-accent-glow));
  border-radius: var(--radius-full);
  border: 2px solid transparent;
  background-clip: padding-box;
}
.kanban-board::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(90deg, var(--color-accent), var(--color-accent-glow));
  background-clip: padding-box;
}

.kanban-column {
  position: relative;
  z-index: 1; /* 盖住 board 装饰光斑，玻璃底仍透出光斑层次 */
  flex: 1 1 0;
  min-width: 250px;
  max-width: 340px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--glass-bg);
  /* 磨砂玻璃：模糊背后内容，保证列头/卡片文字可读 */
  backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-glass), inset 0 1px 0 var(--glass-border-soft);
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}
.kanban-column:hover {
  border-color: var(--glass-border);
  box-shadow: var(--shadow-glass-hover), inset 0 1px 0 var(--glass-border-soft);
}

/* 拖拽悬停高亮：accent 光晕边框 + 背景 tint */
.kanban-column.is-drag-over {
  border-color: var(--color-accent);
  background: linear-gradient(180deg, var(--color-accent-soft), var(--glass-bg));
  box-shadow: 0 0 0 3px var(--color-accent-soft), var(--shadow-glass-hover);
}

/* 列头：玻璃渐变 + 底部阶段色光晕线 + 柔和分隔 */
.kanban-column-head {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.7em 1em;
  background: linear-gradient(180deg, var(--glass-bg-strong), var(--glass-bg) 60%, transparent);
  /* 列头独立磨砂：标题区更实，背后文字不穿透 */
  backdrop-filter: blur(var(--glass-blur-light));
  border-bottom: 1px solid var(--glass-border-soft);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  overflow: hidden;
}
/* 列头底部：阶段色向两端淡出的光晕细线（呼应列色） */
.kanban-column-head::after {
  content: '';
  position: absolute;
  left: 0.75em;
  right: 0.75em;
  bottom: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--stage-color, var(--color-accent-glow)), transparent);
  opacity: 0.55;
  pointer-events: none;
}

.kanban-stage-dot {
  width: 0.65rem;
  height: 0.65rem;
  border-radius: var(--radius-full);
  flex-shrink: 0;
  box-shadow: 0 0 8px currentColor, inset 0 1px 0 rgba(255, 255, 255, 0.35);
}

.kanban-column-title {
  font-family: var(--font-heading);
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  white-space: nowrap;
  transition: color 0.18s ease;
}
.kanban-column:hover .kanban-column-title {
  color: var(--color-accent);
}

/* 列计数：accent 渐变胶囊徽章 */
.kanban-column-count {
  margin-left: auto;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-accent);
  background: linear-gradient(135deg, var(--color-accent-soft), transparent);
  border: 1px solid var(--color-accent-glow);
  border-radius: var(--radius-full);
  padding: 0.15em 0.65em;
  white-space: nowrap;
  box-shadow: inset 0 0 8px var(--color-accent-glow);
}

.kanban-column-body {
  flex: 1;
  min-height: 120px;
  overflow-y: auto;
  padding: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  /* Firefox 滚动条：标准宽度 */
  scrollbar-width: auto;
  scrollbar-color: var(--color-accent-soft) transparent;
}
/* 列内纵向滚动条滑块 */
.kanban-column-body::-webkit-scrollbar {
  width: 10px;
}
.kanban-column-body::-webkit-scrollbar-track {
  background: transparent;
}
.kanban-column-body::-webkit-scrollbar-thumb {
  background: var(--color-accent-soft);
  border-radius: var(--radius-full);
}
.kanban-column-body::-webkit-scrollbar-thumb:hover {
  background: var(--color-accent);
}

/* 空列提示：accent 对角渐变虚线框 */
.kanban-column-empty {
  flex-shrink: 0; /* 与卡片一致：不参与压缩 */
  text-align: center;
  color: var(--color-text-muted);
  font-size: 0.8rem;
  padding: 1.5rem 0;
  border: 1px dashed var(--color-accent-glow);
  background: linear-gradient(135deg, var(--color-accent-soft), transparent);
  border-radius: var(--radius-lg);
}

/* ===== 卡片 ===== */
.kanban-card {
  position: relative;
  flex-shrink: 0; /* 列体是 flex 列容器：禁止压缩卡片，卡片多时靠 overflow-y 滚动而不是压扁 */
  background: var(--glass-bg-strong);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  padding: 0.7em 0.9em;
  cursor: grab;
  /* 触摸支持：横向手势交给 JS 拖拽，纵向手势留给浏览器滚动 */
  touch-action: pan-y;
  -webkit-user-select: none;
  user-select: none;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  box-shadow: var(--shadow-inner-glass);
}
/* 卡片左侧 accent 装饰条（hover 点亮） */
.kanban-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--color-accent);
  opacity: 0;
  transition: opacity 0.15s ease;
}
.kanban-card:hover {
  border-color: var(--color-accent-glow);
  box-shadow:
    0 20px 40px -16px rgba(0, 0, 0, 0.5),
    0 0 0 1px var(--color-accent-glow),
    var(--shadow-inner-glass);
  transform: translateY(-4px);
}
.kanban-card:hover::before {
  opacity: 1;
}
.kanban-card:hover .kanban-card-name {
  color: var(--color-accent);
}
.kanban-card.is-dragging {
  opacity: 0.5;
  cursor: grabbing;
  transform: rotate(1.5deg) scale(1.02);
  box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.55);
}

/* 退单卡片：灰色虚线边框标识，不可拖拽（cursor 默认） */
.kanban-card.is-voided {
  border-style: dashed;
  border-color: var(--color-text-muted);
  background: var(--glass-bg);
  cursor: default;
}
.kanban-card.is-voided::before {
  display: none; /* 退单卡片不显示 accent 装饰条 */
}
.kanban-card.is-voided:hover {
  transform: none;
  border-color: var(--color-text-muted);
  box-shadow: var(--shadow-glass), inset 0 1px 0 var(--glass-border-soft);
}
.kanban-card.is-voided .kanban-card-name {
  color: var(--color-text-muted);
}
.kanban-card.is-voided .kanban-card-actions {
  opacity: 1; /* 退单卡片操作（隐藏/编辑）常显 */
}
.is-voided-hide {
  color: var(--color-warning) !important;
}
.is-voided-hide:hover {
  color: var(--color-danger) !important;
}

.kanban-card-title {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  min-width: 0;
}
/* 客户名胶囊：替代原订单号位置，accent 色区分 */
.kanban-card-customer-pill {
  flex-shrink: 0;
  max-width: 5.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--color-accent);
  background: var(--color-accent-soft);
  border: 1px solid var(--color-accent-glow);
  border-radius: var(--radius-full);
  padding: 0.08em 0.6em;
}
.kanban-card-name {
  font-weight: 500;
  font-size: 0.9rem;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  transition: color 0.15s ease;
}
.kanban-card-title .glass-badge {
  font-size: 0.65em;
  flex-shrink: 0;
}

.kanban-card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.375rem;
  margin-top: 0.5em;
}
/* 订单号：悬浮卡片时浮现（卡片 title 同步原生提示） */
.kanban-card-no {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-muted);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border-soft);
  border-radius: var(--radius-full);
  padding: 0.08em 0.6em;
  white-space: nowrap;
  opacity: 0;
  transform: translateY(2px);
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.kanban-card:hover .kanban-card-no {
  opacity: 1;
  transform: translateY(0);
}
.kanban-card-meta .glass-badge {
  font-size: 0.7em;
  flex-shrink: 0;
}

.kanban-card-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.5em;
}
.kanban-due {
  font-size: 0.72rem;
  color: var(--color-text-muted);
  white-space: nowrap;
}
.kanban-due.is-urgent {
  color: var(--color-danger);
  font-weight: 600;
}
.kanban-cat-tag {
  font-size: 0.7rem;
  color: var(--color-accent);
  background: var(--color-accent-soft);
  border: 1px solid var(--color-accent-glow);
  border-radius: var(--radius-full);
  padding: 0.1em 0.55em;
  white-space: nowrap;
}

/* 悬浮快捷操作：卡内独立一行（不覆盖标题），hover 浮现；按钮多时换行 */
.kanban-card-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem;
  margin-top: 0.55em;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.kanban-card:hover .kanban-card-actions {
  opacity: 1;
}
.kanban-card-actions .glass-btn {
  font-size: 0.75rem;
  padding: 0.35em 0.7em;
}
</style>

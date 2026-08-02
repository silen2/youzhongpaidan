<template>
  <div class="fluid-container order-list-root">
    <div class="order-list-inner">
    <PageHeader title="订单列表" subtitle="管理所有客户订单" :icon="ClipboardListIcon">
      <template #actions>
        <button class="glass-btn glass-btn-primary" @click="openCreate">
          <Plus class="w-4 h-4" /> 新建订单
        </button>
      </template>
    </PageHeader>

    <!-- 高级搜索 -->
    <div class="glass-toolbar mb-4 shrink-0">
      <AdvancedSearch
        v-model:keyword="keyword"
        v-model:primary-filter="statusFilter"
        v-model:sort-key="sortKey"
        v-model:sort-direction="sortDirection"
        :keyword-placeholder="'搜索订单编号、名称、客户、内容...'"
        :primary-filter-all-value="'all'"
        :primary-filter-all-label="'全部状态'"
        :primary-filter-options="statusOptions"
        primary-filter-label="订单状态"
        :sort-options="sortOptions"
        :has-advanced-filters="true"
        @reset="onReset"
      >
        <template #advanced>
          <!-- 高级搜索：客户 -->
          <div class="advanced-search-field">
            <label class="glass-label">客户：</label>
            <DropdownSelect
              v-model="customerFilter"
              :options="[{ value: 'all', label: '全部客户' }, ...customerStore.customers.map(c => ({ value: c.id, label: c.name }))]"
              search-placeholder="搜索客户..."
              teleport-to-body
            />
          </div>

          <!-- 高级搜索：客户类型 -->
          <div class="advanced-search-field">
            <label class="glass-label">客户类型：</label>
            <DropdownSelect
              v-model="customerTypeFilter"
              :options="[{ value: 'all', label: '全部类型' }, ...settingsStore.enabledCustomerTypes.map(t => ({ value: t.id, label: t.name }))]"
              search-placeholder="搜索类型..."
              teleport-to-body
            />
          </div>

          <!-- 高级搜索：来源 -->
          <div class="advanced-search-field">
            <label class="glass-label">来源：</label>
            <DropdownSelect
              v-model="sourceFilter"
              :options="[{ value: 'all', label: '全部来源' }, ...settingsStore.sources.map(s => ({ value: s.id, label: s.name }))]"
              search-placeholder="搜索来源..."
              teleport-to-body
            />
          </div>

          <!-- 高级搜索：阶段（多选，命中任一选中阶段即通过） -->
          <div class="advanced-search-field">
            <label class="glass-label">阶段：</label>
            <MultiSelect
              v-model="stageFilter"
              :options="settingsStore.stages.map(s => ({ value: s.id, label: s.name }))"
              placeholder="全部阶段"
              aria-label="当前阶段"
              :max-display="2"
            />
          </div>

          <!-- 高级搜索：稿件类别（多选下拉，命中任一选中类别即通过） -->
          <div class="advanced-search-field">
            <label class="glass-label">稿件类别：</label>
            <MultiSelect
              v-model="categoryFilter"
              :options="settingsStore.enabledCategories.map(c => ({ value: c.id, label: c.name }))"
              placeholder="全部类别"
              aria-label="稿件类别"
              :max-display="2"
            />
          </div>

          <!-- 高级搜索：收款状态（多选，命中任一选中状态即通过） -->
          <div class="advanced-search-field">
            <label class="glass-label">收款状态：</label>
            <MultiSelect
              v-model="paymentStatusFilter"
              :options="Object.entries(PAYMENT_STATUS_LABEL).map(([value, label]) => ({ value, label }))"
              placeholder="全部状态"
              aria-label="收款状态"
              :max-display="2"
            />
          </div>

          <!-- 高级搜索：金额区间 -->
          <div class="advanced-search-field">
            <label class="glass-label">预计金额：</label>
            <div class="flex items-center gap-2">
              <input
                :value="minAmount"
                type="text"
                inputmode="decimal"
                placeholder="最低"
                class="glass-input w-24"
                @input="onAmountInput($event, 'min')"
                @blur="onAmountBlur($event, 'min')"
              />
              <span class="glass-caption">~</span>
              <input
                :value="maxAmount"
                type="text"
                inputmode="decimal"
                placeholder="最高"
                class="glass-input w-24"
                @input="onAmountInput($event, 'max')"
                @blur="onAmountBlur($event, 'max')"
              />
            </div>
          </div>

          <!-- 高级搜索：是否紧急 -->
          <div class="advanced-search-field">
            <label class="glass-label">紧急订单：</label>
            <DropdownSelect
              v-model="urgentFilter"
              :options="[
                { value: 'all', label: '全部' },
                { value: 'yes', label: '仅紧急' },
                { value: 'no', label: '仅非紧急' },
              ]"
              :searchable="false"
              teleport-to-body
            />
          </div>

          <!-- 高级搜索：创建时间（同一日历内选择起止范围） -->
          <div class="advanced-search-field">
            <label class="glass-label">创建时间：</label>
            <DatePicker
              range
              v-model:start-value="dateFrom"
              v-model:end-value="dateTo"
              placeholder="选择日期范围"
            />
          </div>

          <!-- 高级搜索：预计交付（同一日历内选择起止范围） -->
          <div class="advanced-search-field">
            <label class="glass-label">预计交付：</label>
            <DatePicker
              range
              v-model:start-value="expectedDateFrom"
              v-model:end-value="expectedDateTo"
              placeholder="选择日期范围"
            />
          </div>
        </template>
      </AdvancedSearch>
    </div>

    <!-- 数据表格（订单不可删除，无需勾选/批量操作） -->
    <DataTable
      :columns="columnDefs"
      :data="filteredOrders"
      row-key="id"
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      :selectable="false"
      page-size-storage-key="pagination.orders.pageSize"
      columns-storage-key="dataTable.columns.orders"
    >
      <!-- 订单编号（正文字体与表格其他单元格统一） -->
      <template #td-orderNo="{ row }">
        <span class="whitespace-nowrap">{{ row.orderNo }}</span>
      </template>

      <!-- 订单名称 -->
      <template #td-name="{ row }">
        <span
          class="cursor-pointer hover:text-[var(--color-accent)]"
          @click="goDetail(row.id)"
        >
          {{ row.name }}
        </span>
        <span v-if="row.isUrgent" class="glass-badge glass-badge-danger ml-2">紧急</span>
      </template>

      <!-- 客户 -->
      <template #td-customerId="{ row }">
        {{ customerName(row.customerId) }}
      </template>

      <!-- 来源 -->
      <template #td-sourceId="{ row }">
        <span class="glass-body-sm">{{ sourceName(row.sourceId) || '—' }}</span>
      </template>

      <!-- 阶段 -->
      <template #td-currentStage="{ row }">
        <span class="glass-body-sm">{{ stageLabel(row) }}</span>
      </template>

      <!-- 状态 -->
      <template #td-orderStatus="{ row }">
        <span class="glass-badge" :class="orderStatusBadgeClass(row.orderStatus as OrderStatus)">
          {{ ORDER_STATUS_LABEL[row.orderStatus as OrderStatus] }}
        </span>
      </template>

      <!-- 预计金额 -->
      <template #td-expectedAmount="{ row }">
        <span>{{ prefs.preferences.currencySymbol }}{{ formatAmount(row.expectedAmount) }}</span>
      </template>

      <!-- 预计到手金额 = 预计金额 − 来源手续费 -->
      <template #td-expectedActual="{ row }">
        <span>{{ prefs.preferences.currencySymbol }}{{ formatAmount(calcFee(row.expectedAmount, sourceOf(row.sourceId)).actualAmount) }}</span>
      </template>

      <!-- 预计周期（排期快速编辑入口） -->
      <template #td-expectedPeriod="{ row }">
        <div
          v-if="row.expectedStartDate && row.expectedEndDate"
          class="flex items-center gap-1 cursor-pointer hover:text-[var(--color-accent)]"
          @click="openScheduleEditor(row)"
          title="点击编辑排期"
        >
          <CalendarRange class="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
          <span class="glass-caption whitespace-nowrap">{{ formatDate(row.expectedStartDate) }} → {{ formatDate(row.expectedEndDate) }}</span>
        </div>
        <span v-else class="glass-caption text-[var(--color-warning)] cursor-pointer hover:text-[var(--color-accent)]" @click="openScheduleEditor(row)">
          <CalendarPlus class="w-3.5 h-3.5 inline mr-1" /> 未排期
        </span>
      </template>

      <!-- 预计交付 -->
      <template #td-expectedEndDate="{ row }">
        <span class="glass-caption whitespace-nowrap">{{ formatDate(row.expectedEndDate) }}</span>
      </template>

      <!-- 操作：折叠为一个菜单按钮 -->
      <template #td-__actions__="{ row }">
        <div class="flex items-center justify-end">
          <RowActionsMenu :options="rowActions(row)" />
        </div>
      </template>

      <template #empty>
        暂无订单，点击右上角「新建订单」开始吧
      </template>
    </DataTable>

    <OrderFormModal
      :visible="showForm"
      :order="editingOrder"
      @close="closeForm"
      @saved="onSaved"
    />

    <!-- 排期快速编辑模态框 -->
    <Teleport to="body">
      <transition name="modal-fade">
        <div v-if="showScheduleEditor" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" @click.self="closeScheduleEditor">
          <div class="glass-card w-[420px] max-w-[90vw]">
            <div class="glass-card-header">
              <div class="glass-card-title-group">
                <span class="glass-card-title-icon"><CalendarRange class="w-4 h-4" /></span>
                <h2 class="glass-section-title">编辑排期</h2>
              </div>
              <button class="glass-btn glass-btn-ghost glass-btn-sm" @click="closeScheduleEditor">✕</button>
            </div>
            <div class="glass-card-body space-y-4">
              <div v-if="scheduleOrder" class="glass-caption">
                订单：<span class="font-medium text-[var(--color-text)]">{{ scheduleOrder.orderNo }} {{ scheduleOrder.name }}</span>
              </div>
              <div class="space-y-2">
                <label class="glass-label">开始日期</label>
                <input
                  v-model="scheduleStart"
                  type="date"
                  class="glass-input w-full"
                />
              </div>
              <div class="space-y-2">
                <label class="glass-label">结束日期</label>
                <input
                  v-model="scheduleEnd"
                  type="date"
                  class="glass-input w-full"
                />
              </div>
              <div v-if="scheduleStart && scheduleEnd" class="glass-caption">
                周期：{{ scheduleStart }} → {{ scheduleEnd }}（{{ Math.max(1, Math.floor((new Date(scheduleEnd).getTime() - new Date(scheduleStart).getTime()) / 86400000) + 1) }} 天）
              </div>
              <div class="flex justify-end gap-2 pt-2">
                <button class="glass-btn glass-btn-ghost" @click="closeScheduleEditor">取消</button>
                <button class="glass-btn glass-btn-primary" @click="saveSchedule">保存</button>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ClipboardList as ClipboardListIcon, Plus, Eye, Pencil, HandCoins, Wallet, ArrowRight, Ban, CalendarRange, CalendarPlus } from '@lucide/vue'
import { useOrderStore } from '@/stores/order'
import { useCustomerStore } from '@/stores/customer'
import { useSettingsStore } from '@/stores/settings'
import { usePreferencesStore } from '@/stores/preferences'
import { sortOrders, type OrderSortKey } from '@/domain/order/order-sort'
import { calcFee } from '@/domain/order/fee-calculator'
import { computeTotalPages } from '@/domain/shared/pagination'
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, orderStatusBadgeClass } from '@/constants/order-labels'
import PageHeader from '@/components/common/PageHeader.vue'
import AdvancedSearch from '@/components/common/AdvancedSearch.vue'
import DropdownSelect from '@/components/common/DropdownSelect.vue'
import MultiSelect from '@/components/common/MultiSelect.vue'
import DatePicker from '@/components/common/DatePicker.vue'
import DataTable, { type ColumnDef } from '@/components/common/DataTable.vue'
import RowActionsMenu, { type RowAction } from '@/components/common/RowActionsMenu.vue'
import OrderFormModal from './OrderFormModal.vue'
import type { Order, OrderStatus, Source } from '@/types'
import type { Stage } from '@/types'

const router = useRouter()
const orderStore = useOrderStore()
const customerStore = useCustomerStore()
const settingsStore = useSettingsStore()
const prefs = usePreferencesStore()

// 排序规则选项（列字段）
const sortOptions = [
  { value: 'createdAt', label: '创建时间' },
  { value: 'closedAt', label: '结单时间' },
  { value: 'expectedEnd', label: '预计交付' },
  { value: 'expectedAmount', label: '预计金额' },
]

// 状态选项
const statusOptions = computed(() =>
  Object.entries(ORDER_STATUS_LABEL).map(([value, label]) => ({ value, label }))
)

const keyword = ref('')
const statusFilter = ref<'all' | OrderStatus>('all')
const sortKey = ref(prefs.preferences.listDefaultSortKey)
const sortDirection = ref<'asc' | 'desc'>(prefs.preferences.listDefaultSortDirection)
const currentPage = ref(1)
const pageSize = ref(Number(localStorage.getItem('pagination.orders.pageSize')) || prefs.preferences.listPageSize)

// 高级筛选
const customerFilter = ref('all')
const customerTypeFilter = ref('all') // 客户类型（单选：'all' = 不筛选）
const sourceFilter = ref('all')
const stageFilter = ref<string[]>([]) // 当前阶段多选：空数组 = 不筛选
const categoryFilter = ref<string[]>([]) // 稿件类别多选：空数组 = 不筛选
const paymentStatusFilter = ref<string[]>([]) // 收款状态多选：空数组 = 不筛选
const minAmount = ref('')
const maxAmount = ref('')
const urgentFilter = ref('all')
const dateFrom = ref('')
const dateTo = ref('')
const expectedDateFrom = ref('') // 预计交付起
const expectedDateTo = ref('') // 预计交付止

const showForm = ref(false)
const editingOrder = ref<Order | null>(null)

// 排期快速编辑
const showScheduleEditor = ref(false)
const scheduleOrder = ref<Order | null>(null)
const scheduleStart = ref('')
const scheduleEnd = ref('')

function openScheduleEditor(order: Order) {
  scheduleOrder.value = order
  scheduleStart.value = order.expectedStartDate || ''
  scheduleEnd.value = order.expectedEndDate || ''
  showScheduleEditor.value = true
}

function closeScheduleEditor() {
  showScheduleEditor.value = false
  scheduleOrder.value = null
  scheduleStart.value = ''
  scheduleEnd.value = ''
}

async function saveSchedule() {
  if (!scheduleOrder.value) return
  if (!scheduleStart.value || !scheduleEnd.value) {
    alert('请选择开始和结束日期')
    return
  }
  if (scheduleEnd.value < scheduleStart.value) {
    alert('结束日期不能早于开始日期')
    return
  }
  await orderStore.updateOrder(scheduleOrder.value.id, {
    expectedStartDate: scheduleStart.value,
    expectedEndDate: scheduleEnd.value,
  })
  closeScheduleEditor()
}

// 列定义
const columnDefs = ref<ColumnDef[]>([
  { key: 'orderNo', label: '订单编号', minWidth: 120, draggable: true },
  { key: 'name', label: '订单名称', minWidth: 160, draggable: true },
  { key: 'customerId', label: '客户', minWidth: 100, draggable: true },
  { key: 'sourceId', label: '来源', minWidth: 80, draggable: true },
  { key: 'currentStage', label: '阶段', minWidth: 90, draggable: true },
  { key: 'orderStatus', label: '状态', minWidth: 90, draggable: true },
  { key: 'expectedAmount', label: '预计金额', minWidth: 110, align: 'right', isNumeric: true, draggable: true },
  { key: 'expectedActual', label: '预计到手', minWidth: 110, align: 'right', isNumeric: true, draggable: true },
  { key: 'expectedPeriod', label: '预计周期', minWidth: 180, draggable: true },
  { key: 'expectedEndDate', label: '预计交付', minWidth: 110, draggable: true },
  { key: '__actions__', label: '操作', minWidth: 64, align: 'right', draggable: false, sticky: true },
])

// 名称映射
const customerMap = computed(() => new Map(customerStore.customers.map(c => [c.id, c.name])))
const sourceMap = computed(() => new Map(settingsStore.sources.map(s => [s.id, s.name])))
const stageMap = computed(() => new Map(settingsStore.stages.map(s => [s.id, s.name])))
// 来源模板对象（预计到手金额计算用）
const sourceById = computed(() => new Map(settingsStore.sources.map(s => [s.id, s])))
// 客户 → 客户类型（客户类型筛选用）
const customerTypeMap = computed(() => new Map(customerStore.customers.filter(c => c.typeId).map(c => [c.id, c.typeId!])))
// 订单 → 稿件类别集合（列表筛选）
const orderCategoryMap = computed(() => {
  const map = new Map<string, Set<string>>()
  for (const oc of orderStore.orderCategories) {
    if (!map.has(oc.orderId)) map.set(oc.orderId, new Set())
    map.get(oc.orderId)!.add(oc.categoryId)
  }
  return map
})

function customerName(id: string): string { return customerMap.value.get(id) || '—' }
function sourceName(id: string): string { return sourceMap.value.get(id) || '' }
function stageName(id: string): string { return stageMap.value.get(id) || '' }

/**
 * 阶段列展示：完成栏（st-done）订单的实际工作状态是「待付尾款」（收尾款才结单），
 * 阶段名「完成」+ 状态「待付尾款」并列易让人误读为已完成，故合并为「完成 · 待收尾款」。
 */
function stageLabel(row: Order): string {
  const name = stageName(row.currentStage) || '—'
  if (row.orderStatus === 'awaiting_final') return `${name} · 待收尾款`
  return name
}

/** 订单来源模板对象（无来源/未知 → null，手续费按 0 处理，到手即全额） */
function sourceOf(id: string): Source | null { return sourceById.value.get(id) ?? null }

// ===== 金额搜索输入：仅数字 + 保留两位小数（失焦格式化 100 → 100.00） =====
function sanitizeAmountInput(raw: string): string {
  let v = raw.replace(/[^\d.]/g, '')
  const dot = v.indexOf('.')
  if (dot !== -1) {
    v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '')
    const [int, dec] = v.split('.')
    v = `${int}.${(dec ?? '').slice(0, 2)}`
  }
  return v
}

function onAmountInput(e: Event, key: 'min' | 'max') {
  const el = e.target as HTMLInputElement
  el.value = sanitizeAmountInput(el.value)
  if (key === 'min') minAmount.value = el.value
  else maxAmount.value = el.value
}

function onAmountBlur(e: Event, key: 'min' | 'max') {
  const el = e.target as HTMLInputElement
  const num = Number(el.value)
  const formatted = isFinite(num) && num >= 0 ? num.toFixed(2) : ''
  el.value = formatted
  if (key === 'min') minAmount.value = formatted
  else maxAmount.value = formatted
}

function formatDate(value?: string): string {
  if (!value) return '—'
  return value.slice(0, 10)
}

function formatAmount(value: number): string {
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// 筛选 + 搜索 + 排序
const filteredOrders = computed(() => {
  let list = orderStore.activeOrders

  // 状态筛选
  if (statusFilter.value !== 'all') {
    list = list.filter(o => o.orderStatus === statusFilter.value)
  }

  // 关键词搜索
  const kw = keyword.value.trim().toLowerCase()
  if (kw) {
    list = list.filter(o =>
      o.orderNo.toLowerCase().includes(kw) ||
      o.name.toLowerCase().includes(kw) ||
      o.content.toLowerCase().includes(kw) ||
      customerName(o.customerId).toLowerCase().includes(kw),
    )
  }

  // 客户筛选
  if (customerFilter.value !== 'all') {
    list = list.filter(o => o.customerId === customerFilter.value)
  }

  // 客户类型筛选
  if (customerTypeFilter.value !== 'all') {
    const tid = customerTypeFilter.value
    list = list.filter(o => customerTypeMap.value.get(o.customerId) === tid)
  }

  // 来源筛选
  if (sourceFilter.value !== 'all') {
    list = list.filter(o => o.sourceId === sourceFilter.value)
  }

  // 当前阶段筛选（多选：命中任一选中阶段即通过；无阶段的订单不命中）
  if (stageFilter.value.length > 0) {
    list = list.filter(o => !!o.currentStage && stageFilter.value.includes(o.currentStage))
  }

  // 稿件类别筛选（多选：命中任一选中类别即通过；订单可能属于多个类别）
  if (categoryFilter.value.length > 0) {
    list = list.filter(o => {
      const cats = orderCategoryMap.value.get(o.id)
      return !!cats && categoryFilter.value.some(c => cats.has(c))
    })
  }

  // 收款状态筛选（多选：命中任一选中状态即通过）
  if (paymentStatusFilter.value.length > 0) {
    list = list.filter(o => paymentStatusFilter.value.includes(o.paymentStatus))
  }

  // 金额区间筛选
  if (minAmount.value !== '') {
    const min = Number(minAmount.value)
    list = list.filter(o => o.expectedAmount >= min)
  }
  if (maxAmount.value !== '') {
    const max = Number(maxAmount.value)
    list = list.filter(o => o.expectedAmount <= max)
  }

  // 紧急筛选
  if (urgentFilter.value === 'yes') {
    list = list.filter(o => o.isUrgent)
  } else if (urgentFilter.value === 'no') {
    list = list.filter(o => !o.isUrgent)
  }

  // 创建时间筛选
  if (dateFrom.value) {
    list = list.filter(o => o.createdAt.slice(0, 10) >= dateFrom.value)
  }
  if (dateTo.value) {
    list = list.filter(o => o.createdAt.slice(0, 10) <= dateTo.value)
  }

  // 预计交付时间筛选（按自然日比较；未设置预计交付的订单不命中）
  if (expectedDateFrom.value) {
    list = list.filter(o => !!o.expectedEndDate && o.expectedEndDate.slice(0, 10) >= expectedDateFrom.value)
  }
  if (expectedDateTo.value) {
    list = list.filter(o => !!o.expectedEndDate && o.expectedEndDate.slice(0, 10) <= expectedDateTo.value)
  }

  // 排序
  return sortOrders(list, sortKey.value as OrderSortKey, sortDirection.value)
})

watch(() => filteredOrders.value.length, () => {
  const totalPages = computeTotalPages(filteredOrders.value.length, pageSize.value)
  if (currentPage.value > totalPages) currentPage.value = Math.max(1, totalPages)
})

onMounted(async () => {
  await Promise.all([
    orderStore.fetchOrders(),
    orderStore.fetchOrderCategories(),
    customerStore.fetchCustomers(),
    settingsStore.fetchSources(),
    settingsStore.fetchStages(),
    settingsStore.fetchCategories(),
    settingsStore.fetchCustomerTypes(),
  ])
})

function openCreate() {
  editingOrder.value = null
  showForm.value = true
}
function openEdit(order: Order) {
  editingOrder.value = order
  showForm.value = true
}
function closeForm() { showForm.value = false; editingOrder.value = null }

function onSaved() {
  showForm.value = false
  editingOrder.value = null
}

function onReset() {
  keyword.value = ''
  statusFilter.value = 'all'
  sortKey.value = prefs.preferences.listDefaultSortKey
  sortDirection.value = prefs.preferences.listDefaultSortDirection
  customerFilter.value = 'all'
  customerTypeFilter.value = 'all'
  sourceFilter.value = 'all'
  stageFilter.value = []
  categoryFilter.value = []
  paymentStatusFilter.value = []
  minAmount.value = ''
  maxAmount.value = ''
  urgentFilter.value = 'all'
  dateFrom.value = ''
  dateTo.value = ''
  expectedDateFrom.value = ''
  expectedDateTo.value = ''
  currentPage.value = 1
}

function goDetail(id: string) { router.push(`/orders/${id}`) }

// ===== 操作菜单 =====

/**
 * 订单的下一阶段（按 position 顺序）
 * - 无当前阶段 → 待开始 st-pending（从起点开始流转）
 * - st-done（完成/待收尾款）之后是 st-void 退单，不做推进（应收尾款结单）
 * - st-void / completed / voided → 无下一阶段
 */
function nextStage(order: Order): Stage | null {
  const stages = settingsStore.stagesByPosition
  if (!stages.length) return null
  if (!order.currentStage) return stages.find(s => s.id === 'st-pending') || null
  const idx = stages.findIndex(s => s.id === order.currentStage)
  if (idx === -1) return stages.find(s => s.id === 'st-pending') || null
  const next = stages[idx + 1]
  if (!next || next.id === 'st-void') return null
  return next
}

/** 快捷收款（与看板卡片/详情页一致，直接登记到账） */
async function quickPay(order: Order, status: 'deposit_paid' | 'final_paid') {
  await orderStore.updatePaymentStatus(order.id, status)
}

/** 退单（作废）：与看板拖入「退单」列同路径（transitionStage → st-void）。
 * 覆盖看板缺口——已完成订单不在看板，也能在列表直接退单；退单后不可再收款，已收款项在账单模块退款。 */
async function voidOrder(order: Order) {
  if (!window.confirm(`确定退单「${order.name}」吗？\n退单后不可再收款，已收款项可在账单模块退款。`)) return
  await orderStore.transitionStage(order.id, 'st-void')
}

function rowActions(order: Order) {
  const actions: RowAction[] = [
    { label: '详情', icon: Eye, action: () => goDetail(order.id) },
    { label: '编辑', icon: Pencil, action: () => openEdit(order) },
    { label: '编辑排期', icon: CalendarRange, separator: true, action: () => openScheduleEditor(order) },
  ]

  // 流程快捷操作：收款（按当前收款状态，退单不可收款）+ 推进到下一阶段
  const flow: RowAction[] = []
  if (order.orderStatus !== 'voided' && order.paymentStatus === 'unpaid') {
    flow.push({ label: '收定金', icon: HandCoins, separator: true, action: () => quickPay(order, 'deposit_paid') })
  } else if (order.orderStatus !== 'voided' && order.paymentStatus === 'deposit_paid' && order.orderStatus !== 'completed') {
    flow.push({ label: '收尾款', icon: Wallet, separator: true, action: () => quickPay(order, 'final_paid') })
  }
  const next = nextStage(order)
  if (next) {
    flow.push({
      label: `推进到「${next.name}」`,
      icon: ArrowRight,
      action: () => orderStore.transitionStage(order.id, next.id),
    })
  }
  // 退单（作废）：非退单订单可退，与看板拖入「退单」列同路径；退单后不可再收款，已收款项在账单模块退款
  if (order.orderStatus !== 'voided') {
    flow.push({
      label: '退单',
      icon: Ban,
      danger: true,
      separator: true,
      action: () => voidOrder(order),
    })
  }
  actions.push(...flow)
  return actions
}
</script>

<style scoped>
/* 列表页撑满布局：根容器占满内容区高度（height:100%），
   内容区 flex:1 弹性撑满剩余空间，表格卡片随之展开；
   底部间距由 fluid-container 的 padding 提供，避免表格贴底 */
.order-list-root {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  height: 100%;
}

.order-list-inner {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

</style>
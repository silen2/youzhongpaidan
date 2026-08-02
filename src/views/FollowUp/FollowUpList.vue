<template>
  <div class="fluid-container followup-root">
    <div class="followup-inner">
    <PageHeader title="跟进列表" subtitle="管理客户反馈、修改意见等工作笔记" :icon="MessageSquareIcon">
      <template #actions>
        <button class="glass-btn glass-btn-primary" @click="openCreate">
          <Plus class="w-3.5 h-3.5" />
          <span>新建跟进</span>
        </button>
      </template>
    </PageHeader>

    <!-- 高级搜索（同客户列表：玻璃工具栏包裹，提供外边框） -->
    <div class="glass-toolbar followup-toolbar shrink-0">
      <AdvancedSearch
        v-model:keyword="keyword"
        keyword-placeholder="搜索标题 / 内容..."
        v-model:primary-filter="statusFilter"
        primary-filter-all-value="all"
        primary-filter-all-label="全部状态"
        primary-filter-label="状态"
        :primary-filter-options="statusOptions"
        v-model:sort-key="sortKey"
        v-model:sort-direction="sortDirection"
        :sort-options="sortOptions"
        has-advanced-filters
        @reset="onReset"
      >
        <template #advanced>
          <!-- 高级区字段直接使用 AdvancedSearch 的 6 段网格布局（全局 span 2 规则），
               与客户列表一致，不自建额外网格 -->
          <div class="advanced-search-field">
            <label class="glass-label">跟进类型：</label>
            <DropdownSelect
              v-model="typeFilter"
              :options="typeFilterOptions"
              :searchable="false"
              aria-label="跟进类型筛选"
              teleport-to-body
            />
          </div>
          <div class="advanced-search-field">
            <label class="glass-label">优先级：</label>
            <DropdownSelect
              v-model="priorityFilter"
              :options="priorityFilterOptions"
              :searchable="false"
              aria-label="优先级筛选"
              teleport-to-body
            />
          </div>
          <div class="advanced-search-field">
            <label class="glass-label">关联订单：</label>
            <DropdownSelect
              v-model="orderFilter"
              :options="orderFilterOptions"
              searchable
              search-placeholder="搜索订单..."
              aria-label="关联订单筛选"
              teleport-to-body
            />
          </div>
        </template>
      </AdvancedSearch>
    </div>

    <!-- 数据表格（同客户列表：DataTable 自带玻璃卡并弹性撑满） -->
    <DataTable
      :columns="columnDefs"
      :data="filteredFollowUps"
      row-key="id"
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      page-size-storage-key="pagination.followUps.pageSize"
      columns-storage-key="dataTable.columns.followUps"
      :selectable="false"
      :exportable="false"
    >
        <!-- 标题：可跳转关联对象（订单优先，其次客户） -->
        <template #td-title="{ row }">
          <span
            class="cursor-pointer hover:text-[var(--color-accent)]"
            :class="{ 'line-through opacity-60': row.status === 'completed' }"
            @click="goRelated(row)"
          >{{ row.title }}</span>
        </template>

        <!-- 类型：优先模板名（typeId 关联，改名实时反映），兜底旧名称快照 -->
        <template #td-type="{ row }">
          <span class="glass-badge glass-badge-default">{{ followUpTypeName(row) }}</span>
        </template>

        <!-- 优先级 -->
        <template #td-priority="{ row }">
          <span class="glass-badge" :class="priorityBadgeClass(row.priority)">{{ priorityLabel(row.priority) }}</span>
        </template>

        <!-- 关联对象 -->
        <template #td-relation="{ row }">
          <span v-if="row.orderId" class="whitespace-nowrap cursor-pointer hover:text-[var(--color-accent)]" @click="router.push(`/orders/${row.orderId}`)">
            {{ orderNo(row.orderId) }} · {{ orderName(row.orderId) }}
          </span>
          <span v-else-if="row.customerId" class="whitespace-nowrap cursor-pointer hover:text-[var(--color-accent)]" @click="router.push(`/customers/${row.customerId}`)">
            {{ customerName(row.customerId) }}
          </span>
          <span v-else class="text-[var(--color-text-muted)]">—</span>
        </template>

        <!-- 截止日期 -->
        <template #td-dueDate="{ row }">
          <span
            class="whitespace-nowrap"
            :class="{ 'text-[var(--color-danger)] font-medium': isOverdue(row) }"
          >{{ row.dueDate || '—' }}</span>
        </template>

        <!-- 状态 -->
        <template #td-status="{ row }">
          <span class="glass-badge" :class="row.status === 'completed' ? 'glass-badge-success' : 'glass-badge-warning'">
            {{ row.status === 'completed' ? '已完成' : '待处理' }}
          </span>
        </template>

        <!-- 创建时间 -->
        <template #td-createdAt="{ row }">
          <span class="glass-caption whitespace-nowrap">{{ formatDateTime(row.createdAt) }}</span>
        </template>

        <!-- 操作列 -->
        <template #td-__actions__="{ row }">
          <RowActionsMenu :options="rowActions(row)" />
        </template>

        <template #empty>
          暂无跟进记录，点击「新建跟进」添加
        </template>
      </DataTable>

    </div><!-- /.followup-inner -->

    <FollowUpFormModal
      :visible="formVisible"
      :follow-up="editingFollowUp"
      @close="closeForm"
      @saved="onSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, type Component } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, CheckCircle2, RotateCcw, Pencil, Trash2, MessageSquare as MessageSquareIcon } from '@lucide/vue'
import { useOrderStore } from '@/stores/order'
import { useCustomerStore } from '@/stores/customer'
import { useSettingsStore } from '@/stores/settings'
import { usePreferencesStore } from '@/stores/preferences'
import { priorityLabel, priorityBadgeClass } from '@/domain/followup/follow-up'
import PageHeader from '@/components/common/PageHeader.vue'
import AdvancedSearch from '@/components/common/AdvancedSearch.vue'
import DataTable, { type ColumnDef } from '@/components/common/DataTable.vue'
import RowActionsMenu, { type RowAction } from '@/components/common/RowActionsMenu.vue'
import DropdownSelect from '@/components/common/DropdownSelect.vue'
import FollowUpFormModal from './FollowUpFormModal.vue'
import type { FollowUp } from '@/types'

const router = useRouter()
const orderStore = useOrderStore()
const customerStore = useCustomerStore()
const settingsStore = useSettingsStore()
const prefs = usePreferencesStore()

// ===== 搜索 / 筛选 / 排序 =====
const keyword = ref('')
const statusFilter = ref('all')
const typeFilter = ref('all')
const priorityFilter = ref('all')
const orderFilter = ref('all')
const sortKey = ref('dueDate')
const sortDirection = ref<'asc' | 'desc'>('asc')

const statusOptions = [
  { value: 'pending', label: '待处理' },
  { value: 'completed', label: '已完成' },
]
const sortOptions = [
  { value: 'dueDate', label: '截止日期' },
  { value: 'createdAt', label: '创建时间' },
]
const typeFilterOptions = computed(() => [
  { value: 'all', label: '全部类型' },
  ...settingsStore.enabledFollowUpTypes.map(t => ({ value: t.id, label: t.name })),
])
const priorityFilterOptions = [
  { value: 'all', label: '全部优先级' },
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
]
const orderFilterOptions = computed(() => [
  { value: 'all', label: '全部订单' },
  ...orderStore.activeOrders.map(o => ({ value: o.id, label: `${o.orderNo} ${o.name}` })),
])

function onReset() {
  keyword.value = ''
  statusFilter.value = 'all'
  typeFilter.value = 'all'
  priorityFilter.value = 'all'
  orderFilter.value = 'all'
  sortKey.value = 'dueDate'
  sortDirection.value = 'asc'
}

// ===== 过滤 + 排序（默认截止日期升序） =====
const filteredFollowUps = computed(() => {
  let list = orderStore.followUps
  const kw = keyword.value.trim().toLowerCase()
  if (kw) {
    list = list.filter(f =>
      f.title.toLowerCase().includes(kw)
      || (f.content ?? '').toLowerCase().includes(kw),
    )
  }
  if (statusFilter.value !== 'all') list = list.filter(f => f.status === statusFilter.value)
  if (typeFilter.value !== 'all') {
    // 新数据按 typeId 匹配；旧数据（无 typeId）按名称快照匹配
    list = list.filter(f => f.typeId === typeFilter.value || f.type === typeFilter.value)
  }
  if (priorityFilter.value !== 'all') list = list.filter(f => f.priority === priorityFilter.value)
  if (orderFilter.value !== 'all') list = list.filter(f => f.orderId === orderFilter.value)
  return [...list].sort((a, b) => {
    if (sortKey.value === 'dueDate') {
      const da = a.dueDate ?? '9999-12-31'
      const db = b.dueDate ?? '9999-12-31'
      return sortDirection.value === 'asc' ? da.localeCompare(db) : db.localeCompare(da)
    }
    return sortDirection.value === 'asc'
      ? a.createdAt.localeCompare(b.createdAt)
      : b.createdAt.localeCompare(a.createdAt)
  })
})

// ===== 列表列定义 =====
const columnDefs = ref<ColumnDef[]>([
  { key: 'title', label: '标题', minWidth: 200, draggable: true },
  { key: 'type', label: '类型', minWidth: 110, draggable: true },
  { key: 'priority', label: '优先级', minWidth: 90, draggable: true },
  { key: 'relation', label: '关联对象', minWidth: 180, draggable: true },
  { key: 'dueDate', label: '截止日期', minWidth: 110, draggable: true },
  { key: 'status', label: '状态', minWidth: 90, draggable: true },
  { key: 'createdAt', label: '创建时间', minWidth: 140, draggable: true },
  { key: '__actions__', label: '操作', minWidth: 64, align: 'right', draggable: false, sticky: true },
])

// ===== 分页 =====
const currentPage = ref(1)
const pageSize = ref(prefs.preferences.listPageSize)

// ===== 关联对象显示 =====
const customerMap = computed(() => new Map(customerStore.customers.map(c => [c.id, c.name])))
const followUpTypeMap = computed(() => new Map(settingsStore.followUpTypes.map(t => [t.id, t.name])))
function customerName(id: string): string { return customerMap.value.get(id) || '—' }
function orderNo(id: string): string { return orderStore.orders.find(o => o.id === id)?.orderNo ?? '—' }
function orderName(id: string): string { return orderStore.orders.find(o => o.id === id)?.name ?? '—' }
/** 跟进类型显示名：typeId 关联模板（实时反映改名），缺失/停用时回退名称快照 */
function followUpTypeName(f: FollowUp): string {
  return (f.typeId && followUpTypeMap.value.get(f.typeId)) || f.type || '—'
}

function goRelated(f: FollowUp) {
  if (f.orderId) router.push(`/orders/${f.orderId}`)
  else if (f.customerId) router.push(`/customers/${f.customerId}`)
}

// ===== 逾期判断（截止日期早于今天且未完成） =====
function isOverdue(f: FollowUp): boolean {
  if (!f.dueDate || f.status === 'completed') return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(f.dueDate + 'T00:00:00') < today
}

function formatDateTime(value?: string): string {
  if (!value) return '—'
  const d = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ===== 操作 =====
function rowActions(row: FollowUp): RowAction[] {
  const actions: RowAction[] = []
  if (row.status === 'pending') {
    actions.push({ label: '标记完成', icon: CheckCircle2 as Component, action: () => complete(row) })
  } else {
    actions.push({ label: '重新打开', icon: RotateCcw as Component, action: () => reopen(row) })
  }
  actions.push({ label: '编辑', icon: Pencil as Component, action: () => openEdit(row) })
  actions.push({ label: '删除', icon: Trash2 as Component, danger: true, action: () => remove(row) })
  return actions
}

async function complete(row: FollowUp) {
  await orderStore.updateFollowUp(row.id, { status: 'completed' })
}
async function reopen(row: FollowUp) {
  await orderStore.updateFollowUp(row.id, { status: 'pending' })
}
async function remove(row: FollowUp) {
  if (!confirm(`删除跟进「${row.title}」？`)) return
  await orderStore.deleteFollowUp(row.id)
}

// ===== 新建 / 编辑弹窗 =====
const formVisible = ref(false)
const editingFollowUp = ref<FollowUp | null>(null)

function openCreate() {
  editingFollowUp.value = null
  formVisible.value = true
}
function openEdit(row: FollowUp) {
  editingFollowUp.value = row
  formVisible.value = true
}
function closeForm() {
  formVisible.value = false
  editingFollowUp.value = null
}
async function onSaved() {
  closeForm()
  // 保存后详情页时间线与列表同源，无需额外刷新（store 已 fetchFollowUps）
}

onMounted(async () => {
  await Promise.all([
    orderStore.fetchFollowUps(),
    orderStore.fetchOrders(),
    customerStore.fetchCustomers(),
    settingsStore.fetchFollowUpTypes(),
  ])
})
</script>

<style scoped>
/* ===== 跟进列表页：撑满布局（同客户列表标准：root flex 列 → inner 弹性撑满） ===== */
.followup-root {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.followup-inner {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
/* 间距与客户列表一致：PageHeader 自带 margin-bottom，搜索工具栏用 margin-bottom 分隔表格 */
.followup-toolbar {
  margin-bottom: var(--space-section);
}
</style>

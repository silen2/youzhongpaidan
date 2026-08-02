<template>
  <div class="fluid-container customer-list-root">
    <div class="customer-list-inner">
    <PageHeader title="客户列表" subtitle="管理所有客户信息" :icon="UsersIcon">
      <template #actions>
        <button class="glass-btn glass-btn-primary" @click="openCreate">
          <Plus class="w-4 h-4" /> 新建客户
        </button>
      </template>
    </PageHeader>

    <!-- 高级搜索 -->
    <div class="glass-toolbar customer-toolbar shrink-0">
      <AdvancedSearch
        v-model:keyword="keyword"
        v-model:primary-filter="statusFilter"
        v-model:sort-key="sortKey"
        v-model:sort-direction="sortDirection"
        :keyword-placeholder="'搜索名称、平台、QQ、微信...'"
        :primary-filter-all-value="'all'"
        :primary-filter-all-label="'全部'"
        :primary-filter-options="statusOptions"
        primary-filter-label="快捷筛选"
        :sort-options="sortOptions"
        :has-advanced-filters="true"
        @reset="onReset"
      >
        <template #advanced>
          <!-- 高级搜索：客户类型（多选） -->
          <div class="advanced-search-field">
            <label class="glass-label">客户类型：</label>
            <MultiSelect
              v-model="typeFilter"
              :options="typeOptions"
              placeholder="全部类型"
              aria-label="客户类型"
              :max-display="2"
            />
          </div>

          <!-- 高级搜索：平台（多选，来源模板名称） -->
          <div class="advanced-search-field">
            <label class="glass-label">平台：</label>
            <MultiSelect
              v-model="platformFilter"
              :options="platformOptions"
              placeholder="全部平台"
              aria-label="平台"
              :max-display="2"
            />
          </div>

          <!-- 高级搜索：累计消费大于 -->
          <div class="advanced-search-field">
            <label class="glass-label">累计消费大于：</label>
            <input
              v-model="minTotalSpent"
              type="number"
              min="0"
              step="0.01"
              placeholder="金额"
              class="glass-input"
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
        </template>
      </AdvancedSearch>
    </div>

    <!-- 数据表格 -->
    <DataTable
      ref="dataTableRef"
      :columns="columnDefs"
      :data="filteredCustomers"
      row-key="id"
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      page-size-storage-key="pagination.customers.pageSize"
      columns-storage-key="dataTable.columns.customers"
      @selection:change="onSelectionChange"
      @batch-delete="batchDelete"
    >
      <!-- 列定义：名称 -->
      <template #td-name="{ row }">
        <span
          class="cursor-pointer hover:text-[var(--color-accent)]"
          @click="goDetail(row.id)"
        >
          {{ row.name }}
        </span>
      </template>

      <!-- 列定义：客户ID（完整显示，不用省略号；正文字体与表格其他单元格统一） -->
      <template #td-id="{ row }">
        <span :title="row.id">{{ row.id }}</span>
      </template>

      <!-- 列定义：客户类型 -->
      <template #td-typeId="{ row }">
        <span v-if="row.typeId" class="glass-badge glass-badge-primary">{{ typeName(row.typeId) }}</span>
        <span v-else class="glass-caption">—</span>
      </template>

      <!-- 列定义：平台 -->
      <template #td-platform="{ row }">
        <span class="glass-body-sm">{{ row.platform || '—' }}</span>
      </template>

      <!-- 列定义：联系方式 -->
      <template #td-contact="{ row }">
        <span class="glass-body-sm">{{ contactText(row) }}</span>
      </template>

      <!-- 列定义：偏好（长文本省略号 + 悬停完整内容） -->
      <template #td-preference="{ row }">
        <span v-if="row.preference" class="data-table-cell-ellipsis">{{ row.preference }}</span>
        <span v-else class="glass-caption">—</span>
      </template>

      <!-- 列定义：备注（长文本省略号 + 悬停完整内容） -->
      <template #td-notes="{ row }">
        <span v-if="row.notes" class="data-table-cell-ellipsis">{{ row.notes }}</span>
        <span v-else class="glass-caption">—</span>
      </template>

      <!-- 列定义：权重 -->
      <template #td-weight="{ row }">
        <span :class="weightClass(row.weight)">{{ row.weight }}</span>
      </template>

      <!-- 列定义：累计消费 -->
      <template #td-totalSpent="{ row }">
        <span class="text-[var(--color-success)]">{{ prefs.preferences.currencySymbol }}{{ formatAmount(row.totalSpent) }}</span>
      </template>

      <!-- 列定义：最大单 -->
      <template #td-maxOrderAmount="{ row }">
        <span>{{ prefs.preferences.currencySymbol }}{{ formatAmount(row.maxOrderAmount) }}</span>
      </template>

      <!-- 列定义：订单数 -->
      <template #td-orderCount="{ row }">
        <span>{{ row.orderCount }}</span>
      </template>

      <!-- 列定义：已完成 -->
      <template #td-completedCount="{ row }">
        <span class="text-[var(--color-success)]">{{ row.completedCount }}</span>
      </template>

      <!-- 列定义：免单 -->
      <template #td-waivedCount="{ row }">
        <span v-if="row.waivedCount > 0">{{ row.waivedCount }}</span>
        <span v-else class="glass-caption">0</span>
      </template>

      <!-- 列定义：欠款 -->
      <template #td-arrearsCount="{ row }">
        <span v-if="row.arrearsCount > 0" class="text-[var(--color-danger)]">{{ row.arrearsCount }}</span>
        <span v-else class="glass-caption">0</span>
      </template>

      <!-- 列定义：逾期 -->
      <template #td-latePaymentCount="{ row }">
        <span v-if="row.latePaymentCount > 0" class="text-[var(--color-warning)]">{{ row.latePaymentCount }}</span>
        <span v-else class="glass-caption">0</span>
      </template>

      <!-- 列定义：创建时间 -->
      <template #td-createdAt="{ row }">
        <span class="glass-caption whitespace-nowrap">{{ formatDate(row.createdAt) }}</span>
      </template>

      <!-- 列定义：操作（折叠为一个菜单按钮） -->
      <template #td-__actions__="{ row }">
        <div class="flex items-center justify-end">
          <RowActionsMenu :options="rowActions(row)" />
        </div>
      </template>

      <template #empty>
        暂无客户，点击右上角「新建客户」开始吧
      </template>
    </DataTable>

    <CustomerFormModal
      :visible="showForm"
      :customer="editingCustomer"
      @close="closeForm"
      @saved="onSaved"
    />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Users as UsersIcon, Plus, Eye, Pencil, Trash2 } from '@lucide/vue'
import { useCustomerStore } from '@/stores/customer'
import { useSettingsStore } from '@/stores/settings'
import { usePreferencesStore } from '@/stores/preferences'
import { sortCustomers, type CustomerSortKey } from '@/domain/customer/customer-sort'
import { computeTotalPages } from '@/domain/shared/pagination'
import PageHeader from '@/components/common/PageHeader.vue'
import AdvancedSearch from '@/components/common/AdvancedSearch.vue'
import MultiSelect from '@/components/common/MultiSelect.vue'
import DatePicker from '@/components/common/DatePicker.vue'
import DataTable, { type ColumnDef } from '@/components/common/DataTable.vue'
import RowActionsMenu from '@/components/common/RowActionsMenu.vue'
import CustomerFormModal from './CustomerFormModal.vue'
import type { Customer } from '@/types'

const router = useRouter()
const customerStore = useCustomerStore()
const settingsStore = useSettingsStore()
const prefs = usePreferencesStore()

// 排序规则选项（列字段）
const sortOptions = [
  { value: 'weight', label: '权重' },
  { value: 'totalSpent', label: '累计消费' },
  { value: 'maxOrderAmount', label: '最大单' },
  { value: 'orderCount', label: '订单数' },
  { value: 'completedCount', label: '已完成' },
  { value: 'waivedCount', label: '免单' },
  { value: 'arrearsCount', label: '欠款' },
  { value: 'latePaymentCount', label: '逾期' },
  { value: 'createdAt', label: '创建时间' },
]

const keyword = ref('')
// 快捷筛选（主筛选）：全部 / 欠款 / 逾期 / 免单
const statusFilter = ref('all')
// 高级区多选：客户类型 / 平台（空数组 = 不筛选）
const typeFilter = ref<string[]>([])
const platformFilter = ref<string[]>([])
const sortKey = ref('weight')
const sortDirection = ref<'asc' | 'desc'>('desc')
const currentPage = ref(1)
const pageSize = ref(Number(localStorage.getItem('pagination.customers.pageSize')) || prefs.preferences.listPageSize)

// 高级筛选
const minTotalSpent = ref('')
const dateFrom = ref('')
const dateTo = ref('')

const showForm = ref(false)
const editingCustomer = ref<Customer | null>(null)

// 勾选集合（批量删除用）
const dataTableRef = ref<InstanceType<typeof DataTable> | null>(null)
const selectedKeys = ref<string[]>([])

// 快捷筛选选项：按统计字段快速定位问题客户
const statusOptions = [
  { value: 'all', label: '全部' },
  { value: 'arrears', label: '欠款' },
  { value: 'late', label: '逾期' },
  { value: 'waived', label: '免单' },
]

// 类型选项
const typeOptions = computed(() =>
  settingsStore.customerTypes.map(t => ({ value: t.id, label: t.name }))
)

// 平台选项：来源模板名称（客户 platform 字段与其一致），去重
const platformOptions = computed(() =>
  [...new Set(settingsStore.enabledSources.map(s => s.name))].map(name => ({ value: name, label: name })),
)

// 列定义（支持拖拽排序 + 可见性）
const columnDefs = ref<ColumnDef[]>([
  { key: 'id', label: '客户ID', minWidth: 110, draggable: true },
  { key: 'name', label: '名称', minWidth: 140, draggable: true },
  { key: 'typeId', label: '客户类型', minWidth: 100, draggable: true },
  { key: 'platform', label: '平台', minWidth: 90, draggable: true },
  { key: 'contact', label: '联系方式', minWidth: 180, draggable: true },
  { key: 'preference', label: '偏好', minWidth: 140, draggable: true },
  { key: 'notes', label: '备注', minWidth: 140, draggable: true },
  { key: 'weight', label: '权重', minWidth: 70, align: 'right', isNumeric: true, draggable: true },
  { key: 'totalSpent', label: '累计消费', minWidth: 110, align: 'right', isNumeric: true, draggable: true },
  { key: 'maxOrderAmount', label: '最大单', minWidth: 100, align: 'right', isNumeric: true, draggable: true },
  { key: 'orderCount', label: '订单数', minWidth: 80, align: 'right', isNumeric: true, draggable: true },
  { key: 'completedCount', label: '已完成', minWidth: 80, align: 'right', isNumeric: true, draggable: true },
  { key: 'waivedCount', label: '免单', minWidth: 70, align: 'right', isNumeric: true, draggable: true },
  { key: 'arrearsCount', label: '欠款', minWidth: 70, align: 'right', isNumeric: true, draggable: true },
  { key: 'latePaymentCount', label: '逾期', minWidth: 70, align: 'right', isNumeric: true, draggable: true },
  { key: 'createdAt', label: '创建时间', minWidth: 110, draggable: true },
  { key: '__actions__', label: '操作', minWidth: 64, align: 'right', draggable: false, sticky: true },
])

const typeMap = computed(() => new Map(settingsStore.customerTypes.map(t => [t.id, t.name])))
function typeName(id: string): string { return typeMap.value.get(id) || '—' }

function contactText(c: Customer): string {
  return [c.qq, c.wechat, c.email, c.phone].filter(Boolean).join(' / ') || '—'
}

function weightClass(weight: number): string {
  if (weight >= 80) return 'text-[var(--color-success)]'
  if (weight >= 50) return 'text-[var(--color-warning)]'
  return ''
}

function formatDate(value: string): string {
  return value.slice(0, 10)
}

function formatAmount(value: number): string {
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// 筛选 + 搜索 + 排序
const filteredCustomers = computed(() => {
  let list = customerStore.customers

  // 快捷筛选（主筛选）：欠款 / 逾期 / 免单
  if (statusFilter.value === 'arrears') {
    list = list.filter(c => c.arrearsCount > 0)
  } else if (statusFilter.value === 'late') {
    list = list.filter(c => c.latePaymentCount > 0)
  } else if (statusFilter.value === 'waived') {
    list = list.filter(c => c.waivedCount > 0)
  }

  // 客户类型筛选（多选：命中任一选中类型即通过）
  if (typeFilter.value.length > 0) {
    list = list.filter(c => !!c.typeId && typeFilter.value.includes(c.typeId))
  }

  // 平台筛选（多选：命中任一选中平台即通过）
  if (platformFilter.value.length > 0) {
    list = list.filter(c => !!c.platform && platformFilter.value.includes(c.platform))
  }

  // 关键词搜索：覆盖所有可编辑文本字段（名称/平台/主页/联系方式/偏好/备注）
  const kw = keyword.value.trim().toLowerCase()
  if (kw) {
    list = list.filter(c =>
      c.name.toLowerCase().includes(kw) ||
      (c.platform || '').toLowerCase().includes(kw) ||
      (c.platformLink || '').toLowerCase().includes(kw) ||
      (c.qq || '').toLowerCase().includes(kw) ||
      (c.wechat || '').toLowerCase().includes(kw) ||
      (c.email || '').toLowerCase().includes(kw) ||
      (c.phone || '').toLowerCase().includes(kw) ||
      (c.preference || '').toLowerCase().includes(kw) ||
      (c.notes || '').toLowerCase().includes(kw),
    )
  }

  // 累计消费筛选（大于）
  if (minTotalSpent.value !== '') {
    const min = Number(minTotalSpent.value)
    list = list.filter(c => c.totalSpent > min)
  }

  // 创建时间筛选
  if (dateFrom.value) {
    list = list.filter(c => c.createdAt.slice(0, 10) >= dateFrom.value)
  }
  if (dateTo.value) {
    list = list.filter(c => c.createdAt.slice(0, 10) <= dateTo.value)
  }

  // 排序
  return sortCustomers(list, sortKey.value as CustomerSortKey, sortDirection.value)
})

watch(() => filteredCustomers.value.length, () => {
  const totalPages = computeTotalPages(filteredCustomers.value.length, pageSize.value)
  if (currentPage.value > totalPages) currentPage.value = Math.max(1, totalPages)
})

onMounted(async () => {
  await Promise.all([
    customerStore.fetchCustomers(),
    settingsStore.fetchCustomerTypes(),
    // 客户表单「平台」下拉需要来源模板
    settingsStore.fetchSources(),
  ])
})

function openCreate() {
  editingCustomer.value = null
  showForm.value = true
}
function openEdit(customer: Customer) {
  editingCustomer.value = customer
  showForm.value = true
}
function closeForm() { showForm.value = false; editingCustomer.value = null }

function onSaved() {
  showForm.value = false
  editingCustomer.value = null
}

function onReset() {
  keyword.value = ''
  statusFilter.value = 'all'
  typeFilter.value = []
  platformFilter.value = []
  sortKey.value = 'weight'
  sortDirection.value = 'desc'
  minTotalSpent.value = ''
  dateFrom.value = ''
  dateTo.value = ''
  currentPage.value = 1
}

function goDetail(id: string) { router.push(`/customers/${id}`) }

async function remove(customer: Customer) {
  if (!window.confirm(`确定删除客户「${customer.name}」吗？删除后不可恢复。`)) return
  try {
    await customerStore.deleteCustomer(customer.id)
  } catch (e) {
    window.alert(e instanceof Error ? e.message : '删除失败')
  }
}

// ===== 操作菜单 + 批量删除 =====
function rowActions(customer: Customer) {
  return [
    { label: '详情', icon: Eye, action: () => goDetail(customer.id) },
    { label: '编辑', icon: Pencil, action: () => openEdit(customer) },
    { label: '删除', icon: Trash2, danger: true, action: () => remove(customer) },
  ]
}

function onSelectionChange(keys: string[]) {
  selectedKeys.value = keys
}

async function batchDelete() {
  const n = selectedKeys.value.length
  if (n === 0) return
  if (!window.confirm(`确定删除选中的 ${n} 个客户吗？删除后不可恢复。`)) return
  // 逐条删除：有订单的客户会被守卫拦截，单独提示不中断其余删除
  let blocked = 0
  for (const id of selectedKeys.value) {
    try {
      await customerStore.deleteCustomer(id)
    } catch {
      blocked += 1
    }
  }
  if (blocked > 0) {
    window.alert(`其中 ${blocked} 个客户存在关联订单，未删除（请先删除其订单）`)
  }
  selectedKeys.value = []
  dataTableRef.value?.clearSelection()
}
</script>

<style scoped>
.customer-list-root {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  height: 100%;
}

.customer-list-inner {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

/* 搜索工具栏与页头/表格之间的统一段间距（随屏宽放大） */
.customer-toolbar {
  margin-bottom: var(--space-section);
}

/* 偏好/备注长文本：单行省略，悬停由 td 的 title 显示完整内容 */
.data-table-cell-ellipsis {
  display: inline-block;
  max-width: 16rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: bottom;
}
</style>
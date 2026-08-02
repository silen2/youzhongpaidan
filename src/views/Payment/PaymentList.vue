<template>
  <div class="fluid-container payment-root">
    <div class="payment-inner">
      <PageHeader title="账单" subtitle="资金账单：入账 / 出账（退单退款）与待收" :icon="WalletIcon">
        <template #actions>
          <button class="glass-btn glass-btn-primary" @click="openCreate">
            <Plus class="w-4 h-4" /> 新增记录
          </button>
        </template>
      </PageHeader>

      <!-- 顶部统计卡片（需求 5.2.1 + 出账统计） -->
      <div class="stats-grid">
        <div class="glass-card stat-card">
          <div class="glass-card-body stat-body">
            <span class="stat-icon is-success"><Wallet class="w-4 h-4" /></span>
            <div class="stat-main">
              <div class="stat-value text-[var(--color-success)]">{{ formatAmount(stats.monthReceived) }}</div>
              <div class="stat-label">入账（到手）</div>
            </div>
          </div>
        </div>
        <div class="glass-card stat-card">
          <div class="glass-card-body stat-body">
            <span class="stat-icon is-danger"><Undo2 class="w-4 h-4" /></span>
            <div class="stat-main">
              <div class="stat-value text-[var(--color-danger)]">{{ formatAmount(stats.monthRefunded) }}</div>
              <div class="stat-label">出账（退款）</div>
            </div>
          </div>
        </div>
        <div class="glass-card stat-card">
          <div class="glass-card-body stat-body">
            <span class="stat-icon is-accent"><TrendingUp class="w-4 h-4" /></span>
            <div class="stat-main">
              <div class="stat-value">{{ formatAmount(stats.monthNetIncome) }}</div>
              <div class="stat-label">净收入</div>
            </div>
          </div>
        </div>
        <div class="glass-card stat-card">
          <div class="glass-card-body stat-body">
            <span class="stat-icon is-warning"><Clock class="w-4 h-4" /></span>
            <div class="stat-main">
              <div class="stat-value text-[var(--color-warning)]">{{ formatAmount(stats.pendingTotal) }}</div>
              <div class="stat-label">待收总额</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 筛选（账单化：方向主筛选 + 排序 + 高级区 类型/到账日期/金额/订单/客户） -->
      <div class="glass-toolbar shrink-0">
        <AdvancedSearch
          v-model:keyword="keyword"
          v-model:primary-filter="directionFilter"
          v-model:sort-key="sortKey"
          v-model:sort-direction="sortDirection"
          :keyword-placeholder="'搜索账单号、订单编号、名称、客户、备注...'"
          :primary-filter-all-value="'all'"
          :primary-filter-all-label="'全部方向'"
          :primary-filter-options="directionFilterOptions"
          primary-filter-label="方向"
          :sort-options="sortOptions"
          :has-advanced-filters="true"
          @reset="onReset"
        >
          <template #advanced>
            <!-- 高级搜索：收款类型（入账细分：定金/尾款；出账无类型不受影响） -->
            <div class="advanced-search-field">
              <label class="glass-label">收款类型：</label>
              <DropdownSelect
                v-model="typeFilter"
                :options="typeFilterOptions"
                :searchable="false"
                placeholder="全部类型"
                aria-label="收款类型"
                teleport-to-body
              />
            </div>

            <!-- 高级搜索：到账日期范围（DatePicker 支持年月下拉跨月 + 手动输入） -->
            <div class="advanced-search-field">
              <label class="glass-label">到账日期：</label>
              <DatePicker
                range
                v-model:start-value="dateFrom"
                v-model:end-value="dateTo"
                placeholder="选择日期范围"
              />
            </div>

            <!-- 高级搜索：金额范围（最低/最高，可筛大额/小额账单） -->
            <div class="advanced-search-field">
              <label class="glass-label">金额范围：</label>
              <div class="flex items-center gap-2">
                <input
                  :value="amountMin"
                  type="text"
                  inputmode="decimal"
                  placeholder="最低"
                  class="glass-input w-24"
                  @input="onAmountInput($event, 'min')"
                  @blur="onAmountBlur($event, 'min')"
                />
                <span class="glass-caption">~</span>
                <input
                  :value="amountMax"
                  type="text"
                  inputmode="decimal"
                  placeholder="最高"
                  class="glass-input w-24"
                  @input="onAmountInput($event, 'max')"
                  @blur="onAmountBlur($event, 'max')"
                />
              </div>
            </div>

            <!-- 高级搜索：订单 -->
            <div class="advanced-search-field">
              <label class="glass-label">订单：</label>
              <DropdownSelect
                v-model="orderFilter"
                :options="orderFilterOptions"
                searchable
                search-placeholder="搜索订单..."
                placeholder="全部订单"
                aria-label="筛选订单"
                teleport-to-body
              />
            </div>

            <!-- 高级搜索：客户 -->
            <div class="advanced-search-field">
              <label class="glass-label">客户：</label>
              <DropdownSelect
                v-model="customerFilter"
                :options="customerFilterOptions"
                searchable
                search-placeholder="搜索客户..."
                placeholder="全部客户"
                aria-label="筛选客户"
                teleport-to-body
              />
            </div>
          </template>
        </AdvancedSearch>
      </div>

      <!-- 流水列表（需求 5.2.2） -->
      <DataTable
        :columns="columnDefs"
        :data="filteredRecords"
        row-key="id"
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        page-size-storage-key="pagination.payments.pageSize"
        columns-storage-key="dataTable.columns.payments"
      >
        <template #td-receivedAt="{ row }">
          {{ formatDateTime(row.receivedAt) }}
        </template>

        <template #td-recordNo="{ row }">
          <span class="whitespace-nowrap">{{ row.recordNo || '—' }}</span>
        </template>

        <template #td-direction="{ row }">
          <span class="glass-badge" :class="row.direction === 'out' ? 'glass-badge-danger' : 'glass-badge-primary'">
            {{ paymentDirectionLabel(row.direction) }}
          </span>
          <span v-if="isReversed(row)" class="glass-badge glass-badge-warning" title="该笔入账已被红冲，不再计为有效入账">已红冲</span>
        </template>

        <template #td-type="{ row }">
          <span v-if="row.type" class="glass-badge" :class="row.type === 'deposit' ? 'glass-badge-primary' : 'glass-badge-success'">
            {{ paymentTypeLabel(row.type) }}
          </span>
          <span v-else class="text-[var(--color-text-muted)]">—</span>
        </template>

        <template #td-amount="{ row }">
          <span :class="row.direction === 'out' ? 'text-[var(--color-danger)]' : 'text-[var(--color-text)]'">
            {{ row.direction === 'out' ? '−' : '' }}{{ prefs.preferences.currencySymbol }}{{ formatAmount(row.amount) }}
          </span>
        </template>

        <template #td-expected="{ row }">
          <span class="text-[var(--color-text-muted)]">{{ formatExpected(row) }}</span>
        </template>

        <template #td-fee="{ row }">
          <span class="text-[var(--color-text-muted)]" v-if="feeOf(row) > 0">−{{ prefs.preferences.currencySymbol }}{{ formatAmount(feeOf(row)) }}</span>
          <span v-else class="text-[var(--color-text-muted)]">—</span>
        </template>

        <template #td-net="{ row }">
          <!-- 红冲是冲销不是实出，无到手金额 -->
          <span v-if="row.direction === 'out' && row.refundOf" class="text-[var(--color-text-muted)]">—</span>
          <!-- 被红冲的入账：已冲销，有效到手 0 -->
          <span v-else-if="isReversed(row)" class="text-[var(--color-text-muted)]">{{ prefs.preferences.currencySymbol }}0.00</span>
          <span v-else :class="row.direction === 'out' ? 'text-[var(--color-danger)]' : 'text-[var(--color-accent)]'" class="font-medium">
            {{ row.direction === 'out' ? '−' : '' }}{{ prefs.preferences.currencySymbol }}{{ formatAmount(netOf(row)) }}
          </span>
        </template>

        <template #td-orderNo="{ row }">
          <span
            class="cursor-pointer hover:text-[var(--color-accent)]"
            @click="goOrder(row.orderId)"
          >
            {{ orderNo(row.orderId) }}
          </span>
        </template>

        <template #td-orderName="{ row }">
          <span
            class="cursor-pointer hover:text-[var(--color-accent)]"
            @click="goOrder(row.orderId)"
          >
            {{ orderName(row.orderId) }}
          </span>
        </template>

        <template #td-customer="{ row }">
          {{ customerOf(row.orderId) }}
        </template>

        <template #td-notes="{ row }">
          <span v-if="row.notes" class="data-table-cell-ellipsis" :title="row.notes">{{ row.notes }}</span>
          <span v-else class="text-[var(--color-text-muted)]">—</span>
        </template>

        <template #td-__actions__="{ row }">
          <RowActionsMenu :options="rowActions(row)" />
        </template>
      </DataTable>
    </div>

    <!-- 新增/编辑收款记录弹窗 -->
    <PaymentRecordModal
      :visible="showModal"
      :record="editingRecord"
      @close="showModal = false"
      @saved="onSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Wallet as WalletIcon, Plus, Wallet, Clock, TrendingUp, Undo2, Eye, Pencil } from '@lucide/vue'
import { useOrderStore } from '@/stores/order'
import { useCustomerStore } from '@/stores/customer'
import { useSettingsStore } from '@/stores/settings'
import { usePaymentStore } from '@/stores/payment'
import { usePreferencesStore } from '@/stores/preferences'
import { computePaymentStats, paymentTypeLabel, paymentDirectionLabel, PAYMENT_DIRECTIONS, PAYMENT_DIRECTION_LABEL, PAYMENT_RECORD_TYPE_LABEL } from '@/domain/payment/payment-record'
import { calcFee } from '@/domain/order/fee-calculator'
import { sanitizeAmountInput, formatAmountInput } from '@/domain/order/amount-input'
import PageHeader from '@/components/common/PageHeader.vue'
import AdvancedSearch from '@/components/common/AdvancedSearch.vue'
import DropdownSelect from '@/components/common/DropdownSelect.vue'
import DatePicker from '@/components/common/DatePicker.vue'
import DataTable, { type ColumnDef } from '@/components/common/DataTable.vue'
import RowActionsMenu, { type RowAction } from '@/components/common/RowActionsMenu.vue'
import PaymentRecordModal from './PaymentRecordModal.vue'
import type { PaymentRecord } from '@/types'

const router = useRouter()
const orderStore = useOrderStore()
const customerStore = useCustomerStore()
const settingsStore = useSettingsStore()
const paymentStore = usePaymentStore()
const prefs = usePreferencesStore()

const showModal = ref(false)
/** 编辑中的收款记录（null = 新增模式） */
const editingRecord = ref<PaymentRecord | null>(null)
const currentPage = ref(1)
const pageSize = ref(Number(localStorage.getItem('pagination.payments.pageSize')) || prefs.preferences.listPageSize)

// ===== 筛选（账单化：方向主筛选 + 高级区 类型/日期/金额/订单/客户） =====
const keyword = ref('')
/** 方向主筛选：全部/入账/出账（出账无「类型」，方向才是账单核心维度） */
const directionFilter = ref('all')
/** 收款类型（高级区）：'' = 全部；出账账单无类型不受类型筛选影响 */
const typeFilter = ref('')
const amountMin = ref('')
const amountMax = ref('')
const sortKey = ref('receivedAt')
const sortDirection = ref<'asc' | 'desc'>('desc')

/** 本地日期 YYYY-MM-DD（避免 UTC 时区偏移） */
function localDateStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
/** 本月范围：本月 1 号 ~ 今天（默认进入账单页即限定本月，统计卡随之显示本月数据） */
function currentMonthRange(): { from: string; to: string } {
  const now = new Date()
  return { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, to: localDateStr(now) }
}

/** 到账日期范围（DatePicker range），默认本月 */
const dateFrom = ref(currentMonthRange().from)
const dateTo = ref(currentMonthRange().to)
const orderFilter = ref('')
const customerFilter = ref('')

// 方向主筛选选项（入账/出账）
const directionFilterOptions = PAYMENT_DIRECTIONS.map(d => ({ value: d, label: PAYMENT_DIRECTION_LABEL[d] }))
// 收款类型选项（高级区，入账细分：定金/尾款）
const typeFilterOptions = Object.entries(PAYMENT_RECORD_TYPE_LABEL).map(([value, label]) => ({ value, label }))

// 排序选项：跟随流水字段
const sortOptions = [
  { value: 'receivedAt', label: '到账日期' },
  { value: 'amount', label: '金额' },
  { value: 'type', label: '类型' },
]

const orderFilterOptions = computed(() => [
  { value: '', label: '全部订单' },
  ...orderStore.orders.map(o => ({ value: o.id, label: `${o.orderNo} ${o.name}` })),
])

const customerFilterOptions = computed(() => [
  { value: '', label: '全部客户' },
  ...customerStore.customers.map(c => ({ value: c.id, label: c.name })),
])

function onReset() {
  keyword.value = ''
  directionFilter.value = 'all'
  typeFilter.value = ''
  amountMin.value = ''
  amountMax.value = ''
  sortKey.value = 'receivedAt'
  sortDirection.value = 'desc'
  // 重置 = 清空所有搜索项（含默认携带的「本月」日期范围），回到无筛选、显示全部账单
  dateFrom.value = ''
  dateTo.value = ''
  orderFilter.value = ''
  customerFilter.value = ''
}

// ===== 金额范围输入（复用共享清洗/格式化） =====
function onAmountInput(e: Event, key: 'min' | 'max') {
  const el = e.target as HTMLInputElement
  el.value = sanitizeAmountInput(el.value)
  if (key === 'min') amountMin.value = el.value
  else amountMax.value = el.value
}

function onAmountBlur(e: Event, key: 'min' | 'max') {
  const el = e.target as HTMLInputElement
  const formatted = formatAmountInput(el.value)
  el.value = formatted
  if (key === 'min') amountMin.value = formatted
  else amountMax.value = formatted
}

// ===== 列定义（需求 5.2.2 字段 + 方向/收款单号/订单编号/预计对照） =====
const columnDefs = ref<ColumnDef[]>([
  { key: 'recordNo', label: '账单号', minWidth: 110, draggable: true },
  { key: 'receivedAt', label: '到账时间', minWidth: 130, draggable: true },
  { key: 'direction', label: '方向', minWidth: 80, draggable: true },
  { key: 'amount', label: '金额', minWidth: 100, align: 'right', isNumeric: true, draggable: true },
  { key: 'expected', label: '预计', minWidth: 90, align: 'right', isNumeric: true, draggable: true },
  { key: 'fee', label: '手续费', minWidth: 90, align: 'right', isNumeric: true, draggable: true },
  { key: 'net', label: '到手金额', minWidth: 110, align: 'right', isNumeric: true, draggable: true },
  { key: 'orderNo', label: '订单编号', minWidth: 130, draggable: true },
  { key: 'orderName', label: '订单名称', minWidth: 140, draggable: true },
  { key: 'customer', label: '客户', minWidth: 110, draggable: true },
  { key: 'type', label: '类型', minWidth: 80, draggable: true },
  { key: 'notes', label: '备注', minWidth: 140, draggable: true },
  { key: '__actions__', label: '操作', minWidth: 64, align: 'right', draggable: false, sticky: true },
])

// ===== 数据派生 =====
const orderMap = computed(() => new Map(orderStore.orders.map(o => [o.id, o])))
const customerMap = computed(() => new Map(customerStore.customers.map(c => [c.id, c])))
const sourceMap = computed(() => new Map(settingsStore.sources.map(s => [s.id, s])))

function orderOf(orderId: string) { return orderMap.value.get(orderId) }

/** 已被红冲的入账 id 集合（红冲记录 refundOf 指向它们），用于给原入账单打「已红冲」标记 */
const reversedInIds = computed(() =>
  new Set(paymentStore.records.filter(r => r.direction === 'out' && r.refundOf).map(r => r.refundOf as string)),
)
function isReversed(record: PaymentRecord): boolean {
  return !!record.id && reversedInIds.value.has(record.id)
}
function customerOf(orderId: string) {
  const o = orderOf(orderId)
  if (!o) return '—'
  return customerMap.value.get(o.customerId)?.name ?? '—'
}
function orderNo(orderId: string) {
  const o = orderOf(orderId)
  return o ? o.orderNo : '—'
}
function orderName(orderId: string) {
  const o = orderOf(orderId)
  return o ? o.name : '—'
}
/** 该笔账单对应订单的预计金额（定金 → depositExpected / 尾款 → finalExpected），对照实收；出账显示 — */
function expectedOf(record: PaymentRecord): number {
  if (record.direction === 'out') return 0
  const o = orderOf(record.orderId)
  if (!o) return 0
  return record.type === 'deposit' ? o.depositExpected : o.finalExpected
}
function formatExpected(record: PaymentRecord): string {
  if (record.direction === 'out') return '—'
  const o = orderOf(record.orderId)
  if (!o) return '—'
  return `${prefs.preferences.currencySymbol}${expectedOf(record).toFixed(2)}`
}
function feeOf(record: PaymentRecord): number {
  // 出账（退款/红冲）与被红冲的入账均不产生/不保留手续费
  if (record.direction === 'out' || isReversed(record)) return 0
  const o = orderOf(record.orderId)
  const source = o ? sourceMap.value.get(o.sourceId) : undefined
  return calcFee(record.amount, source).feeAmount
}
function netOf(record: PaymentRecord): number {
  // 手动退款出账：实出全额（不退手续费）
  if (record.direction === 'out') return record.amount
  // 被红冲的入账：已冲销，有效到手 0
  if (isReversed(record)) return 0
  const o = orderOf(record.orderId)
  const source = o ? sourceMap.value.get(o.sourceId) : undefined
  return calcFee(record.amount, source).actualAmount
}

// ===== 顶部统计（需求 5.2.1，入账/出账/净收入跟随筛选结果——所见即所得） =====
const stats = computed(() => {
  // 待收总额是全局应收快照：入账/出账按筛选的账单记录统计；
  // 待收覆盖「已产生账单的订单」+「尚未收过款的待收订单」——
  // 未收过款的订单不会产生账单记录，若只统计有账单的订单，新建待收订单的待收金额恒为 0。
  const orderIds = new Set(filteredRecords.value.map(r => r.orderId))
  const involvedOrders = orderStore.orders.filter(o =>
    orderIds.has(o.id) || (o.orderStatus !== 'completed' && o.orderStatus !== 'voided'),
  )
  return computePaymentStats(
    filteredRecords.value,
    involvedOrders,
    (sourceId) => {
      if (!sourceId) return null
      return sourceMap.value.get(sourceId) ?? null
    },
    null,
  )
})

// ===== 筛选 + 搜索 + 排序 =====
const filteredRecords = computed(() => {
  let list = paymentStore.records

  // 方向主筛选（入账/出账）
  if (directionFilter.value !== 'all') {
    list = list.filter(r => r.direction === directionFilter.value)
  }

  // 收款类型（高级区，入账细分；出账无类型不命中）
  if (typeFilter.value !== '') {
    list = list.filter(r => r.type === typeFilter.value)
  }

  // 全局搜索：账单号 / 订单编号 / 订单名称 / 客户名 / 备注
  const kw = keyword.value.trim().toLowerCase()
  if (kw) {
    list = list.filter((r) => {
      const o = orderOf(r.orderId)
      const c = o ? customerMap.value.get(o.customerId) : undefined
      return (
        (r.recordNo || '').toLowerCase().includes(kw) ||
        (o?.orderNo || '').toLowerCase().includes(kw) ||
        (o?.name || '').toLowerCase().includes(kw) ||
        (c?.name || '').toLowerCase().includes(kw) ||
        (r.notes || '').toLowerCase().includes(kw)
      )
    })
  }

  // 到账日期范围
  if (dateFrom.value) {
    list = list.filter(r => r.receivedAt.slice(0, 10) >= dateFrom.value)
  }
  if (dateTo.value) {
    list = list.filter(r => r.receivedAt.slice(0, 10) <= dateTo.value)
  }

  // 金额范围（最低/最高）
  if (amountMin.value !== '') {
    const min = Number(amountMin.value)
    if (isFinite(min)) list = list.filter(r => r.amount >= min)
  }
  if (amountMax.value !== '') {
    const max = Number(amountMax.value)
    if (isFinite(max)) list = list.filter(r => r.amount <= max)
  }

  // 订单 / 客户筛选
  if (orderFilter.value) {
    list = list.filter(r => r.orderId === orderFilter.value)
  }
  if (customerFilter.value) {
    list = list.filter(r => orderOf(r.orderId)?.customerId === customerFilter.value)
  }

  // 排序
  return [...list].sort((a, b) => {
    let cmp = 0
    if (sortKey.value === 'amount') {
      cmp = a.amount - b.amount
    } else if (sortKey.value === 'type') {
      cmp = (a.type ?? '').localeCompare(b.type ?? '')
    } else {
      cmp = a.receivedAt.localeCompare(b.receivedAt)
    }
    return sortDirection.value === 'asc' ? cmp : -cmp
  })
})

watch(() => filteredRecords.value.length, () => {
  const totalPages = Math.max(1, Math.ceil(filteredRecords.value.length / pageSize.value))
  if (currentPage.value > totalPages) currentPage.value = totalPages
})

// ===== 操作 =====
function openCreate() {
  editingRecord.value = null
  showModal.value = true
}

function openEdit(record: PaymentRecord) {
  editingRecord.value = record
  showModal.value = true
}

function rowActions(record: PaymentRecord) {
  const actions: RowAction[] = [
    {
      label: '详情',
      icon: Eye,
      action: () => goOrder(record.orderId),
    },
  ]
  // 入账可编辑、可红冲（冲销）；出账不可再冲销
  if (record.direction !== 'out') {
    actions.push(
      {
        label: '编辑',
        icon: Pencil,
        action: () => openEdit(record),
      },
      {
        label: '红冲',
        icon: Undo2,
        danger: true,
        action: async () => {
          if (!confirm(`确定红冲该笔入账？\n将生成一条金额相同的出账账单冲销，原账单保留`)) return
          await paymentStore.reversePaymentRecord(record.id)
          // 入账被冲销后订单收款状态回滚，刷新订单/客户缓存
          await Promise.all([orderStore.fetchOrders(), customerStore.fetchCustomers()])
        },
      },
    )
  }
  // 手动退款出账可撤销（误录退款时恢复订单可退金额）；红冲生成的出账保留审计痕迹
  if (record.direction === 'out' && !record.refundOf) {
    actions.push({
      label: '撤销退款',
      icon: Undo2,
      danger: true,
      action: async () => {
        if (!confirm(`确定撤销该笔退款？\n将删除该出账记录，订单可退金额恢复`)) return
        await paymentStore.deleteRefundRecord(record.id)
      },
    })
  }
  return actions
}

function goOrder(orderId: string) {
  router.push(`/orders/${orderId}`)
}

async function onSaved() {
  showModal.value = false
  await Promise.all([
    orderStore.fetchOrders(),
    customerStore.fetchCustomers(),
    settingsStore.fetchSources(),
  ])
}

/** 到账时间：YYYY-MM-DD HH:mm（本地时区） */
function formatDateTime(value: string): string {
  if (!value) return '—'
  const d = new Date(value)
  if (isNaN(d.getTime())) return value.slice(0, 10)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatAmount(value: number): string {
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

onMounted(async () => {
  await Promise.all([
    paymentStore.fetchPaymentRecords(),
    orderStore.fetchOrders(),
    customerStore.fetchCustomers(),
    settingsStore.fetchSources(),
  ])
})
</script>

<style scoped>
/* ===== 撑满布局（同客户/订单列表） ===== */
.payment-root {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.payment-inner {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
/* 间距统一：PageHeader 自带 margin-bottom: var(--space-section)；
   后续区块各用 margin-bottom 承接，避免 flex gap 与 header margin 叠加翻倍 */
.payment-inner .stats-grid {
  margin-bottom: var(--space-section);
}
.payment-inner .glass-toolbar {
  margin-bottom: var(--space-section);
}

/* ===== 统计卡片（需求 5.2.1，实收口径四卡） ===== */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  gap: var(--space-4);
}
.stat-card {
  position: relative;
  overflow: hidden;
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s ease, border-color 0.2s ease;
}
/* 卡片顶部装饰渐变线（呼应列头/标题语言） */
.stat-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 15%;
  right: 15%;
  height: 2px;
  border-radius: 2px;
  background: linear-gradient(90deg, transparent, var(--color-accent-glow), transparent);
  opacity: 0.45;
  pointer-events: none;
  transition: opacity 0.2s ease;
}
/* 卡片右上角装饰光斑（玻璃拟态层次） */
.stat-card::after {
  content: '';
  position: absolute;
  top: -2.5rem;
  right: -2.5rem;
  width: 6.5rem;
  height: 6.5rem;
  border-radius: 50%;
  background: radial-gradient(circle, var(--color-accent-glow), transparent 70%);
  opacity: 0.25;
  pointer-events: none;
  transition: opacity 0.2s ease;
}
.stat-card:hover {
  transform: translateY(-3px);
  border-color: var(--color-accent-glow);
  box-shadow: var(--shadow-glass-hover), 0 0 16px var(--color-accent-glow);
}
.stat-card:hover::before,
.stat-card:hover::after {
  opacity: 0.6;
}
.stat-body {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  position: relative;
  z-index: 1;
}
.stat-icon {
  display: grid;
  place-items: center;
  width: 3rem;
  height: 3rem;
  flex-shrink: 0;
  border-radius: var(--radius-lg);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.stat-card:hover .stat-icon {
  transform: scale(1.08) rotate(-4deg);
}
.stat-icon.is-success {
  background: linear-gradient(135deg, var(--color-success-soft), transparent);
  color: var(--color-success);
  box-shadow: inset 0 0 0 1px var(--color-success), inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 0 10px var(--color-success-soft);
}
.stat-icon.is-warning {
  background: linear-gradient(135deg, var(--color-warning-soft), transparent);
  color: var(--color-warning);
  box-shadow: inset 0 0 0 1px var(--color-warning), inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 0 10px var(--color-warning-soft);
}
.stat-icon.is-danger {
  background: linear-gradient(135deg, var(--color-danger-soft), transparent);
  color: var(--color-danger);
  box-shadow: inset 0 0 0 1px var(--color-danger), inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 0 10px var(--color-danger-soft);
}
.stat-icon.is-accent {
  background: linear-gradient(135deg, var(--color-accent-soft), transparent);
  color: var(--color-accent);
  box-shadow: inset 0 0 0 1px var(--color-accent), inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 0 10px var(--color-accent-glow);
}
.stat-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.stat-value {
  font-size: clamp(1.1rem, 1rem + 0.4vw, 1.5rem);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  text-shadow: 0 0 14px var(--color-accent-glow);
}
.stat-label {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-top: 0.15rem;
  letter-spacing: 0.02em;
}
</style>

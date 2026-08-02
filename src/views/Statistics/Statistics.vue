<template>
  <div class="fluid-container stats-root">
    <PageHeader title="统计分析" subtitle="收入、订单、客户与交付的全局业务报表" :icon="BarChart3Icon" />

    <!-- 全局时间范围控件：快捷预设 + 自定义区间 + 导出 -->
    <div class="glass-toolbar stats-toolbar shrink-0">
      <div class="stats-range-chips">
        <button
          v-for="opt in RANGE_PRESETS"
          :key="opt.value"
          type="button"
          class="stats-range-chip"
          :class="{ 'is-active': rangePreset === opt.value }"
          @click="setPreset(opt.value)"
        >{{ opt.label }}</button>
      </div>
      <div v-if="rangePreset === 'custom'" class="stats-custom-range">
        <DatePicker v-model:start-value="customStart" v-model:end-value="customEnd" range placeholder="选择起止日期" />
      </div>
      <span class="stats-range-label">{{ range.start }} ~ {{ range.end }}</span>
      <button type="button" class="glass-btn glass-btn-sm stats-export-btn" @click="exportCsv">
        <Download class="w-3.5 h-3.5" />
        <span>导出 CSV</span>
      </button>
    </div>

    <!-- KPI 指标卡（实收到手口径） -->
    <div class="stats-grid">
      <div class="glass-card stat-card">
        <div class="glass-card-body stat-body">
          <span class="stat-icon is-success"><Wallet class="w-4 h-4" /></span>
          <div class="stat-main">
            <div class="stat-value text-[var(--color-success)]">{{ formatAmount(incomeStats.totalIncome) }}</div>
            <div class="stat-label">本期收入（到手）</div>
          </div>
        </div>
      </div>
      <div class="glass-card stat-card">
        <div class="glass-card-body stat-body">
          <span class="stat-icon is-danger"><Undo2 class="w-4 h-4" /></span>
          <div class="stat-main">
            <div class="stat-value text-[var(--color-danger)]">{{ formatAmount(incomeStats.totalRefunded) }}</div>
            <div class="stat-label">本期退款</div>
          </div>
        </div>
      </div>
      <div class="glass-card stat-card">
        <div class="glass-card-body stat-body">
          <span class="stat-icon is-info"><HandCoins class="w-4 h-4" /></span>
          <div class="stat-main">
            <div class="stat-value text-[var(--color-info)]">{{ formatAmount(pendingTotal) }}</div>
            <div class="stat-label">待收总额（当前）</div>
          </div>
        </div>
      </div>
      <div class="glass-card stat-card">
        <div class="glass-card-body stat-body">
          <span class="stat-icon is-accent"><Plus class="w-4 h-4" /></span>
          <div class="stat-main">
            <div class="stat-value">{{ orderStats.createdCount }}</div>
            <div class="stat-label">本期新建订单</div>
          </div>
        </div>
      </div>
      <div class="glass-card stat-card">
        <div class="glass-card-body stat-body">
          <span class="stat-icon is-warning"><CheckCircle2 class="w-4 h-4" /></span>
          <div class="stat-main">
            <div class="stat-value text-[var(--color-warning)]">{{ orderStats.completedCount }}</div>
            <div class="stat-label">本期结单</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ① 收入分析 -->
    <section class="glass-card stats-section">
      <div class="glass-card-header">
        <div class="glass-card-title-group">
          <span class="glass-card-title-icon"><TrendingUp class="w-4 h-4" /></span>
          <h2 class="glass-card-title">收入分析</h2>
        </div>
      </div>
      <div class="stats-chart-grid">
        <div class="stats-chart-panel">
          <div class="stats-chart-head">
            <h3 class="stats-chart-title">收入构成趋势</h3>
            <div class="stats-granularity-chips">
              <button
                v-for="g in GRANULARITY_OPTS"
                :key="g.value"
                type="button"
                class="stats-gran-chip"
                :class="{ 'is-active': granularityOverride === g.value }"
                @click="granularityOverride = g.value"
              >{{ g.label }}</button>
            </div>
          </div>
          <EChart :option="incomeTrendOption" aspectRatio="2 / 1" />
        </div>
        <div class="stats-chart-panel">
          <div class="stats-chart-head">
            <h3 class="stats-chart-title">接单来源构成</h3>
          </div>
          <EChart :option="sourceOption" aspectRatio="2 / 1" />
        </div>
      </div>
    </section>

    <!-- ② 支付分析 -->
    <section class="glass-card stats-section">
      <div class="glass-card-header">
        <div class="glass-card-title-group">
          <span class="glass-card-title-icon"><Banknote class="w-4 h-4" /></span>
          <h2 class="glass-card-title">支付分析</h2>
        </div>
      </div>
      <div class="stats-chart-grid">
        <div class="stats-chart-panel">
          <h3 class="stats-chart-title">收付趋势</h3>
          <EChart :option="paymentTrendOption" aspectRatio="2 / 1" />
        </div>
        <div class="stats-chart-panel">
          <h3 class="stats-chart-title">收付类型构成</h3>
          <EChart :option="paymentTypeOption" aspectRatio="2 / 1" />
        </div>
        <div class="stats-chart-panel">
          <h3 class="stats-chart-title">收款状态构成</h3>
          <EChart :option="paymentStatusOption" aspectRatio="2 / 1" />
        </div>
        <div class="stats-chart-panel">
          <div class="stats-chart-head">
            <h3 class="stats-chart-title">待收账款排行</h3>
            <span class="glass-badge glass-badge-muted" v-if="pendingTotalCount > 10">共 {{ pendingTotalCount }} 位 · 待收 TOP10</span>
          </div>
          <EChart :option="pendingOption" aspectRatio="2 / 1" />
        </div>
      </div>
    </section>

    <!-- ② 订单分析 -->
    <section class="glass-card stats-section">
      <div class="glass-card-header">
        <div class="glass-card-title-group">
          <span class="glass-card-title-icon"><ClipboardList class="w-4 h-4" /></span>
          <h2 class="glass-card-title">订单分析</h2>
          <span class="glass-badge glass-badge-warning" v-if="orderStats.urgentCount > 0">紧急 {{ orderStats.urgentCount }} 单</span>
        </div>
      </div>
      <div class="stats-chart-grid">
        <div class="stats-chart-panel">
          <div class="stats-chart-head">
            <h3 class="stats-chart-title">订单量趋势</h3>
            <div class="stats-granularity-chips">
              <button
                v-for="g in GRANULARITY_OPTS"
                :key="g.value"
                type="button"
                class="stats-gran-chip"
                :class="{ 'is-active': granularityOverride === g.value }"
                @click="granularityOverride = g.value"
              >{{ g.label }}</button>
            </div>
          </div>
          <EChart :option="orderTrendOption" aspectRatio="2 / 1" />
        </div>
        <div class="stats-chart-panel">
          <h3 class="stats-chart-title">订单状态构成</h3>
          <EChart :option="orderStatusOption" aspectRatio="2 / 1" />
        </div>
        <div class="stats-chart-panel">
          <h3 class="stats-chart-title">订单金额构成</h3>
          <EChart :option="orderAmountOption" aspectRatio="2 / 1" />
        </div>
        <div class="stats-chart-panel">
          <div class="stats-chart-head">
            <h3 class="stats-chart-title">订单金额分布</h3>
            <label class="stats-step-control">
              <input v-model.number="amountStep" name="stats-amount-step" type="number" min="1" step="100" class="stats-step-input" @change="onAmountStepChange" />
              <span class="stats-step-unit">元/档</span>
            </label>
          </div>
          <EChart :option="orderAmountRangeOption" aspectRatio="2 / 1" />
        </div>
      </div>
    </section>

    <!-- ③ 客户分析 -->
    <section class="glass-card stats-section">
      <div class="glass-card-header">
        <div class="glass-card-title-group">
          <span class="glass-card-title-icon"><Users class="w-4 h-4" /></span>
          <h2 class="glass-card-title">客户分析</h2>
        </div>
      </div>
      <div class="stats-chart-grid">
        <div class="stats-chart-panel">
          <div class="stats-chart-head">
            <h3 class="stats-chart-title">客户收入排行</h3>
            <span class="glass-badge glass-badge-muted" v-if="rankTotal > 10">共 {{ rankTotal }} 位 · 收入 TOP10</span>
          </div>
          <EChart :option="customerRankOption" aspectRatio="2 / 1" />
        </div>
        <div class="stats-chart-panel">
          <h3 class="stats-chart-title">客户价值矩阵</h3>
          <EChart :option="valueMatrixOption" aspectRatio="2 / 1" />
        </div>
      </div>
    </section>

    <!-- ④ 交付分析 -->
    <section class="glass-card stats-section">
      <div class="glass-card-header">
        <div class="glass-card-title-group">
          <span class="glass-card-title-icon"><Timer class="w-4 h-4" /></span>
          <h2 class="glass-card-title">交付分析</h2>
        </div>
      </div>
      <div class="stats-chart-grid">
        <div class="stats-chart-panel">
          <h3 class="stats-chart-title">按期交付率</h3>
          <EChart :option="deliveryOption" aspectRatio="2 / 1" />
        </div>
        <div class="stats-chart-panel">
          <h3 class="stats-chart-title">按期交付趋势</h3>
          <EChart :option="deliveryTrendOption" aspectRatio="2 / 1" />
        </div>
        <div class="stats-chart-panel">
          <h3 class="stats-chart-title">阶段耗时分布</h3>
          <EChart :option="stageDurationOption" aspectRatio="2 / 1" />
        </div>
        <div class="stats-chart-panel">
          <h3 class="stats-chart-title">订单耗时明细</h3>
          <EChart :option="orderDurationOption" aspectRatio="2 / 1" />
        </div>
      </div>
    </section>

    <!-- ⑤ 账款异常（欠款 / 免单） -->
    <section class="glass-card stats-section">
      <div class="glass-card-header">
        <div class="glass-card-title-group">
          <span class="glass-card-title-icon"><AlertTriangle class="w-4 h-4" /></span>
          <h2 class="glass-card-title">账款异常</h2>
          <span class="glass-badge glass-badge-muted">区间内创建的欠款 / 免单订单</span>
        </div>
      </div>
      <div class="stats-mini-grid">
        <div class="stats-mini-card">
          <div class="stats-mini-value text-[var(--color-danger)]">{{ debt.summary.arrearsCustomerCount }}</div>
          <div class="stats-mini-label">欠款客户</div>
        </div>
        <div class="stats-mini-card">
          <div class="stats-mini-value text-[var(--color-danger)]">{{ formatAmount(debt.summary.arrearsTotal) }}</div>
          <div class="stats-mini-label">欠款总额</div>
        </div>
        <div class="stats-mini-card">
          <div class="stats-mini-value text-[var(--color-warning)]">{{ debt.summary.waivedCustomerCount }}</div>
          <div class="stats-mini-label">免单客户</div>
        </div>
        <div class="stats-mini-card">
          <div class="stats-mini-value text-[var(--color-warning)]">{{ formatAmount(debt.summary.waivedTotal) }}</div>
          <div class="stats-mini-label">免单金额（原价）</div>
        </div>
      </div>
      <div class="stats-chart-grid">
        <div class="stats-chart-panel">
          <h3 class="stats-chart-title">客户欠款汇总</h3>
          <EChart :option="arrearsCustomersOption" aspectRatio="2 / 1" />
        </div>
        <div class="stats-chart-panel">
          <h3 class="stats-chart-title">客户免单汇总</h3>
          <EChart :option="waivedCustomersOption" aspectRatio="2 / 1" />
        </div>
        <div class="stats-chart-panel">
          <h3 class="stats-chart-title">欠款订单明细</h3>
          <EChart :option="arrearsOrdersOption" aspectRatio="2 / 1" />
        </div>
        <div class="stats-chart-panel">
          <h3 class="stats-chart-title">免单订单明细</h3>
          <EChart :option="waivedOrdersOption" aspectRatio="2 / 1" />
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  BarChart3 as BarChart3Icon,
  Wallet,
  Undo2,
  Plus,
  CheckCircle2,
  TrendingUp,
  ClipboardList,
  Users,
  Timer,
  HandCoins,
  Download,
  AlertTriangle,
  Banknote,
} from '@lucide/vue'
import { useOrderStore } from '@/stores/order'
import { usePaymentStore } from '@/stores/payment'
import { useCustomerStore } from '@/stores/customer'
import { useSettingsStore } from '@/stores/settings'
import { usePreferencesStore } from '@/stores/preferences'
import PageHeader from '@/components/common/PageHeader.vue'
import DatePicker from '@/components/common/DatePicker.vue'
import EChart, { type EChartOption } from '@/components/common/EChart.vue'
import {
  buildStatsRange,
  guessGranularity,
  splitRangeByGranularity,
  dateInRange,
  type StatsRangePreset,
} from '@/domain/statistics/date-range'
import {
  computeIncomeStats,
  aggregateIncomeTrend,
  aggregateIncomeTrendByType,
  aggregateIncomeBySource,
} from '@/domain/statistics/income'
import {
  computeOrderStats,
  aggregateOrderAmountRange,
} from '@/domain/statistics/order-stats'
import {
  aggregateCustomerIncome,
} from '@/domain/statistics/customer-stats'
import { computeDeliveryStats, aggregateDeliveryTrend } from '@/domain/statistics/delivery'
import { aggregateStageDuration, aggregateOrderDurations } from '@/domain/statistics/stage-duration'
import { aggregateCustomerValue } from '@/domain/statistics/customer-value'
import { computeArrearsWaived } from '@/domain/statistics/arrears-waived'
import {
  aggregatePaymentTypeDist,
  aggregatePaymentStatusDist,
  aggregatePendingByCustomer,
} from '@/domain/statistics/payment-stats'
import { computePaymentStats } from '@/domain/payment/payment-record'
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from '@/constants/order-labels'
import type { OrderStatus, PaymentStatus } from '@/types'

const orderStore = useOrderStore()
const paymentStore = usePaymentStore()
const customerStore = useCustomerStore()
const settingsStore = useSettingsStore()
const preferencesStore = usePreferencesStore()

const RANGE_PRESETS: { value: StatsRangePreset; label: string }[] = [
  { value: 'this-month', label: '本月' },
  { value: 'last-month', label: '上月' },
  { value: 'last-3-months', label: '近3月' },
  { value: 'last-12-months', label: '近12月' },
  { value: 'this-year', label: '今年' },
  { value: 'custom', label: '自定义' },
]

/** 收入趋势粒度切换（auto = 按区间自动猜测） */
const GRANULARITY_OPTS: { value: 'auto' | 'day' | 'week' | 'month'; label: string }[] = [
  { value: 'auto', label: '自动' },
  { value: 'day', label: '按天' },
  { value: 'week', label: '按周' },
  { value: 'month', label: '按月' },
]

// ===== 时间范围 =====
const rangePreset = ref<StatsRangePreset>('this-month')
const customStart = ref('')
const customEnd = ref('')

function setPreset(value: StatsRangePreset) {
  rangePreset.value = value
}

const range = computed(() => buildStatsRange(rangePreset.value, customStart.value, customEnd.value))
const granularityOverride = ref<'auto' | 'day' | 'week' | 'month'>('auto')
const granularity = computed(() => {
  if (granularityOverride.value !== 'auto') return granularityOverride.value
  return guessGranularity(range.value)
})
const buckets = computed(() => splitRangeByGranularity(range.value, granularity.value))
const granularityLabel = computed(() =>
  granularity.value === 'month' ? '按月' : granularity.value === 'week' ? '按周' : '按天',
)

// ===== 数据源（store 全量数据，聚合函数内部按范围过滤） =====
const orders = computed(() => orderStore.orders)
const records = computed(() => paymentStore.records)
const customers = computed(() => customerStore.customers)
const sourceMap = computed(() => new Map(settingsStore.sources.map(s => [s.id, s])))
const sourceOf = (sourceId: string | undefined) => {
  const s = sourceId ? sourceMap.value.get(sourceId) : undefined
  return s ? { feeType: s.feeType, feeValue: s.feeValue } : null
}

// ===== 聚合结果 =====
const incomeStats = computed(() => computeIncomeStats(records.value, orders.value, sourceOf, range.value))
const orderStats = computed(() => computeOrderStats(orders.value, range.value))
const delivery = computed(() =>
  computeDeliveryStats(orders.value, orderStore.allStageTransitions, range.value),
)

/** 交付趋势：按期 / 逾期结单数（堆积柱）+ 按期率（折线） */
const deliveryTrend = computed(() =>
  aggregateDeliveryTrend(orders.value, buckets.value),
)

/** 待收总额（全局应收快照：已产生账单的订单 + 未结单/未退单的待收订单） */
const pendingTotal = computed(() => {
  const orderIds = new Set(records.value.map(r => r.orderId))
  const involved = orders.value.filter(o =>
    orderIds.has(o.id) || (o.orderStatus !== 'completed' && o.orderStatus !== 'voided'),
  )
  return computePaymentStats(
    records.value,
    involved,
    (sourceId) => (sourceId ? sourceMap.value.get(sourceId) ?? null : null),
    null,
  ).pendingTotal
})

const incomeTrend = computed(() => aggregateIncomeTrend(records.value, orders.value, sourceOf, buckets.value))
const incomeTrendByType = computed(() => aggregateIncomeTrendByType(records.value, orders.value, sourceOf, buckets.value))
/** 来源构成：domain 层 sourceName 兜底为 sourceId，这里映射为来源模板真实名称 */
const sourceIncome = computed(() =>
  aggregateIncomeBySource(records.value, orders.value, sourceOf, range.value)
    .map(s => ({ ...s, sourceName: sourceMap.value.get(s.sourceId)?.name ?? s.sourceName })),
)

/** 来源明细表：在收入构成基础上补充区间内订单量 */
const sourceDetail = computed(() => {
  const countMap = new Map<string, number>()
  for (const o of orders.value) {
    if (!dateInRange(o.createdAt, range.value)) continue
    countMap.set(o.sourceId, (countMap.get(o.sourceId) ?? 0) + 1)
  }
  return sourceIncome.value.map(s => ({
    name: s.sourceName,
    orders: countMap.get(s.sourceId) ?? 0,
    income: s.income,
    fee: s.fee,
  }))
})

/** 订单量趋势（时间 × 类别）：区间内新建订单按（时间桶, 首个类别）计数，柱高即订单量趋势 */
const orderTrendCategory = computed(() => {
  const inRange = orders.value.filter(o => dateInRange(o.createdAt, range.value))
  const firstCatOf = new Map<string, string>()
  for (const oc of orderStore.orderCategories) {
    if (!firstCatOf.has(oc.orderId)) firstCatOf.set(oc.orderId, oc.categoryId)
  }
  const catNameMap = new Map(settingsStore.categories.map(c => [c.id, c.name]))
  const usedCatIds = [...new Set(orderStore.orderCategories.map(oc => oc.categoryId))]
    .filter(id => catNameMap.has(id) && inRange.some(o => firstCatOf.get(o.id) === id))
  return {
    series: usedCatIds.map(catId => ({
      name: catNameMap.get(catId)!,
      counts: buckets.value.map(bucket => {
        const start = bucket.start
        const end = bucket.end
        return inRange.filter(o => {
          const d = o.createdAt.slice(0, 10)
          return d >= start && d <= end && firstCatOf.get(o.id) === catId
        }).length
      }),
    })),
  }
})

/** 订单状态构成：当前在办订单（未结单 / 未退单）按工作状态分布，不受时间范围影响 */
const orderStatusDist = computed(() => {
  const order: OrderStatus[] = ['unscheduled', 'awaiting_deposit', 'not_started', 'in_progress', 'awaiting_final']
  return order
    .map(status => ({
      status,
      label: ORDER_STATUS_LABEL[status],
      count: orders.value.filter(o => o.orderStatus === status).length,
    }))
    .filter(x => x.count > 0)
})

/** 订单金额构成：区间内新建订单的预计 / 实收 / 待收合计（到手前账面口径） */
const orderAmountDist = computed(() => {
  const inRange = orders.value.filter(o => dateInRange(o.createdAt, range.value))
  let expected = 0
  let received = 0
  for (const o of inRange) {
    expected += isFinite(o.expectedAmount) ? o.expectedAmount : 0
    received += (isFinite(o.depositActual) ? o.depositActual : 0) + (isFinite(o.finalActual) ? o.finalActual : 0)
  }
  const remain = Math.max(0, expected - received)
  return [
    { name: '预计金额', value: round2(expected) },
    { name: '实收金额', value: round2(received) },
    { name: '待收金额', value: round2(remain) },
  ]
})

/** 订单金额分布：区间内新建订单按预计金额分价位区间计数，步长（x 轴单位长度）可配置并长期记忆 */
const amountStep = ref(preferencesStore.preferences.statsAmountStep)
const amountRange = computed(() => aggregateOrderAmountRange(orders.value, range.value, amountStep.value))

function onAmountStepChange() {
  preferencesStore.update({ statsAmountStep: amountStep.value })
}

/** 客户收入排行：区间内实际收入降序，全部结果 + TOP10 截断（客户多时提示共 X 位） */
const allRankedCustomers = computed(() => {
  const platformMap = new Map(customers.value.map(c => [c.id, c.platform?.trim() || '其他']))
  return aggregateCustomerIncome(records.value, orders.value, customers.value, sourceOf, range.value, 100000)
    .map(c => ({ ...c, platform: platformMap.get(c.customerId) || '其他' }))
})
const customerRank = computed(() => allRankedCustomers.value.slice(0, 10))
const rankTotal = computed(() => allRankedCustomers.value.length)
const valueMatrix = computed(() =>
  aggregateCustomerValue(customers.value, records.value, orders.value, sourceOf, range.value),
)

// ===== 交付 / 耗时 / 账款异常 =====
/** 绘制阶段模板（仅自定义绘制阶段参与耗时统计；待开始/完成/退单不纳入雷达图） */
const stageTemplate = computed(() =>
  settingsStore.stagesByPosition.filter(s => s.type === 'custom'),
)
const stageDuration = computed(() =>
  aggregateStageDuration(
    orders.value,
    orderStore.allStageTransitions,
    range.value,
    stageTemplate.value.map(s => ({ id: s.id, name: s.name, color: s.color })),
  ),
)
const orderDurations = computed(() =>
  aggregateOrderDurations(orders.value, orderStore.allStageTransitions, customers.value, range.value),
)
const debt = computed(() => computeArrearsWaived(orders.value, customers.value, range.value))

// ===== 支付分析（收付趋势 / 类型构成 / 收款状态 / 待收排行） =====
/** 收付趋势：入账到手 / 退款出账 / 净现金流（按时间桶），口径与收入一致 */
const paymentTypeDist = computed(() =>
  aggregatePaymentTypeDist(records.value, orders.value, sourceOf, range.value),
)
/** 收款状态构成：全部订单收款状态快照（不受时间范围影响） */
const paymentStatusDist = computed(() => aggregatePaymentStatusDist(orders.value))
/** 待收账款排行：按客户聚合正常待收金额（降序），截断 TOP10 */
const allPendingCustomers = computed(() =>
  aggregatePendingByCustomer(orders.value, customers.value, sourceOf),
)
const pendingCustomers = computed(() => allPendingCustomers.value.slice(0, 10))
const pendingTotalCount = computed(() => allPendingCustomers.value.length)

// ===== echarts 主题 =====
const PALETTE = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#3b82f6', '#06b6d4', '#f97316', '#a855f7', '#10b981']
const AXIS_TEXT = '#8b93a7'
const SPLIT_LINE = 'rgba(148,163,184,0.14)'
const FONT = "'DM Sans', 'HarmonyOS Sans SC', system-ui, sans-serif"

/** 垂直渐变（柱/面积用） */
function vGradient(from: string, to: string) {
  return {
    type: 'linear' as const,
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: from },
      { offset: 1, color: to },
    ],
  }
}

/** hex 颜色 → 指定透明度 rgba（用于渐变淡出 / 阴影） */
function fade(color: string, opacity: number): string {
  const r = parseInt(color.slice(1, 3), 16)
  const g = parseInt(color.slice(3, 5), 16)
  const b = parseInt(color.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${opacity})`
}

const tooltipStyle = {
  backgroundColor: 'rgba(15,23,42,0.88)',
  borderColor: 'rgba(99,102,241,0.35)',
  borderWidth: 1,
  textStyle: { color: '#e2e8f0', fontSize: 12, fontFamily: FONT },
  extraCssText: 'backdrop-filter: blur(10px); border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.35); padding: 0.5rem 0.75rem;',
}

const legendStyle = { textStyle: { color: AXIS_TEXT, fontSize: 12, fontFamily: FONT }, itemWidth: 10, itemHeight: 10 }

/** dataZoom 滑条统一样式（毛玻璃感） */
const sliderStyle = {
  borderColor: 'transparent',
  backgroundColor: 'rgba(148,163,184,0.12)',
  fillerColor: 'rgba(99,102,241,0.22)',
  handleStyle: { color: '#6366f1', borderColor: 'transparent' },
  textStyle: { color: AXIS_TEXT, fontSize: 10, fontFamily: FONT },
  brushSelect: false,
}

/** 时间类目轴（x 轴）数据量超过阈值时：底部滑条 + 滚轮缩放，grid 底部让位 */
function zoomTime(count: number): { gridBottom: number; dataZoom: EChartOption['dataZoom'] } {
  if (count <= 15) return { gridBottom: 4, dataZoom: undefined }
  return {
    gridBottom: 28,
    dataZoom: [
      { type: 'inside' as const, start: 0, end: 100 },
      { type: 'slider' as const, height: 14, bottom: 4, ...sliderStyle },
    ],
  }
}

/** 清单类目轴（y 轴横向条形）数据量超过阈值时：滚轮滚动 + 右侧滑条，并隐藏数值标签 */
function zoomList(count: number): { gridRight: number; labelShow: boolean; dataZoom: EChartOption['dataZoom'] } {
  if (count <= 15) return { gridRight: 44, labelShow: true, dataZoom: undefined }
  return {
    gridRight: 56,
    labelShow: false,
    dataZoom: [
      { type: 'inside' as const, yAxisIndex: 0, start: 0, end: 100 },
      { type: 'slider' as const, yAxisIndex: 0, width: 10, right: 4, ...sliderStyle },
    ],
  }
}

/** 收入构成趋势：定金/尾款堆积柱 + 净收入折线（合并原「收入趋势」与「定金/尾款」两图） */
const incomeTrendOption = computed<EChartOption>(() => {
  const points = incomeTrendByType.value
  const zoom = zoomTime(points.length)
  return {
    color: PALETTE,
    tooltip: { trigger: 'axis', ...tooltipStyle },
    legend: { data: ['定金（到手）', '尾款（到手）', '净收入'], ...legendStyle, top: 0 },
    grid: { left: 8, right: 14, top: 32, bottom: zoom.gridBottom, containLabel: true },
    dataZoom: zoom.dataZoom,
    xAxis: { type: 'category', data: points.map(p => p.label), axisLine: { lineStyle: { color: SPLIT_LINE } }, axisLabel: { color: AXIS_TEXT, fontFamily: FONT } },
    yAxis: { type: 'value', axisLabel: { color: AXIS_TEXT, fontFamily: FONT }, splitLine: { lineStyle: { color: SPLIT_LINE } } },
    series: [
      {
        name: '定金（到手）',
        type: 'bar',
        stack: 'income',
        barMaxWidth: 26,
        itemStyle: {
          color: vGradient('#6366f1', fade('#6366f1', 0.38)),
          shadowBlur: 4,
          shadowColor: fade('#6366f1', 0.35),
        },
        // 该桶无尾款时定金就是顶层，需圆角；有尾款时定金是中间层，直角
        data: points.map(p => ({
          value: p.deposit,
          itemStyle: p.deposit > 0 && p.final <= 0 ? { borderRadius: [6, 6, 0, 0] } : undefined,
        })),
      },
      {
        name: '尾款（到手）',
        type: 'bar',
        stack: 'income',
        barMaxWidth: 26,
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: vGradient('#22c55e', fade('#22c55e', 0.38)),
          shadowBlur: 4,
          shadowColor: fade('#22c55e', 0.35),
        },
        data: points.map(p => p.final),
      },
      {
        name: '净收入',
        type: 'line',
        smooth: true,
        symbolSize: 6,
        lineStyle: { color: '#f59e0b', width: 2.5, shadowBlur: 8, shadowColor: 'rgba(245,158,11,0.55)' },
        itemStyle: { color: '#f59e0b', borderColor: '#fff', borderWidth: 1 },
        data: points.map(p => p.net),
      },
    ],
  }
})

const sourceOption = computed<EChartOption>(() => {
  const items = sourceIncome.value.filter(s => s.income > 0)
  const zoom = zoomList(items.length)
  return {
    color: PALETTE,
    tooltip: {
      trigger: 'axis',
      ...tooltipStyle,
      formatter: (params: unknown) => {
        const p = (params as { name: string; value: number }[])[0]
        const detail = sourceDetail.value.find(s => s.name === p.name)
        const feeText = detail && detail.fee > 0 ? `<br/>手续费：¥${formatAmount(detail.fee)}` : ''
        const orderText = detail ? `<br/>订单量：${detail.orders} 单` : ''
        return `${p.name}<br/>收入：¥${formatAmount(p.value)}${feeText}${orderText}`
      },
    },
    grid: { left: 8, right: zoom.gridRight, top: 8, bottom: 4, containLabel: true },
    dataZoom: zoom.dataZoom,
    xAxis: { type: 'value', axisLabel: { color: AXIS_TEXT, fontFamily: FONT, formatter: (v: unknown) => compactAmount(Number(v)) }, splitLine: { lineStyle: { color: SPLIT_LINE } } },
    yAxis: { type: 'category', inverse: true, data: items.map(s => s.sourceName), axisLine: { lineStyle: { color: SPLIT_LINE } }, axisLabel: { color: AXIS_TEXT, fontFamily: FONT } },
    series: [
      {
        type: 'bar',
        barMaxWidth: 20,
        itemStyle: {
          borderRadius: [0, 6, 6, 0],
          color: vGradient('#8b5cf6', fade('#8b5cf6', 0.42)),
          shadowBlur: 6,
          shadowColor: fade('#8b5cf6', 0.35),
        },
        label: { show: zoom.labelShow, position: 'right', color: AXIS_TEXT, fontFamily: FONT, formatter: (params: unknown) => formatAmount((params as { value: number }).value) },
        data: items.map(s => s.income),
      },
    ],
  }
})

/** 收付趋势：入账到手（绿柱）+ 退款出账（红柱）堆积，净现金流（橙线） */
const paymentTrendOption = computed<EChartOption>(() => {
  const points = incomeTrend.value
  const zoom = zoomTime(points.length)
  return {
    color: PALETTE,
    tooltip: { trigger: 'axis', ...tooltipStyle },
    legend: { data: ['入账（到手）', '退款（出账）', '净现金流'], ...legendStyle, top: 0 },
    grid: { left: 8, right: 14, top: 32, bottom: zoom.gridBottom, containLabel: true },
    dataZoom: zoom.dataZoom,
    xAxis: { type: 'category', data: points.map(p => p.label), axisLine: { lineStyle: { color: SPLIT_LINE } }, axisLabel: { color: AXIS_TEXT, fontFamily: FONT } },
    yAxis: { type: 'value', axisLabel: { color: AXIS_TEXT, fontFamily: FONT }, splitLine: { lineStyle: { color: SPLIT_LINE } } },
    series: [
      {
        name: '入账（到手）',
        type: 'bar',
        stack: 'flow',
        barMaxWidth: 26,
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: vGradient('#22c55e', fade('#22c55e', 0.38)),
          shadowBlur: 4,
          shadowColor: fade('#22c55e', 0.35),
        },
        data: points.map(p => p.income),
      },
      {
        name: '退款（出账）',
        type: 'bar',
        stack: 'flow',
        barMaxWidth: 26,
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: vGradient('#ef4444', fade('#ef4444', 0.38)),
          shadowBlur: 4,
          shadowColor: fade('#ef4444', 0.35),
        },
        data: points.map(p => p.refund),
      },
      {
        name: '净现金流',
        type: 'line',
        smooth: true,
        symbolSize: 6,
        lineStyle: { color: '#f59e0b', width: 2.5, shadowBlur: 8, shadowColor: 'rgba(245,158,11,0.55)' },
        itemStyle: { color: '#f59e0b', borderColor: '#fff', borderWidth: 1 },
        data: points.map(p => p.net),
      },
    ],
  }
})

/** 收付类型构成：区间内定金 / 尾款（到手）与退款（环形图，中心显示合计） */
const paymentTypeOption = computed<EChartOption>(() => {
  const items = paymentTypeDist.value
  const total = items.reduce((s, i) => s + i.value, 0)
  const typeLabel: Record<string, string> = { deposit: '定金', final: '尾款', refund: '退款' }
  const typeColor: Record<string, string> = { deposit: '#6366f1', final: '#22c55e', refund: '#ef4444' }
  return {
    color: PALETTE,
    tooltip: {
      trigger: 'item',
      ...tooltipStyle,
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number; percent: number }
        return `${p.name}<br/>¥${formatAmount(p.value)}（${p.percent}%）`
      },
    },
    legend: { type: 'scroll', ...legendStyle, bottom: 0 },
    title: {
      text: `¥${compactAmount(total)}`,
      subtext: '区间收付',
      left: 'center',
      top: '30%',
      textStyle: { fontSize: 22, fontWeight: 700, color: '#e2e8f0', fontFamily: FONT },
      subtextStyle: { fontSize: 11, color: AXIS_TEXT, fontFamily: FONT },
    },
    series: [
      {
        type: 'pie',
        radius: ['46%', '70%'],
        center: ['50%', '40%'],
        itemStyle: {
          borderRadius: 8,
          borderColor: 'rgba(255,255,255,0.12)',
          borderWidth: 2,
          shadowBlur: 10,
          shadowColor: 'rgba(15,23,42,0.35)',
        },
        label: { show: false },
        emphasis: { scale: true, scaleSize: 5, label: { show: true, fontSize: 13, fontWeight: 600, color: '#e2e8f0' } },
        data: items.map(i => ({ name: typeLabel[i.type], value: i.value, itemStyle: { color: vGradient(typeColor[i.type], fade(typeColor[i.type], 0.55)) } })),
      },
    ],
  }
})

/** 收款状态构成：全部订单收款状态分布（环形图，中心显示订单总数） */
const paymentStatusOption = computed<EChartOption>(() => {
  const items = paymentStatusDist.value
  const total = orders.value.length
  const statusColor: Record<PaymentStatus, string> = {
    unpaid: '#94a3b8',
    deposit_paid: '#3b82f6',
    final_paid: '#22c55e',
    arrears: '#ef4444',
    waived: '#f59e0b',
  }
  return {
    color: PALETTE,
    tooltip: {
      trigger: 'item',
      ...tooltipStyle,
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number; percent: number }
        return `${p.name}<br/>${p.value} 单（${p.percent}%）`
      },
    },
    legend: { type: 'scroll', ...legendStyle, bottom: 0 },
    title: {
      text: String(total),
      subtext: '全部订单',
      left: 'center',
      top: '30%',
      textStyle: { fontSize: 26, fontWeight: 700, color: '#e2e8f0', fontFamily: FONT },
      subtextStyle: { fontSize: 11, color: AXIS_TEXT, fontFamily: FONT },
    },
    series: [
      {
        type: 'pie',
        radius: ['46%', '70%'],
        center: ['50%', '40%'],
        itemStyle: {
          borderRadius: 8,
          borderColor: 'rgba(255,255,255,0.12)',
          borderWidth: 2,
          shadowBlur: 10,
          shadowColor: 'rgba(15,23,42,0.35)',
        },
        label: { show: false },
        emphasis: { scale: true, scaleSize: 5, label: { show: true, fontSize: 13, fontWeight: 600, color: '#e2e8f0' } },
        data: items.map(s => ({ name: PAYMENT_STATUS_LABEL[s.status as PaymentStatus] ?? s.status, value: s.count, itemStyle: { color: vGradient(statusColor[s.status as PaymentStatus] ?? '#94a3b8', fade(statusColor[s.status as PaymentStatus] ?? '#94a3b8', 0.55)) } })),
      },
    ],
  }
})

/** 待收账款排行：按客户待收金额降序（横向条形，数据多时可滚动） */
const pendingOption = computed<EChartOption>(() => {
  const items = pendingCustomers.value
  const zoom = zoomList(items.length)
  return {
    color: PALETTE,
    tooltip: {
      trigger: 'axis',
      ...tooltipStyle,
      formatter: (params: unknown) => {
        const p = (params as { name: string; value: number }[])[0]
        const c = pendingCustomers.value.find(i => i.customerName === p.name)
        const countText = c ? `<br/>待收订单：${c.orderCount} 单` : ''
        return `${p.name}<br/>待收金额：¥${formatAmount(p.value)}${countText}`
      },
    },
    grid: { left: 8, right: zoom.gridRight, top: 8, bottom: 4, containLabel: true },
    dataZoom: zoom.dataZoom,
    xAxis: { type: 'value', axisLabel: { color: AXIS_TEXT, fontFamily: FONT, formatter: (v: unknown) => compactAmount(Number(v)) }, splitLine: { lineStyle: { color: SPLIT_LINE } } },
    yAxis: { type: 'category', inverse: true, data: items.map(c => c.customerName), axisLine: { lineStyle: { color: SPLIT_LINE } }, axisLabel: { color: AXIS_TEXT, fontFamily: FONT } },
    series: [
      {
        type: 'bar',
        barMaxWidth: 18,
        itemStyle: {
          borderRadius: [0, 6, 6, 0],
          color: vGradient('#f59e0b', '#fbbf24'),
          shadowBlur: 6,
          shadowColor: 'rgba(245,158,11,0.35)',
        },
        label: { show: zoom.labelShow, position: 'right', color: AXIS_TEXT, fontFamily: FONT, formatter: (params: unknown) => formatAmount((params as { value: number }).value) },
        data: items.map(c => c.amount),
      },
    ],
  }
})

/** 订单量趋势（时间 × 类别堆积 + 总趋势折线）：柱高 = 区间内各时间桶新建订单，按稿件类别分层；折线 = 订单总数 */
const orderTrendOption = computed<EChartOption>(() => {
  const seriesList = orderTrendCategory.value.series
  const zoom = zoomTime(buckets.value.length)
  const total = buckets.value.map((_, i) => seriesList.reduce((sum, s) => sum + (s.counts[i] ?? 0), 0))
  // 每个时间桶实际可见的最顶层类别 index（非零段的最高层），仅该层需要顶部圆角
  const topOfBucket = buckets.value.map((_, bIdx) => {
    let top = -1
    seriesList.forEach((s, i) => {
      if ((s.counts[bIdx] ?? 0) > 0) top = i
    })
    return top
  })
  return {
    color: PALETTE,
    tooltip: { trigger: 'axis', ...tooltipStyle },
    legend: { type: 'scroll', ...legendStyle, top: 0 },
    grid: { left: 8, right: 14, top: 32, bottom: zoom.gridBottom, containLabel: true },
    dataZoom: zoom.dataZoom,
    xAxis: { type: 'category', data: buckets.value.map(b => b.label), axisLine: { lineStyle: { color: SPLIT_LINE } }, axisLabel: { color: AXIS_TEXT, fontFamily: FONT } },
    yAxis: { type: 'value', minInterval: 1, axisLabel: { color: AXIS_TEXT, fontFamily: FONT }, splitLine: { lineStyle: { color: SPLIT_LINE } } },
    series: [
      ...seriesList.map((s, i) => {
        const base = PALETTE[i % PALETTE.length]
        return {
          name: s.name,
          type: 'bar' as const,
          stack: 'total',
          barMaxWidth: 30,
          itemStyle: {
            color: vGradient(base, fade(base, 0.38)),
            shadowBlur: 4,
            shadowColor: fade(base, 0.35),
          },
          data: s.counts.map((count, bIdx) => ({
            value: count,
            itemStyle: count > 0 && i === topOfBucket[bIdx] ? { borderRadius: [6, 6, 0, 0] } : undefined,
          })),
        }
      }),
      {
        name: '订单总数',
        type: 'line',
        smooth: true,
        symbolSize: 6,
        lineStyle: { color: '#f59e0b', width: 2.5, shadowBlur: 8, shadowColor: 'rgba(245,158,11,0.55)' },
        itemStyle: { color: '#f59e0b', borderColor: '#fff', borderWidth: 1 },
        data: total,
      },
    ],
  }
})

/** 订单状态构成：当前在办订单状态（环形图，中心显示在办总数） */
const orderStatusOption = computed<EChartOption>(() => {
  const items = orderStatusDist.value
  const total = items.reduce((sum, s) => sum + s.count, 0)
  const statusColor: Record<OrderStatus, string> = {
    unscheduled: '#94a3b8',
    awaiting_deposit: '#f59e0b',
    not_started: '#3b82f6',
    in_progress: '#8b5cf6',
    awaiting_final: '#06b6d4',
    completed: '#22c55e',
    voided: '#ef4444',
  }
  return {
    color: PALETTE,
    tooltip: {
      trigger: 'item',
      ...tooltipStyle,
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number; percent: number }
        return `${p.name}<br/>${p.value} 单（${p.percent}%）`
      },
    },
    legend: { type: 'scroll', ...legendStyle, bottom: 0 },
    title: {
      text: String(total),
      subtext: '在办订单',
      left: 'center',
      top: '30%',
      textStyle: { fontSize: 26, fontWeight: 700, color: '#e2e8f0', fontFamily: FONT },
      subtextStyle: { fontSize: 11, color: AXIS_TEXT, fontFamily: FONT },
    },
    series: [
      {
        type: 'pie',
        radius: ['46%', '70%'],
        center: ['50%', '40%'],
        itemStyle: {
          borderRadius: 8,
          borderColor: 'rgba(255,255,255,0.12)',
          borderWidth: 2,
          shadowBlur: 10,
          shadowColor: 'rgba(15,23,42,0.35)',
        },
        label: { show: false },
        emphasis: { scale: true, scaleSize: 5, label: { show: true, fontSize: 13, fontWeight: 600, color: '#e2e8f0' } },
        data: items.map(s => ({ name: s.label, value: s.count, itemStyle: { color: vGradient(statusColor[s.status], fade(statusColor[s.status], 0.55)) } })),
      },
    ],
  }
})

/** 订单金额构成：区间内新建订单的预计 / 实收 / 待收（实收+待收堆积条，总长 = 预计，虚线标注预计参考线） */
const orderAmountOption = computed<EChartOption>(() => {
  const expected = orderAmountDist.value.find(i => i.name === '预计金额')?.value ?? 0
  const received = orderAmountDist.value.find(i => i.name === '实收金额')?.value ?? 0
  const remain = orderAmountDist.value.find(i => i.name === '待收金额')?.value ?? 0
  const rate = expected > 0 ? Math.round((received / expected) * 100) : 0
  return {
    color: PALETTE,
    tooltip: {
      trigger: 'axis',
      ...tooltipStyle,
      formatter: (params: unknown) => {
        const ps = params as { seriesName: string; value: number }[]
        const line = ps.map(p => `${p.seriesName}：¥${formatAmount(p.value)}`).join('<br/>')
        return `区间新建订单金额<br/>预计总额：¥${formatAmount(expected)}<br/>${line}<br/>收款完成率：${rate}%`
      },
    },
    legend: { data: ['实收金额', '待收金额'], ...legendStyle, top: 0 },
    grid: { left: 8, right: 64, top: 30, bottom: 4, containLabel: true },
    xAxis: { type: 'value', axisLabel: { color: AXIS_TEXT, fontFamily: FONT, formatter: (v: unknown) => compactAmount(Number(v)) }, splitLine: { lineStyle: { color: SPLIT_LINE } } },
    yAxis: { type: 'category', data: ['订单金额'], axisLine: { lineStyle: { color: SPLIT_LINE } }, axisLabel: { color: AXIS_TEXT, fontFamily: FONT } },
    series: [
      {
        name: '实收金额',
        type: 'bar',
        stack: 'amount',
        barMaxWidth: 34,
        itemStyle: {
          color: vGradient('#22c55e', '#4ade80'),
          shadowBlur: 6,
          shadowColor: 'rgba(34,197,94,0.35)',
        },
        label: { show: true, position: 'insideLeft', color: '#fff', fontFamily: FONT, fontSize: 12, formatter: (params: unknown) => `实收 ¥${compactAmount((params as { value: number }).value)}` },
        markLine: {
          symbol: 'none',
          lineStyle: { color: '#94a3b8', type: 'dashed', width: 1.5 },
          label: { show: true, position: 'end', color: AXIS_TEXT, fontSize: 11, fontFamily: FONT, formatter: '预计 ¥{c}' },
          data: [{ xAxis: expected }],
        },
        data: [received],
      },
      {
        name: '待收金额',
        type: 'bar',
        stack: 'amount',
        barMaxWidth: 34,
        itemStyle: {
          borderRadius: [0, 8, 8, 0],
          color: vGradient('#f59e0b', '#fbbf24'),
          shadowBlur: 6,
          shadowColor: 'rgba(245,158,11,0.35)',
        },
        label: { show: true, position: 'right', color: AXIS_TEXT, fontFamily: FONT, fontSize: 12, formatter: (params: unknown) => `待收 ¥${compactAmount((params as { value: number }).value)}` },
        data: [remain],
      },
    ],
  }
})

/** 订单金额分布：区间内新建订单按预计金额分价位区间的订单数柱状图（最高档高亮） */
const orderAmountRangeOption = computed<EChartOption>(() => {
  const items = amountRange.value
  const maxCount = Math.max(...items.map(i => i.count), 0)
  return {
    color: PALETTE,
    tooltip: {
      trigger: 'axis',
      ...tooltipStyle,
      formatter: (params: unknown) => {
        const p = (params as { name: string; value: number }[])[0]
        return `${p.name} 元<br/>订单：${p.value} 单`
      },
    },
    grid: { left: 8, right: 16, top: 16, bottom: 4, containLabel: true },
    xAxis: { type: 'category', data: items.map(i => i.label), axisLine: { lineStyle: { color: SPLIT_LINE } }, axisLabel: { color: AXIS_TEXT, fontFamily: FONT } },
    yAxis: { type: 'value', minInterval: 1, axisLabel: { color: AXIS_TEXT, fontFamily: FONT }, splitLine: { lineStyle: { color: SPLIT_LINE } } },
    series: [
      {
        type: 'bar',
        barMaxWidth: 30,
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: vGradient('#a855f7', '#c084fc'),
          shadowBlur: 6,
          shadowColor: 'rgba(168,85,247,0.35)',
        },
        label: { show: true, position: 'top', color: AXIS_TEXT, fontFamily: FONT, formatter: (params: unknown) => `${(params as { value: number }).value}单` },
        data: items.map(i => ({
          value: i.count,
          itemStyle: i.count === maxCount && maxCount > 0
            ? { color: vGradient('#f59e0b', '#fbbf24'), shadowBlur: 8, shadowColor: 'rgba(245,158,11,0.45)' }
            : undefined,
        })),
      },
    ],
  }
})

/** 客户收入排行：按平台着色 + 图例（合并原「平台构成」图） */
const customerRankOption = computed<EChartOption>(() => {
  const items = customerRank.value
  const platforms = [...new Set(items.map(c => c.platform))]
  const colorOf = (p: string) => PALETTE[(platforms.indexOf(p) * 3 + 1) % PALETTE.length]
  return {
    color: PALETTE,
    tooltip: {
      trigger: 'axis',
      ...tooltipStyle,
      formatter: (params: unknown) => {
        const p = (params as { name: string; value: number }[])[0]
        const c = items.find(i => i.customerName === p.name)
        const platform = c ? `<br/>平台：${c.platform}` : ''
        return `${p.name}<br/>收入：¥${formatAmount(p.value)}${platform}`
      },
    },
    // 平台信息已通过标题副文本与 tooltip 呈现；legend.data 需匹配 series name，
    // 多客户单 series 无法一一对应，省略 legend 避免 echarts 警告
    grid: { left: 8, right: 30, top: 8, bottom: 4, containLabel: true },
    xAxis: { type: 'value', axisLabel: { color: AXIS_TEXT, fontFamily: FONT, formatter: (v: unknown) => compactAmount(Number(v)) }, splitLine: { lineStyle: { color: SPLIT_LINE } } },
    yAxis: { type: 'category', inverse: true, data: items.map(c => c.customerName), axisLine: { lineStyle: { color: SPLIT_LINE } }, axisLabel: { color: AXIS_TEXT, fontFamily: FONT } },
    series: [
      {
        type: 'bar',
        barMaxWidth: 18,
        itemStyle: { borderRadius: [0, 6, 6, 0] },
        label: { show: true, position: 'right', color: AXIS_TEXT, fontFamily: FONT, formatter: (params: unknown) => formatAmount((params as { value: number }).value) },
        data: items.map(c => ({ value: c.income, itemStyle: { color: colorOf(c.platform) } })),
      },
    ],
  }
})

const valueMatrixOption = computed<EChartOption>(() => {
  const items = valueMatrix.value
  const median = (nums: number[]) => {
    if (nums.length === 0) return 0
    const s = [...nums].sort((a, b) => a - b)
    const m = Math.floor(s.length / 2)
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
  }
  // 四象限分割：收入中位 / 权重中位
  const xMed = median(items.map(p => p.contribution))
  const yMed = median(items.map(p => p.weight))
  // x 轴自适应：从 0 起，按数据最大值向上取整（1/2/5 ×10ⁿ），并留出气泡余量
  const maxC = Math.max(...items.map(p => p.contribution), 1)
  const pow = 10 ** Math.floor(Math.log10(maxC))
  const xMax = Math.ceil(maxC / pow / 2) * 2 * pow * 1.15
  return {
    color: PALETTE,
    tooltip: {
      trigger: 'item',
      ...tooltipStyle,
      formatter: (params: unknown) => {
        const p = params as { data: [number, number, string, number] }
        const [contribution, weight, customerName, orderCount] = p.data
        return `${customerName}<br/>区间收入：¥${formatAmount(contribution)}<br/>客户权重：${weight}<br/>区间订单：${orderCount} 单`
      },
    },
    grid: { left: 8, right: 16, top: 24, bottom: 4, containLabel: true },
    xAxis: {
      type: 'value',
      name: '区间收入（¥）',
      nameTextStyle: { color: AXIS_TEXT, fontSize: 11, fontFamily: FONT },
      min: 0,
      max: xMax,
      axisLabel: { color: AXIS_TEXT, fontFamily: FONT, formatter: (v: unknown) => compactAmount(Number(v)) },
      splitLine: { lineStyle: { color: SPLIT_LINE } },
    },
    yAxis: {
      type: 'value',
      name: '客户权重',
      nameTextStyle: { color: AXIS_TEXT, fontSize: 11, fontFamily: FONT },
      min: 0,
      max: 100,
      axisLabel: { color: AXIS_TEXT, fontFamily: FONT },
      splitLine: { lineStyle: { color: SPLIT_LINE } },
    },
    series: [
      {
        type: 'scatter',
        symbolSize: (val: unknown) => {
          const v = val as [number, number, string, number]
          return 6 + Math.min(22, (v[3] ?? 0) * 4)
        },
        itemStyle: {
          color: vGradient('#6366f1', '#a855f7') as unknown as string,
          opacity: 0.82,
          shadowBlur: 10,
          shadowColor: 'rgba(99,102,241,0.5)',
          borderColor: 'rgba(255,255,255,0.65)',
          borderWidth: 1.5,
        },
        emphasis: { scale: 1.5 },
        markLine: {
          symbol: 'none',
          lineStyle: { color: 'rgba(148,163,184,0.5)', type: 'dashed', width: 1.2 },
          label: { show: true, color: AXIS_TEXT, fontSize: 10, fontFamily: FONT, formatter: '{b}' },
          data: [
            { yAxis: yMed, name: '权重中位' },
            { xAxis: xMed, name: '收入中位' },
          ],
        },
        data: items.map(p => [p.contribution, p.weight, p.customerName, p.orderCount]),
      },
    ],
  }
})

const deliveryOption = computed<EChartOption>(() => ({
  color: PALETTE,
  tooltip: {
    trigger: 'item',
    ...tooltipStyle,
    formatter: (params: unknown) => {
      const p = params as { name: string; value: number; percent: number }
      return `${p.name}<br/>${p.value} 单（${p.percent}%）`
    },
  },
  legend: { bottom: 0, ...legendStyle },
  title: {
    text: `${delivery.value.onTimeRate}%`,
    subtext: '按期交付率',
    left: 'center',
    top: '30%',
    textStyle: { fontSize: 26, fontWeight: 700, color: '#e2e8f0', fontFamily: FONT },
    subtextStyle: { fontSize: 11, color: AXIS_TEXT, fontFamily: FONT },
  },
  series: [
    {
      type: 'pie',
      radius: ['46%', '70%'],
      center: ['50%', '40%'],
      itemStyle: {
        borderRadius: 8,
        borderColor: 'rgba(255,255,255,0.12)',
        borderWidth: 2,
        shadowBlur: 10,
        shadowColor: 'rgba(15,23,42,0.35)',
      },
      label: { show: false },
      emphasis: { scale: true, scaleSize: 5, label: { show: true, fontSize: 13, fontWeight: 600, color: '#e2e8f0' } },
      data: [
        { name: '按期交付', value: delivery.value.onTimeCount, itemStyle: { color: vGradient('#22c55e', fade('#22c55e', 0.55)) } },
        { name: '逾期交付', value: delivery.value.lateCount, itemStyle: { color: vGradient('#ef4444', fade('#ef4444', 0.55)) } },
      ],
    },
  ],
}))

/** 按期交付趋势：按期/逾期结单堆积柱（圆角按可见顶层）+ 按期率折线 */
const deliveryTrendOption = computed<EChartOption>(() => {
  const points = deliveryTrend.value
  const zoom = zoomTime(points.length)
  const topOfBucket = points.map(p => (p.late > 0 ? 'late' : p.onTime > 0 ? 'onTime' : null))
  return {
    color: PALETTE,
    tooltip: {
      trigger: 'axis',
      ...tooltipStyle,
      formatter: (params: unknown) => {
        const ps = params as { seriesName: string; value: number; name?: string }[]
        const first = ps[0]
        const line = ps.map(p => `${p.seriesName}：${p.value} 单`).join('<br/>')
        return `${first.name ?? ''}<br/>${line}`
      },
    },
    legend: { data: ['按期交付', '逾期交付', '按期率'], ...legendStyle, top: 0 },
    grid: { left: 8, right: 14, top: 32, bottom: zoom.gridBottom, containLabel: true },
    dataZoom: zoom.dataZoom,
    xAxis: { type: 'category', data: points.map(p => p.label), axisLine: { lineStyle: { color: SPLIT_LINE } }, axisLabel: { color: AXIS_TEXT, fontFamily: FONT } },
    yAxis: [
      { type: 'value', minInterval: 1, axisLabel: { color: AXIS_TEXT, fontFamily: FONT }, splitLine: { lineStyle: { color: SPLIT_LINE } } },
      { type: 'value', min: 0, max: 100, axisLabel: { color: AXIS_TEXT, fontFamily: FONT, formatter: '{value}%' }, splitLine: { show: false } },
    ],
    series: [
      {
        name: '按期交付',
        type: 'bar',
        stack: 'delivery',
        barMaxWidth: 26,
        itemStyle: {
          color: vGradient('#22c55e', fade('#22c55e', 0.38)),
          shadowBlur: 4,
          shadowColor: fade('#22c55e', 0.35),
        },
        data: points.map(p => ({
          value: p.onTime,
          itemStyle: p.onTime > 0 && topOfBucket[points.indexOf(p)] === 'onTime' ? { borderRadius: [6, 6, 0, 0] } : undefined,
        })),
      },
      {
        name: '逾期交付',
        type: 'bar',
        stack: 'delivery',
        barMaxWidth: 26,
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: vGradient('#ef4444', fade('#ef4444', 0.38)),
          shadowBlur: 4,
          shadowColor: fade('#ef4444', 0.35),
        },
        data: points.map(p => p.late),
      },
      {
        name: '按期率',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        symbolSize: 6,
        lineStyle: { color: '#f59e0b', width: 2.5, shadowBlur: 8, shadowColor: 'rgba(245,158,11,0.55)' },
        itemStyle: { color: '#f59e0b', borderColor: '#fff', borderWidth: 1 },
        data: points.map(p => p.rate),
      },
    ],
  }
})

/** 阶段耗时分布：各绘制阶段平均停留天数雷达图（跨维度画像，替代横向条形） */
const stageDurationOption = computed<EChartOption>(() => {
  // 仅自定义绘制阶段（线稿→…→收尾），顺序 = 设置模板顺序；待开始/完成无耗时语义，不参与
  const items = stageDuration.value
  const maxAvg = Math.max(...items.map(s => s.avgDays), 1)
  return {
    color: PALETTE,
    tooltip: {
      trigger: 'item',
      ...tooltipStyle,
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number }
        const sd = stageDuration.value.find(s => s.stageName === p.name)
        return `${p.name}<br/>平均停留 ${p.value} 天${sd && sd.count > 0 ? `（${sd.count} 单）` : ''}`
      },
    },
    radar: {
      indicator: items.map(s => ({ name: s.stageName, max: Math.ceil(maxAvg * 1.2) })),
      radius: '62%',
      center: ['50%', '52%'],
      splitNumber: 4,
      axisName: { color: AXIS_TEXT, fontSize: 11, fontFamily: FONT },
      splitLine: { lineStyle: { color: SPLIT_LINE } },
      splitArea: { areaStyle: { color: ['rgba(99,102,241,0.05)', 'rgba(99,102,241,0.02)'] } },
      axisLine: { lineStyle: { color: SPLIT_LINE } },
    },
    series: [
      {
        type: 'radar',
        symbolSize: 5,
        data: [{ value: items.map(s => s.avgDays), name: '平均停留（天）' }],
        lineStyle: { color: '#06b6d4', width: 2.5, shadowBlur: 8, shadowColor: 'rgba(6,182,212,0.45)' },
        itemStyle: { color: '#06b6d4', borderColor: '#fff', borderWidth: 1 },
        areaStyle: { color: vGradient('#06b6d4', fade('#06b6d4', 0.25)) as unknown as string },
      },
    ],
  }
})

/** 欠款/免单汇总环形饼图（金额占比）：扇形展开动效 + 中心合计，各扇区按调色板异色 */
function ringShareOption(
  items: { name: string; value: number; count: number }[],
  /** 中心合计光晕主色 */
  color: string,
): EChartOption {
  const total = items.reduce((s, i) => s + i.value, 0)
  return {
    color: PALETTE,
    tooltip: {
      trigger: 'item',
      ...tooltipStyle,
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number; percent: number }
        const it = items.find(i => i.name === p.name)
        const countText = it ? `<br/>${it.count} 单` : ''
        return `${p.name}<br/>金额：¥${formatAmount(p.value)}（${p.percent}%）${countText}`
      },
    },
    legend: { type: 'scroll', ...legendStyle, bottom: 0 },
    title: {
      text: `¥${compactAmount(total)}`,
      subtext: '合计金额',
      left: 'center',
      top: '40%',
      textStyle: {
        fontSize: 26,
        fontWeight: 800,
        color: '#f8fafc',
        fontFamily: FONT,
        textShadowBlur: 12,
        textShadowColor: fade(color, 0.55),
      },
      subtextStyle: { fontSize: 12, color: AXIS_TEXT, fontFamily: FONT },
    },
    series: [
      {
        type: 'pie',
        radius: ['46%', '70%'],
        center: ['50%', '46%'],
        itemStyle: {
          borderRadius: 8,
          borderColor: 'rgba(255,255,255,0.12)',
          borderWidth: 2,
          shadowBlur: 10,
          shadowColor: 'rgba(15,23,42,0.35)',
        },
        label: { show: false },
        emphasis: { scale: true, scaleSize: 5, label: { show: true, fontSize: 12, fontWeight: 600, color: '#e2e8f0' } },
        data: items.map((i, idx) => ({
          name: i.name,
          value: i.value,
          itemStyle: { color: vGradient(PALETTE[idx % PALETTE.length], fade(PALETTE[idx % PALETTE.length], 0.45)) },
        })),
      },
    ],
  }
}

/** 客户欠款汇总：欠款金额占比环形饼图（调色板异色） */
const arrearsCustomersOption = computed<EChartOption>(() =>
  ringShareOption(
    debt.value.arrearsCustomers.map(c => ({ name: c.customerName, value: c.amount, count: c.count })),
    '#ef4444',
  ),
)

/** 客户免单汇总：免单金额占比环形饼图（调色板异色） */
const waivedCustomersOption = computed<EChartOption>(() =>
  ringShareOption(
    debt.value.waivedCustomers.map(c => ({ name: c.customerName, value: c.amount, count: c.count })),
    '#f59e0b',
  ),
)

/** 订单耗时明细：甘特式区间条形（value 轴天数偏移 + 透明占位叠加），数据多时 y 轴滚动 */
const orderDurationOption = computed<EChartOption>(() => {
  const items = orderDurations.value
  const zoom = zoomList(items.length)
  const DAY = 86400000
  // 统一以数据最小开工日为基准，转成天偏移（echarts 6 的 time 轴不渲染 bar 区间，用 value 轴解决）
  const startDates = items.map(r => new Date(`${r.startDate}T00:00:00`).getTime())
  const finishDates = items.map(r => new Date(`${r.finishDate}T00:00:00`).getTime())
  const base = Math.min(...startDates)
  const offset = (t: number) => Math.round((t - base) / DAY)
  const starts = items.map((_, i) => offset(startDates[i]))
  const durations = items.map((_, i) => offset(finishDates[i]) - offset(startDates[i]))
  const fmt = (v: number) => {
    const d = new Date(base + v * DAY)
    return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  return {
    color: PALETTE,
    tooltip: {
      trigger: 'axis',
      ...tooltipStyle,
      formatter: (params: unknown) => {
        const p = (params as { name: string }[])[0]
        const row = orderDurations.value.find(r => r.orderName === p.name)
        if (!row) return p.name
        return `${p.name}<br/>单号：${row.orderNo}<br/>客户：${row.customerName || '—'}<br/>开工：${row.startDate} · 完工：${row.finishDate}<br/>周期：${row.cycleDays} 天`
      },
    },
    grid: { left: 8, right: 20, top: 8, bottom: 4, containLabel: true },
    dataZoom: zoom.dataZoom,
    xAxis: {
      type: 'value',
      min: 0,
      axisLabel: { color: AXIS_TEXT, fontFamily: FONT, formatter: (v: unknown) => fmt(Number(v)) },
      axisLine: { lineStyle: { color: SPLIT_LINE } },
      splitLine: { lineStyle: { color: SPLIT_LINE } },
    },
    yAxis: { type: 'category', inverse: true, data: items.map(r => r.orderName), axisLine: { lineStyle: { color: SPLIT_LINE } }, axisLabel: { color: AXIS_TEXT, fontFamily: FONT } },
    series: [
      {
        name: '占位',
        type: 'bar',
        stack: 'gantt',
        barWidth: 14,
        itemStyle: { color: 'rgba(0,0,0,0)' },
        tooltip: { show: false },
        data: starts,
      },
      {
        name: '绘制周期',
        type: 'bar',
        stack: 'gantt',
        barWidth: 14,
        itemStyle: {
          borderRadius: [6, 6, 6, 6],
          color: vGradient('#06b6d4', '#67e8f9'),
          shadowBlur: 6,
          shadowColor: 'rgba(6,182,212,0.4)',
        },
        data: durations,
      },
    ],
  }
})

/** 通用横向条形（清单类明细）：tooltip 补充单数/预计交付等额外信息，量大时 y 轴滚动缩放 */
function horizontalBarOption(
  items: { name: string; value: number; extra?: string }[],
  color: string,
): EChartOption {
  const zoom = zoomList(items.length)
  return {
    color: PALETTE,
    tooltip: {
      trigger: 'axis',
      ...tooltipStyle,
      formatter: (params: unknown) => {
        const p = (params as { name: string; value: number }[])[0]
        const it = items.find(i => i.name === p.name)
        const extraText = it?.extra ? `<br/>${it.extra}` : ''
        return `${p.name}<br/>金额：¥${formatAmount(p.value)}${extraText}`
      },
    },
    grid: { left: 8, right: zoom.gridRight, top: 8, bottom: 4, containLabel: true },
    dataZoom: zoom.dataZoom,
    xAxis: { type: 'value', axisLabel: { color: AXIS_TEXT, fontFamily: FONT, formatter: (v: unknown) => compactAmount(Number(v)) }, splitLine: { lineStyle: { color: SPLIT_LINE } } },
    yAxis: { type: 'category', inverse: true, data: items.map(i => i.name), axisLine: { lineStyle: { color: SPLIT_LINE } }, axisLabel: { color: AXIS_TEXT, fontFamily: FONT } },
    series: [
      {
        type: 'bar',
        barMaxWidth: 16,
        itemStyle: { borderRadius: [0, 6, 6, 0], color: vGradient(color, fade(color, 0.4)) },
        label: { show: zoom.labelShow, position: 'right', color: AXIS_TEXT, fontFamily: FONT, formatter: (params: unknown) => formatAmount((params as { value: number }).value) },
        data: items.map(i => i.value),
      },
    ],
  }
}

/** 欠款订单明细：金额横向条形，悬停看预计交付，量大时可滚动 */
const arrearsOrdersOption = computed<EChartOption>(() =>
  horizontalBarOption(
    debt.value.arrearsOrders.map(o => ({
      name: o.orderName,
      value: o.amount,
      extra: `客户：${o.customerName || '—'} · 预计交付：${o.expectedEndDate ? o.expectedEndDate.slice(0, 10) : '—'}`,
    })),
    '#ef4444',
  ),
)

/** 免单订单明细：金额横向条形，悬停看预计交付，量大时可滚动 */
const waivedOrdersOption = computed<EChartOption>(() =>
  horizontalBarOption(
    debt.value.waivedOrders.map(o => ({
      name: o.orderName,
      value: o.amount,
      extra: `客户：${o.customerName || '—'} · 预计交付：${o.expectedEndDate ? o.expectedEndDate.slice(0, 10) : '—'}`,
    })),
    '#f59e0b',
  ),
)

// ===== CSV 导出 =====
function exportCsv() {
  const sections: { title: string; headers: string[]; rows: (string | number)[][] }[] = []
  sections.push({
    title: '收入明细（' + granularityLabel.value + '）',
    headers: ['区间', '收入（到手）', '退款', '净收入'],
    rows: incomeTrend.value.map(p => [p.label, p.income, p.refund, p.net]),
  })
  sections.push({
    title: '来源明细',
    headers: ['来源', '订单量', '收入', '手续费'],
    rows: sourceDetail.value.map(s => [s.name, s.orders, s.income, s.fee]),
  })
  sections.push({
    title: '客户收入排行',
    headers: ['客户', '平台', '区间收入'],
    rows: customerRank.value.map(c => [c.customerName, c.platform, c.income]),
  })
  sections.push({
    title: '订单耗时明细',
    headers: ['订单号', '订单名', '客户', '开工', '完工', '周期（天）'],
    rows: orderDurations.value.map(r => [r.orderNo, r.orderName, r.customerName ?? '', r.startDate, r.finishDate, r.cycleDays]),
  })
  sections.push({
    title: '欠款订单明细',
    headers: ['订单号', '订单名', '客户', '欠款金额', '预计交付'],
    rows: debt.value.arrearsOrders.map(r => [r.orderNo, r.orderName, r.customerName ?? '', r.amount, r.expectedEndDate ? r.expectedEndDate.slice(0, 10) : '']),
  })
  sections.push({
    title: '免单订单明细',
    headers: ['订单号', '订单名', '客户', '免单金额', '预计交付'],
    rows: debt.value.waivedOrders.map(r => [r.orderNo, r.orderName, r.customerName ?? '', r.amount, r.expectedEndDate ? r.expectedEndDate.slice(0, 10) : '']),
  })

  const lines: string[] = []
  for (const s of sections) {
    lines.push(s.title)
    lines.push(s.headers.map(escapeCsv).join(','))
    for (const row of s.rows) lines.push(row.map(escapeCsv).join(','))
    lines.push('')
  }
  const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const today = new Date()
  const stamp = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
  a.href = url
  a.download = `统计分析_${stamp}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function escapeCsv(value: string | number): string {
  const s = String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function formatAmount(value: number): string {
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** 保留两位小数 */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function compactAmount(value: number): string {
  if (value >= 10000) return `${Math.round(value / 1000) / 10}万`
  if (value >= 1000) return `${Math.round(value / 100) / 10}k`
  return String(value)
}

onMounted(async () => {
  await Promise.all([
    orderStore.fetchOrders(),
    orderStore.fetchAllStageTransitions(),
    orderStore.fetchOrderCategories(),
    paymentStore.fetchPaymentRecords(),
    customerStore.fetchCustomers(),
    settingsStore.fetchSources(),
    settingsStore.fetchCategories(),
    settingsStore.fetchStages(),
  ])
})
</script>

<style scoped>
.stats-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-bottom: var(--space-section);
}
.stats-range-chips {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.stats-range-chip {
  padding: 0.375rem 0.875rem;
  border-radius: 999px;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  background: color-mix(in srgb, var(--color-surface) 60%, transparent);
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: all 0.18s ease;
}
.stats-range-chip:hover {
  border-color: var(--color-accent-glow);
  color: var(--color-text);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}
.stats-range-chip.is-active {
  background: linear-gradient(135deg, var(--color-accent), var(--color-accent-glow));
  border-color: transparent;
  color: #fff;
  box-shadow: 0 0 14px var(--color-accent-glow);
}
.stats-custom-range {
  min-width: 260px;
}
.stats-range-label {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  margin-left: auto;
  font-variant-numeric: tabular-nums;
}
.stats-export-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  height: 33px;
}

/* ===== KPI 卡 ===== */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--space-4);
  margin-bottom: var(--space-section);
}
@media (max-width: 700px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
.stat-card {
  position: relative;
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
}
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
}
.stat-card::after {
  content: '';
  position: absolute;
  top: -40%;
  right: -30%;
  width: 70%;
  height: 90%;
  border-radius: 50%;
  background: radial-gradient(circle, var(--color-accent-glow), transparent 70%);
  opacity: 0.14;
  pointer-events: none;
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
}
.stat-icon.is-success { background: color-mix(in srgb, var(--color-success) 16%, transparent); color: var(--color-success); }
.stat-icon.is-danger { background: color-mix(in srgb, var(--color-danger) 16%, transparent); color: var(--color-danger); }
.stat-icon.is-accent { background: color-mix(in srgb, var(--color-accent) 16%, transparent); color: var(--color-accent); }
.stat-icon.is-warning { background: color-mix(in srgb, var(--color-warning) 16%, transparent); color: var(--color-warning); }
.stat-icon.is-info { background: color-mix(in srgb, var(--color-info) 16%, transparent); color: var(--color-info); }
.stat-value {
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}
.stat-label {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  margin-top: 0.125rem;
}

/* ===== Section / 图表面板 ===== */
.stats-section {
  margin-bottom: var(--space-section);
}
.stats-section .glass-card-header {
  position: relative;
}
.stats-section .glass-card-header::after {
  content: '';
  position: absolute;
  left: var(--space-4);
  right: var(--space-4);
  bottom: 0;
  height: 1px;
  background: linear-gradient(90deg, var(--color-accent-glow), transparent 70%);
  opacity: 0.35;
  pointer-events: none;
}
.stats-chart-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
  padding: var(--space-4);
}
.stats-chart-grid .is-narrow {
  grid-column: auto;
}
.stats-chart-grid .is-wide {
  grid-column: 1 / -1;
}
/* 小屏（平板竖屏 / 手机）：单列 */
@media (max-width: 960px) {
  .stats-chart-grid {
    grid-template-columns: 1fr;
  }
  .stats-chart-grid .is-wide {
    grid-column: auto;
  }
}
.stats-chart-panel {
  min-width: 0;
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--color-surface) 40%, transparent);
  border: 1px solid var(--color-border);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.stats-chart-panel:hover {
  border-color: color-mix(in srgb, var(--color-accent-glow) 55%, var(--color-border));
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.14);
}

/* 图表小标题：渐变竖条 + 主标题 + 副说明 */
.stats-chart-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}
.stats-chart-head .stats-chart-title {
  margin-bottom: 0;
}
.stats-chart-title {
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--color-text);
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  line-height: 1.4;
}
.stats-chart-title::before {
  content: '';
  align-self: center;
  width: 3px;
  height: 1em;
  border-radius: 2px;
  background: linear-gradient(180deg, var(--color-accent), var(--color-accent-glow));
  flex-shrink: 0;
}
/* 收入趋势粒度切换 chips */
.stats-granularity-chips {
  display: inline-flex;
  gap: 0.25rem;
  flex-shrink: 0;
  padding: 0.125rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--color-surface) 60%, transparent);
  border: 1px solid var(--color-border);
}
.stats-gran-chip {
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-full);
  font-size: 0.72rem;
  color: var(--color-text-muted);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.18s ease;
}
.stats-gran-chip:hover {
  color: var(--color-text);
}
.stats-gran-chip.is-active {
  background: linear-gradient(135deg, var(--color-accent), var(--color-accent-glow));
  color: #fff;
  box-shadow: 0 0 10px var(--color-accent-glow);
}
/* 金额分布粒度输入框（x 轴单位长度） */
.stats-step-control {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.125rem 0.5rem 0.125rem 0.125rem;
  border-radius: var(--radius-full);
  background: color-mix(in srgb, var(--color-surface) 60%, transparent);
  border: 1px solid var(--color-border);
  flex-shrink: 0;
}
.stats-step-input {
  width: 72px;
  padding: 0.125rem 0.5rem;
  border-radius: var(--radius-full);
  border: none;
  outline: none;
  font-size: 0.78rem;
  font-family: inherit;
  color: var(--color-text);
  background: color-mix(in srgb, var(--color-surface) 80%, transparent);
  font-variant-numeric: tabular-nums;
  transition: box-shadow 0.18s ease;
}
.stats-step-input:focus {
  box-shadow: 0 0 0 2px var(--color-accent-glow);
}
.stats-step-input::-webkit-outer-spin-button,
.stats-step-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.stats-step-unit {
  font-size: 0.72rem;
  color: var(--color-text-muted);
  white-space: nowrap;
}

/* 账款异常 mini 指标 */
.stats-mini-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 170px), 1fr));
  gap: var(--space-3);
  padding: 0 var(--space-4) var(--space-3);
}
.stats-mini-card {
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--color-surface) 50%, transparent);
  border: 1px solid var(--color-border);
  text-align: center;
}
.stats-mini-value {
  font-size: 1.3rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.stats-mini-label {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-top: 0.25rem;
}
</style>

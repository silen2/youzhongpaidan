<template>
  <div class="fluid-container gantt-root">
    <div class="gantt-inner">
      <PageHeader title="排期甘特图" subtitle="可视化查看订单排期，拖拽可调整时间" :icon="CalendarRangeIcon">
      </PageHeader>

      <!-- 工具栏：搜索 / 缩放 / 今天定位 / 筛选 / 图例 -->
      <div class="glass-toolbar gantt-toolbar shrink-0">
        <div class="gantt-toolbar-left">
          <!-- 关键字搜索：订单号 / 名称 / 客户名 -->
          <div class="gantt-search">
            <Search class="gantt-search-icon" />
            <input
              v-model="keyword"
              class="gantt-search-input"
              type="text"
              placeholder="搜索订单号 / 名称 / 客户..."
              aria-label="搜索订单"
            />
            <button v-if="keyword" type="button" class="gantt-search-clear" @click="keyword = ''">
              <X class="w-3.5 h-3.5" />
            </button>
          </div>

          <!-- 显示模式切换已移除：行高固定，专注排期可视化 -->
          <button type="button" class="glass-btn glass-btn-ghost glass-btn-sm" @click="jumpToday">
            <MapPin class="w-3.5 h-3.5" /> 今天
          </button>
        </div>

        <div class="gantt-toolbar-right">
          <DropdownSelect
            v-model="customerFilter"
            :options="customerFilterOptions"
            searchable
            search-placeholder="搜索客户..."
            placeholder="全部客户"
            aria-label="筛选客户"
            teleport-to-body
          />
          <MultiSelect
            v-model="stageFilter"
            :options="settingsStore.stages.map(s => ({ value: s.id, label: s.name }))"
            placeholder="全部阶段"
            aria-label="筛选阶段"
            :max-display="2"
          />
          <!-- 颜色图例：按钮 + 弹出面板（阶段多时可滚动，不占工具栏空间） -->
          <div class="gantt-legend-wrap" ref="legendWrapRef">
            <button
              type="button"
              class="glass-btn glass-btn-ghost glass-btn-sm"
              :class="{ 'is-active': legendOpen }"
              @click="legendOpen = !legendOpen"
            >
              <Palette class="w-3.5 h-3.5" /> 图例
              <span class="gantt-legend-count">{{ settingsStore.stages.length }}</span>
            </button>
            <transition name="gantt-legend-fade">
              <div v-if="legendOpen" class="gantt-legend-panel">
                <div class="gantt-legend-grid">
                  <button
                    v-for="s in settingsStore.stages"
                    :key="s.id"
                    type="button"
                    class="gantt-legend-item"
                    :class="{ 'is-active': stageFilter.length === 0 || stageFilter.includes(s.id) }"
                    :title="s.name"
                    @click="toggleStageLegend(s.id)"
                  >
                    <span class="gantt-legend-dot" :style="{ background: s.color }"></span>
                    <span class="gantt-legend-name">{{ s.name }}</span>
                  </button>
                </div>
              </div>
            </transition>
          </div>
        </div>
      </div>

      <!-- 甘特图主体：左侧任务栏 + 右侧时间轴/条带区 -->
      <div class="glass-card gantt-card">
        <div class="gantt-body">
          <!-- 左侧任务栏（固定列，纵向与甘特区同步滚动） -->
          <div class="gantt-labels" :style="{ width: LABEL_W + 'px' }">
            <div class="gantt-labels-head">订单</div>
            <div ref="labelsBodyRef" class="gantt-labels-body" :style="{ height: bodyH + 'px' }">
              <div
                v-for="row in ganttRows"
                :key="row.order.id"
                class="gantt-label-row"
                :style="{ height: rowHeightOf(row.order.id) + 'px' }"
              >
                <span class="gantt-label-dot" :style="{ background: stageColor(row.order) }"></span>
                <span class="gantt-label-customer" :title="customerName(row.order.customerId)">{{ customerName(row.order.customerId) }}</span>
                <span class="gantt-label-name" :title="row.order.orderNo" @click="goOrder(row.order.id)">{{ row.order.name }}</span>
                <!-- 行间分割线：悬浮出现，拖拽整体缩放全部行高（表格式，整行两端联动高亮） -->
                <span
                  class="gantt-row-resizer"
                  :class="{ 'is-active': hoverResizeOrderId === row.order.id }"
                  title="拖动整体缩放行高"
                  @pointerenter="hoverResizeOrderId = row.order.id"
                  @pointerleave="hoverResizeOrderId = ''"
                  @pointerdown="onRowResizerPointerDown(row.order.id, $event)"
                  @pointermove="onRowResizerPointerMove"
                  @pointerup="onRowResizerPointerUp"
                  @pointercancel="onRowResizerPointerUp"
                ></span>
              </div>

              <div v-if="ganttRows.length === 0" class="gantt-empty-label">暂无订单</div>
            </div>
          </div>

          <!-- 甘特区（横向 + 纵向滚动，时间轴 sticky） -->
          <div
            ref="scrollRef"
            class="gantt-scroll"
            @scroll="onScroll"
            @wheel="onWheelZoom"
            @pointerdown="onScrollPointerDown"
            @pointermove="onScrollPointerMove"
            @pointerup="onScrollPointerUp"
            @pointercancel="onScrollPointerUp"
          >
            <div class="gantt-canvas" ref="canvasRef" :style="{ width: canvasW + 'px', height: canvasH + 'px' }">
              <!-- 顶部时间轴（sticky top，横向随滚动） -->
              <div class="gantt-timeline" :style="{ width: canvasW + 'px', height: TIMELINE_H + 'px' }">
                <div
                  v-for="tick in ticks"
                  :key="tick.ts"
                  class="gantt-tick"
                  :style="{ left: tickX(tick.ts) + 'px' }"
                >
                  <span class="gantt-tick-label">{{ tick.label }}</span>
                </div>
              </div>

              <!-- 竖向网格（当前缩放单位） -->
              <div class="gantt-grid" :style="{ width: canvasW + 'px' }">
                <div
                  v-for="tick in ticks"
                  :key="'g' + tick.ts"
                  class="gantt-grid-line"
                  :style="{ left: tickX(tick.ts) + 'px' }"
                ></div>
              </div>

              <!-- 条带区 -->
              <div class="gantt-rows">
                <div
                  v-for="row in ganttRows"
                  :key="row.order.id"
                  class="gantt-row"
                  :style="{ top: (rowTops.get(row.order.id) ?? TIMELINE_H) + 'px', height: rowHeightOf(row.order.id) + 'px' }"
                >
                  <!-- 上轨道：预期层（可拖拽调整时间） -->
                  <div
                    class="gantt-bar"
                    :class="{
                      'is-dragging': dragState.orderId === row.order.id,
                      'is-editing': preview && preview.orderId === row.order.id,
                      'is-overdue': statusOf(row.order) === 'overdue',
                      'is-finished': statusOf(row.order) === 'completed' || statusOf(row.order) === 'completed_early',
                    }"
                    :style="barStyle(row)"
                    @pointerdown="onBarPointerDown(row.order, $event)"
                  >
                    <span class="gantt-bar-handle is-start" title="拖动调整开始日期"></span>
                    <span class="gantt-bar-text">{{ row.order.orderNo }} {{ row.order.name }}</span>
                    <span class="gantt-bar-handle is-end" title="拖动调整结束日期"></span>
                    <span v-if="statusOf(row.order) === 'overdue'" class="gantt-bar-badge is-overdue">超期</span>
                    <span
                      v-if="statusOf(row.order) === 'completed' || statusOf(row.order) === 'completed_early'"
                      class="gantt-bar-badge is-done"
                      title="已完工"
                    >
                      <CheckCheck class="w-3 h-3" />
                    </span>
                  </div>
                  <!-- 下轨道：实际层（阶段流转生成，不可调整）——整体圆角矩形，内部按流转时间戳分段染色 -->
                  <div
                    v-if="row.layer"
                    class="gantt-bar-actual"
                    :style="{ left: row.layer.base.left, width: row.layer.base.width }"
                    :title="row.layer.base.title"
                  >
                    <span
                      v-for="(seg, i) in row.layer.segs"
                      :key="i"
                      class="gantt-bar-actual-seg"
                      :style="{ left: seg.left, width: seg.width, '--bar-color': seg.color }"
                      :title="seg.title"
                    ></span>
                  </div>
                  <!-- 行间分割线（甘特区）：悬浮出现，拖拽整体缩放全部行高（与左侧任务栏同一条线） -->
                  <span
                    class="gantt-row-resizer"
                    :class="{ 'is-active': hoverResizeOrderId === row.order.id }"
                    title="拖动整体缩放行高"
                    @pointerenter="hoverResizeOrderId = row.order.id"
                    @pointerleave="hoverResizeOrderId = ''"
                    @pointerdown="onRowResizerPointerDown(row.order.id, $event)"
                    @pointermove="onRowResizerPointerMove"
                    @pointerup="onRowResizerPointerUp"
                    @pointercancel="onRowResizerPointerUp"
                  ></span>
                </div>

                <div v-if="ganttRows.length === 0" class="gantt-empty">
                  <CalendarRangeIcon class="gantt-empty-icon" />
                  <p class="gantt-empty-title">暂无排期订单</p>
                  <p class="gantt-empty-sub">在订单列表新建订单并填写排期，或调整上方搜索/筛选条件</p>
                </div>
              </div>

              <!-- 当前时间垂直线 -->
              <div class="gantt-today-line" :style="{ left: todayX + 'px', height: canvasH + 'px' }"></div>
            </div>

            <!-- 缩放指示（密度标签，右下角悬浮） -->
            <div class="gantt-zoom-hint">{{ zoomHint }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { CalendarRange as CalendarRangeIcon, MapPin, CheckCheck, Search, X, Palette } from '@lucide/vue'
import { useOrderStore } from '@/stores/order'
import { useCustomerStore } from '@/stores/customer'
import { useSettingsStore } from '@/stores/settings'
import { usePreferencesStore } from '@/stores/preferences'
import PageHeader from '@/components/common/PageHeader.vue'
import DropdownSelect from '@/components/common/DropdownSelect.vue'
import MultiSelect from '@/components/common/MultiSelect.vue'
import { MIN_PX_PER_DAY, MAX_PX_PER_DAY, inferTickUnit, timeToX, xToTime, buildTicks, snapToUnit, computeRange } from '@/domain/gantt/gantt-scales'
import { parseLocalDay, formatLocalDay, startOfDay, DAY_MS } from '@/domain/gantt/gantt-time'
import { deriveScheduleProgress, buildStageSegments, type ScheduleProgress } from '@/domain/schedule/schedule-progress'
import { computeScheduleStatus, type ScheduleStatus } from '@/domain/schedule/schedule-status'
import type { Order, Stage, StageTransition } from '@/types'

const router = useRouter()
const orderStore = useOrderStore()
const customerStore = useCustomerStore()
const settingsStore = useSettingsStore()
const prefs = usePreferencesStore()

const TIMELINE_H = 56
/** 左侧任务栏宽度（偏好设置可调） */
const LABEL_W = computed(() => prefs.preferences.ganttLabelWidth)
/** 默认行高（偏好设置可调；每行可独立调整，表格式） */
const ROW_H = computed(() => prefs.preferences.ganttRowHeight)
const MIN_ROW_H = computed(() => prefs.preferences.ganttMinRowHeight)
const MAX_ROW_H = computed(() => prefs.preferences.ganttMaxRowHeight)
/** 每行实际高度（订单 id → 高度，默认 ROW_H） */
const rowHeights = ref<Record<string, number>>({})
function rowHeightOf(orderId: string): number {
  return rowHeights.value[orderId] ?? ROW_H.value
}

/** 连续缩放密度（px/天），滚轮/双指调整，默认密度来自偏好设置 */
const pxPerDay = ref(prefs.preferences.ganttDefaultPxPerDay)

const customerFilter = ref('')
const stageFilter = ref<string[]>([])
/** 关键字搜索：订单号 / 名称 / 客户名模糊匹配 */
const keyword = ref('')
/** 图例面板开关 */
const legendOpen = ref(false)
const legendWrapRef = ref<HTMLElement | null>(null)
/** 进入页面时的今天（本地日 0 点时间戳，避免页面停留跨天跳动） */
const todayTs = startOfDay(Date.now())

const scrollRef = ref<HTMLElement | null>(null)
const labelsBodyRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLElement | null>(null)

// ===== 数据派生 =====

/** 有排期的活跃订单（非结单/退单，且开始结束均合法）。排期强制后所有活跃订单均有排期。 */
const scheduledOrders = computed(() =>
  orderStore.orders.filter(o => {
    if (o.orderStatus === 'completed' || o.orderStatus === 'voided') return false
    const s = parseLocalDay(o.expectedStartDate)
    const e = parseLocalDay(o.expectedEndDate)
    return Number.isFinite(s) && Number.isFinite(e) && e >= s
  }),
)

/** 订单 id → 流转记录（升序），用于实际进度推导 */
const transitionsByOrder = computed(() => {
  const map = new Map<string, StageTransition[]>()
  for (const t of orderStore.allStageTransitions) {
    const list = map.get(t.orderId)
    if (list) list.push(t)
    else map.set(t.orderId, [t])
  }
  for (const list of map.values()) list.sort((a, b) => a.transitionDate.localeCompare(b.transitionDate))
  return map
})

/** 订单实际进度（由流转记录推导，仅用于条带实际层/状态判定） */
function progressOf(order: Order): ScheduleProgress {
  return deriveScheduleProgress(transitionsByOrder.value.get(order.id) ?? [])
}

/** 订单排期状态（超期/完工等判定） */
function statusOf(order: Order): ScheduleStatus {
  return computeScheduleStatus(
    order.expectedStartDate,
    order.expectedEndDate,
    progressOf(order),
    formatLocalDay(todayTs),
  )
}

const customerFilterOptions = computed(() => [
  { value: '', label: '全部客户' },
  ...customerStore.customers.map(c => ({ value: c.id, label: c.name })),
])

/** 客户 id → 客户名（搜索与展示用） */
const customerNameMap = computed(() => new Map(customerStore.customers.map(c => [c.id, c.name])))

/** 筛选后的订单（客户 + 阶段 + 关键字） */
const filteredOrders = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return scheduledOrders.value.filter(o => {
    if (customerFilter.value && o.customerId !== customerFilter.value) return false
    if (stageFilter.value.length > 0 && !stageFilter.value.includes(o.currentStage)) return false
    if (kw) {
      const customerName = customerNameMap.value.get(o.customerId) ?? ''
      const hit =
        o.orderNo.toLowerCase().includes(kw) ||
        o.name.toLowerCase().includes(kw) ||
        customerName.toLowerCase().includes(kw)
      if (!hit) return false
    }
    return true
  })
})

/** 图例项点击：切换该阶段的筛选（单点=只看该阶段，再次点击=恢复全部） */
function toggleStageLegend(stageId: string) {
  if (stageFilter.value.includes(stageId)) {
    stageFilter.value = []
  } else {
    stageFilter.value = [stageId]
  }
}

const range = computed(() =>
  computeRange(
    filteredOrders.value.map(o => ({ start: o.expectedStartDate, end: o.expectedEndDate })),
    todayTs,
    pxPerDay.value,
    viewW.value,
    prefs.preferences.ganttMinRangeDays,
  ),
)
const ticks = computed(() => buildTicks(range.value.start, range.value.end, pxPerDay.value))

/** 缩放指示文案（当前密度对应的刻度粒度） */
const zoomHint = computed(() => {
  const unit = inferTickUnit(pxPerDay.value)
  const unitLabel: Record<string, string> = { day: '日', week: '周', month: '月', quarter: '季' }
  return `${Math.round(pxPerDay.value)}px/天 · ${unitLabel[unit]}视图`
})

function tickX(ts: number): number {
  return timeToX(ts, range.value.start, pxPerDay.value)
}

/** 显示范围总像素（含最后一格） */
const canvasW = computed(() => timeToX(range.value.end, range.value.start, pxPerDay.value) + pxPerDay.value * 1)

/** 订单显示顺序：开始时间升序，同日开始按创建时间（与行布局严格一致） */
function orderSortKey(a: Order, b: Order): number {
  return parseLocalDay(a.expectedStartDate) - parseLocalDay(b.expectedStartDate) || a.createdAt.localeCompare(b.createdAt)
}

/** 每个订单的行顶 y：从时间轴下方按显示顺序逐行累加行高（每订单一行，表格式，
 * 保证左侧订单栏与甘特区严格对齐，不依赖 track 合并压缩） */
const rowTops = computed(() => {
  const tops = new Map<string, number>()
  let y = TIMELINE_H
  for (const r of ganttRows.value) {
    tops.set(r.order.id, y)
    y += rowHeightOf(r.order.id)
  }
  return tops
})

/** 甘特区总高：内容行高 + 时间轴高度；纵向撑满视口时以视口高度为下限（由 bodyH 兜底） */
const contentH = computed(() => TIMELINE_H + ganttRows.value.reduce((sum, r) => sum + rowHeightOf(r.order.id), 0))
/** 甘特区最终高度 = max(内容高度, 可视区域高度)，单子少时撑满视口不显空 */
const canvasH = computed(() => Math.max(contentH.value, bodyH.value))
/** 滚动容器高度（视口剩余） */
const bodyH = ref(400)
/** 甘特区视口宽度（低密度缩放时扩大时间窗铺满视口） */
const viewW = ref(0)

const ganttRows = computed(() =>
  [...filteredOrders.value]
    .sort(orderSortKey)
    .map(order => ({ order, layer: buildActualLayer(order) })),
)

function stageOf(order: Order): Stage | undefined {
  return settingsStore.stages.find(s => s.id === order.currentStage)
}
function stageColor(order: Order): string {
  return stageOf(order)?.color ?? 'var(--color-text-muted)'
}

/** 客户名（左侧任务栏展示用） */
function customerName(id: string): string {
  return customerNameMap.value.get(id) ?? '—'
}

/** 条带样式：左/宽按时间换算；预览拖拽中的临时值。
 * 双轨设计：计划层（打底半透明）由本样式定位，实际层由实际层布局叠加。 */
function barStyle(row: { order: Order }) {
  const o = row.order
  const pre = preview.value && preview.value.orderId === o.id ? preview.value : null
  const s = parseLocalDay(pre?.start ?? o.expectedStartDate)
  const e = parseLocalDay(pre?.end ?? o.expectedEndDate)
  const left = timeToX(s, range.value.start, pxPerDay.value)
  const width = timeToX(e + DAY_MS, range.value.start, pxPerDay.value) - left
  const color = stageColor(o)
  return {
    left: `${left}px`,
    width: `${Math.max(width, 8)}px`,
    '--bar-color': color,
  }
}

/** 实际层布局：整体圆角矩形（实际开始 → 实际结束/至今）+ 内部按流转时间戳染色的阶段色条 */
interface ActualLayerLayout {
  base: { left: string; width: string; title: string }
  segs: Array<{ left: string; width: string; color: string; title: string }>
}

/** 由流转记录构建实际层：外层是一个覆盖「实际开始→实际结束」的圆角矩形，
 * 内层色条按时间戳精确分割染色（同一行内不同颜色段连续拼接），由外层裁剪出圆角。
 * 未开工（仍在待开始）返回 null。 */
function buildActualLayer(order: Order): ActualLayerLayout | null {
  const segments = buildStageSegments(transitionsByOrder.value.get(order.id) ?? [], Date.now())
  if (segments.length === 0) return null
  const baseStart = segments[0].startTs
  const baseEnd = segments[segments.length - 1].endTs
  const baseLeft = timeToX(baseStart, range.value.start, pxPerDay.value)
  const baseW = Math.max(timeToX(baseEnd, range.value.start, pxPerDay.value) - baseLeft, 2)
  const segs = segments.map(seg => ({
    left: `${Math.max(timeToX(seg.startTs, range.value.start, pxPerDay.value) - baseLeft, 0)}px`,
    width: `${Math.max(timeToX(seg.endTs, range.value.start, pxPerDay.value) - timeToX(seg.startTs, range.value.start, pxPerDay.value), 2)}px`,
    color: seg.color,
    title: `${seg.stageName} ${fmtTs(seg.startTs)} ~ ${fmtTs(seg.endTs)}`,
  }))
  return {
    base: {
      left: `${baseLeft}px`,
      width: `${baseW}px`,
      title: `实际 ${fmtTs(baseStart)} ~ ${fmtTs(baseEnd)}`,
    },
    segs,
  }
}

/** 时间戳 → 'YYYY-MM-DD HH:mm'（悬浮提示用） */
function fmtTs(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const todayX = computed(() => timeToX(todayTs, range.value.start, pxPerDay.value))

// ===== 滚动同步（任务栏纵向 ↔ 甘特区） =====
function onScroll() {
  if (labelsBodyRef.value && scrollRef.value) {
    labelsBodyRef.value.scrollTop = scrollRef.value.scrollTop
  }
}

/** 「今天」定位：滚到当前时间所在位置 */
function jumpToday() {
  const el = scrollRef.value
  if (!el) return
  el.scrollLeft = Math.max(0, todayX.value - el.clientWidth / 2)
}

// ===== 拖拽（pointer events：整条平移 / 边缘调时长） =====
interface DragState {
  orderId: string
  pointerId: number
  startX: number
  mode: 'move' | 'start' | 'end'
  origStart: number
  origEnd: number
  /** 按下时指针吸附后的时间（用于平移时保持抓取偏移，避免条带瞬移到指针处） */
  grabSnapped: number
  active: boolean
  /** 条带所在 canvas 的视口左边缘（用于 clientX → canvas x 换算，含滚动偏移） */
  canvasLeft: number
  scrollLeft: number
}
const dragState: DragState = { orderId: '', pointerId: -1, startX: 0, mode: 'move', origStart: 0, origEnd: 0, grabSnapped: 0, active: false, canvasLeft: 0, scrollLeft: 0 }
const preview = ref<{ orderId: string; start: string; end: string } | null>(null)

function onBarPointerDown(order: Order, e: PointerEvent) {
  const target = e.target as HTMLElement
  let mode: DragState['mode'] = 'move'
  if (target.closest('.gantt-bar-handle.is-start')) mode = 'start'
  else if (target.closest('.gantt-bar-handle.is-end')) mode = 'end'
  const s = parseLocalDay(order.expectedStartDate)
  const e2 = parseLocalDay(order.expectedEndDate)
  if (!Number.isFinite(s) || !Number.isFinite(e2)) return
  const canvas = canvasRef.value
  dragState.orderId = order.id
  dragState.pointerId = e.pointerId
  dragState.startX = e.clientX
  dragState.mode = mode
  dragState.origStart = s
  dragState.origEnd = e2
  dragState.active = false
  dragState.canvasLeft = canvas?.getBoundingClientRect().left ?? 0
  dragState.scrollLeft = scrollRef.value?.scrollLeft ?? 0
  // 记录指针按下处吸附后的时间（平移按「当前-按下」差值移动，保持抓取偏移不跳变）
  const downTs = xToTime(clientXToCanvasX(e.clientX), range.value.start, pxPerDay.value)
  dragState.grabSnapped = snapToUnit(downTs)
  try { ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* 合成事件忽略 */ }
}

function clientXToCanvasX(clientX: number): number {
  return clientX - dragState.canvasLeft + dragState.scrollLeft
}

function onBarPointerMove(e: PointerEvent) {
  if (dragState.pointerId !== e.pointerId || !dragState.orderId) return
  if (!dragState.active && Math.abs(e.clientX - dragState.startX) < 3) return
  dragState.active = true

  const rawTs = xToTime(clientXToCanvasX(e.clientX), range.value.start, pxPerDay.value)
  const snapped = snapToUnit(rawTs)

  const { origStart, origEnd, mode, grabSnapped } = dragState
  let ns = origStart
  let ne = origEnd
  if (mode === 'move') {
    const delta = snapped - grabSnapped
    ns = origStart + delta
    ne = origEnd + delta
  } else if (mode === 'start') {
    ns = Math.min(snapped, origEnd - DAY_MS)
    ne = origEnd
  } else {
    ne = Math.max(snapped, origStart + DAY_MS)
    ns = origStart
  }
  if (ns !== origStart || ne !== origEnd) {
    preview.value = { orderId: dragState.orderId, start: formatLocalDay(ns), end: formatLocalDay(ne) }
  }
}

function onBarPointerUp(e: PointerEvent) {
  if (dragState.pointerId !== e.pointerId) return
  const { orderId, origStart, origEnd, active } = dragState
  dragState.orderId = ''
  dragState.pointerId = -1
  dragState.active = false
  if (!active || !preview.value || preview.value.orderId !== orderId) {
    preview.value = null
    return
  }
  const { start, end } = preview.value
  preview.value = null
  const ns = parseLocalDay(start)
  const ne = parseLocalDay(end)
  if (ns === origStart && ne === origEnd) return
  // 同步订单（详情/看板/客户详情排期联动）
  void orderStore.updateOrder(orderId, { expectedStartDate: start, expectedEndDate: end })
}

function goOrder(id: string) { router.push(`/orders/${id}`) }

// ===== 连续缩放：滚轮（PC）+ 双指捏合（触屏） =====
/** 密度调整：保持鼠标/两指中点下的时间锚点不位移，缩放后回位 */
function applyZoomFactor(factor: number, anchorClientX: number) {
  const el = scrollRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const viewX = anchorClientX - rect.left // 视口内 x
  const anchorTs = xToTime(viewX + el.scrollLeft, range.value.start, pxPerDay.value)
  const next = Math.min(MAX_PX_PER_DAY, Math.max(MIN_PX_PER_DAY, pxPerDay.value * factor))
  if (next === pxPerDay.value) return
  pxPerDay.value = next
  // 保持锚点时间仍在原视口位置
  const newX = timeToX(anchorTs, range.value.start, pxPerDay.value)
  el.scrollLeft = Math.max(0, newX - viewX)
}

function onWheelZoom(e: WheelEvent) {
  if (e.ctrlKey) return // 保留浏览器页面缩放
  e.preventDefault()
  const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
  applyZoomFactor(factor, e.clientX)
}

/** 触屏双指缩放：横向（两指水平距离变化）缩放时间轴密度，纵向（两指垂直距离变化）统一调整所有行高 */
const activePointers = new Map<number, { x: number; y: number }>()
let pinchStartDx = 0
let pinchStartDy = 0
let pinchStartPx = 0
let pinchStartHeights: Record<string, number> = {}

function onScrollPointerDown(e: PointerEvent) {
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (activePointers.size === 2) {
    // 进入捏合：记录初始横/纵距离与当前密度/行高，取消进行中的单指拖拽
    dragState.orderId = ''
    dragState.pointerId = -1
    dragState.active = false
    preview.value = null
    pinchStartDx = pinchDeltaX()
    pinchStartDy = pinchDeltaY()
    pinchStartPx = pxPerDay.value
    pinchStartHeights = { ...rowHeights.value }
  }
}

function onScrollPointerMove(e: PointerEvent) {
  const p = activePointers.get(e.pointerId)
  if (!p) return
  p.x = e.clientX
  p.y = e.clientY
  if (activePointers.size !== 2) return

  // 横向：时间轴密度
  const dx = pinchDeltaX()
  if (pinchStartDx > 0) {
    const factorX = dx / pinchStartDx
    const nextPx = Math.min(MAX_PX_PER_DAY, Math.max(MIN_PX_PER_DAY, Math.round(pinchStartPx * factorX)))
    if (nextPx !== pxPerDay.value) pxPerDay.value = nextPx
  }
  // 纵向：统一缩放所有行高（以 44 为基准比例）
  const dy = pinchDeltaY()
  if (pinchStartDy > 0) {
    const factorY = dy / pinchStartDy
    const next: Record<string, number> = {}
    for (const o of filteredOrders.value) {
      const base = pinchStartHeights[o.id] ?? ROW_H.value
      next[o.id] = Math.min(MAX_ROW_H.value, Math.max(MIN_ROW_H.value, Math.round(base * factorY)))
    }
    rowHeights.value = next
  }
}

function onScrollPointerUp(e: PointerEvent) {
  activePointers.delete(e.pointerId)
  pinchStartDx = 0
  pinchStartDy = 0
}

/** 两指水平距离 */
function pinchDeltaX(): number {
  const pts = [...activePointers.values()]
  if (pts.length !== 2) return 0
  return Math.abs(pts[0].x - pts[1].x)
}

/** 两指垂直距离 */
function pinchDeltaY(): number {
  const pts = [...activePointers.values()]
  if (pts.length !== 2) return 0
  return Math.abs(pts[0].y - pts[1].y)
}

// ===== 订单行间分割线：拖拽整体缩放全部行高（表格式，整行两端联动高亮） =====
let rowResizeOrderId = ''
let rowResizeStartY = 0
let rowResizeStartH = 0
/** 拖动开始时的各订单行高快照（整体按同一比例缩放） */
let rowResizeStartHeights: Record<string, number> = {}
/** 当前悬浮的整行分割线（订单 id）：左侧任务栏 + 甘特区两端同时高亮 */
const hoverResizeOrderId = ref('')

function onRowResizerPointerDown(orderId: string, e: PointerEvent) {
  rowResizeOrderId = orderId
  rowResizeStartY = e.clientY
  rowResizeStartH = rowHeightOf(orderId)
  rowResizeStartHeights = { ...rowHeights.value }
  try { ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* 合成事件忽略 */ }
}

function onRowResizerPointerMove(e: PointerEvent) {
  if (!rowResizeOrderId) return
  const deltaY = e.clientY - rowResizeStartY
  // 整体缩放：以被拖行的起始高度为基准，所有行按同一比例放大/缩小。
  // 比例可降到 0（大幅上拖 → 全部压到最小行高），不能为负。
  const factor = Math.max((rowResizeStartH + deltaY) / rowResizeStartH, 0)
  const next: Record<string, number> = {}
  for (const o of filteredOrders.value) {
    const base = rowResizeStartHeights[o.id] ?? ROW_H.value
    next[o.id] = Math.min(MAX_ROW_H.value, Math.max(MIN_ROW_H.value, Math.round(base * factor)))
  }
  rowHeights.value = next
}

function onRowResizerPointerUp() {
  rowResizeOrderId = ''
  rowResizeStartHeights = {}
}

/** 点击图例面板外部时关闭 */
function onDocClick(e: MouseEvent) {
  if (legendWrapRef.value && !legendWrapRef.value.contains(e.target as Node)) {
    legendOpen.value = false
  }
}

let resizeObserver: ResizeObserver | null = null

onMounted(async () => {
  await Promise.all([
    orderStore.fetchOrders(),
    orderStore.fetchAllStageTransitions(),
    customerStore.fetchCustomers(),
    settingsStore.fetchStages(),
  ])
  // 全局监听拖拽（pointer capture 失效时兜底）
  document.addEventListener('pointermove', onBarPointerMove as EventListener)
  document.addEventListener('pointerup', onBarPointerUp as EventListener)
  document.addEventListener('mousedown', onDocClick)
  // 甘特区尺寸变化 → 同步左侧任务栏可视高度 / 视口宽度（时间窗铺满视口）
  const el = scrollRef.value
  if (el) {
    bodyH.value = el.clientHeight
    viewW.value = el.clientWidth
    resizeObserver = new ResizeObserver(() => {
      bodyH.value = el.clientHeight
      viewW.value = el.clientWidth
    })
    resizeObserver.observe(el)
  }
  // 初始定位到今天
  requestAnimationFrame(jumpToday)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointermove', onBarPointerMove as EventListener)
  document.removeEventListener('pointerup', onBarPointerUp as EventListener)
  document.removeEventListener('mousedown', onDocClick)
  resizeObserver?.disconnect()
  resizeObserver = null
})
</script>

<style scoped>
/* 撑满布局（同其他列表页） */
.gantt-root {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.gantt-inner {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.gantt-inner .gantt-toolbar {
  margin-bottom: var(--space-section);
}

/* 工具栏：更精致的毛玻璃条 */
.gantt-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 6%, transparent), transparent 45%),
    var(--glass-bg-strong);
  backdrop-filter: blur(var(--glass-blur));
  box-shadow: var(--shadow-glass), var(--shadow-inner-glass);
  transition: border-color 0.2s, box-shadow 0.2s;
}
.gantt-toolbar:focus-within {
  border-color: color-mix(in srgb, var(--color-accent) 40%, transparent);
  box-shadow: var(--shadow-glass), 0 0 0 3px var(--color-accent-soft);
}
.gantt-toolbar-left,
.gantt-toolbar-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  flex-wrap: wrap;
}

/* ===== 工具栏控件统一：搜索框 / 下拉 / 多选 / 按钮 等高、同字号、同圆角、同文字色 ===== */
.gantt-toolbar .gantt-search,
.gantt-toolbar :deep(.dropdown-select-trigger),
.gantt-toolbar :deep(.multiselect-trigger),
.gantt-toolbar .glass-btn {
  height: 34px;
  min-height: 34px;
  font-size: 0.82rem;
  border-radius: var(--radius-full);
  color: var(--color-text-secondary);
  box-sizing: border-box;
}
/* 控件底色/边框统一（下拉、多选、按钮都是同一套玻璃药丸） */
.gantt-toolbar :deep(.dropdown-select-trigger),
.gantt-toolbar :deep(.multiselect-trigger),
.gantt-toolbar .glass-btn {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
}
.gantt-toolbar .gantt-search-input {
  font-size: 0.82rem;
  color: var(--color-text-secondary);
}
/* 缩放指示（右下角悬浮，随滚动容器视口固定） */
.gantt-zoom-hint {
  position: sticky;
  left: 100%;
  bottom: 0.5rem;
  z-index: 8;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  width: max-content;
  margin-left: auto;
  padding: 0.25rem 0.75rem;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  background: var(--glass-bg-panel);
  backdrop-filter: blur(16px);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--color-text-secondary);
  pointer-events: none;
  box-shadow: var(--shadow-glass), var(--shadow-inner-glass);
  white-space: nowrap;
}
.gantt-zoom-hint::before {
  content: '';
  width: 0.45rem;
  height: 0.45rem;
  border-radius: var(--radius-full);
  background: var(--color-accent);
  box-shadow: 0 0 8px var(--color-accent-glow);
}

/* 关键字搜索框 */
.gantt-search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.75rem;
  height: 34px;
  min-width: 220px;
  width: clamp(220px, 24vw, 320px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur-light));
  box-shadow: var(--shadow-inner-glass);
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
}
.gantt-search:hover {
  border-color: color-mix(in srgb, var(--color-accent) 35%, transparent);
}
.gantt-search:focus-within {
  border-color: var(--color-accent-glow);
  background: var(--glass-bg-hover);
  box-shadow: 0 0 0 3px var(--color-accent-soft), var(--shadow-inner-glass);
}
.gantt-search-icon {
  flex-shrink: 0;
  width: 0.95rem;
  height: 0.95rem;
  color: var(--color-text-muted);
}
.gantt-search-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  color: var(--color-text);
  font-size: 0.82rem;
  font-family: var(--font-body);
  outline: none;
}
.gantt-search-input::placeholder {
  color: var(--color-text-muted);
}
.gantt-search-clear {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  padding: 0.125rem;
  border: none;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}
.gantt-search-clear:hover {
  background: var(--glass-bg-hover);
  color: var(--color-text);
}

/* 图例：按钮 + 弹出面板（阶段多时可滚动网格，不占工具栏空间） */
.gantt-legend-wrap {
  position: relative;
}
.gantt-legend-wrap .glass-btn.is-active {
  border-color: var(--color-accent-glow);
  color: var(--color-accent);
  background: var(--color-accent-soft);
}
.gantt-legend-count {
  display: inline-grid;
  place-items: center;
  min-width: 1.1rem;
  height: 1.1rem;
  padding: 0 0.25rem;
  border-radius: var(--radius-full);
  font-size: 0.65rem;
  font-weight: 700;
  background: var(--glass-bg-hover);
  color: var(--color-text-muted);
}
.gantt-legend-panel {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  z-index: 30;
  width: 260px;
  max-height: 320px;
  overflow-y: auto;
  padding: 0.75rem;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  background: var(--glass-bg-panel);
  backdrop-filter: blur(20px);
  box-shadow: var(--shadow-glass), 0 16px 40px -12px rgba(0, 0, 0, 0.45);
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--color-text) 25%, transparent) transparent;
}
.gantt-legend-panel::-webkit-scrollbar {
  width: 8px;
}
.gantt-legend-panel::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--color-text) 20%, transparent);
  border-radius: var(--radius-full);
  border: 2px solid transparent;
  background-clip: padding-box;
}
.gantt-legend-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.375rem;
}
.gantt-legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.5rem;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-size: 0.75rem;
  color: var(--color-text-muted);
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.12s;
}
.gantt-legend-item:hover {
  background: var(--glass-bg-hover);
  color: var(--color-text);
}
.gantt-legend-item.is-active .gantt-legend-name {
  color: var(--color-text);
}
.gantt-legend-item:not(.is-active) {
  opacity: 0.5;
}
.gantt-legend-dot {
  flex-shrink: 0;
  width: 0.7rem;
  height: 0.7rem;
  border-radius: var(--radius-full);
  box-shadow: 0 0 0 2px color-mix(in srgb, currentColor 12%, transparent);
}
.gantt-legend-name {
  overflow: hidden;
  text-overflow: ellipsis;
}
/* 图例面板淡入淡出 */
.gantt-legend-fade-enter-active,
.gantt-legend-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.gantt-legend-fade-enter-from,
.gantt-legend-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* 甘特图主体卡片 */
.gantt-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.gantt-body {
  flex: 1;
  min-height: 0;
  display: flex;
}

/* 订单行间分割线：悬浮出现拖拽把手，纵向拖动调整该行高度（表格式） */
.gantt-label-row {
  position: relative;
}
.gantt-row-resizer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: -3px;
  height: 6px;
  cursor: row-resize;
  touch-action: none;
  z-index: 6;
}
.gantt-row-resizer::before {
  content: '';
  position: absolute;
  inset: 3px 0;
  background: transparent;
  transition: background 0.15s;
}
/* 悬浮或拖拽中：整行分割线高亮（任务栏端与甘特区端同时亮起） */
.gantt-row-resizer:hover::before,
.gantt-row-resizer.is-active::before {
  background: var(--color-accent-glow);
}

/* 左侧任务栏：更通透的玻璃面板 + 精致表头 */
.gantt-labels {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--glass-border);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--color-accent) 5%, transparent), transparent 120px),
    var(--glass-bg-strong);
  backdrop-filter: blur(var(--glass-blur));
}
.gantt-labels-head {
  height: 56px;
  display: flex;
  align-items: center;
  padding: 0 0.75rem;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.045em;
  color: var(--color-text-secondary);
  border-bottom: 1px solid var(--color-text-muted);
  /* 与客户列表表头一致的玻璃渐变（模仿 .data-table-inner thead th） */
  background: linear-gradient(180deg, color-mix(in srgb, var(--glass-bg-strong) 88%, var(--color-accent-soft)), var(--glass-bg-strong));
  flex-shrink: 0;
}
.gantt-labels-body {
  overflow-y: auto;
  scrollbar-width: none;
  position: relative;
}
.gantt-labels-body::-webkit-scrollbar {
  display: none;
}
.gantt-label-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.625rem;
  border-bottom: 1px solid var(--glass-border-soft);
  min-width: 0;
  transition: background 0.12s;
}
/* 斑马纹：奇数行淡色背景引导视线（与右侧甘特区行背景同步） */
.gantt-label-row:nth-child(odd) {
  background: color-mix(in srgb, var(--color-text) 3%, transparent);
}
.gantt-label-row:hover {
  background: color-mix(in srgb, var(--color-accent) 10%, transparent);
}
.gantt-label-dot {
  flex-shrink: 0;
  width: 0.55rem;
  height: 0.55rem;
  border-radius: var(--radius-full);
  box-shadow: 0 0 6px color-mix(in srgb, currentColor 55%, transparent);
}
.gantt-label-customer {
  flex-shrink: 0;
  max-width: 5.2rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--color-text-muted);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border-soft);
  border-radius: var(--radius-full);
  padding: 0.06em 0.55em;
}
.gantt-label-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.12s;
}
.gantt-label-name:hover {
  color: var(--color-accent);
}
.gantt-empty-label {
  padding: 1rem 0.625rem;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  text-align: center;
}

/* 甘特区 */
.gantt-scroll {
  flex: 1;
  min-width: 0;
  overflow: auto;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--color-text) 25%, transparent) transparent;
}
.gantt-scroll::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
.gantt-scroll::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--color-text) 20%, transparent);
  border-radius: var(--radius-full);
  border: 2px solid transparent;
  background-clip: padding-box;
}
.gantt-scroll::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--color-text) 34%, transparent);
  background-clip: padding-box;
}
.gantt-scroll::-webkit-scrollbar-corner {
  background: transparent;
}
.gantt-canvas {
  position: relative;
  /* 行高独立可调后，斑马纹/水平分隔线改为每行自身背景与边框（见 .gantt-row） */
}
.gantt-timeline {
  position: sticky;
  top: 0;
  z-index: 5;
  /* 与客户列表表头一致的玻璃渐变 + 分隔线（模仿 .data-table-inner thead th） */
  background: linear-gradient(180deg, color-mix(in srgb, var(--glass-bg-strong) 88%, var(--color-accent-soft)), var(--glass-bg-strong));
  backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--color-text-muted);
  box-shadow: var(--shadow-inner-glass);
}
.gantt-tick {
  position: absolute;
  top: 0;
  height: 100%;
  border-left: 1px solid var(--glass-border);
  display: flex;
  align-items: center;
  padding-left: 0.5rem;
}
.gantt-tick-label {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  white-space: nowrap;
  letter-spacing: 0.02em;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
}

/* 竖向网格 */
.gantt-grid {
  position: absolute;
  top: 56px;
  bottom: 0;
  pointer-events: none;
}
.gantt-grid-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--glass-border-soft);
}

/* 条带区 */
.gantt-rows {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
}
.gantt-row {
  position: absolute;
  left: 0;
  right: 0;
  /* 行分隔线：底部边框（行高独立，每行自带） */
  border-bottom: 1px solid var(--glass-border-soft);
  transition: background 0.12s;
}
/* 斑马纹：奇数行淡色背景（按 track 奇偶，与左侧任务栏一致） */
.gantt-row:nth-child(odd) {
  background: color-mix(in srgb, var(--color-text) 3%, transparent);
}
.gantt-row:hover {
  background: color-mix(in srgb, var(--color-accent) 7%, transparent);
}
/* 上轨道：预期层（可调整）——玻璃半透明 + 虚线边框，占行内上半部分（50%，任何行高都不与下轨重合） */
.gantt-bar {
  position: absolute;
  top: 2px;
  bottom: calc(50% + 1px);
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0 0.5rem;
  border-radius: var(--radius-md);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.10), rgba(255, 255, 255, 0) 55%),
    linear-gradient(90deg, color-mix(in srgb, var(--bar-color) 20%, transparent), color-mix(in srgb, var(--bar-color) 7%, transparent));
  border: 1px dashed color-mix(in srgb, var(--bar-color) 50%, transparent);
  color: var(--color-text);
  cursor: grab;
  touch-action: none;
  user-select: none;
  overflow: visible;
  white-space: nowrap;
  box-shadow: 0 2px 8px -4px color-mix(in srgb, var(--bar-color) 35%, transparent), var(--shadow-inner-glass);
  transition: box-shadow 0.15s ease, border-color 0.15s ease, filter 0.15s ease, transform 0.15s ease;
}
/* 下轨道：实际层（阶段流转生成，不可调整）——整体圆角矩形，内部按流转时间戳分段染色。
   外层覆盖「实际开始→实际结束」整段，圆角只在外层两端；内层色条连续拼接，
   由外层的 overflow:hidden + border-radius 裁剪出统一的圆角轮廓。 */
.gantt-bar-actual {
  position: absolute;
  top: calc(50% + 1px);
  bottom: 2px;
  left: 0;
  border: 1px solid color-mix(in srgb, var(--color-text-secondary) 30%, transparent);
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: 0 2px 8px -3px rgba(0, 0, 0, 0.3), var(--shadow-inner-glass);
  background: color-mix(in srgb, var(--color-text) 6%, transparent);
}
/* 内层阶段色条：无圆角无边框，仅按时间戳染色，由外层统一裁剪 */
.gantt-bar-actual-seg {
  position: absolute;
  top: 0;
  bottom: 0;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0) 45%),
    var(--bar-color);
}
/* 超期：计划层红框 + 徽章 */
.gantt-bar.is-overdue {
  border-color: var(--color-danger);
  border-style: solid;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0) 55%),
    color-mix(in srgb, var(--color-danger) 14%, transparent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-danger) 32%, transparent), var(--shadow-inner-glass);
}
.gantt-bar.is-finished {
  border-style: solid;
}
.gantt-bar:hover {
  border-color: color-mix(in srgb, var(--bar-color) 85%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--bar-color) 24%, transparent), 0 8px 20px -8px color-mix(in srgb, var(--bar-color) 45%, transparent);
  filter: brightness(1.1);
}
.gantt-bar.is-dragging {
  cursor: grabbing;
  opacity: 0.88;
  transform: translateY(-1px);
  box-shadow: 0 12px 24px -8px rgba(0, 0, 0, 0.55), var(--shadow-inner-glass);
}
.gantt-bar.is-editing {
  border-style: dashed;
  border-width: 2px;
}
.gantt-bar-text {
  position: relative;
  z-index: 2;
  pointer-events: none;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}
.gantt-bar-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 8px;
  cursor: ew-resize;
  touch-action: none;
  z-index: 3;
}
.gantt-bar-handle.is-start {
  left: 0;
  border-left: 2px solid color-mix(in srgb, var(--bar-color) 70%, transparent);
  border-top-left-radius: var(--radius-md);
  border-bottom-left-radius: var(--radius-md);
}
.gantt-bar-handle.is-end {
  right: 0;
  border-right: 2px solid color-mix(in srgb, var(--bar-color) 70%, transparent);
  border-top-right-radius: var(--radius-md);
  border-bottom-right-radius: var(--radius-md);
}
.gantt-bar-handle:hover {
  background: color-mix(in srgb, var(--bar-color) 30%, transparent);
}
/* 条带徽章：超期 / 完工标记 */
.gantt-bar-badge {
  position: absolute;
  top: -9px;
  right: 0.25rem;
  z-index: 4;
  display: inline-flex;
  align-items: center;
  gap: 0.125rem;
  padding: 0 0.375rem;
  height: 16px;
  border-radius: var(--radius-full);
  font-size: 0.62rem;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  backdrop-filter: blur(6px);
}
.gantt-bar-badge.is-overdue {
  background: color-mix(in srgb, var(--color-danger) 92%, transparent);
  color: #fff;
  box-shadow: 0 2px 8px -2px var(--color-danger);
}
.gantt-bar-badge.is-done {
  background: color-mix(in srgb, var(--color-success) 92%, transparent);
  color: #fff;
  box-shadow: 0 2px 8px -2px var(--color-success);
}

/* 空态 */
.gantt-empty {
  position: absolute;
  top: 56px;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 3rem 1rem;
  text-align: center;
}
.gantt-empty-icon {
  width: 2.6rem;
  height: 2.6rem;
  padding: 0.625rem;
  border-radius: var(--radius-xl);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  color: var(--color-accent);
  opacity: 0.85;
  box-shadow: var(--shadow-glass), var(--shadow-inner-glass);
}
.gantt-empty-title {
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}
.gantt-empty-sub {
  font-size: 0.78rem;
  color: var(--color-text-muted);
}

/* 当前时间垂直线：顶部渐变淡出，更精致 */
.gantt-today-line {
  position: absolute;
  top: 0;
  width: 2px;
  background: linear-gradient(180deg, var(--color-danger) 0%, var(--color-danger) 88%, transparent 100%);
  z-index: 4;
  pointer-events: none;
  box-shadow: 0 0 8px var(--color-danger-soft);
}
.gantt-today-line::before {
  content: '';
  position: absolute;
  top: 0;
  left: -4px;
  width: 10px;
  height: 10px;
  border-radius: var(--radius-full);
  background: radial-gradient(circle, #fff 0%, var(--color-danger) 55%);
  box-shadow: 0 0 12px var(--color-danger);
}
</style>

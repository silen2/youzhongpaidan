<template>
  <div
    ref="rootRef"
    class="data-table"
    @touchstart="onPinchStart"
    @touchmove="onPinchMove"
    @touchend="onPinchEnd"
    @touchcancel="onPinchEnd"
  >
    <!-- 表格工具栏（仅在有工具栏内容时显示） -->
    <div v-if="showToolbar && $slots['toolbar-left']" class="data-table-toolbar">
      <div class="data-table-toolbar-left">
        <slot name="toolbar-left" />
      </div>
    </div>

    <!-- 表格主体：三栏结构 —— 左固定勾选列 + 中间可滚动数据列 + 右固定操作列。
         勾选列与操作列在滚动区之外，不再覆盖在滚动内容上（横向滚动范围不含它们），
         也无需不透明遮挡，可保留真玻璃质感 -->
    <div class="glass-card data-table-card">
      <div class="data-table-body">
      <!-- 左固定列：勾选 -->
      <div ref="fixedLeftRef" v-if="selectable" class="data-table-fixed data-table-fixed-left">
        <table class="glass-table data-table-inner">
          <colgroup>
            <col :style="{ width: SELECT_COL_WIDTH + 'px' }" />
          </colgroup>
          <thead>
            <tr>
              <th class="data-table-th data-table-th-select">
                <label class="data-table-checkbox">
                  <input
                    type="checkbox"
                    name="table-checkbox"
                    class="data-table-checkbox-input"
                    :checked="allPageSelected"
                    :disabled="pagedData.length === 0"
                    @change="toggleSelectAll"
                  />
                  <span class="sr-only">全选</span>
                  <span class="data-table-checkbox-box"></span>
                </label>
              </th>
            </tr>
          </thead>
          <tbody :key="tbodyPageKey" class="data-table-tbody-anim">
            <tr
              v-for="(row, rowIndex) in pagedData"
              :key="'l-' + (row[rowKey] || rowIndex)"
              class="data-table-row"
              :class="{ 'is-selected': isRowSelected(row), 'is-hovered': hoveredIndex === rowIndex }"
              @mouseenter="hoveredIndex = rowIndex"
              @mouseleave="hoveredIndex = -1"
            >
              <td class="data-table-td data-table-td-select">
                <label class="data-table-checkbox">
                  <input
                    type="checkbox"
                    name="table-checkbox"
                    class="data-table-checkbox-input"
                    :checked="isRowSelected(row)"
                    @change="toggleRowSelected(row)"
                  />
                  <span class="sr-only">选择该行</span>
                  <span class="data-table-checkbox-box"></span>
                </label>
                <!-- 行高拖动条：任意行下方分割线可拖动，统一调整所有行高（平板可双指捏合） -->
                <span
                  class="data-table-row-resize"
                  :class="{ 'is-active': rowResizeActive }"
                  title="拖动调整行高（平板双指捏合）"
                  @mousedown.prevent="startRowResize"
                ></span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 中间：可滚动数据列（纵向滚动时同步固定列） -->
      <div ref="scrollRef" class="overflow-x-auto data-table-scroll" @scroll="syncFixedScroll">
        <table class="glass-table data-table-inner">
          <!-- colgroup 显式控制每列宽度：配合 table-layout: fixed，
               列宽精确生效且不随内容/空态漂移，拖动缩放双向可靠 -->
          <colgroup>
            <col
              v-for="col in scrollColumns"
              :key="'col-' + col.key"
              :style="{ width: colWidth(col) + 'px' }"
            />
          </colgroup>
          <thead>
            <tr>
              <th
                v-for="col in scrollColumns"
                :key="col.key"
                class="data-table-th"
                :class="{
                  'is-numeric': col.isNumeric,
                  'is-dragging': dragKey === col.key,
                  'is-drag-over-left': dragKey && dragKey !== col.key && dragOverKey === col.key && dragInsertPos === 'left',
                  'is-drag-over-right': dragKey && dragKey !== col.key && dragOverKey === col.key && dragInsertPos === 'right',
                }"
                @dragover.prevent="onHeaderDragOver(col.key, $event)"
                @dragleave="onHeaderDragLeave"
                @drop.prevent="onHeaderDrop(col.key, $event)"
                @dragend="onDragEnd"
              >
                <!-- 拖拽排序的判定缩小到文字标签本身，表头空白处不再误触发 -->
                <span
                  class="data-table-th-label"
                  :draggable="col.draggable !== false"
                  :title="col.draggable !== false ? '按住可拖动调整列顺序' : undefined"
                  @dragstart="onHeaderDragStart(col.key, $event)"
                >
                  <slot :name="`th-${col.key}`" :column="col">
                    {{ col.label }}
                  </slot>
                </span>
                <!-- 列宽调节分隔线：命中区加宽，便于拖动 -->
                <span
                  class="data-table-th-resize"
                  title="拖动调整列宽"
                  @mousedown.prevent="startResize(col.key, $event)"
                ></span>
              </th>
            </tr>
          </thead>
          <tbody :key="tbodyPageKey" class="data-table-tbody-anim">
            <tr
              v-for="(row, rowIndex) in pagedData"
              :key="'m-' + (row[rowKey] || rowIndex)"
              class="data-table-row"
              :class="{ 'is-selected': isRowSelected(row), 'is-hovered': hoveredIndex === rowIndex }"
              @mouseenter="hoveredIndex = rowIndex"
              @mouseleave="hoveredIndex = -1"
            >
              <td
                v-for="col in scrollColumns"
                :key="col.key"
                class="data-table-td"
                :class="{
                  'is-text-right': col.align === 'right',
                  'is-numeric': col.isNumeric,
                }"
                :title="formatCell(row, col)"
              >
                <slot
                  :name="`td-${col.key}`"
                  :row="row"
                  :rowIndex="rowIndex"
                  :column="col"
                  :value="row[col.key]"
                >
                  {{ formatCell(row, col) }}
                </slot>
                <!-- 行高拖动条：任意行下方分割线可拖动，统一调整所有行高（平板可双指捏合） -->
                <span
                  class="data-table-row-resize"
                  :class="{ 'is-active': rowResizeActive }"
                  title="拖动调整行高（平板双指捏合）"
                  @mousedown.prevent="startRowResize"
                ></span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 右固定列：操作 -->
      <div ref="fixedRightRef" class="data-table-fixed data-table-fixed-right">
        <table class="glass-table data-table-inner">
          <colgroup>
            <col
              v-for="col in rightColumns"
              :key="'col-' + col.key"
              :style="{ width: colWidth(col) + 'px' }"
            />
          </colgroup>
          <thead>
            <tr>
              <th
                v-for="col in rightColumns"
                :key="col.key"
                class="data-table-th is-actions-th"
              >
                <span class="data-table-th-label">
                  <slot :name="`th-${col.key}`" :column="col">
                    {{ col.label }}
                  </slot>
                </span>
              </th>
            </tr>
          </thead>
          <tbody :key="tbodyPageKey" class="data-table-tbody-anim">
            <tr
              v-for="(row, rowIndex) in pagedData"
              :key="'r-' + (row[rowKey] || rowIndex)"
              class="data-table-row"
              :class="{ 'is-selected': isRowSelected(row), 'is-hovered': hoveredIndex === rowIndex }"
              @mouseenter="hoveredIndex = rowIndex"
              @mouseleave="hoveredIndex = -1"
            >
              <td
                v-for="col in rightColumns"
                :key="col.key"
                class="data-table-td is-actions"
              >
                <slot
                  :name="`td-${col.key}`"
                  :row="row"
                  :rowIndex="rowIndex"
                  :column="col"
                  :value="row[col.key]"
                >
                  {{ formatCell(row, col) }}
                </slot>
                <!-- 行高拖动条：任意行下方分割线可拖动，统一调整所有行高（平板可双指捏合） -->
                <span
                  class="data-table-row-resize"
                  :class="{ 'is-active': rowResizeActive }"
                  title="拖动调整行高（平板双指捏合）"
                  @mousedown.prevent="startRowResize"
                ></span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      </div><!-- /.data-table-body -->

      <!-- 空态提示：悬浮在卡片中央（横跨三栏），不随滚动条移动 -->
      <div v-if="pagedData.length === 0" class="data-table-empty-overlay">
        <slot name="empty">
          暂无数据
        </slot>
      </div>

      <!-- 分页（空数据时也显示） -->
      <div class="data-table-pagination">
        <Pagination
          v-model:current-page="currentPageModel"
          v-model:page-size="pageSizeModel"
          :total="total"
          :selected-count="selectedKeys.size"
          :page-size-storage-key="pageSizeStorageKey"
          :page-size-editable="pageSizeEditable"
        >
          <template #left>
            <!-- 批量删除（勾选后出现，靠最左） -->
            <button
              v-if="selectedKeys.size > 0"
              class="glass-btn glass-btn-ghost glass-btn-sm text-[var(--color-danger)]"
              @click="emit('batch-delete')"
              title="删除选中的行"
            >
              <Trash2 class="w-3.5 h-3.5" />
              <span>批量删除</span>
            </button>

            <!-- 导出勾选内容 -->
            <button
              v-if="exportable"
              class="glass-btn glass-btn-ghost glass-btn-sm"
              @click="exportCsv"
              title="导出勾选内容（未勾选时导出全部）"
            >
              <Download class="w-3.5 h-3.5" />
              <span>导出</span>
            </button>

            <!-- 列设置（紧跟导出） -->
            <div ref="columnSettingsRef" class="data-table-column-settings">
              <button
                ref="columnSettingsBtnRef"
                class="glass-btn glass-btn-ghost glass-btn-sm"
                :class="{ 'is-active': showColumnPanel }"
                @click="toggleColumnPanel"
                title="列设置"
              >
                <Settings2 class="w-3.5 h-3.5" />
                <span>列设置</span>
              </button>

              <!-- 列设置面板：Teleport 到 body，fixed 定位才相对视口（避免卡片 backdrop-filter 破坏包含块） -->
              <Teleport to="body">
                <transition name="data-table-fade">
                  <div
                    v-if="showColumnPanel"
                    ref="columnPanelRef"
                    class="data-table-column-panel"
                    :style="columnPanelStyle"
                  >
                    <div class="data-table-column-panel-header">
                      <span class="glass-caption">拖拽排序，或点击眼睛隐藏/显示</span>
                    </div>
                    <ul class="data-table-column-list">
                      <!-- 勾选列与操作列不在列设置中提供隐藏 -->
                      <li
                        v-for="col in configurableColumns"
                        :key="col.key"
                        class="data-table-column-item"
                        :class="{
                          'is-hidden': col.visible === false,
                          'is-dragging': dragKey === col.key,
                          'is-drag-over': dragKey && dragKey !== col.key && dragOverKey === col.key,
                        }"
                        :draggable="col.draggable !== false"
                        @dragstart="onHeaderDragStart(col.key, $event)"
                        @dragend="onDragEnd"
                        @dragover.prevent="onHeaderDragOver(col.key, $event)"
                        @dragleave="onHeaderDragLeave"
                        @drop.prevent="onHeaderDrop(col.key, $event)"
                      >
                        <button
                          v-if="col.draggable !== false"
                          class="data-table-col-drag"
                          title="拖拽排序"
                        >
                          <GripVertical class="w-4 h-4" />
                        </button>
                        <button
                          class="data-table-col-visibility"
                          :title="col.visible !== false ? '隐藏列' : '显示列'"
                          @click="toggleColumnVisible(col.key)"
                        >
                          <Eye v-if="col.visible !== false" class="w-4 h-4" />
                          <EyeOff v-else class="w-4 h-4" />
                        </button>
                        <span class="data-table-col-label">{{ col.label }}</span>
                      </li>
                    </ul>
                    <div class="data-table-column-panel-footer">
                      <button class="glass-btn glass-btn-ghost glass-btn-sm" @click="resetColumnOrder">
                        重置顺序
                      </button>
                      <button class="glass-btn glass-btn-ghost glass-btn-sm" @click="showAllColumns">
                        全选显示
                      </button>
                    </div>
                  </div>
                </transition>
              </Teleport>
            </div>
          </template>
        </Pagination>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Settings2, GripVertical, Eye, EyeOff, Download, Trash2 } from '@lucide/vue'
import { computePageItems, computeTotalPages } from '@/domain/shared/pagination'
import Pagination from './Pagination.vue'

export interface ColumnDef {
  key: string
  label: string
  visible?: boolean
  draggable?: boolean
  align?: 'left' | 'center' | 'right'
  width?: number
  minWidth?: number
  isNumeric?: boolean
  /** 固定在最右侧（如操作列） */
  sticky?: boolean
  formatter?: (value: any, row: any) => string
}

interface Props {
  columns: ColumnDef[]
  data: any[]
  rowKey?: string
  currentPage: number
  pageSize: number
  pageSizeStorageKey?: string
  /** 列配置（顺序/可见性）持久化键，不同表格应使用不同键，避免互相污染 */
  columnsStorageKey?: string
  showToolbar?: boolean
  /** 是否显示行勾选列（最左侧），默认 true */
  selectable?: boolean
  /** 是否显示分页栏「导出」按钮，默认 true */
  exportable?: boolean
  /** 是否允许修改每页条数（false 时隐藏分页栏每页条数下拉，固定当前 pageSize），默认 true */
  pageSizeEditable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  rowKey: 'id',
  columnsStorageKey: 'dataTable.columns',
  showToolbar: true,
  selectable: true,
  exportable: true,
  pageSizeEditable: true,
})

const emit = defineEmits<{
  'update:currentPage': [page: number]
  'update:pageSize': [size: number]
  'column:reorder': [columns: ColumnDef[]]
  'column:visibility': [columns: ColumnDef[]]
  /** 勾选集合变化（父组件用于批量操作） */
  'selection:change': [keys: string[]]
  /** 点击分页栏「批量删除」按钮 */
  'batch-delete': []
}>()

// 内部可写的列
const columns = ref<ColumnDef[]>(
  props.columns.map(c => ({ ...c, visible: c.visible !== false })),
)

// 拖拽状态（以列 key 为标识，表头与列设置面板共用）
const dragKey = ref<string | null>(null)
const dragOverKey = ref<string | null>(null)
/** 插入方向：拖到目标列左半 → 插入其前（left）；右半 → 插入其后（right） */
const dragInsertPos = ref<'left' | 'right'>('left')

// 外部传入 columns 变化时同步
watch(() => props.columns, (newCols) => {
  columns.value = newCols.map(c => ({ ...c, visible: c.visible !== false }))
}, { deep: false })

// 加载持久化列配置
try {
  const saved = localStorage.getItem(props.columnsStorageKey)
  if (saved) {
    const savedCols = JSON.parse(saved) as { key: string; visible: boolean; width?: number }[]
    const savedMap = new Map(savedCols.map(c => [c.key, c]))
    // 恢复可见性与列宽
    columns.value.forEach(col => {
      const savedCol = savedMap.get(col.key)
      if (savedCol) {
        col.visible = savedCol.visible
        if (typeof savedCol.width === 'number') {
          // 固定布局下仅需恢复 width（colgroup 控制列宽，minWidth 保持列定义的下限）
          col.width = savedCol.width
        }
      }
    })
    // 按保存的顺序排列
    columns.value.sort((a, b) => {
      const aIdx = savedCols.findIndex(c => c.key === a.key)
      const bIdx = savedCols.findIndex(c => c.key === b.key)
      const aPos = aIdx === -1 ? 999 : aIdx
      const bPos = bIdx === -1 ? 999 : bIdx
      return aPos - bPos
    })
  }
} catch {
  // ignore
}

// 持久化列配置变化
watch(columns, (val) => {
  emit('column:reorder', val)
  emit('column:visibility', val)
  try {
    localStorage.setItem(props.columnsStorageKey, JSON.stringify(val.map(c => ({
      key: c.key,
      visible: c.visible !== false,
      width: typeof c.width === 'number' ? c.width : undefined,
    }))))
  } catch {
    // ignore
  }
}, { deep: true })

const showColumnPanel = ref(false)
const columnSettingsRef = ref<HTMLElement | null>(null)
const columnSettingsBtnRef = ref<HTMLElement | null>(null)
const columnPanelRef = ref<HTMLElement | null>(null)
const columnPanelStyle = ref<Record<string, string>>({})

async function toggleColumnPanel() {
  showColumnPanel.value = !showColumnPanel.value
  if (showColumnPanel.value) {
    await nextTick()
    positionColumnPanel()
  }
}

// 面板 fixed 定位在按钮上方（强制反向展开），限制在视口内
function positionColumnPanel() {
  const btn = columnSettingsBtnRef.value
  if (!btn) return
  const rect = btn.getBoundingClientRect()
  const panelWidth = 280
  // 以实际渲染高度为准（列多时面板可能更高）
  const panelHeight = columnPanelRef.value?.getBoundingClientRect().height ?? 360
  let left = Math.min(rect.right - panelWidth, window.innerWidth - panelWidth - 12)
  left = Math.max(12, left)
  // 向上展开：面板底部贴近按钮顶部，再整体上移 8px 间距；高度超过可用空间时钳制在视口顶部
  const top = Math.max(12, rect.top - panelHeight - 8)
  columnPanelStyle.value = { top: `${top}px`, left: `${left}px`, width: `${panelWidth}px` }
}

// 点击面板外部关闭（面板经 Teleport 挂到 body，需同时判断容器与面板自身）
function onClickOutside(e: MouseEvent) {
  const target = e.target as Node
  if (!showColumnPanel.value) return
  if (columnSettingsRef.value?.contains(target)) return
  if (columnPanelRef.value?.contains(target)) return
  showColumnPanel.value = false
}

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside)
  updateFixedPadding()
  if (typeof ResizeObserver !== 'undefined' && scrollRef.value) {
    scrollbarObserver = new ResizeObserver(updateFixedPadding)
    scrollbarObserver.observe(scrollRef.value)
  }
  // 恢复持久化的行高（平板双指 / 鼠标拖动调整的结果），保持各列表一致
  try {
    const saved = Number(localStorage.getItem(ROW_H_STORAGE_KEY) || 0)
    if (saved >= MIN_ROW_H && saved <= MAX_ROW_H) {
      rootRef.value?.style.setProperty('--row-h', `${saved}px`)
    }
  } catch {
    // ignore storage errors
  }
  // 初次渲染后按比例拉伸列宽撑满容器；窗口缩放时同步
  nextTick(stretchColumnsToFit)
  window.addEventListener('resize', scheduleStretch)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onClickOutside)
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
  document.removeEventListener('mousemove', onRowResizeMove)
  document.removeEventListener('mouseup', onRowResizeEnd)
  window.removeEventListener('resize', scheduleStretch)
  clearTimeout(stretchTimer)
  scrollbarObserver?.disconnect()
  scrollbarObserver = null
})

// 分页模型
const currentPageModel = computed({
  get: () => props.currentPage,
  set: (v: number) => emit('update:currentPage', v),
})
const pageSizeModel = computed({
  get: () => props.pageSize,
  set: (v: number) => emit('update:pageSize', v),
})

/** 换页动画 key：页码/每页条数变化时重建三栏 tbody，触发缓动进入动画 */
const tbodyPageKey = computed(() => `${currentPageModel.value}:${pageSizeModel.value}`)

const visibleColumns = computed(() => columns.value.filter(c => c.visible !== false))

/** 中间可滚动列：排除固定右侧的列（如操作列） */
const scrollColumns = computed(() => visibleColumns.value.filter(c => !c.sticky))

/** 右侧固定列：sticky 标记的列（如操作列） */
const rightColumns = computed(() => visibleColumns.value.filter(c => c.sticky))

// 列显隐/重置后列宽总和变化，重新拉伸撑满（visibleColumns 定义在其上方，避免 TDZ）
watch(visibleColumns, scheduleStretch)

/** 跨三栏行 hover 同步：中间/左/右表格同一行 index 高亮 */
const hoveredIndex = ref(-1)

// 三栏滚动同步：中间区纵向滚动时，左右固定列跟随滚动（保持行对齐）
const scrollRef = ref<HTMLElement | null>(null)
const fixedLeftRef = ref<HTMLElement | null>(null)
const fixedRightRef = ref<HTMLElement | null>(null)
const rootRef = ref<HTMLElement | null>(null)

function syncFixedScroll() {
  const top = scrollRef.value?.scrollTop ?? 0
  if (fixedLeftRef.value) fixedLeftRef.value.scrollTop = top
  if (fixedRightRef.value) fixedRightRef.value.scrollTop = top
}

// 固定列底部预留横向滚动条高度：
// 中间滚动区出现横向滚动条时 clientHeight 会被压缩，若固定列不做同样占位，
// 纵向滚动到接近底部时固定列 scrollTop 会被浏览器钳制，导致行底分割线与中间区错位。
// 用 ResizeObserver 监测滚动区尺寸变化（滚动条出现/消失、窗口缩放、列显隐均会触发），
// 将滚动条高度写入 --fixed-pad，供固定列 padding-bottom 使用。
let scrollbarObserver: ResizeObserver | null = null

function updateFixedPadding() {
  const scroller = scrollRef.value
  const root = rootRef.value
  if (!scroller || !root) return
  const h = scroller.offsetHeight - scroller.clientHeight
  root.style.setProperty('--fixed-pad', h > 0 ? `${h}px` : '0px')
}

// ===== 列少时按比例拉伸列宽撑满容器（防止表格窄于容器导致表头断裂/右侧大片留白） =====
// 表格 width:max-content 时列宽精确（拖动不漂移），但当可见列总和 < 容器宽时，
// 把各列按比例放大写入 col.width（持久化），使表格撑满容器；之后拖动某列仍只改该列。
let stretchTimer: number | undefined

function stretchColumnsToFit() {
  const scroller = scrollRef.value
  if (!scroller) return
  const cols = scrollColumns.value
  if (!cols.length) return
  const total = cols.reduce((s, c) => s + colWidth(c), 0)
  if (total <= 0) return
  // 容器可视宽留 1px 余量，避免恰好等宽触发横向滚动条
  const avail = scroller.clientWidth - 1
  if (total >= avail) return // 已撑满或超出（超出走横向滚动）
  const k = avail / total
  cols.forEach(c => {
    const w = Math.max(1, Math.round(colWidth(c) * k))
    if (w !== colWidth(c)) c.width = w
  })
}

function scheduleStretch() {
  clearTimeout(stretchTimer)
  stretchTimer = window.setTimeout(stretchColumnsToFit, 120)
}

/** 列设置面板中可配置的列：排除固定勾选列与操作列 */
const configurableColumns = computed(() =>
  columns.value.filter(c => c.key !== '__select__' && c.key !== '__actions__'),
)

// 勾选列固定宽度（与 CSS .data-table-th-select 的 width 保持一致）
const SELECT_COL_WIDTH = 40

/** 列宽：优先用户调整过的宽度，其次列定义 minWidth，最后兜底 120 */
function colWidth(col: ColumnDef): number {
  return col.width ?? col.minWidth ?? 120
}

const total = computed(() => props.data.length)

const pagedData = computed(() => {
  const { slice } = computePageItems(props.data.length, props.pageSize, props.currentPage)
  return props.data.slice(slice[0], slice[1])
})

watch(() => props.data.length, () => {
  const totalPages = computeTotalPages(props.data.length, props.pageSize)
  if (props.currentPage > totalPages) {
    emit('update:currentPage', Math.max(1, totalPages))
  }
})

// 换页/改每页条数后（tbody 重建），内容变化可能撑高行，
// 重新对齐三栏行高，避免勾选/数据/操作列高度不一致
watch(tbodyPageKey, () => {
  nextTick(() => alignRowHeights())
})

// ===== 勾选逻辑（单选/多选 + 全选） =====
const selectedKeys = ref<Set<string>>(new Set())

function rowKeyOf(row: any): string {
  return String(row[props.rowKey] ?? JSON.stringify(row))
}

function isRowSelected(row: any): boolean {
  return selectedKeys.value.has(rowKeyOf(row))
}

function toggleRowSelected(row: any) {
  const key = rowKeyOf(row)
  const next = new Set(selectedKeys.value)
  if (next.has(key)) {
    next.delete(key)
  } else {
    next.add(key)
  }
  selectedKeys.value = next
}

const allPageSelected = computed(() => {
  if (pagedData.value.length === 0) return false
  return pagedData.value.every(row => isRowSelected(row))
})

function toggleSelectAll() {
  if (allPageSelected.value) {
    // 取消当前页全部
    const next = new Set(selectedKeys.value)
    pagedData.value.forEach(row => next.delete(rowKeyOf(row)))
    selectedKeys.value = next
  } else {
    // 选中当前页全部
    const next = new Set(selectedKeys.value)
    pagedData.value.forEach(row => next.add(rowKeyOf(row)))
    selectedKeys.value = next
  }
}

// 勾选集合变化通知父组件（批量操作用）
watch(selectedKeys, (keys) => {
  emit('selection:change', Array.from(keys))
})

// 供父组件在批量操作后清空勾选
defineExpose({
  clearSelection: () => { selectedKeys.value = new Set() },
})

// ===== 导出勾选内容（CSV） =====
function exportCsv() {
  const exportCols = visibleColumns.value.filter(c => c.key !== '__actions__')
  const rows = selectedKeys.value.size > 0
    ? props.data.filter(row => selectedKeys.value.has(rowKeyOf(row)))
    : props.data

  if (rows.length === 0) {
    window.alert('没有可导出的数据')
    return
  }

  const header = exportCols.map(c => `"${c.label}"`).join(',')
  const body = rows.map(row =>
    exportCols.map(col => {
      const v = formatCell(row, col)
      return `"${String(v).replace(/"/g, '""')}"`
    }).join(','),
  )
  const csv = '\uFEFF' + [header, ...body].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const name = (props.columnsStorageKey || 'dataTable').replace(/[^\w-]/g, '-')
  a.href = url
  a.download = `${name}-${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ===== 列宽调节（表头分隔线拖动） =====
const resizing = ref<{ key: string; startX: number; startWidth: number } | null>(null)

function startResize(key: string, e: MouseEvent) {
  const col = columns.value.find(c => c.key === key)
  if (!col) return
  resizing.value = { key, startX: e.clientX, startWidth: colWidth(col) }
  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', onResizeEnd)
  document.body.style.cursor = 'col-resize'
}

function onResizeMove(e: MouseEvent) {
  const r = resizing.value
  if (!r) return
  const col = columns.value.find(c => c.key === r.key)
  if (!col) return
  // 收缩下限取列定义的 minWidth（拖动中不修改 minWidth，否则只能拉大不能缩小）
  const floor = col.minWidth ?? 60
  col.width = Math.max(floor, r.startWidth + (e.clientX - r.startX))
}

function onResizeEnd() {
  resizing.value = null
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
  document.body.style.cursor = ''
}

// ===== 统一行高调节（任意行下方分割线拖动） =====
// 拖动任一行底部的分割线，通过 --row-h 统一调整三栏所有数据行的高度
const MIN_ROW_H = 36
const MAX_ROW_H = 96
const rowResizeActive = ref(false)
let rowResizing: { startY: number; startHeight: number } | null = null

function currentRowHeight(): number {
  const root = rootRef.value
  if (!root) return 44
  const v = root.style.getPropertyValue('--row-h')
  return v ? parseFloat(v) : 44
}

/** 三栏所有数据行的最大实际高度：内容自然高度（badge/按钮等）可能撑高行，
   取最大值回写 --row-h，保证勾选/数据/操作三栏每一行都对齐 */
function getMaxActualRowHeight(): number {
  let max = 0
  for (const table of [scrollRef.value, fixedLeftRef.value, fixedRightRef.value]) {
    if (!table) continue
    for (const tr of table.querySelectorAll('tbody tr')) {
      const h = tr.getBoundingClientRect().height
      if (h > max) max = h
    }
  }
  return max
}

function alignRowHeights() {
  const root = rootRef.value
  if (!root) return
  const cur = parseFloat(root.style.getPropertyValue('--row-h')) || 44
  const max = getMaxActualRowHeight()
  if (max > cur) root.style.setProperty('--row-h', `${Math.round(max)}px`)
}

function startRowResize(e: MouseEvent) {
  rowResizing = { startY: e.clientY, startHeight: currentRowHeight() }
  rowResizeActive.value = true
  document.addEventListener('mousemove', onRowResizeMove)
  document.addEventListener('mouseup', onRowResizeEnd)
  document.body.style.cursor = 'row-resize'
  document.body.style.userSelect = 'none'
}

function onRowResizeMove(e: MouseEvent) {
  const r = rowResizing
  const root = rootRef.value
  if (!r || !root) return
  const requested = Math.min(MAX_ROW_H, Math.max(MIN_ROW_H, r.startHeight + (e.clientY - r.startY)))
  root.style.setProperty('--row-h', `${requested}px`)
  // 数据/勾选/操作三栏内容的自然行高可能大于请求值（如 badge、1em 按钮撑高行），
  // 以三栏所有行的最大实际高度为准回写，保证三栏行高始终一致
  const actual = getMaxActualRowHeight()
  if (actual > requested) {
    root.style.setProperty('--row-h', `${Math.round(actual)}px`)
  }
}

function onRowResizeEnd() {
  rowResizing = null
  rowResizeActive.value = false
  document.removeEventListener('mousemove', onRowResizeMove)
  document.removeEventListener('mouseup', onRowResizeEnd)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  saveRowHeight()
}

// ===== 平板双指捏合调整行高 =====
// 两根手指在表格上张开/捏合，统一调整所有行高（与拖动分割线同一套 --row-h 机制），
// 调整结果持久化，刷新后保持。
const ROW_H_STORAGE_KEY = 'datatable.rowHeight'
let pinchState: { dist: number; height: number } | null = null

function pinchDistance(e: TouchEvent): number {
  if (e.touches.length !== 2) return 0
  const [a, b] = Array.from(e.touches)
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

function saveRowHeight() {
  const root = rootRef.value
  if (!root) return
  try {
    localStorage.setItem(ROW_H_STORAGE_KEY, String(currentRowHeight()))
  } catch {
    // ignore storage errors
  }
}

/** 应用行高并处理内容撑高回写（数据/勾选/操作三栏对齐） */
function applyRowHeight(px: number) {
  const root = rootRef.value
  if (!root) return
  const requested = Math.min(MAX_ROW_H, Math.max(MIN_ROW_H, Math.round(px)))
  root.style.setProperty('--row-h', `${requested}px`)
  const actual = getMaxActualRowHeight()
  if (actual > requested) root.style.setProperty('--row-h', `${Math.round(actual)}px`)
}

function onPinchStart(e: TouchEvent) {
  if (e.touches.length === 2) {
    pinchState = { dist: pinchDistance(e), height: currentRowHeight() }
  }
}

function onPinchMove(e: TouchEvent) {
  if (!pinchState || e.touches.length !== 2) return
  // 双指捏合时阻止浏览器默认行为（页面缩放/双指滚动）
  e.preventDefault()
  const dist = pinchDistance(e)
  if (dist === 0) return
  const delta = (dist - pinchState.dist) * 0.5
  applyRowHeight(pinchState.height + delta)
}

function onPinchEnd() {
  if (pinchState) {
    pinchState = null
    saveRowHeight()
  }
}

// ===== 原生 HTML5 拖拽排序（表头 + 列设置面板共用） =====
function onHeaderDragStart(key: string, e: DragEvent) {
  dragKey.value = key
  dragOverKey.value = null
  dragInsertPos.value = 'left'
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', key)
  }
}

function onDragEnd() {
  dragKey.value = null
  dragOverKey.value = null
  dragInsertPos.value = 'left'
}

function onHeaderDragOver(key: string, e: DragEvent) {
  if (!dragKey.value || dragKey.value === key) return
  dragOverKey.value = key
  // 根据鼠标在目标列内的水平位置决定插入方向
  const target = e.currentTarget as HTMLElement | null
  if (target) {
    const rect = target.getBoundingClientRect()
    dragInsertPos.value = e.clientX < rect.left + rect.width / 2 ? 'left' : 'right'
  }
}

function onHeaderDragLeave() {
  dragOverKey.value = null
}

function onHeaderDrop(key: string, e: DragEvent) {
  e.preventDefault()
  const from = dragKey.value
  const to = key
  if (!from || from === to) {
    onDragEnd()
    return
  }
  // 将 from 列插入到 to 列之前或之后（取决于 dragInsertPos）
  const list = columns.value
  const fromIdx = list.findIndex(c => c.key === from)
  if (fromIdx === -1) {
    onDragEnd()
    return
  }
  const [moved] = list.splice(fromIdx, 1)
  const toIdx = list.findIndex(c => c.key === to)
  if (toIdx === -1) {
    list.splice(fromIdx, 0, moved)
    onDragEnd()
    return
  }
  const insertAt = dragInsertPos.value === 'right' ? toIdx + 1 : toIdx
  list.splice(insertAt, 0, moved)
  dragKey.value = null
  dragOverKey.value = null
  dragInsertPos.value = 'left'
}

function toggleColumnVisible(key: string) {
  const col = columns.value.find(c => c.key === key)
  if (col) col.visible = col.visible === false ? true : false
}

function showAllColumns() {
  columns.value.forEach(c => { c.visible = true })
}

function resetColumnOrder() {
  columns.value = props.columns.map(c => ({ ...c, visible: c.visible !== false }))
  try {
    localStorage.removeItem(props.columnsStorageKey)
  } catch {
    // ignore
  }
}

function formatCell(row: any, col: ColumnDef): string {
  if (col.formatter) {
    return col.formatter(row[col.key], row)
  }
  const val = row[col.key]
  if (val === null || val === undefined) return ''
  return String(val)
}
</script>

<style scoped>
/* 换页缓动动画：页码/每页条数变化时，三栏 tbody 一起淡入上移 */
@keyframes data-table-page-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.data-table-tbody-anim {
  animation: data-table-page-in 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.data-table {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  /* 平板：允许滚动，禁用浏览器双指页面缩放，交还给 JS 双指调行高 */
  touch-action: pan-x pan-y;
}

.data-table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-2);
  gap: var(--space-3);
  flex-shrink: 0;
}

.data-table-toolbar-left {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.data-table-toolbar-right {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  position: relative;
}

/* 列设置 */
.data-table-column-settings {
  position: relative;
}

.data-table-column-panel {
  position: fixed;
  width: 280px;
  background: var(--glass-bg-strong);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-glass-hover), var(--shadow-inner-glass);
  padding: var(--space-3);
  z-index: 1000;
}

.data-table-column-panel-header {
  padding: var(--space-2) 0 var(--space-3);
  border-bottom: 1px solid var(--glass-border-soft);
  margin-bottom: var(--space-2);
}

.data-table-column-list {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 280px;
  overflow-y: auto;
}

.data-table-column-item {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-md);
  transition: background 0.15s;
  cursor: default;
}
.data-table-column-item:hover {
  background: var(--glass-bg-hover);
}
.data-table-column-item.is-hidden {
  opacity: 0.45;
}
.data-table-column-item.is-dragging {
  opacity: 0.5;
  background: var(--glass-bg-hover);
}
.data-table-column-item.is-drag-over {
  border-top: 2px solid var(--color-accent);
}

.data-table-col-drag {
  display: grid;
  place-items: center;
  width: 1.25rem;
  height: 1.25rem;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: grab;
  border-radius: var(--radius-sm);
  transition: all 0.15s;
}
.data-table-col-drag:hover {
  color: var(--color-text);
  background: var(--glass-bg);
}
.data-table-col-drag:active {
  cursor: grabbing;
}

.data-table-col-visibility {
  display: grid;
  place-items: center;
  width: 1.25rem;
  height: 1.25rem;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.15s;
}
.data-table-col-visibility:hover {
  color: var(--color-text);
  background: var(--glass-bg);
}

.data-table-col-label {
  flex: 1;
  font-size: 0.85rem;
  color: var(--color-text);
  font-weight: 500;
  text-align: left;
  padding-right: 0.25rem;
}

.data-table-column-panel-footer {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-3);
  padding-top: var(--space-2);
  border-top: 1px solid var(--glass-border-soft);
}

/* 表格卡片：撑满父容器可用高度（列方向：表格主体 + 分页栏） */
.data-table-card {
  overflow: hidden;
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

/* 三栏主体：行方向（左固定勾选 / 中间可滚动 / 右固定操作）。
   position: relative 供底部渐隐覆盖层跨三栏统一使用 */
.data-table-body {
  position: relative;
  display: flex;
  flex-direction: row;
  flex: 1;
  min-height: 0;
  min-width: 0;
}

/* 固定列容器：不参与横向滚动；纵向滚动与中间区由 JS 同步（隐藏滚动条）。
   背景透明：勾选框/操作框底色与数据单元格底色完全一致（统一由卡片玻璃打底），
   不另加面板色/模糊，避免固定列像"包"在表格两侧。表头单元格自带背景（见吸顶规则） */
.data-table-fixed {
  flex-shrink: 0;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  background: transparent;
  padding-bottom: var(--fixed-pad, 0px);
}
.data-table-fixed::-webkit-scrollbar {
  display: none;
}
.data-table-fixed-left {
  /* 固定列边界线：与表头/行间分隔线统一用次级文字灰（亮色下也清晰可见） */
  border-right: 1px solid var(--color-text-muted);
}
.data-table-fixed-right {
  border-left: 1px solid var(--color-text-muted);
}

/* 滚动容器：占据中间剩余空间 */
.data-table-scroll {
  flex: 1;
  min-width: 0;
  position: relative;
  overflow-x: auto;
  overflow-y: auto;
}

/* 表格本体：fixed 布局，列宽由 colgroup 精确控制（拖动缩放双向可靠、空态不漂移）。
   中间表格宽度 = 列宽总和（max-content）：拖动某列分隔线只改变该列宽度，
   其余列渲染宽度精确不变（width:100% 时容器与列宽总和的差值会按比例摊给所有列，导致拖动一列其他列宽漂移）。
   固定列表格收缩到内容宽度（避免 100% 在自动宽 flex 项内爆炸） */
.data-table-inner {
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
  width: max-content;
}
.data-table-fixed .data-table-inner {
  width: auto;
}

/* 单元格内容：单行 + 省略号。列宽收窄时内容用 "..." 隐藏，
   不撑高行；完整内容可通过单元格 title 悬浮查看 */
.data-table-inner tbody td {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 三栏表格行高必须一致（左/中/右独立表格靠行高对齐）。
   表头固定：三栏各自滚动容器内 thead 吸顶（position: sticky），
   纵向滚动时表头不动、始终可见；背景用与其他部件统一的浅色玻璃（--glass-bg-strong），
   靠自身 backdrop-filter 模糊滚过表头下方的行，避免行内容透过浅色表头。
   行高 3.5rem：与底部 54.3px 的分页栏保持同一量级并稍高；
   勾选列 th 也走同一 height 规则（不再被 padding:0 压矮），保证三栏表头等高、行底对齐。
   （左/中/右三表头在同一 y 上各自吸顶，天然对齐） */
.data-table-inner thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  /* 玻璃渐变表头：与卡片/工具栏一致的微光质感，靠自身 backdrop-filter 模糊滚过表头下方的行 */
  background: linear-gradient(180deg, color-mix(in srgb, var(--glass-bg-strong) 88%, var(--color-accent-soft)), var(--glass-bg-strong));
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  height: 3.5rem;
  /* 行距收紧：正文随屏宽放大时表头保持 3.5rem 高度不撑破 */
  line-height: 1.3;
  padding-top: 0.4em;
  padding-bottom: 0.4em;
}
.data-table-inner thead th:hover {
  background: linear-gradient(180deg, color-mix(in srgb, var(--glass-bg-hover) 82%, var(--color-accent-soft)), var(--glass-bg-strong));
}
.data-table-inner tbody td {
  position: relative;
  /* 行高由 --row-h 统一控制（行高拖动条调整），默认 2.75rem */
  height: var(--row-h, 2.75rem);
  /* 行距收紧：大屏字号放大时行仍保持 2.75rem 紧凑密度 */
  line-height: 1.4;
  padding-top: 0.35em;
  padding-bottom: 0.35em;
}

/* 数据未填满表格时：底部柔和渐隐，过渡到卡片底色，避免空白区域显得生硬。
   覆盖三栏整体（左勾选 + 中间数据 + 右操作），保证左右固定列与中间区渐隐一致，
   不会出现分割线在固定列处"露出来"的不对称 */
.data-table-body::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2.5rem;
  background: linear-gradient(to bottom, transparent, var(--color-bg) 92%);
  opacity: 0.4;
  pointer-events: none;
  z-index: 1;
}

/* 固定列（左勾选 / 右操作）：在滚动区之外，横向滚动范围不含它们。
   玻璃面板样式见 .data-table-fixed */

/* 勾选列：正方形单元格（宽高一致），无内边距，勾选框绝对居中 */
.data-table-th-select,
.data-table-td-select {
  width: 2.5rem;
  min-width: 2.5rem;
  max-width: 2.5rem;
  padding: 0 !important;
  text-align: center !important;
  vertical-align: middle;
}

/* 勾选框 */
.data-table-checkbox {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  cursor: pointer;
}
.data-table-checkbox-input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.data-table-checkbox-box {
  display: grid;
  place-items: center;
  width: 1.1rem;
  height: 1.1rem;
  border: 1.5px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: var(--glass-bg);
  transition: all 0.15s ease;
  position: relative;
}
/* 勾选态：input 与 box 之间隔有 sr-only 无障碍标签，需用通用兄弟选择器 ~ 而非相邻 + */
.data-table-checkbox-input:checked ~ .data-table-checkbox-box {
  background: var(--color-accent-soft);
  border-color: var(--color-accent);
}
.data-table-checkbox-input:checked ~ .data-table-checkbox-box::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 45%;
  width: 0.3rem;
  height: 0.55rem;
  border: solid var(--color-accent);
  border-width: 0 2px 2px 0;
  transform: translate(-50%, -50%) rotate(45deg);
}
.data-table-checkbox-input:disabled ~ .data-table-checkbox-box {
  opacity: 0.4;
  cursor: not-allowed;
}
.data-table-checkbox:hover .data-table-checkbox-box {
  border-color: var(--color-accent);
}

/* ---- 行状态：hover + 选中（三栏表格由 hoveredIndex 跨表同步） ---- */

/* 行 hover：单元格玻璃悬浮 */
.data-table-row.is-hovered td {
  background: var(--glass-bg-hover);
}

/* 选中行：单元格强调色 */
.data-table-row.is-selected td {
  background: var(--color-accent-soft);
}

/* 蓝色强调条只显示在中间数据区第一列前面；
   勾选列/操作列前方不显示（覆盖全局 .glass-table tbody tr:hover td:first-child 的强调条） */
.data-table-fixed .data-table-row.is-hovered td:first-child,
.data-table-fixed .data-table-row.is-selected td:first-child {
  box-shadow: none;
}

.data-table-th {
  position: relative;
  white-space: nowrap;
  user-select: none;
  transition: background 0.15s ease, border-color 0.15s ease;
  cursor: pointer;
  /* 表头分隔线：亮色主题下 --glass-border 只有 ~8% 透明度几乎不可见，
     改用次级文字灰，亮暗主题都清晰（覆盖 .glass-table thead th 的默认底边框） */
  border-bottom: 1px solid var(--color-text-muted);
  /* 字重/字距提升辨识度（背景/留白由 .data-table-inner thead th 统一控制） */
  font-weight: 600;
  letter-spacing: 0.045em;
}
/* 表头列间竖向分隔线（非最后一列）：用于定位列宽拖动手柄，
   灰色在亮暗主题下都清晰可见（--glass-border-soft 太淡） */
.data-table-th:not(:last-child) {
  border-right: 1px solid var(--color-text-muted);
}
/* 表头文字：悬浮判定范围限定在文字本身（hover 到文字才上浮/发光），
   避免整个单元格 hover 都触发；可拖拽排序（判定区限定在文字本身） */
.data-table-th-label {
  position: relative;
  display: inline-block;
  transition: transform 0.15s ease, text-shadow 0.15s ease, color 0.15s ease;
  transform: translateY(0);
}
.data-table-th-label[draggable="true"] {
  cursor: grab;
}
.data-table-th-label[draggable="true"]:active {
  cursor: grabbing;
}
.data-table-th-label:hover {
  transform: translateY(-1px);
  color: var(--color-accent);
  text-shadow: 0 0 12px var(--color-accent-glow);
}
/* hover 时文字下方渐变细线（现代表头细节） */
.data-table-th-label::after {
  content: '';
  position: absolute;
  left: 8%;
  right: 8%;
  bottom: -0.18em;
  height: 1px;
  border-radius: 1px;
  background: linear-gradient(90deg, transparent, var(--color-accent), transparent);
  opacity: 0;
  transition: opacity 0.15s ease;
}
.data-table-th-label:hover::after {
  opacity: 1;
}
/* 操作列表头文字居中 */
.data-table-th.is-actions-th .data-table-th-label {
  text-align: center;
  width: 100%;
}

/* 拖拽中的源表头：轻微挣扎抖动 */
.data-table-th.is-dragging {
  opacity: 0.85;
  background: var(--glass-bg-strong);
}
.data-table-th.is-dragging .data-table-th-label {
  animation: data-table-shake 0.25s ease-in-out infinite;
}
@keyframes data-table-shake {
  0%, 100% { transform: translateY(-1px) rotate(0deg); }
  25% { transform: translateY(-2px) rotate(-0.6deg); }
  50% { transform: translateY(-1px) rotate(0.6deg); }
  75% { transform: translateY(-2px) rotate(-0.4deg); }
}

/* 拖拽目标插入指示线（左侧） */
.data-table-th.is-drag-over-left::before,
.data-table-th.is-drag-over-right::after {
  content: '';
  position: absolute;
  top: 15%;
  bottom: 15%;
  width: 3px;
  border-radius: 2px;
  background: var(--color-accent);
  box-shadow: 0 0 8px var(--color-accent-glow);
  pointer-events: none;
  z-index: 3;
}
.data-table-th.is-drag-over-left::before {
  left: -1px;
}
.data-table-th.is-drag-over-right::after {
  right: -1px;
}

/* 列宽调节分隔线：命中区加宽（以列右边缘为中心 ±10px，便于抓取拖动）。
   平时不画线（列间分隔由 .data-table-th 的 border-right 提供），
   命中区 hover/拖动时显示 accent 粗线指示当前列边界 */
.data-table-th-resize {
  position: absolute;
  top: 0;
  bottom: 0;
  right: -10px;
  width: 20px;
  cursor: col-resize;
  z-index: 3;
}
.data-table-th-resize::before {
  content: '';
  position: absolute;
  top: 15%;
  bottom: 15%;
  left: 10px;
  width: 1px;
  background: transparent;
  transition: background 0.15s ease, width 0.15s ease, left 0.15s ease;
}
.data-table-th-resize:hover::before,
.data-table-th-resize.is-active::before {
  width: 2px;
  left: 9.5px;
  background: var(--color-accent);
  box-shadow: 0 0 6px var(--color-accent-glow);
}

/* 数字列内容右对齐；表头文字一律居中（th 不带 is-text-right，由 .glass-table 默认居中） */
.data-table-td.is-text-right {
  text-align: right;
}

.data-table-td.is-numeric,
.data-table-th.is-numeric {
  font-variant-numeric: tabular-nums;
}

/* 表格单元格内的 badge/tag：字号与表格正文一致（.glass-badge 默认 0.7em 偏小），
   客户类型/订单状态/紧急等标签统一跟随单元格字号 */
.data-table-td :deep(.glass-badge) {
  font-size: 1em;
  line-height: 1;
}

/* 操作列按钮：字号与表格正文一致（.glass-btn 默认 0.875em 偏小） */
.data-table-td.is-actions :deep(.glass-btn) {
  font-size: 1em;
}

/* 表格正文统一字号：glass-body-sm（平台/联系方式等，默认最大 1.15rem）
   与 glass-caption（创建时间/占位等，默认最大 1rem）在单元格内统一为 1em，
   与 ID/名称/权重等正文完全一致；
   同时颜色统一为默认黑白自适应（--color-text），表格内不使用灰色/次级色 */
.data-table-td :deep(.glass-body-sm),
.data-table-td :deep(.glass-caption) {
  font-size: 1em;
  color: var(--color-text);
}

.data-table-row {
  transition: background 0.18s ease;
}

.data-table-td {
  transition: background 0.15s ease;
}

/* 行高拖动条：每个单元格底部 8px 命中区（覆盖整行下分割线），
   悬停显示 row-resize 光标 + 高亮线，拖动统一调整所有行高。
   因单元格 overflow:hidden，命中区落在单元格内部而非外扩 */
.data-table-row-resize {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 8px;
  cursor: row-resize;
  z-index: 2;
}
.data-table-row-resize::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 2px;
  transform: translateY(-50%) scaleX(0);
  background: var(--color-accent);
  box-shadow: 0 0 6px var(--color-accent-glow);
  opacity: 0;
  transition: opacity 0.15s ease, transform 0.15s ease;
  pointer-events: none;
}
.data-table-row-resize:hover::before,
.data-table-row-resize.is-active::before {
  opacity: 1;
  transform: translateY(-50%) scaleX(1);
}

/* 最后一行：闭合数据块 —— 底部边框 + 下圆角，与表头"头尾呼应"。
   注意：不再给末行加列间竖线（表格本身无列分隔线设计，末行单独有竖线会显得不一致）。 */
.data-table-inner tbody tr:last-child td {
  /* 末行闭合线：与行间分隔线统一用次级文字灰 */
  border-bottom: 1px solid var(--color-text-muted);
}
/* 末行左下角（勾选列）圆角 */
.data-table-fixed-left .data-table-inner tbody tr:last-child td:first-child {
  border-bottom-left-radius: var(--radius-lg);
}
/* 末行右下角（操作列）圆角 */
.data-table-fixed-right .data-table-inner tbody tr:last-child td:last-child {
  border-bottom-right-radius: var(--radius-lg);
}

/* 操作列按钮：鼠标设备上默认半透明，行 hover 时浮现（Notion/Airtable 手法） */
@media (hover: hover) {
  .data-table-td.is-actions :deep(.glass-btn) {
    opacity: 0.35;
    transition: opacity 0.18s ease;
  }
  .data-table-row.is-hovered .data-table-td.is-actions :deep(.glass-btn),
  .data-table-row.is-selected .data-table-td.is-actions :deep(.glass-btn) {
    opacity: 1;
  }
}

/* 空态：悬浮在卡片中央，横跨表头+内容区，不随滚动条移动 */
.data-table-empty-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  font-size: 0.95em;
  pointer-events: none;
  z-index: 1;
  /* 底部预留分页栏高度，使空态不被分页遮挡 */
  padding-bottom: 3.5rem;
}

.data-table-pagination {
  padding: 0;
  flex-shrink: 0;
}

/* 列设置面板动画 */
.data-table-fade-enter-active,
.data-table-fade-leave-active {
  transition: all 0.2s ease;
}
.data-table-fade-enter-from,
.data-table-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

@media (max-width: 640px) {
  .data-table-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .data-table-toolbar-right {
    justify-content: flex-end;
  }
}
</style>

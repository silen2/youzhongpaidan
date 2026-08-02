<template>
  <div class="advanced-search">
    <!-- 基础搜索行 -->
    <div ref="rowRef" class="advanced-search-row">
      <div ref="basicRef" class="advanced-search-basic">
        <!-- 模糊搜索 -->
        <div class="advanced-search-field advanced-search-keyword">
          <label for="advanced-search-keyword" class="glass-label">全局搜索：</label>
          <div class="advanced-search-keyword-box">
            <Search class="advanced-search-icon" />
            <input
              :value="keyword"
              id="advanced-search-keyword"
              type="text"
              name="keyword"
              :placeholder="keywordPlaceholder"
              class="glass-input"
              @input="onKeywordInput"
            />
            <button
              v-if="keyword"
              class="advanced-search-clear"
              @click="onClearKeyword"
              title="清除搜索"
            >
              <X class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <!-- 主筛选下拉 -->
        <div v-if="primaryFilterOptions?.length" class="advanced-search-field advanced-search-select">
          <label v-if="primaryFilterLabel" class="glass-label">{{ primaryFilterLabel }}：</label>
          <DropdownSelect
            :model-value="primaryFilter"
            :options="[{ value: primaryFilterAllValue, label: primaryFilterAllLabel }, ...primaryFilterOptions]"
            :searchable="false"
            :aria-label="primaryFilterLabel || '主筛选'"
            teleport-to-body
            @update:model-value="onPrimaryFilterChange"
          />
        </div>

        <!-- 排序：方向切换按钮 + 关联列 -->
        <div class="advanced-search-field advanced-search-sort-field">
          <label class="glass-label">排序：</label>
          <div class="advanced-search-sort">
          <button
            type="button"
            class="sort-direction-btn"
            :class="{ 'is-asc': sortDirection === 'asc' }"
            @click="toggleSortDirection"
            :title="sortDirection === 'desc' ? '当前从高到低，点击切换为从低到高' : '当前从低到高，点击切换为从高到低'"
          >
            <ArrowDown v-if="sortDirection === 'desc'" class="w-3.5 h-3.5" />
            <ArrowUp v-else class="w-3.5 h-3.5" />
            <span>{{ sortDirection === 'desc' ? '高→低' : '低→高' }}</span>
          </button>
          <DropdownSelect
            :model-value="sortKey"
            :options="sortOptions"
            :searchable="false"
            aria-label="排序字段"
            teleport-to-body
            @update:model-value="onSortKeyChange"
          />
          </div>
        </div>
      </div>

      <!-- 右侧操作区 -->
      <div ref="actionsRef" class="advanced-search-actions">
        <!-- 高级搜索展开/收起按钮 -->
        <button
          v-if="hasAdvancedFilters"
          class="glass-btn glass-btn-ghost glass-btn-sm advanced-search-toggle"
          :class="{ 'is-open': isExpanded }"
          @click="isExpanded = !isExpanded"
        >
          <Filter class="w-3.5 h-3.5" />
          <span>高级筛选</span>
          <ChevronDown class="w-3.5 h-3.5 transition-transform duration-200" :class="{ 'rotate-180': isExpanded }" />
        </button>

        <!-- 重置按钮：固定显示在高级筛选右侧（不再条件弹出，避免操作区宽度变化导致布局抖动） -->
        <button
          class="glass-btn glass-btn-ghost glass-btn-sm"
          @click="onReset"
        >
          <RotateCcw class="w-3.5 h-3.5" />
          <span>重置</span>
        </button>
      </div>
    </div>

    <!-- 高级筛选展开区域：JS 钩子驱动 height 缓动展开/收起；
         右侧预留与基础行「高级筛选」操作区等宽的空白，使分割列与上方对齐 -->
    <transition
      name="advanced-slide"
      @enter="onAdvancedEnter"
      @leave="onAdvancedLeave"
    >
      <div v-if="isExpanded && hasAdvancedFilters" class="advanced-search-extra">
        <div class="advanced-search-extra-inner" :style="{ paddingRight: extraPadRight + 'px' }">
          <slot name="advanced"></slot>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { X, ChevronDown, Filter, RotateCcw, ArrowDown, ArrowUp, Search } from '@lucide/vue'
import DropdownSelect from './DropdownSelect.vue'

interface FilterOption {
  value: string
  label: string
}

type SortDirection = 'asc' | 'desc'

interface Props {
  keyword: string
  keywordPlaceholder?: string
  primaryFilter: string
  primaryFilterAllValue: string
  primaryFilterAllLabel: string
  primaryFilterOptions?: FilterOption[]
  /** 主筛选的名称标签（基础行内显示，如「客户类型」「订单状态」） */
  primaryFilterLabel?: string
  sortKey: string
  sortDirection: SortDirection
  sortOptions: FilterOption[]
  hasAdvancedFilters?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  keywordPlaceholder: '搜索...',
  primaryFilterOptions: () => [],
  primaryFilterLabel: '',
  hasAdvancedFilters: false,
})

const emit = defineEmits<{
  'update:keyword': [value: string]
  'update:primaryFilter': [value: string]
  'update:sortKey': [value: string]
  'update:sortDirection': [value: SortDirection]
  'reset': []
}>()

const isExpanded = ref(false)

// ===== 高级搜索区右侧预留宽度：与基础行「高级筛选/重置」操作区等宽，
// 使高级搜索的分割列与上方基础搜索的分割列对齐 =====
const rowRef = ref<HTMLElement | null>(null)
const basicRef = ref<HTMLElement | null>(null)
const actionsRef = ref<HTMLElement | null>(null)
const extraPadRight = ref(0)

let extraResizeObserver: ResizeObserver | null = null

function measureExtraPadRight() {
  const row = rowRef.value
  const basic = basicRef.value
  if (row && basic) {
    const pad = Math.round(row.getBoundingClientRect().right - basic.getBoundingClientRect().right)
    extraPadRight.value = Math.max(0, pad)
  }
}

onMounted(() => {
  measureExtraPadRight()
  if (typeof ResizeObserver !== 'undefined') {
    extraResizeObserver = new ResizeObserver(() => measureExtraPadRight())
    if (rowRef.value) extraResizeObserver.observe(rowRef.value)
    if (actionsRef.value) extraResizeObserver.observe(actionsRef.value)
  }
})

onBeforeUnmount(() => {
  extraResizeObserver?.disconnect()
  extraResizeObserver = null
})

// ===== 高级筛选展开/收起动画：JS 钩子显式驱动 height（0 → scrollHeight → 0），
// 配合 CSS transition 实现平滑缓动（grid-template-rows 的 fr 过渡在收起方向不插值，弃用） =====
function waitTransitionEnd(el: Element, done: () => void) {
  const target = el as HTMLElement
  let finished = false
  const finish = () => {
    if (finished) return
    finished = true
    target.removeEventListener('transitionend', finish)
    done()
  }
  // 只等 height 过渡结束（0.35s 为最长；opacity 0.22s 会先触发，不能提前完成）
  const onEnd = (e: TransitionEvent) => {
    if (e.propertyName === 'height') finish()
  }
  target.addEventListener('transitionend', onEnd)
  // 兜底：动画最长 0.35s，超时强制完成
  window.setTimeout(finish, 500)
}

function onAdvancedEnter(el: Element, done: () => void) {
  const e = el as HTMLElement
  e.style.height = '0px'
  e.style.opacity = '0'
  requestAnimationFrame(() => {
    e.style.height = `${e.scrollHeight}px`
    e.style.opacity = '1'
  })
  waitTransitionEnd(el, done)
}

function onAdvancedLeave(el: Element, done: () => void) {
  const e = el as HTMLElement
  e.style.height = `${e.scrollHeight}px`
  e.style.opacity = '1'
  requestAnimationFrame(() => {
    e.style.height = '0px'
    e.style.opacity = '0'
  })
  waitTransitionEnd(el, done)
}

function onKeywordInput(e: Event) {
  emit('update:keyword', (e.target as HTMLInputElement).value)
}

function onClearKeyword() {
  emit('update:keyword', '')
}

function onPrimaryFilterChange(value: string | number) {
  emit('update:primaryFilter', String(value))
}

function onSortKeyChange(value: string | number) {
  emit('update:sortKey', String(value))
}

function toggleSortDirection() {
  emit('update:sortDirection', props.sortDirection === 'desc' ? 'asc' : 'desc')
}

function onReset() {
  emit('reset')
}
</script>

<style scoped>
.advanced-search {
  width: 100%;
}

.advanced-search-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

/* 基础搜索行：三等分分割布局 —— 预留右侧「高级筛选」操作区后，
   剩余横向空间分为 6 份，每个搜索项各占 2 份（等宽段） */
.advanced-search-basic {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: var(--space-3);
  flex: 1;
  min-width: 0;
}

.advanced-search-basic > .advanced-search-field {
  grid-column: span 2;
  min-width: 0;
  /* 与高级搜索一致：名称标签在上、控件在下（纵排） */
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-1);
}

.advanced-search-field {
  position: relative;
  /* 覆盖全局 slot 字段样式（flex column），基础行为块级 */
  display: block;
  flex: none;
}

/* 搜索框：占满所在分割段，高度与高级搜索控件一致 */
.advanced-search-keyword {
  position: relative;
}

/* 输入框+清除按钮的定位容器：清除按钮以输入框为参照垂直居中，
   而不是整个字段（含上方标签） */
.advanced-search-keyword-box {
  position: relative;
  display: flex;
  align-items: center;
}

/* 搜索放大镜：输入框左侧悬浮图标 */
.advanced-search-icon {
  position: absolute;
  left: 0.625rem;
  width: 0.9rem;
  height: 0.9rem;
  color: var(--color-text-muted);
  pointer-events: none;
  z-index: 1;
}

.advanced-search-keyword .glass-input {
  width: 100%;
  min-width: 0;
  /* 左侧留出放大镜空间，右侧预留清除按钮空间 */
  padding-left: 2rem;
  padding-right: 2.25rem;
  border-radius: var(--radius-md);
  /* 与高级搜索输入控件同字号（0.8rem） */
  font-size: 0.8rem;
}

/* 下拉框与输入框保持一致：字号 0.8rem，使 em 内边距/行高与 .glass-input 相同（等高 33px） */
.advanced-search :deep(.dropdown-select-trigger) {
  font-size: 0.8rem;
}

.advanced-search-clear {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  display: grid;
  place-items: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: var(--radius-full);
  background: var(--glass-bg);
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.2s;
}
.advanced-search-clear:hover {
  background: var(--glass-bg-hover);
  color: var(--color-text);
}

/* 操作区：纵向拉伸到与基础搜索字段等高，按钮组整体贴底部 →
   与「标签在上、控件在下」的输入框控件底部对齐（而不是整行垂直居中） */
.advanced-search-actions {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
  align-self: stretch;
}

/* 高级筛选/重置按钮与基础搜索控件（0.8rem → 33px）等高对齐；
   margin-top:auto 把按钮组推到操作区底部 = 控件底部水平线 */
.advanced-search-actions .glass-btn {
  height: 33px;
  box-sizing: border-box;
  margin-top: auto;
}

.advanced-search-toggle.is-open {
  background: var(--glass-bg-strong);
  border-color: var(--color-accent-glow);
  color: var(--color-accent);
}

/* 高级筛选展开区：JS 钩子控制 height（0 → scrollHeight），CSS 负责缓动过渡；
   overflow: hidden 确保展开/收起过程中内容被裁切干净 */
.advanced-search-extra {
  overflow: hidden;
  transition: height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.22s ease;
}
.advanced-search-extra-inner {
  min-height: 0;
  overflow: hidden;
  /* 间距用 border-top + padding-top 实现（在盒内，外层 height 动画时可被裁切；margin 不会被裁切） */
  border-top: 1px solid var(--glass-border-soft);
  padding-top: var(--space-3);
  /* 与基础行同一套 6 份分割：每个高级字段各占 2 份，对齐基础搜索段 */
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: var(--space-3);
}
.advanced-search-extra-inner :deep(.advanced-search-field) {
  grid-column: span 2;
  min-width: 0;
}

/* ===== 排序组合控件：方向按钮 + 关联列下拉，视觉上合为一体 ===== */
.advanced-search-sort {
  display: inline-flex;
  align-items: stretch;
  flex-direction: row;
  flex-wrap: nowrap;
  gap: 0;
  min-width: 0;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--glass-bg);
  /* 不可裁剪：下拉面板需溢出显示 */
  overflow: visible;
  transition: all 0.15s;
}
.advanced-search-sort:focus-within {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-soft);
}

.sort-direction-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5em 0.7em;
  border: none;
  border-right: 1px solid var(--glass-border-soft);
  border-radius: var(--radius-md) 0 0 var(--radius-md);
  background: transparent;
  color: var(--color-text-muted);
  /* 与输入框/下拉框同字号，保持等高 */
  font-size: 0.8rem;
  font-weight: 500;
  font-family: var(--font-body);
  line-height: 1.5;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.15s;
}
.sort-direction-btn:hover {
  background: var(--glass-bg-hover);
  color: var(--color-text);
}
.sort-direction-btn.is-asc {
  color: var(--color-accent);
}

/* 下拉触发器融入组合容器：去掉自身边框与圆角 */
.advanced-search-sort :deep(.dropdown-select) {
  flex: 1;
}
.advanced-search-sort :deep(.dropdown-select-trigger) {
  border: none;
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  background: transparent;
  min-width: 7.5rem;
}
.advanced-search-sort :deep(.dropdown-select-trigger:hover) {
  background: var(--glass-bg-hover);
}

/* 展开/收起过渡由 JS 钩子（onAdvancedEnter/onAdvancedLeave）驱动 height，
   transition 属性已在 .advanced-search-extra 上声明 */

@media (max-width: 640px) {
  .advanced-search-basic {
    width: 100%;
    grid-template-columns: 1fr;
  }
  .advanced-search-basic > .advanced-search-field {
    grid-column: auto;
  }
  .advanced-search-extra-inner {
    grid-template-columns: 1fr;
  }
  .advanced-search-extra-inner :deep(.advanced-search-field) {
    grid-column: auto;
  }
  .advanced-search-actions {
    /* 移动端回到横向：操作区换行显示，按钮水平居右 */
    width: 100%;
    flex-direction: row;
    align-items: center;
    align-self: auto;
    justify-content: flex-end;
  }
}
</style>
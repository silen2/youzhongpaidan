<template>
  <div ref="rootRef" class="date-picker" :class="{ 'is-range': range }">
    <!-- 触发器：div[role=button]（内嵌真实清除按钮，button 不能嵌套 button）；
         外观与 .glass-input 一致，随主题自动适配 -->
    <div
      ref="triggerRef"
      role="button"
      tabindex="0"
      class="date-picker-trigger"
      :class="{ 'is-placeholder': !hasValue }"
      :aria-label="triggerAriaLabel"
      @click="toggle"
      @keydown.enter.prevent="toggle"
      @keydown.space.prevent="toggle"
    >
      <component :is="range ? CalendarRange : Calendar" class="date-picker-trigger-icon" />
      <span class="date-picker-trigger-text">{{ displayText || placeholder }}</span>
      <!-- 清除按钮：与箭头同排，位于箭头左侧（点击不触发打开） -->
      <button
        v-if="clearable && hasValue"
        type="button"
        class="date-picker-clear"
        :title="range ? '清除日期范围' : '清除日期'"
        @click.stop="clear"
      >
        <X class="w-3.5 h-3.5" />
      </button>
      <ChevronDown class="date-picker-arrow" :class="{ 'is-open': isOpen }" />
    </div>

    <!-- 日历面板：Teleport 到 body 用 fixed 定位（避免被父级 overflow/backdrop-filter 裁剪） -->
    <Teleport to="body">
      <transition name="date-picker-fade">
        <div
          v-if="isOpen"
          ref="panelRef"
          class="date-picker-panel"
          :style="panelStyle"
          @mousedown.stop
        >
          <!-- 月份导航 + 年月下拉（快速跨月/跨年） -->
          <div class="date-picker-head">
            <button type="button" class="date-picker-nav" aria-label="上个月" @click="prevMonth">
              <ChevronLeft class="w-4 h-4" />
            </button>
            <div class="date-picker-title-group">
              <button
                type="button"
                class="date-picker-title-btn"
                :class="{ 'is-open': pickerMode === 'year' }"
                @click="togglePicker('year')"
              >
                {{ viewYear }}年
                <ChevronDown class="date-picker-title-arrow" :class="{ 'is-open': pickerMode === 'year' }" />
              </button>
              <button
                type="button"
                class="date-picker-title-btn"
                :class="{ 'is-open': pickerMode === 'month' }"
                @click="togglePicker('month')"
              >
                {{ viewMonth + 1 }}月
                <ChevronDown class="date-picker-title-arrow" :class="{ 'is-open': pickerMode === 'month' }" />
              </button>
            </div>
            <button type="button" class="date-picker-nav" aria-label="下个月" @click="nextMonth">
              <ChevronRight class="w-4 h-4" />
            </button>
          </div>

          <!-- 年份 / 月份快速选择列表 -->
          <div v-if="pickerMode === 'year'" class="date-picker-ym-list">
            <button
              v-for="y in yearOptions"
              :key="y"
              type="button"
              class="date-picker-ym-item"
              :class="{ 'is-active': y === viewYear }"
              @click="pickYear(y)"
            >
              {{ y }}年
            </button>
          </div>
          <div v-else-if="pickerMode === 'month'" class="date-picker-ym-list">
            <button
              v-for="mo in 12"
              :key="mo"
              type="button"
              class="date-picker-ym-item"
              :class="{ 'is-active': mo - 1 === viewMonth }"
              @click="pickMonth(mo)"
            >
              {{ mo }}月
            </button>
          </div>

          <!-- 星期表头（周一为一周开始） -->
          <div class="date-picker-week">
            <span v-for="w in WEEK_LABELS" :key="w" class="date-picker-week-cell">{{ w }}</span>
          </div>

          <!-- 日期网格 -->
          <div class="date-picker-grid">
            <button
              v-for="cell in cells"
              :key="cell.key"
              type="button"
              class="date-picker-day"
              :class="dayClass(cell)"
              :disabled="!cell.inMonth"
              @click="pick(cell)"
              @mouseenter="hoverIso = cell.iso"
            >
              {{ cell.day }}
            </button>
          </div>

          <!-- 手动输入区：支持直接输入日期（跨月/补录方便），回车应用 -->
          <div class="date-picker-manual">
            <div v-if="range" class="date-picker-manual-row">
              <input
                v-model="manualStart"
                type="text"
                class="date-picker-manual-input"
                placeholder="开始 2026-06-01"
                aria-label="手动输入开始日期"
                @keydown.enter="applyManualInput"
              />
              <span class="date-picker-manual-sep">~</span>
              <input
                v-model="manualEnd"
                type="text"
                class="date-picker-manual-input"
                placeholder="结束 2026-08-15"
                aria-label="手动输入结束日期"
                @keydown.enter="applyManualInput"
              />
            </div>
            <input
              v-else
              v-model="manualSingle"
              type="text"
              class="date-picker-manual-input"
              placeholder="YYYY-MM-DD"
              aria-label="手动输入日期"
              @keydown.enter="applyManualInput"
            />
            <p v-if="manualError" class="date-picker-manual-error">{{ manualError }}</p>
            <p v-else class="date-picker-manual-hint">支持手动输入或点选年月快速跨月</p>
          </div>

          <!-- 范围选择提示 -->
          <div v-if="range" class="date-picker-foot">{{ rangeHint }}</div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Calendar, CalendarRange, ChevronLeft, ChevronRight, ChevronDown, X } from '@lucide/vue'

interface Props {
  /** 单日期模式选中值（YYYY-MM-DD） */
  modelValue?: string
  /** 范围模式开始日期（YYYY-MM-DD） */
  startValue?: string
  /** 范围模式结束日期（YYYY-MM-DD） */
  endValue?: string
  /** 是否范围模式（同一日历内点选起止日期） */
  range?: boolean
  /** 无值时的占位文案 */
  placeholder?: string
  /** 是否显示清除按钮 */
  clearable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  startValue: '',
  endValue: '',
  range: false,
  placeholder: '选择日期',
  clearable: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:startValue': [value: string]
  'update:endValue': [value: string]
}>()

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']

const rootRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const panelStyle = ref<Record<string, string>>({})

// 当前展示的年月（打开面板时按已有值或今天定位）
const today = new Date()
const viewYear = ref(today.getFullYear())
const viewMonth = ref(today.getMonth())

// 范围选择中间态：已选开始日期、等待选结束日期
const pendingStart = ref('')
const hoverIso = ref('')

// 年月快速选择（下拉列表）：'year' | 'month' | 'none'
const pickerMode = ref<'year' | 'month' | 'none'>('none')
const yearOptions = computed(() => {
  const y = viewYear.value
  return Array.from({ length: 15 }, (_, i) => y - 7 + i)
})

// 手动输入
const manualStart = ref('')
const manualEnd = ref('')
const manualSingle = ref('')
const manualError = ref('')

function togglePicker(mode: 'year' | 'month') {
  pickerMode.value = pickerMode.value === mode ? 'none' : mode
}

function pickYear(y: number) {
  viewYear.value = y
  pickerMode.value = 'none'
}

function pickMonth(mo: number) {
  viewMonth.value = mo - 1
  pickerMode.value = 'none'
}

/** 解析手动输入：支持 YYYY-MM-DD / YYYY/M/D / YYYY.M.D；非法返回 null */
function parseManualDate(raw: string): string | null {
  const m = raw.trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const dt = new Date(y, mo - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null
  return toISO(dt)
}

function applyManualInput() {
  if (props.range) {
    const s = parseManualDate(manualStart.value)
    const e = parseManualDate(manualEnd.value)
    if (!manualStart.value.trim() && !manualEnd.value.trim()) return
    if (manualStart.value.trim() && !s) { manualError.value = '开始日期格式无效'; return }
    if (manualEnd.value.trim() && !e) { manualError.value = '结束日期格式无效'; return }
    manualError.value = ''
    // 自动交换：开始晚于结束时
    if (s && e && s > e) {
      emit('update:startValue', e)
      emit('update:endValue', s)
    } else {
      if (s) emit('update:startValue', s)
      if (e) emit('update:endValue', e)
    }
    close()
    return
  }
  const iso = parseManualDate(manualSingle.value)
  if (!manualSingle.value.trim()) return
  if (!iso) { manualError.value = '日期格式无效（YYYY-MM-DD）'; return }
  manualError.value = ''
  emit('update:modelValue', iso)
  close()
}

function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayISO(): string {
  return toISO(new Date())
}

interface DayCell {
  key: string
  iso: string
  day: number
  inMonth: boolean
}

// 42 格日历网格（6 行固定高度），周一为一周开始
const cells = computed<DayCell[]>(() => {
  const offset = (new Date(viewYear.value, viewMonth.value, 1).getDay() + 6) % 7
  const list: DayCell[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(viewYear.value, viewMonth.value, i - offset + 1)
    list.push({
      key: d.getTime().toString(),
      iso: toISO(d),
      day: d.getDate(),
      inMonth: d.getMonth() === viewMonth.value,
    })
  }
  return list
})

const hasValue = computed(() => (props.range ? !!props.startValue || !!props.endValue : !!props.modelValue))

const displayText = computed(() => {
  if (!props.range) return props.modelValue || ''
  const s = props.startValue
  const e = props.endValue
  if (s && e) return `${s} ~ ${e}`
  if (s) return `${s} ~ 选择结束`
  return ''
})

const triggerAriaLabel = computed(() => {
  if (props.range) return displayText.value || '选择日期范围'
  return displayText.value || '选择日期'
})

function isBetween(iso: string, a: string, b: string): boolean {
  const lo = a < b ? a : b
  const hi = a < b ? b : a
  return iso > lo && iso < hi
}

function dayClass(cell: DayCell) {
  const inRangeNow = !!props.startValue && !!props.endValue && isBetween(cell.iso, props.startValue, props.endValue)
  const previewing = !!pendingStart.value && !props.endValue && !!hoverIso.value && isBetween(cell.iso, pendingStart.value, hoverIso.value)
  return {
    'is-out': !cell.inMonth,
    'is-today': cell.iso === todayISO(),
    'is-single': !props.range && cell.iso === props.modelValue,
    'is-start': props.range && cell.iso === props.startValue,
    'is-end': props.range && cell.iso === props.endValue,
    'is-in-range': inRangeNow,
    'is-preview': previewing,
  }
}

const rangeHint = computed(() => {
  if (pendingStart.value && !props.endValue) return `请点击选择结束日期`
  if (props.startValue && props.endValue) return `已选范围，再次点击可重新选择`
  return `请点击选择开始日期`
})

function pick(cell: DayCell) {
  const iso = cell.iso
  if (!props.range) {
    emit('update:modelValue', iso)
    close()
    return
  }
  if (!props.startValue) {
    emit('update:startValue', iso)
    pendingStart.value = iso
    return
  }
  if (!props.endValue) {
    if (iso < props.startValue) {
      emit('update:startValue', iso)
      emit('update:endValue', props.startValue)
    } else {
      emit('update:endValue', iso)
    }
    pendingStart.value = ''
    close()
    return
  }
  // 起止都已选中：重新开始选择
  emit('update:startValue', iso)
  emit('update:endValue', '')
  pendingStart.value = iso
}

function clear() {
  if (props.range) {
    emit('update:startValue', '')
    emit('update:endValue', '')
  } else {
    emit('update:modelValue', '')
  }
}

function prevMonth() {
  viewMonth.value--
  if (viewMonth.value < 0) {
    viewMonth.value = 11
    viewYear.value--
  }
}

function nextMonth() {
  viewMonth.value++
  if (viewMonth.value > 11) {
    viewMonth.value = 0
    viewYear.value++
  }
}

function toggle() {
  if (isOpen.value) {
    close()
    return
  }
  isOpen.value = true
}

watch(isOpen, async (open) => {
  if (!open) return
  // 打开时定位到已有值所在月份
  const anchor = props.range ? props.startValue || props.endValue || todayISO() : props.modelValue || todayISO()
  const d = new Date(`${anchor}T00:00:00`)
  if (!Number.isNaN(d.getTime())) {
    viewYear.value = d.getFullYear()
    viewMonth.value = d.getMonth()
  }
  pendingStart.value = ''
  hoverIso.value = ''
  pickerMode.value = 'none'
  manualError.value = ''
  manualStart.value = props.startValue || ''
  manualEnd.value = props.endValue || ''
  manualSingle.value = props.modelValue || ''
  await nextTick()
  positionPanel()
})

// 面板 fixed 定位：默认向下，空间不足向上；宽度固定 288px（窄屏时不超过视口）
function positionPanel() {
  const trigger = triggerRef.value
  const panel = panelRef.value
  if (!trigger || !panel) return
  const rect = trigger.getBoundingClientRect()
  const width = Math.min(288, window.innerWidth - 24)
  const height = Math.max(panel.getBoundingClientRect().height, 300)
  const left = Math.min(Math.max(rect.left, 12), window.innerWidth - width - 12)
  const enoughBelow = rect.bottom + 6 + height <= window.innerHeight
  const enoughAbove = rect.top - 6 - height >= 12
  const top = enoughBelow ? rect.bottom + 6 : (enoughAbove ? rect.top - height - 6 : Math.max(12, rect.bottom + 6))
  panelStyle.value = { top: `${top}px`, left: `${left}px`, width: `${width}px` }
}

function onClickOutside(e: MouseEvent) {
  if (!isOpen.value) return
  const t = e.target as Node
  if (rootRef.value?.contains(t)) return
  if (panelRef.value?.contains(t)) return
  close()
}

function close() {
  isOpen.value = false
}

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onClickOutside)
})
</script>

<style scoped>
.date-picker {
  position: relative;
  min-width: 0;
}

/* ===== 触发器：与 .glass-input 同款玻璃外观，随主题自动适配 ===== */
.date-picker-trigger {
  display: flex;
  align-items: center;
  gap: 0.5em;
  width: 100%;
  padding: 0.5em 0.75em;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  /* 字号由上下文通过 --date-picker-font-size 覆盖（如高级搜索 0.8rem 与其他控件等高） */
  font-size: var(--date-picker-font-size, 0.875em);
  font-family: var(--font-body);
  line-height: 1.5;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  text-align: left;
  box-sizing: border-box;
}
.date-picker-trigger:hover {
  border-color: var(--glass-border);
  background: var(--glass-bg-hover);
}
.date-picker-trigger.is-placeholder {
  color: var(--color-text-muted);
}
.date-picker-trigger:focus-visible {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-soft);
}

.date-picker-trigger-icon {
  flex-shrink: 0;
  width: 1em;
  height: 1em;
  color: var(--color-text-muted);
}

.date-picker-trigger-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 清除按钮：流内排列在箭头左侧（与下拉框的清除/箭头布局一致） */
.date-picker-clear {
  display: grid;
  place-items: center;
  width: 1.4rem;
  height: 1.4rem;
  flex-shrink: 0;
  margin-left: 0.25em;
  border: none;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
}
.date-picker-clear:hover {
  background: var(--glass-bg-hover);
  color: var(--color-text);
}

.date-picker-arrow {
  flex-shrink: 0;
  width: 1em;
  height: 1em;
  color: var(--color-text-muted);
  transition: transform 0.2s ease;
}
.date-picker-arrow.is-open {
  transform: rotate(180deg);
  color: var(--color-accent);
}

/* ===== 日历面板：浮动玻璃面板（--glass-bg-panel 随亮暗主题切换） ===== */
.date-picker-panel {
  position: fixed;
  z-index: 1000;
  background: var(--glass-bg-panel);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-glass-hover), var(--shadow-inner-glass), 0 12px 32px rgba(0, 0, 0, 0.16);
  padding: var(--space-3);
  user-select: none;
}
/* 顶部 accent 渐变装饰线（玻璃面板层次感） */
.date-picker-panel::before {
  content: '';
  position: absolute;
  top: 0;
  left: var(--space-4);
  right: var(--space-4);
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--color-accent-glow), transparent);
  opacity: 0.6;
  pointer-events: none;
}

.date-picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

/* 年月标题按钮组：点年/月分别弹出快速选择列表 */
.date-picker-title-group {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}
.date-picker-title-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.2em;
  padding: 0.3em 0.55em;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text);
  font-family: var(--font-heading);
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  cursor: pointer;
  transition: all 0.18s ease;
}
.date-picker-title-btn:hover {
  background: var(--glass-bg-hover);
  color: var(--color-accent);
  border-color: var(--glass-border);
  transform: translateY(-1px);
}
.date-picker-title-btn.is-open {
  background: var(--color-accent-soft);
  color: var(--color-accent);
  border-color: var(--color-accent-glow);
  box-shadow: 0 0 8px var(--color-accent-glow);
}
.date-picker-title-arrow {
  width: 0.85em;
  height: 0.85em;
  color: var(--color-text-muted);
  transition: transform 0.2s ease;
}
.date-picker-title-arrow.is-open {
  transform: rotate(180deg);
  color: var(--color-accent);
}

/* 年份 / 月份快速选择列表 */
.date-picker-ym-list {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.25rem;
  margin-bottom: var(--space-2);
  padding: var(--space-2);
  background: var(--glass-bg-strong);
  border: 1px solid var(--glass-border-soft);
  border-radius: var(--radius-md);
}
.date-picker-ym-item {
  display: grid;
  place-items: center;
  padding: 0.4em 0;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 0.8rem;
  font-family: var(--font-body);
  cursor: pointer;
  transition: all 0.14s ease;
}
.date-picker-ym-item:hover {
  background: var(--glass-bg-hover);
  color: var(--color-text);
  border-color: var(--glass-border);
  transform: translateY(-1px);
}
.date-picker-ym-item.is-active {
  background: var(--color-accent-soft);
  color: var(--color-accent);
  border-color: var(--color-accent-glow);
  font-weight: 600;
  box-shadow: 0 0 8px var(--color-accent-glow);
}

/* 手动输入区：跨月/补录直接输入日期，回车应用 */
.date-picker-manual {
  margin-top: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid var(--glass-border-soft);
}
.date-picker-manual-row {
  display: flex;
  align-items: center;
  gap: 0.4em;
}
.date-picker-manual-input {
  flex: 1;
  min-width: 0;
  padding: 0.45em 0.65em;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-size: 0.8rem;
  font-family: var(--font-body);
  line-height: 1.5;
  outline: none;
  transition: all 0.18s ease;
}
.date-picker-manual-input:hover {
  border-color: var(--color-accent-glow);
  background: var(--glass-bg-hover);
}
.date-picker-manual-input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-soft);
  background: var(--glass-bg-hover);
}
.date-picker-manual-input::placeholder {
  color: var(--color-text-muted);
}
.date-picker-manual-sep {
  color: var(--color-accent);
  font-size: 0.8rem;
  font-weight: 600;
  flex-shrink: 0;
}
.date-picker-manual-hint,
.date-picker-manual-error {
  margin-top: 0.375rem;
  font-size: 0.72rem;
}
.date-picker-manual-hint {
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  gap: 0.3em;
}
.date-picker-manual-hint::before {
  content: '';
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--color-accent);
  box-shadow: 0 0 6px var(--color-accent-glow);
  flex-shrink: 0;
}
.date-picker-manual-error {
  color: var(--color-danger);
  display: flex;
  align-items: center;
  gap: 0.3em;
}
.date-picker-manual-error::before {
  content: '⚠';
  flex-shrink: 0;
}

.date-picker-nav {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.18s ease;
}
.date-picker-nav:hover {
  background: var(--glass-bg-hover);
  color: var(--color-accent);
  border-color: var(--glass-border);
  transform: translateY(-1px);
  box-shadow: 0 0 8px var(--color-accent-glow);
}

.date-picker-week {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.125rem;
  margin-bottom: 0.125rem;
}
.date-picker-week-cell {
  text-align: center;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  font-weight: 500;
  letter-spacing: 0.04em;
  padding: 0.25rem 0;
}

.date-picker-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.125rem;
}

.date-picker-day {
  display: grid;
  place-items: center;
  height: 2.1rem;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text);
  font-size: 0.85rem;
  font-family: var(--font-body);
  cursor: pointer;
  transition: background 0.14s ease, color 0.14s ease, border-color 0.14s ease, box-shadow 0.14s ease, transform 0.14s ease;
}
.date-picker-day:hover:not(:disabled) {
  background: var(--glass-bg-hover);
  border-color: var(--color-accent-glow);
  color: var(--color-accent);
  transform: translateY(-1px);
}
.date-picker-day:disabled {
  opacity: 0.35;
  cursor: default;
}
.date-picker-day.is-today {
  font-weight: 600;
  box-shadow: inset 0 0 0 1px var(--color-accent-glow), 0 0 6px var(--color-accent-glow);
  color: var(--color-accent);
}

/* 选中（单日期） / 起止（范围） */
.date-picker-day.is-single,
.date-picker-day.is-start,
.date-picker-day.is-end {
  background: linear-gradient(135deg, var(--color-accent), var(--color-accent-hover));
  color: #fff;
  font-weight: 500;
  box-shadow: 0 2px 10px var(--color-accent-glow), inset 0 1px 0 rgba(255, 255, 255, 0.25);
  transform: translateY(-1px);
}

/* 范围中间高亮 + 悬停预览 */
.date-picker-day.is-in-range,
.date-picker-day.is-preview {
  background: var(--color-accent-soft);
  color: var(--color-accent);
  border-radius: 0;
}
.date-picker-day.is-in-range {
  background: var(--color-accent-soft);
}

.date-picker-foot {
  margin-top: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid var(--glass-border-soft);
  text-align: center;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

/* 展开/收起动画 */
.date-picker-fade-enter-active,
.date-picker-fade-leave-active {
  transition: all 0.18s ease;
}
.date-picker-fade-enter-from,
.date-picker-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>

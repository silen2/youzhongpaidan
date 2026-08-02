<template>
  <div ref="rootRef" class="dropdown-select" :class="{ 'is-open': isOpen, 'is-disabled': disabled }">
    <!-- 触发器 -->
    <button
      ref="triggerRef"
      type="button"
      class="dropdown-select-trigger"
      :class="{ 'is-placeholder': !selectedLabel }"
      :disabled="disabled"
      :aria-expanded="isOpen"
      :aria-label="ariaLabel"
      @click="toggle"
    >
      <span class="dropdown-select-value">{{ selectedLabel || placeholder }}</span>
      <ChevronDown class="dropdown-select-arrow" :class="{ 'is-open': isOpen }" />
    </button>

    <!-- 下拉面板：teleportToBody 时挂到 body 用 fixed 定位（避免被父级 overflow/backdrop-filter 裁剪） -->
    <Teleport v-if="teleportToBody" to="body">
      <transition name="dropdown-fade">
        <div
          v-if="isOpen"
          ref="panelRef"
          class="dropdown-select-panel dropdown-select-panel-fixed"
          :class="{ 'is-up': direction === 'up' }"
          :style="panelStyle"
        >
          <div v-if="searchable" class="dropdown-select-search">
            <Search class="dropdown-select-search-icon" />
            <input
              ref="searchRef"
              v-model="keyword"
              type="text"
              class="dropdown-select-search-input"
              :placeholder="searchPlaceholder"
              @keydown.down.prevent="moveHighlight(1)"
              @keydown.up.prevent="moveHighlight(-1)"
              @keydown.enter.prevent="selectHighlighted"
              @keydown.esc="close"
            />
            <button v-if="keyword" type="button" class="dropdown-select-search-clear" @click="keyword = ''">
              <X class="w-3.5 h-3.5" />
            </button>
          </div>

          <ul class="dropdown-select-list">
            <li
              v-for="(opt, index) in filteredOptions"
              :key="opt.value"
              class="dropdown-select-option"
              :class="{
                'is-selected': opt.value === modelValue,
                'is-highlighted': highlightIndex === index,
                'is-disabled': opt.disabled,
              }"
              @mousedown.prevent="selectOption(opt)"
              @mouseenter="highlightIndex = index"
            >
              <Check v-if="opt.value === modelValue" class="dropdown-select-check" />
              <span class="dropdown-select-option-label">{{ opt.label }}</span>
            </li>
            <li v-if="filteredOptions.length === 0" class="dropdown-select-empty">
              <span>无匹配结果</span>
            </li>
          </ul>
        </div>
      </transition>
    </Teleport>

    <transition v-else name="dropdown-fade">
      <div v-if="isOpen" class="dropdown-select-panel" :class="{ 'is-up': direction === 'up' }">
        <div v-if="searchable" class="dropdown-select-search">
          <Search class="dropdown-select-search-icon" />
          <input
            ref="searchRef"
            v-model="keyword"
            type="text"
            class="dropdown-select-search-input"
            :placeholder="searchPlaceholder"
            @keydown.down.prevent="moveHighlight(1)"
            @keydown.up.prevent="moveHighlight(-1)"
            @keydown.enter.prevent="selectHighlighted"
            @keydown.esc="close"
          />
          <button v-if="keyword" type="button" class="dropdown-select-search-clear" @click="keyword = ''">
            <X class="w-3.5 h-3.5" />
          </button>
        </div>

        <ul class="dropdown-select-list">
          <li
            v-for="(opt, index) in filteredOptions"
            :key="opt.value"
            class="dropdown-select-option"
            :class="{
              'is-selected': opt.value === modelValue,
              'is-highlighted': highlightIndex === index,
              'is-disabled': opt.disabled,
            }"
            @mousedown.prevent="selectOption(opt)"
            @mouseenter="highlightIndex = index"
          >
            <Check v-if="opt.value === modelValue" class="dropdown-select-check" />
            <span class="dropdown-select-option-label">{{ opt.label }}</span>
          </li>
          <li v-if="filteredOptions.length === 0" class="dropdown-select-empty">
            <span>无匹配结果</span>
          </li>
        </ul>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { Search, X, ChevronDown, Check } from '@lucide/vue'

export interface SelectOption {
  value: string | number
  label: string
  disabled?: boolean
}

interface Props {
  modelValue: string | number | null
  options: SelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  /** 是否显示搜索框，默认 true */
  searchable?: boolean
  disabled?: boolean
  ariaLabel?: string
  /** 面板 Teleport 到 body 并用 fixed 定位（避免被父级 overflow/backdrop-filter 裁剪），默认 false */
  teleportToBody?: boolean
  /** 面板展开方向：'down' 向下（默认）/'up' 向上 */
  direction?: 'down' | 'up'
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '请选择',
  searchPlaceholder: '搜索...',
  searchable: true,
  disabled: false,
  ariaLabel: '',
  teleportToBody: false,
  direction: 'down',
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
  /** 选中某项时触发（便于行内编辑等场景选中即提交） */
  'select': [value: string | number]
}>()

const rootRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const searchRef = ref<HTMLInputElement | null>(null)
const isOpen = ref(false)
const keyword = ref('')
const highlightIndex = ref(0)
const panelStyle = ref<Record<string, string>>({})

// 选中项的显示文本
const selectedLabel = computed(() => {
  const opt = props.options.find(o => o.value === props.modelValue)
  return opt ? opt.label : ''
})

// 模糊搜索过滤
const filteredOptions = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return props.options
  return props.options.filter(o => o.label.toLowerCase().includes(kw))
})

watch(isOpen, async (open) => {
  if (open) {
    keyword.value = ''
    highlightIndex.value = 0
    await nextTick()
    if (props.teleportToBody) positionPanel()
    if (props.searchable) {
      searchRef.value?.focus()
    }
  }
})

// Teleport 模式下：面板 fixed 定位在触发器下方；空间不足或 direction=up 时向上展开。
// 高度以面板实际渲染高度为准（不要硬编码，否则无搜索框的简洁面板会与触发器之间留出大空隙）
function positionPanel() {
  const trigger = triggerRef.value
  const panel = panelRef.value
  if (!trigger || !panel) return
  const rect = trigger.getBoundingClientRect()
  const panelRect = panel.getBoundingClientRect()
  const width = Math.max(rect.width, 120)
  const height = Math.max(panelRect.height, 60)
  let left = Math.min(rect.left, window.innerWidth - width - 12)
  left = Math.max(12, left)
  const preferUp = props.direction === 'up'
  const enoughBelow = rect.bottom + 6 + height <= window.innerHeight
  const enoughAbove = rect.top - 6 - height >= 12
  let top: number
  if (preferUp ? enoughAbove : enoughBelow) {
    top = preferUp ? rect.top - height - 6 : rect.bottom + 6
  } else {
    // 空间不足时反向
    top = preferUp ? rect.bottom + 6 : Math.max(12, rect.top - height - 6)
  }
  panelStyle.value = { top: `${top}px`, left: `${left}px`, width: `${width}px` }
}

// 点击外部关闭（Teleport 模式下面板不在 rootRef 内，需同时判断 panelRef）
function onClickOutside(e: MouseEvent) {
  if (!isOpen.value) return
  const target = e.target as Node
  if (rootRef.value?.contains(target)) return
  if (panelRef.value?.contains(target)) return
  close()
}

function toggle() {
  if (props.disabled) return
  isOpen.value = !isOpen.value
}

function close() {
  isOpen.value = false
}

function selectOption(opt: SelectOption) {
  if (opt.disabled) return
  emit('update:modelValue', opt.value)
  emit('select', opt.value)
  close()
}

function moveHighlight(step: number) {
  if (filteredOptions.value.length === 0) return
  const len = filteredOptions.value.length
  highlightIndex.value = (highlightIndex.value + step + len) % len
}

function selectHighlighted() {
  const opt = filteredOptions.value[highlightIndex.value]
  if (opt && !opt.disabled) {
    selectOption(opt)
  }
}

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onClickOutside)
})
</script>

<style scoped>
.dropdown-select {
  position: relative;
  min-width: 0;
}

.dropdown-select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5em;
  width: 100%;
  padding: 0.5em 0.75em;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-size: 0.875em;
  font-family: var(--font-body);
  line-height: 1.5;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  text-align: left;
}
.dropdown-select-trigger:hover {
  border-color: var(--glass-border);
  background: var(--glass-bg-hover);
}
.dropdown-select-trigger.is-placeholder {
  color: var(--color-text-muted);
}
.dropdown-select-trigger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.dropdown-select-trigger:focus-visible {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-soft);
}

.dropdown-select-value {
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-select-arrow {
  flex-shrink: 0;
  width: 1em;
  height: 1em;
  color: var(--color-text-muted);
  transition: transform 0.2s ease;
}
.dropdown-select-arrow.is-open {
  transform: rotate(180deg);
  color: var(--color-accent);
}

/* 下拉面板 */
.dropdown-select-panel {
  position: absolute;
  top: calc(100% + 0.375rem);
  left: 0;
  right: 0;
  z-index: 300;
  background: var(--glass-bg-panel);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-glass-hover), var(--shadow-inner-glass);
  overflow: hidden;
}
.dropdown-select-panel.is-up {
  top: auto;
  bottom: calc(100% + 0.375rem);
}
.dropdown-select-panel-fixed {
  position: fixed;
  z-index: 1000;
}
/* fixed 模式由 JS 计算 top 定位，忽略 is-up 的 bottom（避免 top+bottom 双定位导致高度塌陷） */
.dropdown-select-panel-fixed.is-up {
  bottom: auto;
}

/* 搜索框 */
.dropdown-select-search {
  position: relative;
  display: flex;
  align-items: center;
  padding: 0.5rem;
  border-bottom: 1px solid var(--glass-border-soft);
}
.dropdown-select-search-icon {
  position: absolute;
  left: 1rem;
  width: 1rem;
  height: 1rem;
  color: var(--color-text-muted);
  pointer-events: none;
}
.dropdown-select-search-input {
  flex: 1;
  min-width: 0;
  padding: 0.4em 2em 0.4em 2.1em;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-size: 0.85em;
  font-family: var(--font-body);
  outline: none;
  transition: all 0.2s ease;
}
.dropdown-select-search-input::placeholder {
  color: var(--color-text-muted);
}
.dropdown-select-search-input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-soft);
}
.dropdown-select-search-clear {
  position: absolute;
  right: 0.75rem;
  display: grid;
  place-items: center;
  width: 1.4rem;
  height: 1.4rem;
  border: none;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
}
.dropdown-select-search-clear:hover {
  background: var(--glass-bg-hover);
  color: var(--color-text);
}

/* 选项列表 */
.dropdown-select-list {
  list-style: none;
  margin: 0;
  padding: 0.375rem;
  max-height: 15rem;
  overflow-y: auto;
}
.dropdown-select-option {
  display: flex;
  align-items: center;
  gap: 0.5em;
  padding: 0.5em 0.75em;
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-size: 0.875em;
  cursor: pointer;
  transition: background 0.12s ease;
  white-space: nowrap;
}
.dropdown-select-option.is-highlighted {
  background: var(--glass-bg-hover);
}
.dropdown-select-option.is-selected {
  color: var(--color-accent);
  font-weight: 500;
}
.dropdown-select-option.is-disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.dropdown-select-check {
  flex-shrink: 0;
  width: 1em;
  height: 1em;
}
.dropdown-select-option-label {
  overflow: hidden;
  text-overflow: ellipsis;
}
.dropdown-select-empty {
  padding: 0.75em;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 0.85em;
}

/* 动画 */
.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  transition: all 0.18s ease;
}
.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>

<template>
  <div ref="rootRef" class="multiselect">
    <!-- 触发器：玻璃盒 + 选中摘要（前 maxDisplay 个 + 省略号）+ 清空 + 箭头 -->
    <div
      ref="triggerRef"
      role="button"
      tabindex="0"
      class="multiselect-trigger"
      :class="{ 'is-open': isOpen, 'is-placeholder': !selectedLabels.length }"
      :aria-label="ariaLabel"
      @click="toggle"
      @keydown.enter.prevent="toggle"
      @keydown.space.prevent="toggle"
      @keydown.esc="isOpen = false"
    >
      <span class="multiselect-value" :title="selectedLabels.join('、') || undefined">{{ displayText }}</span>
      <button
        v-if="selectedLabels.length"
        type="button"
        class="multiselect-clear"
        title="清除全部"
        @click.stop="clearAll"
      >
        <X class="w-3.5 h-3.5" />
      </button>
      <ChevronDown class="multiselect-arrow" :class="{ 'is-open': isOpen }" />
    </div>

    <!-- 面板：Teleport 到 body + fixed 定位（避免被高级区 overflow 容器裁剪） -->
    <Teleport to="body">
      <transition name="multiselect-fade">
        <div v-if="isOpen" ref="panelRef" class="multiselect-panel" :style="panelStyle" @mousedown.stop>
          <div class="multiselect-panel-head">
            <span class="multiselect-panel-title">{{ ariaLabel || '多选' }}</span>
            <span v-if="selectedLabels.length" class="multiselect-panel-count">已选 {{ selectedLabels.length }} 项</span>
          </div>
          <ul class="multiselect-list">
            <li
              v-for="opt in options"
              :key="String(opt.value)"
              class="multiselect-option"
              :class="{ 'is-selected': isSelected(opt.value) }"
              @click="toggleOption(opt.value)"
            >
              <span class="multiselect-check">
                <Check v-if="isSelected(opt.value)" class="w-3 h-3" />
              </span>
              <span class="multiselect-option-label">{{ opt.label }}</span>
            </li>
            <li v-if="options.length === 0" class="multiselect-empty">
              <span>暂无选项</span>
            </li>
          </ul>
          <div v-if="selectedLabels.length" class="multiselect-panel-foot">
            <button type="button" class="glass-btn glass-btn-ghost glass-btn-sm" @click="clearAll">清空</button>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { ChevronDown, Check, X } from '@lucide/vue'

export interface MultiSelectOption {
  value: string | number
  label: string
}

const props = withDefaults(defineProps<{
  modelValue: (string | number)[]
  options: MultiSelectOption[]
  placeholder?: string
  ariaLabel?: string
  /** 触发器最多完整显示前几个选中项，超出用省略号 */
  maxDisplay?: number
}>(), {
  placeholder: '请选择',
  ariaLabel: '多选',
  maxDisplay: 2,
})

const emit = defineEmits<{
  'update:modelValue': [value: (string | number)[]]
}>()

const isOpen = ref(false)
const rootRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const panelStyle = ref<Record<string, string>>({})

const labelMap = computed(() => new Map(props.options.map(o => [String(o.value), o.label])))
const selectedLabels = computed(() =>
  props.modelValue.map(v => labelMap.value.get(String(v)) ?? String(v)),
)

/** 触发器摘要：前 maxDisplay 个选项 + 省略号；无选中显示占位 */
const displayText = computed(() => {
  if (selectedLabels.value.length === 0) return props.placeholder
  const shown = selectedLabels.value.slice(0, props.maxDisplay).join('、')
  return selectedLabels.value.length > props.maxDisplay ? `${shown}…` : shown
})

function isSelected(value: string | number): boolean {
  return props.modelValue.includes(value)
}

function toggleOption(value: string | number) {
  const next = isSelected(value)
    ? props.modelValue.filter(v => v !== value)
    : [...props.modelValue, value]
  emit('update:modelValue', next)
}

function clearAll() {
  emit('update:modelValue', [])
}

function toggle() {
  isOpen.value = !isOpen.value
}

watch(isOpen, async (open) => {
  if (open) {
    await nextTick()
    position()
  }
})

function position() {
  const trigger = triggerRef.value
  const panel = panelRef.value
  if (!trigger || !panel) return
  const rect = trigger.getBoundingClientRect()
  const panelRect = panel.getBoundingClientRect()
  const width = Math.max(rect.width, 160)
  const height = Math.max(panelRect.height, 80)
  let left = Math.min(rect.left, window.innerWidth - width - 12)
  left = Math.max(12, left)
  const enoughBelow = rect.bottom + 6 + height <= window.innerHeight
  const top = enoughBelow ? rect.bottom + 6 : Math.max(12, rect.top - height - 6)
  panelStyle.value = { top: `${top}px`, left: `${left}px`, width: `${width}px` }
}

function onClickOutside(e: MouseEvent) {
  if (!isOpen.value) return
  const target = e.target as Node
  if (rootRef.value?.contains(target)) return
  if (panelRef.value?.contains(target)) return
  isOpen.value = false
}

onMounted(() => document.addEventListener('mousedown', onClickOutside))
onBeforeUnmount(() => document.removeEventListener('mousedown', onClickOutside))
</script>

<style scoped>
.multiselect {
  position: relative;
  min-width: 0;
}
/* 触发器：与 DropdownSelect 同款玻璃盒，字号走变量（高级区上下文覆盖为 0.8rem 等高） */
.multiselect-trigger {
  display: flex;
  align-items: center;
  gap: 0.5em;
  height: 33px;
  box-sizing: border-box;
  padding: 0 0.75em;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--glass-bg);
  font-size: var(--multiselect-font-size, 0.875em);
  font-weight: 400;
  font-family: var(--font-body);
  line-height: 1.5;
  color: var(--color-text);
  cursor: pointer;
  user-select: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.multiselect-trigger:hover {
  border-color: var(--glass-border);
  background: var(--glass-bg-hover);
}
.multiselect-trigger.is-open {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-soft);
}
.multiselect-trigger.is-placeholder {
  color: var(--color-text-muted);
}
.multiselect-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.multiselect-clear {
  display: grid;
  place-items: center;
  width: 1.2rem;
  height: 1.2rem;
  border: none;
  border-radius: var(--radius-full);
  background: var(--glass-bg-hover);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.12s ease;
}
.multiselect-clear:hover {
  color: var(--color-danger);
  background: var(--color-danger-soft);
}
.multiselect-arrow {
  flex-shrink: 0;
  width: 1em;
  height: 1em;
  color: var(--color-text-muted);
  transition: transform 0.15s ease;
}
.multiselect-arrow.is-open {
  transform: rotate(180deg);
  color: var(--color-accent);
}
/* 面板：玻璃下拉，fixed 定位（同 DropdownSelect） */
.multiselect-panel {
  position: fixed;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  background: var(--glass-bg-panel);
  backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-glass-hover), var(--shadow-inner-glass);
  padding: 0.375rem;
}
.multiselect-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.35em 0.65em 0.3em;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}
.multiselect-panel-count {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--color-accent);
  background: var(--color-accent-soft);
  border-radius: var(--radius-full);
  padding: 0.1em 0.6em;
}
.multiselect-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 220px;
  overflow-y: auto;
}
.multiselect-option {
  display: flex;
  align-items: center;
  gap: 0.5em;
  padding: 0.5em 0.65em;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.12s ease;
}
.multiselect-option:hover {
  background: var(--glass-bg-hover);
}
.multiselect-option.is-selected {
  background: var(--color-accent-soft);
}
.multiselect-check {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 1.1rem;
  height: 1.1rem;
  border-radius: 4px;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--color-accent);
}
.multiselect-option.is-selected .multiselect-check {
  border-color: var(--color-accent);
  background: var(--color-accent);
  color: #fff;
}
.multiselect-option-label {
  font-size: 0.85rem;
  line-height: 1.4;
  color: var(--color-text);
  white-space: nowrap;
}
.multiselect-empty {
  padding: 1rem;
  text-align: center;
  font-size: 0.8rem;
  color: var(--color-text-muted);
}
.multiselect-panel-foot {
  border-top: 1px solid var(--glass-border-soft);
  margin-top: 0.25rem;
  padding-top: 0.25rem;
  display: flex;
  justify-content: flex-end;
}
.multiselect-fade-enter-active,
.multiselect-fade-leave-active {
  transition: all 0.15s ease;
}
.multiselect-fade-enter-from,
.multiselect-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>

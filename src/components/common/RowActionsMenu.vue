<template>
  <div ref="rootRef" class="row-actions-menu">
    <button
      ref="btnRef"
      type="button"
      class="glass-btn glass-btn-ghost glass-btn-sm row-actions-trigger"
      :class="{ 'is-open': isOpen }"
      title="操作"
      aria-label="操作"
      @click.stop="toggle"
    >
      <MoreHorizontal class="w-4 h-4" />
    </button>

    <!-- 菜单 Teleport 到 body + fixed 定位：避免被固定操作列/卡片 overflow 裁剪 -->
    <Teleport to="body">
      <transition name="row-actions-fade">
        <div v-if="isOpen" ref="panelRef" class="row-actions-dropdown" :style="panelStyle">
          <div class="row-actions-header">
            <span class="row-actions-header-icon"><MoreHorizontal class="w-3.5 h-3.5" /></span>
            <span>操作</span>
          </div>
          <div class="row-actions-divider"></div>

          <template v-for="(opt, i) in options" :key="opt.label">
            <!-- 显式分组分隔线；危险操作（删除）前自动插入分隔线 -->
            <div v-if="opt.separator || (opt.danger && i === dangerStartIndex)" class="row-actions-divider"></div>
            <button
              type="button"
              class="row-actions-item"
              :class="{ 'is-danger': opt.danger }"
              @click="pick(opt)"
            >
              <component :is="opt.icon" class="row-actions-item-icon" />
              <span class="row-actions-item-label">{{ opt.label }}</span>
            </button>
          </template>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount, type Component } from 'vue'
import { MoreHorizontal } from '@lucide/vue'

export interface RowAction {
  label: string
  icon?: Component
  danger?: boolean
  /** 在该项前插入分隔线（显式分组） */
  separator?: boolean
  action: () => void
}

const props = defineProps<{ options: RowAction[] }>()

const rootRef = ref<HTMLElement | null>(null)
const btnRef = ref<HTMLElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const panelStyle = ref<Record<string, string>>({})

/** 第一个危险项的索引（其前插入分隔线）；无危险项时为 -1 */
const dangerStartIndex = computed(() => props.options.findIndex(o => o.danger))

watch(isOpen, async (open) => {
  if (open) {
    await nextTick()
    position()
  }
})

// 面板 fixed 定位：按钮下方右对齐；空间不足时向上展开，始终限制在视口内
function position() {
  const btn = btnRef.value
  const panel = panelRef.value
  if (!btn || !panel) return
  const rect = btn.getBoundingClientRect()
  // 宽度实测（菜单项文字长度不定），最小 156px
  const width = panel.getBoundingClientRect().width || 156
  const height = panel.getBoundingClientRect().height || 150
  let left = rect.right - width
  left = Math.min(Math.max(8, left), window.innerWidth - width - 8)
  const top = rect.bottom + 6 + height <= window.innerHeight
    ? rect.bottom + 6
    : Math.max(8, rect.top - height - 6)
  panelStyle.value = { top: `${top}px`, left: `${left}px`, width: `${width}px` }
}

function toggle() {
  isOpen.value = !isOpen.value
}

function pick(opt: RowAction) {
  isOpen.value = false
  opt.action()
}

// 点击外部关闭
function onClickOutside(e: MouseEvent) {
  if (!isOpen.value) return
  const t = e.target as Node
  if (rootRef.value?.contains(t)) return
  if (panelRef.value?.contains(t)) return
  isOpen.value = false
}

onMounted(() => document.addEventListener('mousedown', onClickOutside))
onBeforeUnmount(() => document.removeEventListener('mousedown', onClickOutside))
</script>

<style scoped>
.row-actions-menu {
  display: inline-flex;
}

/* 触发器：打开时 accent 高亮 */
.row-actions-trigger {
  padding: 0.35em 0.55em;
}
.row-actions-trigger.is-open {
  color: var(--color-accent);
  background: var(--glass-bg-strong);
  box-shadow: 0 0 0 3px var(--color-accent-soft);
}

/* 弹窗：玻璃面板 + 立体阴影 + 顶部 accent 渐变装饰线（呼应统计卡/列头语言） */
.row-actions-dropdown {
  position: fixed;
  background: var(--glass-bg-strong);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-glass-hover), var(--shadow-inner-glass), 0 12px 32px rgba(0, 0, 0, 0.16);
  min-width: 156px;
  padding: 0.375rem;
  z-index: 1000;
}
.row-actions-dropdown::before {
  content: '';
  position: absolute;
  top: 0;
  left: 12%;
  right: 12%;
  height: 2px;
  border-radius: 2px;
  background: linear-gradient(90deg, transparent, var(--color-accent-glow), transparent);
  opacity: 0.6;
  pointer-events: none;
}

/* 头部：accent 图标块 + 标题（与详情页卡片标题同款语言） */
.row-actions-header {
  display: flex;
  align-items: center;
  gap: 0.5em;
  padding: 0.3em 0.6em 0.35em;
  color: var(--color-accent);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.05em;
}
.row-actions-header-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 1.4rem;
  height: 1.4rem;
  border-radius: var(--radius-md);
  background: var(--color-accent-soft);
  border: 1px solid var(--color-accent-glow);
  color: var(--color-accent);
}

/* 分隔线 */
.row-actions-divider {
  height: 1px;
  background: var(--glass-border);
  margin: 0.25rem 0.5rem;
}

/* 菜单项：图标 + 文字，hover 图标转 accent，危险项红色 */
.row-actions-item {
  display: flex;
  align-items: center;
  gap: 0.6em;
  width: 100%;
  padding: 0.45em 0.75em;
  border: none;
  background: transparent;
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-size: 0.85rem;
  font-family: var(--font-body);
  line-height: 1.4;
  cursor: pointer;
  text-align: left;
  white-space: nowrap;
  transition: background 0.14s ease, color 0.14s ease;
}
.row-actions-item-icon {
  flex-shrink: 0;
  width: 1.05rem;
  height: 1.05rem;
  color: var(--color-text-muted);
  transition: color 0.14s ease, transform 0.14s ease;
}
.row-actions-item:hover {
  background: var(--color-accent-soft);
}
.row-actions-item:hover .row-actions-item-icon {
  color: var(--color-accent);
  transform: scale(1.1);
}
.row-actions-item.is-danger,
.row-actions-item.is-danger .row-actions-item-icon {
  color: var(--color-danger);
}
.row-actions-item.is-danger:hover {
  background: var(--color-danger-soft);
}

/* 展开动画：轻微上浮 + 缩放淡入 */
.row-actions-fade-enter-active,
.row-actions-fade-leave-active {
  transition: all 0.16s ease;
}
.row-actions-fade-enter-from,
.row-actions-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}
</style>

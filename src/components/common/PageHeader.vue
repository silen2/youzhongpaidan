<template>
  <header class="page-header-glass">
    <div v-if="icon || $slots.icon" class="page-header-icon">
      <slot name="icon">
        <component :is="icon" class="w-5 h-5" />
      </slot>
    </div>

    <div class="page-header-text">
      <h1 class="page-header-title">{{ title }}</h1>
      <p v-if="subtitle" class="page-header-subtitle">{{ subtitle }}</p>
    </div>

    <div v-if="$slots.actions" class="page-header-actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup lang="ts">
import type { Component } from 'vue'

/**
 * 通用页面页头（玻璃拟态卡片式）。
 *
 * - 用法：<PageHeader title="设置" subtitle="..." :icon="SettingsIcon">
 *   <template #actions><button ...>...</button></template>
 * - 图标省略时隐藏；右侧操作区通过 #actions 插槽传入（按钮等），移动端自动换行。
 */
interface Props {
  title: string
  subtitle?: string
  icon?: Component
}

withDefaults(defineProps<Props>(), {
  subtitle: undefined,
  icon: undefined,
})
</script>

<style scoped>
.page-header-glass {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  /* 大屏适度舒展：内边距随屏宽放大 */
  padding: clamp(0.9rem, 1.8vw, 1.5rem) clamp(1rem, 2vw, 2rem);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-glass), var(--shadow-inner-glass);
  /* 与下方内容（搜索栏/卡片）的统一段间距：与各页面工具栏/卡片组同一节奏 */
  margin-bottom: var(--space-section);
}
.page-header-icon {
  flex: none;
  width: clamp(2.4rem, 4vw, 3rem);
  height: clamp(2.4rem, 4vw, 3rem);
  display: grid;
  place-items: center;
  border-radius: var(--radius-md);
  background: var(--color-accent-soft);
  color: var(--color-accent);
  box-shadow: inset 0 0 0 1px var(--color-accent-glow);
}
.page-header-title {
  font-family: var(--font-heading);
  font-size: clamp(1.3rem, 2.2vw, 1.9rem);
  font-weight: 700;
  letter-spacing: 0.01em;
  line-height: 1.25;
  color: var(--color-text);
}
.page-header-subtitle {
  margin-top: 0.125rem;
  font-size: 0.85em;
  color: var(--color-text-muted);
}
.page-header-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
@media (max-width: 640px) {
  .page-header-glass {
    flex-wrap: wrap;
    gap: var(--space-3);
  }
  .page-header-actions {
    margin-left: 0;
    width: 100%;
  }
  .page-header-actions :deep(.glass-btn) {
    flex: 1;
  }
}
</style>

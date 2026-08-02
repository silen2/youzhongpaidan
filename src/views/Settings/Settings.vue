<template>
  <div class="fluid-container">
    <PageHeader :icon="SettingsIcon" title="设置" subtitle="管理系统模板、权重配置和通知设置" />

    <div class="settings-layout">
      <!-- 桌面侧边导航 -->
      <nav class="settings-nav">
        <div class="settings-nav-head">
          <component :is="SlidersHorizontal" class="w-4 h-4" />
          <span>配置项</span>
        </div>
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          class="settings-nav-item"
          :class="activeTab === tab.id ? 'settings-nav-item-active' : ''"
        >
          <component :is="tab.icon" class="settings-nav-icon" />
          <span class="truncate">{{ tab.label }}</span>
        </button>
      </nav>

      <!-- 移动端横向标签 -->
      <div class="settings-nav-mobile">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          class="glass-nav-item shrink-0"
          :class="activeTab === tab.id ? 'glass-nav-item-active' : ''"
        >
          <component :is="tab.icon" class="w-4 h-4 shrink-0" />
          {{ tab.label }}
        </button>
      </div>

      <!-- 内容区 -->
      <div class="settings-content">
        <StageConfig v-if="activeTab === 'stage'" />
        <SourceConfig v-else-if="activeTab === 'source'" />
        <CategoryConfig v-else-if="activeTab === 'category'" />
        <CustomerTypeConfig v-else-if="activeTab === 'customerType'" />
        <FollowUpTypeConfig v-else-if="activeTab === 'followUpType'" />
        <WeightConfig v-else-if="activeTab === 'weight'" />
        <ThemeConfig v-else-if="activeTab === 'theme'" />
        <NotificationSettings v-else-if="activeTab === 'notification'" />
        <PreferencesConfig v-else-if="activeTab === 'preferences'" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import { Layers, Link, Tag, Users, ClipboardList, BarChart3, Bell, Palette, SlidersHorizontal, Settings as SettingsIcon } from '@lucide/vue'
import PageHeader from '@/components/common/PageHeader.vue'
import StageConfig from './StageConfig.vue'
import SourceConfig from './SourceConfig.vue'
import CategoryConfig from './CategoryConfig.vue'
import CustomerTypeConfig from './CustomerTypeConfig.vue'
import FollowUpTypeConfig from './FollowUpTypeConfig.vue'
import WeightConfig from './WeightConfig.vue'
import NotificationSettings from './NotificationSettings.vue'
import ThemeConfig from './ThemeConfig.vue'
import PreferencesConfig from './PreferencesConfig.vue'

const activeTab = ref('stage')

const tabs = [
  { id: 'stage', label: '绘制阶段', icon: shallowRef(Layers) },
  { id: 'source', label: '来源模板', icon: shallowRef(Link) },
  { id: 'category', label: '稿件类别', icon: shallowRef(Tag) },
  { id: 'customerType', label: '客户类型', icon: shallowRef(Users) },
  { id: 'followUpType', label: '跟进类型', icon: shallowRef(ClipboardList) },
  { id: 'weight', label: '权重配置', icon: shallowRef(BarChart3) },
  { id: 'theme', label: '主题外观', icon: shallowRef(Palette) },
  { id: 'notification', label: '通知与数据', icon: shallowRef(Bell) },
  { id: 'preferences', label: '偏好设置', icon: shallowRef(SlidersHorizontal) },
]
</script>

<style scoped>
.settings-layout {
  display: grid;
  grid-template-columns: 11rem minmax(0, 1fr);
  gap: var(--space-6);
  align-items: start;
}
/* 侧边导航：玻璃卡片容器，激活项带左侧强调条与图标高亮 */
.settings-nav {
  position: sticky;
  top: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: var(--space-3);
  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-glass), var(--shadow-inner-glass);
}
.settings-nav-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  margin-bottom: var(--space-1);
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}
.settings-nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-muted);
  transition: all 0.18s ease;
  cursor: pointer;
  text-align: left;
}
.settings-nav-item:hover {
  background: var(--glass-bg-hover);
  color: var(--color-text);
}
.settings-nav-item-active {
  background: var(--color-accent-soft);
  color: var(--color-text);
  box-shadow: inset 0 0 0 1px var(--color-accent-glow);
}
.settings-nav-item-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 50%;
  border-radius: 0 var(--radius-full) var(--radius-full) 0;
  background: var(--color-accent);
  box-shadow: 0 0 8px var(--color-accent-glow);
}
.settings-nav-icon {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  transition: color 0.18s ease;
}
.settings-nav-item-active .settings-nav-icon {
  color: var(--color-accent);
}
.settings-nav-mobile {
  display: none;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 0.5rem;
  scrollbar-width: none;
}
.settings-nav-mobile::-webkit-scrollbar {
  display: none;
}
.settings-content {
  min-width: 0;
}

@media (max-width: 640px) {
  .settings-layout {
    grid-template-columns: 1fr;
  }
  .settings-nav {
    display: none;
  }
  .settings-nav-mobile {
    display: flex;
  }
}
</style>

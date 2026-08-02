<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  LayoutDashboard,
  FileText,
  GanttChartSquare,
  Users,
  ClipboardList,
  Wallet,
  BarChart3,
  Settings,
  Bell,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  X,
  CheckCheck,
  AlertTriangle,
  CalendarClock,
  Trash2,
  Sun,
} from '@lucide/vue'
import { useThemeStore } from '@/stores/theme'
import { useNotificationStore } from '@/stores/notification'

const route = useRoute()
const router = useRouter()
const theme = useThemeStore()
const notificationStore = useNotificationStore()

// 侧边栏收纳状态（持久化到 localStorage）
const collapsed = ref(localStorage.getItem('sidebar.collapsed') === '1')

function toggleCollapsed() {
  collapsed.value = !collapsed.value
  try {
    localStorage.setItem('sidebar.collapsed', collapsed.value ? '1' : '0')
  } catch {
    // ignore quota / privacy-mode errors
  }
}

// 品牌图片位：默认使用内置头图（public/brand-logo.jpg），主题外观里可上传自定义图覆盖
const DEFAULT_BRAND_IMAGE = '/brand-logo.jpg'
const brandImageUrl = computed(() => theme.customBrandImage || DEFAULT_BRAND_IMAGE)

/** 把当前头图同步为浏览器标签页图标（favicon），自定义图优先，否则用默认图 */
function updateFavicon() {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'icon'
    document.head.appendChild(link)
  }
  link.href = brandImageUrl.value
}

// 头图变化时同步 favicon
watch(brandImageUrl, updateFavicon)

// ===== 品牌头图点击抖动 =====
const brandShaking = ref(false)
let brandShakeTimer: ReturnType<typeof setTimeout> | null = null

function triggerBrandShake() {
  if (brandShaking.value) return
  brandShaking.value = true
  if (brandShakeTimer) clearTimeout(brandShakeTimer)
  brandShakeTimer = setTimeout(() => {
    brandShaking.value = false
  }, 520)
}

// ===== 通知中心 =====
const notifPanelOpen = ref(false)
const notifPanelRef = ref<HTMLElement | null>(null)

const unreadCount = computed(() => notificationStore.unreadCount)

function notifIcon(type: string) {
  switch (type) {
    case 'overdue': return AlertTriangle
    case 'due-soon': return CalendarClock
    case 'followup-due': return ClipboardList
    case 'daily-summary': return Sun
    default: return Bell
  }
}
function notifBadgeClass(type: string): string {
  switch (type) {
    case 'overdue': return 'glass-badge-danger'
    case 'due-soon': return 'glass-badge-warning'
    case 'daily-summary': return 'glass-badge-success'
    default: return 'glass-badge-primary'
  }
}
function notifTypeLabel(type: string): string {
  switch (type) {
    case 'overdue': return '催收'
    case 'due-soon': return '到期'
    case 'followup-due': return '跟进'
    case 'daily-summary': return '日报'
    default: return '通知'
  }
}

/** 通知图标块的语义色（催收红/到期黄/日报绿/其余主色），与类型徽章色呼应 */
function notifIconTone(type: string): string {
  switch (type) {
    case 'overdue': return 'is-danger'
    case 'due-soon': return 'is-warning'
    case 'daily-summary': return 'is-success'
    default: return 'is-accent'
  }
}

function formatNotifTime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function toggleNotifPanel() {
  notifPanelOpen.value = !notifPanelOpen.value
  if (notifPanelOpen.value) {
    // 打开时重新生成（催收/到期/跟进状态可能已变化），保证数据新鲜
    await notificationStore.generateNotifications()
    await notificationStore.fetchNotifications()
  }
}

async function openNotification(n: { id: string; relatedId?: string; relatedType?: string; isRead: boolean }) {
  if (!n.isRead) await notificationStore.markRead(n.id)
  notifPanelOpen.value = false
  if (!n.relatedType || !n.relatedId) return
  if (n.relatedType === 'order') router.push(`/orders/${n.relatedId}`)
  else if (n.relatedType === 'customer') router.push(`/customers/${n.relatedId}`)
  else router.push('/followups')
}

async function removeNotif(id: string) {
  await notificationStore.removeNotification(id)
}

// 点击面板外部关闭
function onClickOutside(e: MouseEvent) {
  if (!notifPanelOpen.value) return
  const t = e.target as Node
  if (notifPanelRef.value?.contains(t)) return
  notifPanelOpen.value = false
}

onMounted(async () => {
  theme.applyTheme()
  document.addEventListener('mousedown', onClickOutside)
  updateFavicon()
  await notificationStore.fetchNotifications()
  await notificationStore.generateNotifications()
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onClickOutside)
  if (brandShakeTimer) clearTimeout(brandShakeTimer)
})

const navItems = [
  { path: '/dashboard', label: '工作台', icon: LayoutDashboard },
  { path: '/orders', label: '订单', icon: FileText },
  { path: '/gantt', label: '排期', icon: GanttChartSquare },
  { path: '/customers', label: '客户', icon: Users },
  { path: '/followups', label: '跟进', icon: ClipboardList },
  { path: '/payments', label: '账单', icon: Wallet },
  { path: '/statistics', label: '统计', icon: BarChart3 },
  { path: '/settings', label: '设置', icon: Settings },
]
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <!-- Sidebar -->
    <aside
      class="glass-nav shrink-0 sidebar"
      :class="{ 'sidebar-collapsed': collapsed }"
      :style="{ width: collapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width)' }"
    >
      <!-- 收纳开关：侧边栏右侧居中浮动箭头 -->
      <button
        class="sidebar-collapse-btn"
        :title="collapsed ? '展开侧边栏' : '收纳侧边栏'"
        @click="toggleCollapsed"
      >
        <ChevronLeft v-if="!collapsed" class="w-3 h-3" />
        <ChevronRight v-else class="w-3 h-3" />
      </button>

      <!-- 品牌头图区：毛玻璃卡片，头图随屏宽自适应，点击抖动 -->
      <div class="sidebar-brand">
        <button
          type="button"
          class="sidebar-brand-btn"
          :class="{ 'is-shaking': brandShaking }"
          title="品牌头图"
          @click="triggerBrandShake"
        >
          <img
            v-if="brandImageUrl"
            :src="brandImageUrl"
            alt="品牌"
            class="sidebar-brand-image"
          />
          <span v-else class="sidebar-brand-placeholder">
            <ImageIcon class="w-4 h-4" />
          </span>
        </button>
        <div class="sidebar-brand-text">
          <span class="sidebar-brand-name">有种排单</span>
          <span class="sidebar-brand-sub">Mohyeh 的插画排单管理</span>
        </div>
      </div>

      <nav class="flex-1 px-2.5 py-4 space-y-1.5 overflow-y-auto">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="glass-nav-item"
          :title="collapsed ? item.label : undefined"
          :class="route.path === item.path ? 'glass-nav-item-active' : ''"
        >
          <component :is="item.icon" class="w-4 h-4 shrink-0" />
          <span class="hide-mobile nav-label">{{ item.label }}</span>
        </router-link>
      </nav>

      <!-- Sidebar Footer: 通知铃铛 -->
      <div class="sidebar-footer px-2 py-2.5 border-t border-[var(--glass-border-soft)]">
        <div class="flex items-center justify-center">
          <button
            ref="notifPanelRef"
            class="glass-btn glass-btn-ghost glass-btn-sm sidebar-icon-btn relative shrink-0"
            :class="{ 'notif-open': notifPanelOpen }"
            title="通知"
            @click="toggleNotifPanel"
          >
            <Bell class="w-4 h-4" />
            <span
              v-if="unreadCount > 0"
              class="notif-badge"
            >{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
          </button>
        </div>
      </div>
    </aside>

    <!-- 通知面板：Teleport 到 body，右下角弹出（玻璃面板，点击外部关闭） -->
    <Teleport to="body">
      <transition name="notif-fade">
        <div v-if="notifPanelOpen" class="notif-panel">
          <div class="notif-panel-head">
            <div class="notif-panel-title">
              <span class="notif-head-icon"><Bell class="w-4 h-4" /></span>
              <span>通知中心</span>
              <span v-if="unreadCount > 0" class="notif-unread-count">{{ unreadCount }} 未读</span>
            </div>
            <button
              type="button"
              class="glass-btn glass-btn-ghost glass-btn-sm"
              :disabled="unreadCount === 0"
              @click="notificationStore.markAllRead()"
            >
              <CheckCheck class="w-3.5 h-3.5" />
              <span>全部已读</span>
            </button>
            <button type="button" class="notif-close" title="关闭" aria-label="关闭通知面板" @click="notifPanelOpen = false">
              <X class="w-4 h-4" />
            </button>
          </div>

          <div class="notif-list">
            <div v-if="notificationStore.notifications.length === 0" class="notif-empty">
              <Bell class="notif-empty-icon" />
              <p>暂无通知</p>
            </div>
            <button
              v-for="n in notificationStore.notifications"
              :key="n.id"
              type="button"
              class="notif-item"
              :class="{ 'is-unread': !n.isRead }"
              @click="openNotification(n)"
            >
              <span class="notif-item-icon" :class="notifIconTone(n.type)">
                <component :is="notifIcon(n.type)" class="w-4 h-4" />
              </span>
              <span class="notif-item-main">
                <span class="notif-item-head">
                  <span class="notif-item-title">{{ n.title }}</span>
                  <span class="glass-badge notif-item-badge" :class="notifBadgeClass(n.type)">{{ notifTypeLabel(n.type) }}</span>
                </span>
                <span class="notif-item-content">{{ n.content }}</span>
                <span class="notif-item-time">{{ formatNotifTime(n.createdAt) }}</span>
              </span>
              <span class="notif-item-remove" title="删除通知" @click.stop="removeNotif(n.id)">
                <Trash2 class="w-3.5 h-3.5" />
              </span>
            </button>
          </div>
        </div>
      </transition>
    </Teleport>

    <!-- Main Content -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- Page Content (no redundant top header bar) -->
      <main class="flex-1 overflow-auto main-content main-content-flex">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>
  </div>
</template>

<style scoped>
.sidebar {
  position: relative;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
/* 导航文字：随收纳平滑收起/展开（宽度 + 透明度双过渡） */
.sidebar .nav-label {
  overflow: hidden;
  white-space: nowrap;
  max-width: 9rem;
  opacity: 1;
  transition:
    max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.25s ease;
}
.sidebar-collapsed .nav-label {
  max-width: 0;
  opacity: 0;
}
/* 收纳开关：右侧边缘居中浮动的狭长圆角矩形把手
   底色 = 玻璃色(半透) 叠加在主题实色底上 → 不透明且与侧边栏玻璃质感一致 */
.sidebar-collapse-btn {
  position: absolute;
  top: 50%;
  right: -0.625rem;
  transform: translateY(-50%);
  z-index: 20;
  width: 1.25rem;
  height: 2.5rem;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background:
    linear-gradient(var(--glass-bg-strong), var(--glass-bg-strong)),
    var(--color-bg);
  border: 1px solid var(--glass-border);
  color: var(--color-text-secondary);
  box-shadow: var(--shadow-glass);
  cursor: pointer;
  transition: all 0.2s ease;
}
.sidebar-collapse-btn:hover {
  background:
    linear-gradient(var(--glass-bg-hover), var(--glass-bg-hover)),
    var(--color-bg);
  color: var(--color-text);
  border-color: var(--color-accent-glow);
  box-shadow: 0 0 12px var(--color-accent-glow);
}
/* ===== 品牌头图区 ===== */
/* 毛玻璃卡片：包裹头图与品牌名，与侧边栏玻璃质感一致 */
.sidebar-brand {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: var(--space-3) var(--space-3) var(--space-2);
  padding: var(--space-3);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border-soft);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-inner-glass);
  transition: background 0.2s ease, border-color 0.2s ease;
}
.sidebar-brand:hover {
  background: var(--glass-bg-hover);
  border-color: var(--glass-border);
}
/* 头图按钮：去掉默认 button 样式，hover 微放大 + 提亮 */
.sidebar-brand-btn {
  flex-shrink: 0;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: 10px;
  cursor: pointer;
  transition: transform 0.25s ease, filter 0.25s ease;
}
.sidebar-brand-btn:hover {
  transform: scale(1.06);
  filter: brightness(1.1) drop-shadow(0 0 8px var(--color-accent-glow));
}
.sidebar-brand-btn:active {
  transform: scale(0.96);
}
/* 点击抖动动画：左右摆动两下 */
.sidebar-brand-btn.is-shaking {
  animation: brand-shake 0.52s cubic-bezier(0.36, 0.07, 0.19, 0.97);
}
@keyframes brand-shake {
  0%, 100% { transform: translateX(0); }
  12% { transform: translateX(-6px) rotate(-4deg); }
  28% { transform: translateX(6px) rotate(4deg); }
  44% { transform: translateX(-5px) rotate(-3deg); }
  60% { transform: translateX(5px) rotate(3deg); }
  76% { transform: translateX(-2px) rotate(-1deg); }
}
/* 头图：随屏宽自适应放大（小屏 48px → 大屏 80px），正方形 + accent 光晕 */
.sidebar-brand-image {
  display: block;
  width: clamp(3rem, 3.5vw + 0.5rem, 5rem);
  height: clamp(3rem, 3.5vw + 0.5rem, 5rem);
  border-radius: 10px;
  object-fit: cover;
  border: 2px solid var(--glass-border);
  background: var(--glass-bg);
  box-shadow: var(--shadow-glass), 0 0 18px var(--color-accent-glow);
}
.sidebar-brand-placeholder {
  display: grid;
  place-items: center;
  width: clamp(3rem, 3.5vw + 0.5rem, 5rem);
  height: clamp(3rem, 3.5vw + 0.5rem, 5rem);
  border-radius: 10px;
  border: 2px dashed var(--glass-border);
  background: var(--glass-bg);
  color: var(--color-text-muted);
}
/* 品牌名与副标题：展开态显示，收纳态隐藏 */
.sidebar-brand-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.25;
}
.sidebar-brand-name {
  font-family: var(--font-heading);
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sidebar-brand-sub {
  margin-top: 2px;
  font-size: 0.68rem;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* 收纳态：只保留头图，文字隐藏，卡片收窄居中 */
.sidebar-collapsed .sidebar-brand {
  justify-content: center;
  margin: var(--space-3) 0.5rem var(--space-2);
  padding: var(--space-2) 0;
}
.sidebar-collapsed .sidebar-brand-text {
  display: none;
}
.sidebar-collapsed .sidebar-brand-image,
.sidebar-collapsed .sidebar-brand-placeholder {
  width: 2rem;
  height: 2rem;
}
/* 收纳态：导航图标居中，隐藏文字 */
.sidebar-collapsed .glass-nav-item {
  justify-content: center;
  gap: 0;
  padding-left: 0.375em;
  padding-right: 0.375em;
}
.sidebar-footer .sidebar-icon-btn {
  width: 2rem;
  padding-left: 0;
  padding-right: 0;
}

/* ===== 通知中心 ===== */
/* 铃铛未读数字角标（替代原固定红点，随未读数显示） */
.notif-badge {
  position: absolute;
  top: -0.375rem;
  right: -0.5rem;
  min-width: 1.1rem;
  height: 1.1rem;
  padding: 0 0.25rem;
  border-radius: var(--radius-full);
  display: grid;
  place-items: center;
  background: var(--color-danger);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
  line-height: 1;
  box-shadow: 0 0 8px var(--color-danger);
}
.sidebar-icon-btn.notif-open {
  color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-soft);
}
/* 面板：右下角弹出（铃铛在侧边栏底部），玻璃面板 + 顶部内高光 */
.notif-panel {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: 1100;
  width: min(360px, calc(100vw - 2rem));
  max-height: min(70vh, 560px);
  display: flex;
  flex-direction: column;
  background: var(--glass-bg-panel);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-glass-hover), var(--shadow-inner-glass), 0 12px 32px rgba(0, 0, 0, 0.16);
  overflow: hidden;
}
.notif-panel-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0.625rem 0.875rem;
  border-bottom: 1px solid var(--glass-border);
  background: linear-gradient(180deg, var(--glass-bg-strong), var(--glass-bg));
}
.notif-panel-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--font-heading);
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text);
  margin-right: auto;
}
/* 头部铃铛图标块：accent 软底圆角（与详情页卡片标题图标同款语言） */
.notif-head-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 1.7rem;
  height: 1.7rem;
  border-radius: var(--radius-md);
  background: var(--color-accent-soft);
  border: 1px solid var(--color-accent-glow);
  color: var(--color-accent);
}
.notif-unread-count {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--color-danger);
  background: linear-gradient(135deg, var(--color-danger-soft), transparent);
  border: 1px solid rgba(248, 113, 113, 0.35);
  border-radius: var(--radius-full);
  padding: 0.12em 0.6em;
}
.notif-close {
  display: grid;
  place-items: center;
  width: 1.8rem;
  height: 1.8rem;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}
.notif-close:hover {
  color: var(--color-danger);
  background: var(--color-danger-soft);
}
.notif-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.375rem;
}
.notif-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2.5rem 1rem;
  color: var(--color-text-muted);
  font-size: 0.85rem;
  border: 1px dashed var(--color-accent-glow);
  background: linear-gradient(135deg, var(--color-accent-soft), transparent);
  border-radius: var(--radius-lg);
  margin: 0.375rem;
}
.notif-empty-icon {
  width: 2rem;
  height: 2rem;
  color: var(--color-accent);
  opacity: 0.6;
}
/* 通知项：图标 + 标题 + 内容 + 时间；未读高亮 + 左侧 accent 指示条 */
.notif-item {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  width: 100%;
  padding: 0.625rem 0.5rem;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: all 0.18s ease;
  overflow: hidden;
}
/* 未读指示条：左侧 3px accent 竖条（hover/未读点亮，同看板卡片语言） */
.notif-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--color-accent);
  opacity: 0;
  transition: opacity 0.15s ease;
}
.notif-item:hover {
  background: var(--glass-bg-hover);
  border-color: var(--color-accent-glow);
  box-shadow: var(--shadow-glass);
  transform: translateY(-1px);
}
.notif-item.is-unread {
  background: linear-gradient(135deg, var(--color-accent-soft), transparent);
  border-color: rgba(129, 140, 248, 0.25);
}
.notif-item.is-unread::before {
  opacity: 1;
}
.notif-item-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-md);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border-soft);
  color: var(--color-text-muted);
  transition: all 0.15s ease;
}
/* 通知类型 → 图标块语义色（催收红/到期黄/日报绿/其余主色） */
.notif-item-icon.is-danger {
  color: var(--color-danger);
  background: var(--color-danger-soft);
  border-color: rgba(248, 113, 113, 0.35);
}
.notif-item-icon.is-warning {
  color: var(--color-warning);
  background: var(--color-warning-soft);
  border-color: rgba(251, 191, 36, 0.35);
}
.notif-item-icon.is-success {
  color: var(--color-success);
  background: var(--color-success-soft);
  border-color: rgba(52, 211, 153, 0.35);
}
.notif-item-icon.is-accent {
  color: var(--color-accent);
  background: var(--color-accent-soft);
  border-color: var(--color-accent-glow);
}
.notif-item.is-unread .notif-item-icon {
  filter: brightness(1.05);
}
.notif-item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.notif-item-head {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-wrap: wrap;
}
.notif-item-title {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.3;
  transition: color 0.15s ease;
}
.notif-item.is-unread .notif-item-title {
  color: var(--color-accent);
}
.notif-item-badge {
  font-size: 0.68rem;
}
.notif-item-content {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  line-height: 1.5;
  /* 长文最多两行，超出省略号 */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.notif-item-time {
  font-size: 0.7rem;
  color: var(--color-text-muted);
}
.notif-item-remove {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: var(--radius-full);
  color: var(--color-text-muted);
  opacity: 0;
  transition: all 0.15s ease;
}
.notif-item:hover .notif-item-remove {
  opacity: 1;
}
.notif-item-remove:hover {
  color: var(--color-danger);
  background: var(--color-danger-soft);
}
.notif-fade-enter-active,
.notif-fade-leave-active {
  transition: all 0.18s ease;
}
.notif-fade-enter-from,
.notif-fade-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.98);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
/* 允许子页面的 flex 子元素撑满视口（如 DataTable 填充卡片） */
.main-content-flex {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}
</style>

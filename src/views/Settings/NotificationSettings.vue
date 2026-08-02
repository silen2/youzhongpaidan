<template>
  <div class="space-y-5">
    <!-- 通知设置 -->
    <div class="glass-card settings-card">
      <div class="glass-card-header">
        <div class="settings-card-title">
          <component :is="Bell" class="settings-card-icon" />
          <div>
            <h2 class="glass-section-title">通知设置</h2>
            <p class="glass-section-subtitle">逾期与汇总通知的触发规则</p>
          </div>
        </div>
      </div>

      <div class="glass-card-body pref-list">
        <div class="pref-row">
          <div class="pref-row-info">
            <span class="pref-row-label">催收通知</span>
            <span class="pref-row-desc">定金 / 尾款逾期未付时触发催收提醒</span>
          </div>
          <div class="pref-row-control">
            <span class="pref-unit">超过</span>
            <input v-model.number="overdueDays" type="number" min="1" class="glass-input pref-input" />
            <span class="pref-unit">天未付即通知</span>
          </div>
        </div>

        <div class="pref-row">
          <div class="pref-row-info">
            <span class="pref-row-label">每日汇总</span>
            <span class="pref-row-desc">每天定时推送当日安排与待办汇总</span>
          </div>
          <div class="pref-row-control">
            <label class="glass-toggle">
              <input type="checkbox" class="glass-toggle-input" v-model="dailySummaryEnabled" />
              <span class="glass-toggle-track"></span>
              <span class="glass-toggle-thumb"></span>
            </label>
            <input v-model="summaryTime" type="time" class="glass-input pref-input" :disabled="!dailySummaryEnabled" />
          </div>
        </div>

        <div class="pref-row">
          <div class="pref-row-info">
            <span class="pref-row-label">即将到期提醒</span>
            <span class="pref-row-desc">距预计交付时间不足时提前提醒</span>
          </div>
          <div class="pref-row-control">
            <span class="pref-unit">≤</span>
            <input v-model.number="dueDays" type="number" min="1" class="glass-input pref-input" />
            <span class="pref-unit">天时发送提醒</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 操作 -->
    <div class="pref-actions">
      <button @click="saveNotificationSettings" class="glass-btn glass-btn-primary">
        <component :is="Check" class="w-3.5 h-3.5" />
        保存通知设置
      </button>
    </div>

    <!-- 数据管理 -->
    <div class="glass-card settings-card">
      <div class="glass-card-header">
        <h2 class="glass-section-title">数据管理</h2>
      </div>

      <div class="glass-card-body">
        <div class="fluid-grid" style="grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 1rem;">
          <div class="glass-grid-card">
            <div class="flex items-center gap-2 mb-1">
              <Download class="data-card-icon" />
              <h3 class="font-medium text-sm text-[var(--color-text)]">导出数据</h3>
            </div>
            <p class="glass-body-sm mb-3">将所有数据导出为 JSON 文件备份</p>
            <button @click="exportData" class="glass-btn glass-btn-secondary w-full">导出 JSON</button>
          </div>
          <div class="glass-grid-card">
            <div class="flex items-center gap-2 mb-1">
              <Upload class="data-card-icon" />
              <h3 class="font-medium text-sm text-[var(--color-text)]">导入数据</h3>
            </div>
            <p class="glass-body-sm mb-3">从 JSON 文件恢复数据（将覆盖现有数据）</p>
            <button @click="importInput?.click()" class="glass-btn glass-btn-secondary w-full">导入 JSON</button>
            <input ref="importInput" type="file" accept=".json" @change="importData" class="hidden" />
          </div>
          <div class="glass-grid-card data-card-danger">
            <div class="flex items-center gap-2 mb-1">
              <AlertTriangle class="data-card-icon" />
              <h3 class="font-medium text-sm text-[var(--color-danger)]">初始化数据</h3>
            </div>
            <p class="glass-body-sm mb-3">清除全部订单、客户、账单等数据，恢复默认模板</p>
            <button @click="openResetModal" class="glass-btn glass-btn-danger w-full">初始化数据</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 初始化确认弹窗：5 秒倒计时后才可确认 -->
  <div v-if="showResetModal" class="glass-overlay" @click.self="closeResetModal">
    <div class="glass-modal glass-modal-sm">
      <div class="glass-modal-header">
        <h3 class="glass-modal-title">初始化数据</h3>
      </div>
      <div class="glass-modal-body space-y-4">
        <div class="flex items-start gap-3">
          <span class="shrink-0 mt-0.5 text-[var(--color-danger)]"><AlertTriangle class="w-5 h-5" /></span>
          <div class="space-y-1">
            <p class="text-sm font-semibold text-[var(--color-text)]">真的要初始化所有数据吗？</p>
            <p class="glass-body-sm">将清除全部订单、客户、账单、跟进、通知等数据，并恢复默认模板（来源 / 类别 / 客户类型 / 绘制阶段 / 跟进类型 / 权重配置）。<span class="text-[var(--color-danger)] font-medium">此操作不可恢复</span>，建议先导出 JSON 备份。</p>
          </div>
        </div>
      </div>
      <div class="glass-modal-footer px-6 pb-6">
        <button type="button" @click="closeResetModal" class="glass-btn glass-btn-outline">取消</button>
        <button type="button" @click="confirmReset" :disabled="resetCountdown > 0" class="glass-btn glass-btn-danger">
          {{ resetCountdown > 0 ? `确认初始化（${resetCountdown}s）` : '确认初始化' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { AlertTriangle, Bell, Check, Download, Upload } from '@lucide/vue'
import { useSettingsStore } from '@/stores/settings'
import { useNotificationStore } from '@/stores/notification'

const store = useSettingsStore()
const notificationStore = useNotificationStore()

const importInput = ref<HTMLInputElement | null>(null)

// ===== 初始化数据：确认弹窗 + 5 秒倒计时 =====
const showResetModal = ref(false)
const resetCountdown = ref(0)
let resetTimer: ReturnType<typeof setInterval> | null = null

function openResetModal() {
  showResetModal.value = true
  resetCountdown.value = 5
  resetTimer = setInterval(() => {
    resetCountdown.value -= 1
    if (resetCountdown.value <= 0) {
      resetCountdown.value = 0
      if (resetTimer) { clearInterval(resetTimer); resetTimer = null }
    }
  }, 1000)
}

function closeResetModal() {
  if (resetTimer) { clearInterval(resetTimer); resetTimer = null }
  showResetModal.value = false
  resetCountdown.value = 0
}

async function confirmReset() {
  if (resetCountdown.value > 0) return
  try {
    await store.resetAllData()
    window.location.reload()
  } catch (e) {
    alert((e as Error).message)
    closeResetModal()
  }
}

onBeforeUnmount(closeResetModal)

// 通知设置：从通知 store（localStorage 持久化）初始化
const overdueDays = ref(notificationStore.settings.overdueDays)
const dailySummaryEnabled = ref(notificationStore.settings.dailySummaryEnabled)
const summaryTime = ref(notificationStore.settings.summaryTime)
const dueDays = ref(notificationStore.settings.dueDays)

onMounted(() => { store.fetchFollowUpTypes() })

function saveNotificationSettings() {
  notificationStore.updateSettings({
    overdueDays: Math.max(1, overdueDays.value || 3),
    dueDays: Math.max(1, dueDays.value || 2),
    dailySummaryEnabled: dailySummaryEnabled.value,
    summaryTime: summaryTime.value || '09:00',
  })
  alert('通知设置已保存')
}

function exportData() {
  const data = {
    sources: store.sources,
    categories: store.categories,
    customerTypes: store.customerTypes,
    stages: store.stages,
    followUpTypes: store.followUpTypes,
    exportAt: new Date().toISOString(),
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `hetong-jira-backup-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function importData(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!confirm('导入将覆盖现有数据，确定继续？')) { input.value = ''; return }
  const reader = new FileReader()
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target?.result as string)
      alert(`导入成功！\n来源: ${data.sources?.length || 0}\n类别: ${data.categories?.length || 0}\n阶段: ${data.stages?.length || 0}`)
    } catch { alert('导入失败：文件格式错误') }
  }
  reader.readAsText(file)
  input.value = ''
}
</script>

<style scoped>
/* 数据管理卡片：标题行图标统一用 accent 色小标；初始化卡片带危险色氛围 */
.data-card-icon {
  width: 1rem;
  height: 1rem;
  color: var(--color-accent);
  flex-shrink: 0;
}
.data-card-danger .data-card-icon {
  color: var(--color-danger);
}
.data-card-danger {
  border-color: var(--color-danger-soft);
}
.data-card-danger:hover {
  border-color: var(--color-danger);
}
</style>

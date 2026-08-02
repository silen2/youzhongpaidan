<template>
  <div class="space-y-5">
    <!-- 甘特图（排期） -->
    <div class="glass-card settings-card">
      <div class="glass-card-header">
        <div class="settings-card-title">
          <component :is="BarChart3" class="settings-card-icon" />
          <div>
            <h2 class="glass-section-title">甘特图（排期）</h2>
            <p class="glass-section-subtitle">排期视图的默认尺寸与缩放行为</p>
          </div>
        </div>
      </div>
      <div class="glass-card-body pref-list">
        <div class="pref-row">
          <div class="pref-row-info">
            <span class="pref-row-label">默认行高</span>
            <span class="pref-row-desc">拖拽行间分割线可整体缩放</span>
          </div>
          <div class="pref-row-control">
            <input v-model.number="ganttRowHeight" type="number" min="32" max="160" class="glass-input pref-input" />
            <span class="pref-unit">px</span>
          </div>
        </div>

        <div class="pref-row">
          <div class="pref-row-info">
            <span class="pref-row-label">行高范围</span>
            <span class="pref-row-desc">缩放分割线时的最小与最大行高</span>
          </div>
          <div class="pref-row-control">
            <input v-model.number="ganttMinRowHeight" type="number" min="24" max="120" class="glass-input pref-input" />
            <span class="pref-unit">px ~</span>
            <input v-model.number="ganttMaxRowHeight" type="number" min="48" max="240" class="glass-input pref-input" />
            <span class="pref-unit">px</span>
          </div>
        </div>

        <div class="pref-row">
          <div class="pref-row-info">
            <span class="pref-row-label">默认缩放密度</span>
            <span class="pref-row-desc">越大越细，可滚轮或双指缩放调整</span>
          </div>
          <div class="pref-row-control">
            <input v-model.number="ganttDefaultPxPerDay" type="number" min="3" max="56" class="glass-input pref-input" />
            <span class="pref-unit">px/天</span>
          </div>
        </div>

        <div class="pref-row">
          <div class="pref-row-info">
            <span class="pref-row-label">左侧任务栏宽度</span>
            <span class="pref-row-desc">甘特图左侧任务列表的宽度</span>
          </div>
          <div class="pref-row-control">
            <input v-model.number="ganttLabelWidth" type="number" min="120" max="360" class="glass-input pref-input" />
            <span class="pref-unit">px</span>
          </div>
        </div>

        <div class="pref-row">
          <div class="pref-row-info">
            <span class="pref-row-label">最小时间窗</span>
            <span class="pref-row-desc">以今天为中心的时间范围</span>
          </div>
          <div class="pref-row-control">
            <span class="pref-unit">±</span>
            <input v-model.number="ganttMinRangeDays" type="number" min="14" max="180" class="glass-input pref-input" />
            <span class="pref-unit">天</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 金额显示 -->
    <div class="glass-card settings-card">
      <div class="glass-card-header">
        <div class="settings-card-title">
          <component :is="Wallet" class="settings-card-icon" />
          <div>
            <h2 class="glass-section-title">金额显示</h2>
            <p class="glass-section-subtitle">金额展示统一使用的货币符号</p>
          </div>
        </div>
      </div>
      <div class="glass-card-body pref-list">
        <div class="pref-row">
          <div class="pref-row-info">
            <span class="pref-row-label">货币符号</span>
            <span class="pref-row-desc">所有金额展示统一使用该符号（如 ¥ / $ / €）</span>
          </div>
          <div class="pref-row-control">
            <input v-model="currencySymbol" type="text" maxlength="4" class="glass-input pref-input" />
          </div>
        </div>
      </div>
    </div>

    <!-- 订单编号 -->
    <div class="glass-card settings-card">
      <div class="glass-card-header">
        <div class="settings-card-title">
          <component :is="Hash" class="settings-card-icon" />
          <div>
            <h2 class="glass-section-title">订单编号</h2>
            <p class="glass-section-subtitle">新建订单时自动生成的编号规则</p>
          </div>
        </div>
      </div>
      <div class="glass-card-body pref-list">
        <div class="pref-row">
          <div class="pref-row-info">
            <span class="pref-row-label">前缀</span>
            <span class="pref-row-desc">订单编号起始前缀</span>
          </div>
          <div class="pref-row-control">
            <input v-model="orderNoPrefix" type="text" maxlength="6" class="glass-input pref-input" />
          </div>
        </div>

        <div class="pref-row">
          <div class="pref-row-info">
            <span class="pref-row-label">日期样式</span>
            <span class="pref-row-desc">编号中的日期格式</span>
          </div>
          <div class="pref-row-control">
            <select v-model="orderNoDateStyle" class="glass-select pref-select">
              <option value="yyMMdd">YYMMDD（260731）</option>
              <option value="yyyyMMdd">YYYYMMDD（20260731）</option>
            </select>
          </div>
        </div>

        <div class="pref-row">
          <div class="pref-row-info">
            <span class="pref-row-label">序列位数</span>
            <span class="pref-row-desc">编号尾部的随机数字位数</span>
          </div>
          <div class="pref-row-control">
            <input v-model.number="orderNoSeqDigits" type="number" min="2" max="6" class="glass-input pref-input" />
            <span class="pref-unit">位</span>
          </div>
        </div>

        <div class="pref-row">
          <div class="pref-row-info">
            <span class="pref-row-label">预览示例</span>
            <span class="pref-row-desc">新建订单时生效</span>
          </div>
          <div class="pref-row-control">
            <span class="glass-badge glass-badge-primary pref-preview">{{ previewOrderNo }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 看板与列表 -->
    <div class="glass-card settings-card">
      <div class="glass-card-header">
        <div class="settings-card-title">
          <component :is="LayoutGrid" class="settings-card-icon" />
          <div>
            <h2 class="glass-section-title">看板与列表</h2>
            <p class="glass-section-subtitle">看板卡片与列表视图的默认行为</p>
          </div>
        </div>
      </div>
      <div class="glass-card-body pref-list">
        <div class="pref-row">
          <div class="pref-row-info">
            <span class="pref-row-label">临期标红阈值</span>
            <span class="pref-row-desc">看板卡片距预计交付的剩余天数</span>
          </div>
          <div class="pref-row-control">
            <span class="pref-unit">≤</span>
            <input v-model.number="kanbanUrgentDays" type="number" min="0" max="30" class="glass-input pref-input" />
            <span class="pref-unit">天时标红</span>
          </div>
        </div>

        <div class="pref-row">
          <div class="pref-row-info">
            <span class="pref-row-label">列表默认每页条数</span>
            <span class="pref-row-desc">订单、客户等列表默认每页显示条数</span>
          </div>
          <div class="pref-row-control">
            <input v-model.number="listPageSize" type="number" min="5" max="100" class="glass-input pref-input" />
            <span class="pref-unit">条</span>
          </div>
        </div>

        <div class="pref-row">
          <div class="pref-row-info">
            <span class="pref-row-label">列表默认排序</span>
            <span class="pref-row-desc">列表默认的排序字段与方向</span>
          </div>
          <div class="pref-row-control">
            <select v-model="listDefaultSortKey" class="glass-select pref-select">
              <option value="createdAt">创建时间</option>
              <option value="closedAt">结单时间</option>
              <option value="expectedEnd">预计交付</option>
              <option value="expectedAmount">预计金额</option>
            </select>
            <select v-model="listDefaultSortDirection" class="glass-select pref-select">
              <option value="desc">高 → 低</option>
              <option value="asc">低 → 高</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- 操作 -->
    <div class="pref-actions">
      <button class="glass-btn glass-btn-ghost" @click="resetDefaults">
        <component :is="RotateCcw" class="w-3.5 h-3.5" />
        恢复默认
      </button>
      <button class="glass-btn glass-btn-primary" @click="save">
        <component :is="Check" class="w-3.5 h-3.5" />
        保存偏好设置
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { BarChart3, Wallet, Hash, LayoutGrid, Check, RotateCcw } from '@lucide/vue'
import { usePreferencesStore } from '@/stores/preferences'
import { DEFAULT_PREFERENCES } from '@/domain/config/app-preferences'

const prefs = usePreferencesStore()

const ganttRowHeight = ref(prefs.preferences.ganttRowHeight)
const ganttMinRowHeight = ref(prefs.preferences.ganttMinRowHeight)
const ganttMaxRowHeight = ref(prefs.preferences.ganttMaxRowHeight)
const ganttDefaultPxPerDay = ref(prefs.preferences.ganttDefaultPxPerDay)
const ganttLabelWidth = ref(prefs.preferences.ganttLabelWidth)
const ganttMinRangeDays = ref(prefs.preferences.ganttMinRangeDays)
const currencySymbol = ref(prefs.preferences.currencySymbol)
const orderNoPrefix = ref(prefs.preferences.orderNoPrefix)
const orderNoDateStyle = ref(prefs.preferences.orderNoDateStyle)
const orderNoSeqDigits = ref(prefs.preferences.orderNoSeqDigits)
const kanbanUrgentDays = ref(prefs.preferences.kanbanUrgentDays)
const listPageSize = ref(prefs.preferences.listPageSize)
const listDefaultSortKey = ref(prefs.preferences.listDefaultSortKey)
const listDefaultSortDirection = ref(prefs.preferences.listDefaultSortDirection)

const pad = (n: number, len = 2) => String(n).padStart(len, '0')

/** 订单编号预览（静态示例，序列位用 0 填充） */
const previewOrderNo = computed(() => {
  const now = new Date()
  const datePart = orderNoDateStyle.value === 'yyyyMMdd'
    ? `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
    : `${String(now.getFullYear()).slice(-2)}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  return `${orderNoPrefix.value || 'HT'}${datePart}${'0'.repeat(Math.min(Math.max(orderNoSeqDigits.value || 3, 2), 6))}`
})

function save() {
  prefs.update({
    ganttRowHeight: ganttRowHeight.value,
    ganttMinRowHeight: ganttMinRowHeight.value,
    ganttMaxRowHeight: ganttMaxRowHeight.value,
    ganttDefaultPxPerDay: ganttDefaultPxPerDay.value,
    ganttLabelWidth: ganttLabelWidth.value,
    ganttMinRangeDays: ganttMinRangeDays.value,
    currencySymbol: currencySymbol.value,
    orderNoPrefix: orderNoPrefix.value,
    orderNoDateStyle: orderNoDateStyle.value,
    orderNoSeqDigits: orderNoSeqDigits.value,
    kanbanUrgentDays: kanbanUrgentDays.value,
    listPageSize: listPageSize.value,
    listDefaultSortKey: listDefaultSortKey.value,
    listDefaultSortDirection: listDefaultSortDirection.value,
  })
  alert('偏好设置已保存')
}

function resetDefaults() {
  const d = DEFAULT_PREFERENCES
  ganttRowHeight.value = d.ganttRowHeight
  ganttMinRowHeight.value = d.ganttMinRowHeight
  ganttMaxRowHeight.value = d.ganttMaxRowHeight
  ganttDefaultPxPerDay.value = d.ganttDefaultPxPerDay
  ganttLabelWidth.value = d.ganttLabelWidth
  ganttMinRangeDays.value = d.ganttMinRangeDays
  currencySymbol.value = d.currencySymbol
  orderNoPrefix.value = d.orderNoPrefix
  orderNoDateStyle.value = d.orderNoDateStyle
  orderNoSeqDigits.value = d.orderNoSeqDigits
  kanbanUrgentDays.value = d.kanbanUrgentDays
  listPageSize.value = d.listPageSize
  listDefaultSortKey.value = d.listDefaultSortKey
  listDefaultSortDirection.value = d.listDefaultSortDirection
}
</script>

<style scoped>
/* 订单编号预览 badge：等宽数字，便于对齐 */
.pref-preview {
  font-family: var(--font-body);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
}
</style>

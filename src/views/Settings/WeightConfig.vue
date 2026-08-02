<template>
  <div class="glass-card settings-card">
    <div class="glass-card-header">
      <div>
        <h2 class="glass-section-title">客户权重配置</h2>
        <p class="glass-section-subtitle">客户权重用于看板卡片排序。选择预设方案或自定义调整因子比例，可选客户实时预览权重效果。</p>
      </div>
      <button class="glass-btn glass-btn-ghost glass-btn-sm" @click="resetToDefault">
        <RotateCcw class="w-3.5 h-3.5" />
        恢复默认
      </button>
    </div>

    <div class="glass-card-body">
      <!-- 预设方案 -->
      <section class="preset-section">
        <div class="preset-head">
          <span class="setting-label">预设方案</span>
          <span v-if="activePreset === 'custom'" class="glass-badge glass-badge-warning">
            <Sliders class="w-3 h-3" />
            自定义配置
          </span>
        </div>
        <div class="preset-grid">
          <button
            v-for="preset in WEIGHT_PRESETS"
            :key="preset.id"
            @click="selectPreset(preset)"
            class="preset-card"
            :class="{ 'preset-card-active': activePreset === preset.id }"
          >
            <Check v-if="activePreset === preset.id" class="preset-card-check" />
            <span class="preset-card-name">{{ preset.name }}</span>
            <span class="preset-card-desc">{{ preset.description }}</span>
            <span class="preset-card-weights">
              {{ preset.weights.w1 }} / {{ preset.weights.w2 }} / {{ preset.weights.w3 }} / {{ preset.weights.w4 }} / {{ preset.weights.w5 }}
            </span>
          </button>
        </div>
        <p class="glass-caption preset-caption">数字依次为：单价 / 频次 / 时效 / 兑现 / 信用 因子权重</p>
      </section>

      <!-- 双列：滑块 + 预览 -->
      <div class="weight-layout">
        <!-- 左：滑块调整 -->
        <div class="weight-sliders">
          <div v-for="meta in factorMeta" :key="meta.key" class="slider-block">
            <div class="slider-head">
              <label class="slider-label">{{ meta.label }}</label>
              <span class="slider-value" :class="total === 100 ? 'is-ok' : 'is-bad'">{{ factors[meta.key] }}%</span>
            </div>
            <input
              v-model.number="factors[meta.key]"
              type="range"
              min="0"
              max="100"
              step="5"
              class="weight-slider"
            />
            <p class="glass-caption">{{ meta.description }}</p>
          </div>

          <div class="total-block">
            <span class="glass-caption">权重总和</span>
            <span class="total-num" :class="total === 100 ? 'is-ok' : 'is-bad'">{{ total }}%</span>
            <span v-if="total !== 100" class="glass-caption is-bad-text">权重总和须为 100%</span>
          </div>
        </div>

        <!-- 右：实时预览 -->
        <div class="weight-preview">
          <div class="preview-head">
            <span class="setting-label">实时预览</span>
            <select v-model="selectedCustomerId" @change="onCustomerChange" class="glass-input preview-select">
              <option value="">选择客户…</option>
              <option v-for="c in customers" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>

          <div v-if="!selectedCustomerId" class="preview-empty">
            <Eye class="w-6 h-6 opacity-40" />
            <p class="glass-caption">选择一位客户，预览其权重与因子得分分解</p>
          </div>

          <template v-else>
            <div class="preview-weight">
              <span class="glass-caption">预测权重</span>
              <span class="preview-weight-num">{{ previewWeight ?? '—' }}</span>
            </div>

            <div class="factor-breakdown">
              <div v-for="item in factorBreakdown" :key="item.label" class="factor-row">
                <span class="factor-row-label">{{ item.label }}</span>
                <div class="factor-bar">
                  <div class="factor-bar-fill" :style="{ width: item.score + '%' }"></div>
                </div>
                <span class="factor-row-score">{{ Math.round(item.score) }}</span>
              </div>
            </div>
          </template>

          <div class="formula-block">
            <span class="setting-label">计算公式</span>
            <p class="glass-caption">权重 = Σ（因子权重 / 100 × 因子得分），结果自然落在 0–100</p>
            <div class="formula-expr">
              {{ factors.w1 }}%×单价 + {{ factors.w2 }}%×频次 + {{ factors.w3 }}%×时效 + {{ factors.w4 }}%×兑现 + {{ factors.w5 }}%×信用
            </div>
          </div>

          <button
            @click="handleSave"
            :disabled="total !== 100"
            class="glass-btn glass-btn-primary w-full"
          >
            <Save class="w-4 h-4" />
            保存配置
          </button>
          <p v-if="saved" class="glass-caption save-feedback">✓ 配置已保存，将触发全量权重重算</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { Check, RotateCcw, Sliders, Eye, Save } from '@lucide/vue'
import { useSettingsStore, type WeightPreviewData } from '@/stores/settings'
import { useCustomerStore } from '@/stores/customer'
import { recalculateAllCustomers } from '@/db'
import { WEIGHT_PRESETS, findWeightPreset, matchPreset } from '@/domain/config/weight-presets'
import type { WeightPreset } from '@/domain/config/weight-presets'
import { computeWeightFactors, calculateWeightFromFactors } from '@/domain/customer/weight-calculator'
import type { WeightConfig, WeightPresetId } from '@/types'

const store = useSettingsStore()
const customerStore = useCustomerStore()
const saved = ref(false)
const selectedCustomerId = ref('')
const previewData = ref<WeightPreviewData | null>(null)

const factors = reactive({
  w1: 25,
  w2: 20,
  w3: 20,
  w4: 15,
  w5: 20,
})

const factorMeta = [
  { key: 'w1', label: '单价因子', description: '客户最大订单单价越高，权重越高' },
  { key: 'w2', label: '频次因子', description: '客户订单数量越多，权重越高' },
  { key: 'w3', label: '时效因子', description: '单位时间内产出金额越高，权重越高' },
  { key: 'w4', label: '兑现因子', description: '实际金额与预计金额比值越接近 1，权重越高' },
  { key: 'w5', label: '信用因子', description: '按时付尾款的比例越高，权重越高' },
] as const

const customers = computed(() => customerStore.customers)

const total = computed(() => factors.w1 + factors.w2 + factors.w3 + factors.w4 + factors.w5)

const activePreset = computed<WeightPresetId>(() =>
  matchPreset({ w1: factors.w1, w2: factors.w2, w3: factors.w3, w4: factors.w4, w5: factors.w5 }),
)

const currentConfig = computed<WeightConfig>(() => ({
  id: 1,
  w1: factors.w1,
  w2: factors.w2,
  w3: factors.w3,
  w4: factors.w4,
  w5: factors.w5,
  activePreset: activePreset.value,
}))

const weightFactors = computed(() => {
  if (!previewData.value) return null
  return computeWeightFactors(
    previewData.value.customerOrders,
    previewData.value.allCustomers,
    previewData.value.allOrders,
  )
})

const previewWeight = computed(() => {
  if (!weightFactors.value) return null
  return calculateWeightFromFactors(weightFactors.value, currentConfig.value)
})

const factorBreakdown = computed(() => {
  const f = weightFactors.value
  return [
    { label: '单价因子', score: f?.priceScore ?? 0 },
    { label: '频次因子', score: f?.freqScore ?? 0 },
    { label: '时效因子', score: f?.timeScore ?? 0 },
    { label: '兑现因子', score: f?.fulfillScore ?? 0 },
    { label: '信用因子', score: f?.creditScore ?? 0 },
  ]
})

function selectPreset(preset: WeightPreset) {
  factors.w1 = preset.weights.w1
  factors.w2 = preset.weights.w2
  factors.w3 = preset.weights.w3
  factors.w4 = preset.weights.w4
  factors.w5 = preset.weights.w5
}

function resetToDefault() {
  const balanced = findWeightPreset('balanced')
  if (balanced) selectPreset(balanced)
}

async function onCustomerChange() {
  if (!selectedCustomerId.value) {
    previewData.value = null
    return
  }
  previewData.value = await store.fetchWeightPreviewData(selectedCustomerId.value)
}

onMounted(async () => {
  await Promise.all([store.fetchWeightConfig(), customerStore.fetchCustomers()])
  if (store.weightConfig) {
    factors.w1 = store.weightConfig.w1
    factors.w2 = store.weightConfig.w2
    factors.w3 = store.weightConfig.w3
    factors.w4 = store.weightConfig.w4
    factors.w5 = store.weightConfig.w5
  }
})

async function handleSave() {
  try {
    await store.saveWeightConfig({
      w1: factors.w1,
      w2: factors.w2,
      w3: factors.w3,
      w4: factors.w4,
      w5: factors.w5,
      activePreset: activePreset.value,
    })
    // 需求 2.3.2：修改权重公式后触发全量客户权重重算（含统计字段）
    await recalculateAllCustomers()
    await customerStore.fetchCustomers()
    saved.value = true
    setTimeout(() => {
      saved.value = false
    }, 3000)
  } catch (e: any) {
    alert(e.message)
  }
}
</script>

<style scoped>
/* ===== Preset Section ===== */
.preset-section {
  margin-bottom: var(--space-6);
}
.preset-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}
.preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
  gap: 0.75rem;
}
.preset-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0.875rem 0.875rem 0.75rem;
  background: var(--glass-bg-strong);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 2px solid transparent;
  border-radius: 0.75rem;
  transition: all 0.2s ease;
  cursor: pointer;
  text-align: left;
}
.preset-card:hover {
  background: var(--glass-bg-hover);
  transform: translateY(-4px);
  box-shadow: var(--shadow-glass-hover);
}
.preset-card-active {
  border-color: var(--color-accent);
  box-shadow: 0 0 12px var(--color-accent-glow);
  background: var(--glass-bg-hover);
}
.preset-card-check {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 1rem;
  height: 1rem;
  color: var(--color-accent);
  filter: drop-shadow(0 0 4px currentColor);
}
.preset-card-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text);
}
.preset-card-active .preset-card-name {
  color: var(--color-accent);
}
.preset-card-desc {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  line-height: 1.4;
}
.preset-card-weights {
  font-size: 0.7rem;
  font-family: var(--font-body);
  font-variant-numeric: tabular-nums;
  color: var(--color-text-muted);
  margin-top: 0.125rem;
}
.preset-caption {
  margin-top: var(--space-2);
}

/* ===== Two-Column Layout ===== */
.weight-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-6);
  align-items: start;
}
@media (min-width: 880px) {
  .weight-layout {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
}

/* ===== Sliders ===== */
.weight-sliders {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.slider-block {
  background: var(--glass-bg-strong);
  border: 1px solid var(--glass-border-soft);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
}
.slider-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-2);
}
.slider-label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text);
}
.slider-value {
  font-size: 0.85rem;
  font-weight: 600;
}
.is-ok {
  color: var(--color-accent);
}
.is-bad {
  color: var(--color-danger);
}
.is-bad-text {
  color: var(--color-danger);
}
.weight-slider {
  width: 100%;
  height: 4px;
  appearance: none;
  background: var(--glass-border);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}
.weight-slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-accent);
  box-shadow: 0 0 8px var(--color-accent-glow);
  cursor: pointer;
  border: 2px solid var(--color-text);
}
.weight-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-accent);
  box-shadow: 0 0 8px var(--color-accent-glow);
  cursor: pointer;
  border: 2px solid var(--color-text);
}

.total-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: var(--space-4);
  background: var(--glass-bg-strong);
  border: 1px solid var(--glass-border-soft);
  border-radius: var(--radius-md);
}
.total-num {
  font-size: clamp(1.8rem, 4vw, 2.5rem);
  font-weight: 700;
  line-height: 1;
}

/* ===== Preview ===== */
.weight-preview {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  background: var(--glass-bg-strong);
  border: 1px solid var(--glass-border-soft);
  border-radius: var(--radius-md);
  padding: var(--space-4);
}
.preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  flex-wrap: wrap;
}
.preview-select {
  max-width: 12rem;
  min-width: 8rem;
}
.preview-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  text-align: center;
  padding: var(--space-8) var(--space-4);
  color: var(--color-text-muted);
}
.preview-weight {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
  padding: var(--space-3);
}
.preview-weight-num {
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: 700;
  color: var(--color-accent);
  line-height: 1;
}

.factor-breakdown {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.factor-row {
  display: grid;
  grid-template-columns: 5rem 1fr 2rem;
  align-items: center;
  gap: var(--space-2);
}
.factor-row-label {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}
.factor-bar {
  height: 6px;
  background: var(--glass-border-soft);
  border-radius: 3px;
  overflow: hidden;
}
.factor-bar-fill {
  height: 100%;
  background: var(--color-accent);
  border-radius: 3px;
  box-shadow: 0 0 6px var(--color-accent-glow);
  transition: width 0.15s ease;
}
.factor-row-score {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text);
  text-align: right;
}

.formula-block {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding-top: var(--space-3);
  border-top: 1px solid var(--glass-border-soft);
}
.formula-expr {
  font-family: var(--font-body);
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  word-break: break-all;
  background: var(--glass-bg-strong);
  padding: 0.5rem 0.625rem;
  border-radius: var(--radius-sm);
}

.save-feedback {
  color: var(--color-success);
  text-align: center;
}

/* ===== Mobile ===== */
@media (max-width: 640px) {
  .preview-head {
    flex-direction: column;
    align-items: stretch;
  }
  .preview-select {
    max-width: none;
    width: 100%;
  }
  .factor-row {
    grid-template-columns: 4.5rem 1fr 2rem;
  }
}
</style>

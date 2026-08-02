<template>
  <div class="echart-shell" :style="shellStyle">
    <div ref="el" v-show="!isEmpty" class="echart"></div>
    <div v-show="isEmpty" class="echart-empty">
      <div class="echart-empty-art" aria-hidden="true">
        <svg viewBox="0 0 150 96" fill="none">
          <defs>
            <linearGradient id="echart-empty-bar" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#94a3b8" stop-opacity="0.5" />
              <stop offset="1" stop-color="#94a3b8" stop-opacity="0.15" />
            </linearGradient>
          </defs>
          <g stroke="#94a3b8" stroke-opacity="0.2" stroke-width="1">
            <line x1="14" y1="20" x2="140" y2="20" stroke-dasharray="4 5" />
            <line x1="14" y1="42" x2="140" y2="42" stroke-dasharray="4 5" />
            <line x1="14" y1="64" x2="140" y2="64" stroke-dasharray="4 5" />
            <line x1="30" y1="10" x2="30" y2="80" stroke-dasharray="4 5" />
            <line x1="90" y1="10" x2="90" y2="80" stroke-dasharray="4 5" />
          </g>
          <path d="M14 82 H140" stroke="#94a3b8" stroke-opacity="0.35" stroke-width="1.5" />
          <rect x="26" y="44" width="20" height="36" rx="4" fill="url(#echart-empty-bar)" />
          <rect x="58" y="30" width="20" height="50" rx="4" fill="url(#echart-empty-bar)" />
          <rect x="90" y="52" width="20" height="28" rx="4" fill="url(#echart-empty-bar)" />
          <rect x="122" y="38" width="20" height="42" rx="4" fill="url(#echart-empty-bar)" />
          <polyline points="36,48 68,34 100,56 132,42" stroke="#64748b" stroke-opacity="0.55" stroke-width="1.5" stroke-dasharray="3 3" />
          <circle cx="36" cy="48" r="2.5" fill="#94a3b8" fill-opacity="0.65" />
          <circle cx="68" cy="34" r="2.5" fill="#94a3b8" fill-opacity="0.65" />
          <circle cx="100" cy="56" r="2.5" fill="#94a3b8" fill-opacity="0.65" />
          <circle cx="132" cy="42" r="2.5" fill="#94a3b8" fill-opacity="0.65" />
        </svg>
      </div>
      <span class="echart-empty-text">本期暂无数据</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart, BarChart, PieChart, ScatterChart, RadarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, TitleComponent, RadarComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { ComposeOption } from 'echarts/core'
import type { LineSeriesOption, BarSeriesOption, PieSeriesOption, ScatterSeriesOption, RadarSeriesOption } from 'echarts/charts'
import type { GridComponentOption, TooltipComponentOption, LegendComponentOption, DataZoomComponentOption, TitleComponentOption, RadarComponentOption } from 'echarts/components'

echarts.use([LineChart, BarChart, PieChart, ScatterChart, RadarChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, TitleComponent, RadarComponent, CanvasRenderer])

export type EChartOption = ComposeOption<
  | LineSeriesOption
  | BarSeriesOption
  | PieSeriesOption
  | ScatterSeriesOption
  | RadarSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
  | DataZoomComponentOption
  | TitleComponentOption
  | RadarComponentOption
>

const props = defineProps<{
  option: EChartOption
  height?: string
  /** 宽高比（如 '2 / 1'）：提供时高度随宽度按比例缩放，替代固定 height */
  aspectRatio?: string
}>()

/** 外层容器尺寸：优先 aspect-ratio（响应式比例），否则回退固定高度 */
const shellStyle = computed(() =>
  props.aspectRatio ? { aspectRatio: props.aspectRatio } : { height: props.height },
)

const el = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null
let observer: ResizeObserver | null = null

/** 图表是否无数据：所有 series 的 data 为空或全 0（含对象形式 { value } 与散点数组） */
const isEmpty = computed(() => {
  const option = props.option as { series?: unknown[] } | undefined
  const series = option?.series
  if (!Array.isArray(series) || series.length === 0) return true
  return series.every((s) => {
    const data = (s as { data?: unknown }).data
    if (!Array.isArray(data) || data.length === 0) return true
    return data.every((d) => {
      // 散点等数组格式（如 [x, y, name, count]）：取首元素判断
      if (Array.isArray(d)) return Number(d[0] ?? 0) === 0
      const value = typeof d === 'object' && d !== null
        ? (d as { value?: unknown }).value
        : d
      return Number(value ?? 0) === 0
    })
  })
})

function ensureChart() {
  if (!el.value || chart) return
  chart = echarts.init(el.value)
  observer = new ResizeObserver(() => chart?.resize())
  observer.observe(el.value)
}

function render() {
  if (!chart || !props.option) return
  // 统一动效：柱状逐根弹出（瀑布）、折线绘制、饼图展开、散点浮现
  // 顶层 animation 配置对所有图表生效；bar 系列附加逐数据点延迟
  const raw = props.option.series
  const series = (Array.isArray(raw) ? raw : raw ? [raw] : []).map(s =>
    (s as { type?: string }).type === 'bar'
      ? { ...s, animationDelay: (idx: number) => idx * 55 }
      : s,
  )
  const option: EChartOption = {
    ...props.option,
    animation: true,
    animationDuration: 650,
    animationDurationUpdate: 450,
    animationEasing: 'cubicOut',
    animationEasingUpdate: 'cubicOut',
    series,
  }
  chart.setOption(option, { notMerge: true })
}

function sync() {
  if (isEmpty.value) return
  ensureChart()
  render()
  // 空状态（display:none）切回时容器尺寸可能为 0，重新测量
  requestAnimationFrame(() => chart?.resize())
}

onMounted(sync)

// flush: 'post' 保证 DOM 更新（v-show 切换）后再测量/渲染
watch(() => props.option, sync, { deep: true, flush: 'post' })

onBeforeUnmount(() => {
  observer?.disconnect()
  chart?.dispose()
  chart = null
})
</script>

<style scoped>
.echart-shell {
  position: relative;
  width: 100%;
  min-height: 260px;
}
.echart-shell .echart {
  width: 100%;
  height: 100%;
  min-height: 260px;
}
.echart-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  color: var(--color-text-muted);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--color-surface) 30%, transparent);
}
.echart-empty-art {
  width: 150px;
  height: 96px;
}
.echart-empty-text {
  font-size: 0.8rem;
  opacity: 0.75;
}
</style>

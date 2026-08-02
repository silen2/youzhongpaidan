<template>
  <nav class="glass-pagination" role="navigation" aria-label="分页">
    <!-- 左侧：自定义操作（导出、列设置） -->
    <div class="glass-pagination-left">
      <slot name="left" />
    </div>

    <!-- 右侧：整合的分页规格与页码设置 -->
    <div class="glass-pagination-right">
      <span
        class="glass-pagination-total"
        :class="{ 'is-selected': selectedCount > 0 }"
      >
        <template v-if="selectedCount > 0">已选中 {{ selectedCount }} 条</template>
        <template v-else>共 {{ total }} 条</template>
      </span>

      <label v-if="pageSizeEditable" class="glass-pagination-size">
        <DropdownSelect
          :model-value="pageSize"
          :options="pageSizeOptions.map(opt => ({ value: opt, label: `${opt} / 页` }))"
          :searchable="false"
          teleport-to-body
          direction="up"
          aria-label="每页条数"
          @update:model-value="onPageSizeChange"
        />
      </label>

      <div class="glass-pagination-buttons">
        <button
          class="glass-btn glass-btn-ghost glass-btn-sm"
          :disabled="isFirst"
          @click="goTo(currentPage - 1)"
          title="上页"
          aria-label="上页"
        >
          <ChevronLeft class="w-3.5 h-3.5" />
        </button>

        <template v-for="(item, idx) in pageWindow" :key="idx">
          <span v-if="item === 'ellipsis'" class="glass-pagination-ellipsis">…</span>
          <button
            v-else
            class="glass-btn glass-btn-sm glass-pagination-page"
            :class="item === currentPage ? 'glass-btn-primary' : 'glass-btn-secondary'"
            :aria-current="item === currentPage ? 'page' : undefined"
            @click="goTo(item)"
          >{{ item }}</button>
        </template>

        <button
          class="glass-btn glass-btn-ghost glass-btn-sm"
          :disabled="isLast"
          @click="goTo(currentPage + 1)"
          title="下页"
          aria-label="下页"
        >
          <ChevronRight class="w-3.5 h-3.5" />
        </button>
      </div>

      <!-- 跳页 -->
      <div class="glass-pagination-jump hide-mobile">
        <label for="pagination-jump-input" class="glass-caption">跳至</label>
        <input
          v-model="jumpInput"
          id="pagination-jump-input"
          class="glass-input glass-input-sm glass-pagination-jump-input"
          type="text"
          name="jump-page"
          inputmode="numeric"
          :aria-label="`跳至页，共 ${totalPages} 页`"
          @keyup.enter="commitJump"
          @blur="commitJump"
        />
        <span class="glass-caption">页</span>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import {
  computeTotalPages,
  computePageWindow,
  clampPageInput,
  type PageWindowItem,
} from '@/domain/shared/pagination'
import DropdownSelect from './DropdownSelect.vue'

/**
 * 通用受控分页器组件。
 *
 * - 不持有 currentPage/pageSize 真值，全部由父组件传入，仅 emit 更新事件。
 * - 兼容纯前端切片（父组件对全量数组 slice）与未来服务端分页（父组件发请求拉新页）。
 * - total<=0 时不渲染。
 * - 颜色全部走 CSS 变量以适配 11 套主题 + 亮/暗文字方案。
 */
interface Props {
  /** 当前页（受控） */
  currentPage: number
  /** 每页条数（受控） */
  pageSize: number
  /** 总条数 */
  total: number
  /** 已勾选条数：>0 时右侧「共 N 条」自动变更为「已选中 N 条」 */
  selectedCount?: number
  /** 每页条数可选项，默认 [10, 20, 50] */
  pageSizeOptions?: number[]
  /** 是否允许修改每页条数（false 时隐藏每页条数下拉，固定当前 pageSize），默认 true */
  pageSizeEditable?: boolean
  /** 页码按钮当前页左右各显示几个，默认 1 */
  siblingCount?: number
  /** 传入则按此 key 记忆 pageSize 到 localStorage */
  pageSizeStorageKey?: string
}

const props = withDefaults(defineProps<Props>(), {
  pageSizeOptions: () => [10, 20, 50],
  pageSizeEditable: true,
  siblingCount: 1,
  pageSizeStorageKey: undefined,
  selectedCount: 0,
})

const emit = defineEmits<{
  'update:currentPage': [page: number]
  'update:pageSize': [size: number]
}>()

const totalPages = computed(() => computeTotalPages(props.total, props.pageSize))
const pageWindow = computed<PageWindowItem[]>(() =>
  computePageWindow(props.currentPage, totalPages.value, props.siblingCount),
)
const isFirst = computed(() => props.currentPage <= 1)
const isLast = computed(() => props.currentPage >= totalPages.value || totalPages.value === 0)

// 跳页输入框本地状态：允许中间态（清空/部分输入），仅在 enter/blur 时校验落地
const jumpInput = ref(String(props.currentPage))
watch(() => props.currentPage, (v) => {
  jumpInput.value = String(v)
})

function goTo(page: number) {
  if (page < 1 || page > totalPages.value) return
  if (page !== props.currentPage) {
    emit('update:currentPage', page)
  }
}

function commitJump() {
  const next = clampPageInput(jumpInput.value, totalPages.value, props.currentPage)
  jumpInput.value = String(next) // 规范化显示
  if (next !== props.currentPage) {
    emit('update:currentPage', next)
  }
}

function onPageSizeChange(value: string | number) {
  const newSize = Number(value)
  emit('update:pageSize', newSize)
  // 切换条数后若当前页越界，同步修正到新末页
  const newTotalPages = computeTotalPages(props.total, newSize)
  if (props.currentPage > newTotalPages) {
    emit('update:currentPage', Math.max(1, newTotalPages))
  }
  if (props.pageSizeStorageKey) {
    try {
      localStorage.setItem(props.pageSizeStorageKey, String(newSize))
    } catch {
      // ignore quota / privacy-mode errors
    }
  }
}
</script>

<style scoped>
/* 分页栏：与表头（glass-table thead）视觉统一，形成"头尾呼应"
   采用 flex 单行流式布局：左（共 N 条 + 每页条数 + 翻页按钮）连续排列，
   右（导出/列设置/跳页）通过 margin-left:auto 推到最右。
   避免 grid 三栏下子项数量不匹配导致换行错位。 */
.glass-pagination {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
  padding: 0.7em 1.1em;
  border-top: 1px solid var(--glass-border);
  /* 与表头吸顶栏统一：同色浅色玻璃（--glass-bg-strong）+ 同等模糊，视觉一致 */
  background: var(--glass-bg-strong);
  backdrop-filter: blur(var(--glass-blur));
  /* 统一基准字号：所有分页控件（文字/按钮/下拉/输入框）继承同一字号；
     em 相对页面正文，随屏宽放大（与表格正文 0.875em 同一视觉量级） */
  font-size: 0.875em;
}

/* 统一分页控件：同一字号 + 同一最小高度，保证垂直对齐 */
.glass-pagination :deep(.glass-btn),
.glass-pagination-size :deep(.dropdown-select-trigger),
.glass-pagination-jump-input {
  font-size: inherit;
  min-height: 2.125rem;
}

/* 左侧：自定义操作（导出/列设置）—— 垂直居中，靠最左 */
.glass-pagination-left {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

/* 右侧：整合的分页规格与页码设置 —— 共 N 条数据，分为 M 页 */
.glass-pagination-total {
  font-size: inherit;
  color: var(--color-text-secondary);
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
}
/* 已勾选条目时：文本变更为「已选中 N 条」并用主题色强调 */
.glass-pagination-total.is-selected {
  color: var(--color-accent);
}
.glass-pagination-size {
  display: inline-flex;
  align-items: center;
}

/* 翻页按钮：紧跟每页条数，垂直居中 */
.glass-pagination-buttons {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-wrap: wrap;
}
.glass-pagination-ellipsis {
  padding: 0 0.25rem;
  color: var(--color-text-muted);
  user-select: none;
  line-height: 1;
  display: inline-flex;
  align-items: center;
}
.glass-pagination-page {
  min-width: 2em;
  justify-content: center;
}

/* 右侧：自定义操作 + 跳页 —— 垂直居中，靠右排列 */
.glass-pagination-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-3);
  margin-left: auto;
}
.glass-pagination-jump {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}
/* 跳页文字标签与输入框统一字号、垂直对齐 */
.glass-pagination-jump .glass-caption,
.glass-pagination-jump-input {
  font-size: inherit;
}
/* 覆盖 .glass-select / .glass-input 的 w-full，适配分页器内联尺寸 */
.glass-select-sm {
  width: auto;
  padding: 0.3em 1.5em 0.3em 0.6em;
}
/* DropdownSelect 内联缩小：适配分页器每页条数选择器 */
.glass-pagination-size :deep(.dropdown-select-trigger) {
  width: auto;
  min-width: 4.5rem;
  padding: 0.3em 0.6em;
}
.glass-pagination-size :deep(.dropdown-select-panel) {
  min-width: 6rem;
}
.glass-input-sm {
  width: auto;
  padding: 0.3em 0.5em;
}
/* 跳页输入框：固定窄宽度（需声明在 .glass-input-sm 之后才能压过其 width:auto，
   否则 input 会回退到默认 size=20 的固有宽度而显得过大） */
.glass-pagination-jump-input {
  width: 3rem;
  flex: none;
  text-align: center;
  padding-left: 0.25rem;
  padding-right: 0.25rem;
}
@media (max-width: 640px) {
  .glass-pagination {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-2);
  }
  .glass-pagination-left,
  .glass-pagination-total,
  .glass-pagination-size {
    align-self: center;
  }
  .glass-pagination-buttons {
    justify-content: center;
  }
  .glass-pagination-right {
    flex-wrap: wrap;
    justify-content: center;
    margin-left: 0;
  }
  .glass-pagination-jump {
    margin-left: 0;
  }
}
</style>

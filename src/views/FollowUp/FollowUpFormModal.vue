<template>
  <div v-if="visible" class="glass-overlay" @click.self="cancel">
    <div class="glass-modal glass-modal-lg glass-followup-form">
      <!-- 头部：与表格表头一致的玻璃质感 + 底部分隔线 -->
      <div class="glass-modal-header">
        <div class="glass-modal-header-inner">
          <span class="glass-modal-header-icon">
            <StickyNote v-if="!followUp" class="w-4 h-4" />
            <Pencil v-else class="w-4 h-4" />
          </span>
          <div class="glass-modal-header-text">
            <h3 class="glass-modal-title">{{ followUp ? '编辑跟进' : '新建跟进' }}</h3>
            <p class="glass-modal-subtitle">{{ followUp ? '修改跟进内容，保存后立即生效' : '记录客户反馈、修改意见等工作笔记' }}</p>
          </div>
        </div>
      </div>

      <form @submit.prevent="submit" class="glass-modal-body glass-followup-form-body">
        <section class="glass-form-section">
          <div class="glass-form-section-head">
            <h4 class="glass-form-section-title">跟进内容</h4>
          </div>
          <div class="glass-form-grid">
            <div class="glass-form-group" :class="{ 'has-error': titleError }">
              <label class="glass-label glass-label-required">标题：</label>
              <input
                v-model="form.title"
                type="text"
                class="glass-input"
                name="followUpTitle"
                aria-label="跟进标题"
                placeholder="如：客户要求调整配色方案"
              />
              <p v-if="titleError" class="glass-form-error">{{ titleError }}</p>
            </div>
            <div class="glass-form-group">
              <label class="glass-label">类型：</label>
              <DropdownSelect
                v-model="form.type"
                :options="typeOptions"
                searchable
                search-placeholder="搜索类型..."
                placeholder="请选择类型"
                aria-label="跟进类型"
                teleport-to-body
              />
            </div>
          </div>
          <div class="glass-form-group">
            <label class="glass-label">优先级：</label>
            <div class="priority-chips">
              <button
                v-for="p in priorityOptions"
                :key="p.value"
                type="button"
                class="priority-chip"
                :class="[`is-${p.value}`, { 'is-active': form.priority === p.value }]"
                @click="form.priority = p.value"
              >
                {{ p.label }}
              </button>
            </div>
          </div>
          <div class="glass-form-group">
            <label class="glass-label">内容（可选）：</label>
            <textarea
              v-model="form.content"
              rows="3"
              class="glass-input resize-none"
              name="followUpContent"
              aria-label="跟进内容"
              placeholder="补充说明..."
            />
          </div>
        </section>

        <section class="glass-form-section">
          <div class="glass-form-section-head">
            <h4 class="glass-form-section-title">关联与截止</h4>
          </div>
          <div class="glass-form-grid">
            <div class="glass-form-group">
              <label class="glass-label">关联订单（可选）：</label>
              <DropdownSelect
                v-model="form.orderId"
                :options="orderOptions"
                searchable
                search-placeholder="搜索订单..."
                placeholder="不关联订单"
                aria-label="关联订单"
                teleport-to-body
              />
            </div>
            <div class="glass-form-group">
              <label class="glass-label">关联客户（可选）：</label>
              <DropdownSelect
                v-model="form.customerId"
                :options="customerOptions"
                searchable
                search-placeholder="搜索客户..."
                placeholder="不关联客户"
                aria-label="关联客户"
                teleport-to-body
              />
            </div>
            <div class="glass-form-group">
              <label class="glass-label">截止日期（可选）：</label>
              <DatePicker v-model="form.dueDate" placeholder="选择截止日期" aria-label="截止日期" />
            </div>
          </div>
        </section>

        <div class="glass-modal-footer">
          <button type="button" @click="cancel" class="glass-btn glass-btn-outline">取消</button>
          <button type="submit" class="glass-btn glass-btn-primary">保存</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { StickyNote, Pencil } from '@lucide/vue'
import { useOrderStore } from '@/stores/order'
import { useCustomerStore } from '@/stores/customer'
import { useSettingsStore } from '@/stores/settings'
import DropdownSelect from '@/components/common/DropdownSelect.vue'
import DatePicker from '@/components/common/DatePicker.vue'
import { FOLLOWUP_PRIORITIES, PRIORITY_LABEL, type FollowUpPriority } from '@/domain/followup/follow-up'
import type { FollowUp } from '@/types'

const props = defineProps<{
  visible: boolean
  followUp: FollowUp | null
  /** 看板/详情页快捷添加入口：预选关联订单 */
  presetOrderId?: string
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const orderStore = useOrderStore()
const customerStore = useCustomerStore()
const settingsStore = useSettingsStore()

const form = ref({
  title: '',
  typeId: '',
  type: '',
  priority: 'medium' as FollowUpPriority,
  orderId: '',
  customerId: '',
  dueDate: '',
  content: '',
})

const titleError = ref('')

const priorityOptions = FOLLOWUP_PRIORITIES.map(p => ({ value: p, label: PRIORITY_LABEL[p] }))

// 跟进类型：设置 → 跟进类型模板（值=模板 id，模板改名后实时反映）；
// 编辑回填时若 typeId 对应模板已被删除，则用旧 type 名称兜底显示，避免丢失
const typeOptions = computed(() => {
  const opts = settingsStore.enabledFollowUpTypes.map(t => ({ value: t.id, label: t.name }))
  const cur = form.value
  if (cur.typeId && !opts.some(o => o.value === cur.typeId)) {
    opts.unshift({ value: cur.typeId, label: `${cur.type}（自定义）` })
  }
  return opts
})

const orderOptions = computed(() =>
  orderStore.activeOrders.map(o => ({ value: o.id, label: `${o.orderNo} ${o.name}` })),
)

const customerOptions = computed(() =>
  customerStore.customers.map(c => ({ value: c.id, label: c.name })),
)

watch(() => props.visible, (v) => {
  if (!v) return
  titleError.value = ''
  const f = props.followUp
  // 类型模板：优先 typeId；旧数据无 typeId 时按 type 名称匹配模板回填（升级关联）
  let typeId = f?.typeId ?? ''
  let typeName = f?.type ?? ''
  if (!typeId && typeName) {
    const matched = settingsStore.followUpTypes.find(t => t.name === typeName)
    typeId = matched?.id ?? ''
  }
  if (!typeId) {
    typeId = settingsStore.enabledFollowUpTypes[0]?.id ?? ''
    typeName = settingsStore.enabledFollowUpTypes[0]?.name ?? typeName
  }
  form.value = {
    title: f?.title ?? '',
    typeId,
    type: typeName || '其他',
    priority: f?.priority ?? 'medium',
    orderId: f?.orderId ?? props.presetOrderId ?? '',
    customerId: f?.customerId ?? '',
    dueDate: f?.dueDate ?? '',
    content: f?.content ?? '',
  }
})

watch(() => form.value.title, () => { titleError.value = '' })

// 关联订单变化时自动带出该订单的客户（用户仍可手动改客户）
watch(() => form.value.orderId, (id) => {
  if (!id) return
  const o = orderStore.orders.find(x => x.id === id)
  if (o?.customerId) form.value.customerId = o.customerId
})

async function submit() {
  if (!form.value.title.trim()) {
    titleError.value = '请填写跟进标题'
    return
  }
  // type：类型名称快照（旧数据兼容 + 模板删除/停用时的兜底显示）
  const matched = settingsStore.followUpTypes.find(t => t.id === form.value.typeId)
  const typeName = matched?.name ?? form.value.type
  const payload = {
    title: form.value.title.trim(),
    typeId: form.value.typeId || undefined,
    type: typeName || '其他',
    priority: form.value.priority,
    orderId: form.value.orderId || undefined,
    customerId: form.value.customerId || undefined,
    dueDate: form.value.dueDate || undefined,
    content: form.value.content || undefined,
  }
  if (props.followUp) {
    await orderStore.updateFollowUp(props.followUp.id, payload)
  } else {
    await orderStore.addFollowUp(payload)
  }
  emit('saved')
}

function cancel() { emit('close') }
</script>

<style scoped>
/* ===== 新建/编辑跟进弹窗：与客户/订单弹窗同款玻璃语言 ===== */
.glass-followup-form {
  width: clamp(360px, 95vw, 42rem);
}
.glass-followup-form .glass-modal-header {
  display: flex;
  align-items: center;
  padding: var(--space-4) var(--space-8);
  background: var(--glass-bg-strong);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--glass-border);
}
.glass-modal-header-inner {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.glass-modal-header-icon {
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  flex-shrink: 0;
  border-radius: var(--radius-lg);
  background: var(--color-accent-soft);
  border: 1px solid var(--color-accent-glow);
  color: var(--color-accent);
}
.glass-modal-header-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.glass-followup-form .glass-modal-title {
  font-family: var(--font-heading);
  font-size: 1.15rem;
  font-weight: 600;
  line-height: 1.3;
}
.glass-modal-subtitle {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-top: 0.125rem;
}
.glass-followup-form-body {
  padding: var(--space-4) var(--space-8) var(--space-6);
}
.glass-form-section + .glass-form-section {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--glass-border-soft);
}
.glass-form-section-head {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}
.glass-form-section-title {
  margin: 0;
  font-family: var(--font-heading);
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text);
  letter-spacing: 0.01em;
  white-space: nowrap;
}
.glass-form-section-head::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, var(--glass-border), transparent);
}
.glass-followup-form .glass-form-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  row-gap: var(--space-3);
}
.glass-followup-form .glass-form-group {
  margin-bottom: var(--space-3);
}
.glass-followup-form .glass-label {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--color-text-secondary);
}
.glass-followup-form .glass-form-group.has-error :deep(.glass-input) {
  border-color: var(--color-danger);
  box-shadow: 0 0 0 3px var(--color-danger-soft);
}
.glass-form-error {
  margin-top: var(--space-1);
  font-size: 0.75rem;
  color: var(--color-danger);
}
/* 优先级 chips：三档语义色（高红/中黄/低默认），激活实心 */
.priority-chips {
  display: flex;
  gap: var(--space-2);
}
.priority-chip {
  flex: 1;
  padding: 0.5em 0;
  border-radius: var(--radius-md);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--color-text-secondary);
  font-size: 0.85rem;
  font-weight: 500;
  font-family: var(--font-body);
  cursor: pointer;
  transition: all 0.15s ease;
}
.priority-chip.is-high.is-active {
  color: var(--color-danger);
  background: var(--color-danger-soft);
  border-color: var(--color-danger);
}
.priority-chip.is-medium.is-active {
  color: var(--color-warning);
  background: var(--color-warning-soft);
  border-color: var(--color-warning);
}
.priority-chip.is-low.is-active {
  color: var(--color-success);
  background: var(--color-success-soft);
  border-color: var(--color-success);
}
.glass-followup-form .glass-modal-footer {
  margin-top: var(--space-6);
  padding-top: var(--space-4);
  border-top: 1px solid var(--glass-border-soft);
}
@media (max-width: 640px) {
  .glass-followup-form .glass-form-grid {
    grid-template-columns: 1fr;
  }
}
</style>

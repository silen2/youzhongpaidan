<template>
  <div v-if="visible" class="glass-overlay" @click.self="cancel">
    <div class="glass-modal glass-modal-lg glass-order-form">
      <!-- 头部：与表格表头一致的玻璃质感（--glass-bg-strong + blur）+ 底部分隔线 -->
      <div class="glass-modal-header">
        <div class="glass-modal-header-inner">
          <span class="glass-modal-header-icon">
            <ClipboardList v-if="!order" class="w-4 h-4" />
            <ClipboardPen v-else class="w-4 h-4" />
          </span>
          <div class="glass-modal-header-text">
            <h3 class="glass-modal-title">{{ order ? '编辑订单' : '新建订单' }}</h3>
            <p class="glass-modal-subtitle">{{ order ? '修改订单信息，保存后立即生效' : '录入订单基本信息、金额与收款安排' }}</p>
          </div>
        </div>
      </div>

      <form @submit.prevent="submit" class="glass-modal-body glass-order-form-body">
        <!-- 基本信息 -->
        <section class="glass-form-section">
          <div class="glass-form-section-head">
            <h4 class="glass-form-section-title">基本信息</h4>
          </div>
          <div class="glass-form-grid">
            <div class="glass-form-group">
              <label class="glass-label glass-label-required">订单名称：</label>
              <input v-model="form.name" type="text" required class="glass-input" name="orderName" aria-label="订单名称" placeholder="如：半身像立绘、Q版头像..." />
            </div>
            <div class="glass-form-group">
              <label class="glass-label glass-label-required">客户：</label>
              <DropdownSelect
                v-model="form.customerId"
                :options="customerStore.customers.map(c => ({ value: c.id, label: c.name }))"
                placeholder="请选择客户"
                search-placeholder="搜索客户..."
                aria-label="客户"
                teleport-to-body
              />
            </div>
          </div>
        </section>

        <!-- 接单信息 -->
        <section class="glass-form-section">
          <div class="glass-form-section-head">
            <h4 class="glass-form-section-title">接单信息</h4>
          </div>
          <div class="glass-form-grid">
            <div class="glass-form-group">
              <label class="glass-label">接单来源：</label>
              <!-- 接单来源与客户直接关联：根据客户平台自动匹配来源模板，仅展示不可选择 -->
              <div class="glass-input source-readonly" :class="{ 'is-empty': !selectedCustomer }">
                <template v-if="selectedCustomer">
                  <template v-if="selectedCustomer.platform">
                    <span>{{ selectedCustomer.platform }}</span>
                    <span v-if="derivedSource" class="source-readonly-hint">{{ feeHint }}</span>
                    <span v-else class="source-readonly-hint is-warn">未匹配到来源模板</span>
                  </template>
                  <span v-else>无（线下/直客）</span>
                </template>
                <span v-else class="source-readonly-placeholder">选择客户后自动关联</span>
              </div>
              <p v-if="!selectedCustomer" class="glass-caption mt-1">接单来源会根据客户平台自动关联</p>
            </div>
            <div class="glass-form-group">
              <label class="glass-label">来源链接：</label>
              <input v-model="form.sourceLink" type="text" class="glass-input" name="sourceLink" aria-label="来源链接" placeholder="可粘贴原单链接" />
            </div>
            <div class="glass-form-group">
              <label class="glass-label">用途：</label>
              <DropdownSelect
                v-model="form.usage"
                :options="[
                  { value: 'personal', label: '个人' },
                  { value: 'commercial', label: '商用' },
                ]"
                :searchable="false"
                aria-label="用途"
                teleport-to-body
              />
            </div>
            <div class="glass-form-group">
              <label class="glass-label">紧急订单：</label>
              <label class="glass-toggle mt-1">
                <input type="checkbox" class="glass-toggle-input" v-model="form.isUrgent" />
                <span class="glass-toggle-track"></span>
                <span class="glass-toggle-thumb"></span>
              </label>
            </div>
          </div>
        </section>

        <!-- 金额与收款 -->
        <section class="glass-form-section">
          <div class="glass-form-section-head">
            <h4 class="glass-form-section-title">金额与收款</h4>
          </div>

          <div class="glass-form-group">
            <label class="glass-label">收款方式：</label>
            <div class="payment-chips">
              <button
                type="button"
                class="payment-chip"
                :class="{ 'is-active': paymentMode === 'normal' }"
                @click="setPaymentMode('normal')"
              >正常收款</button>
              <button
                type="button"
                class="payment-chip is-arrears"
                :class="{ 'is-active': paymentMode === 'arrears' }"
                @click="setPaymentMode('arrears')"
              >欠款</button>
              <button
                type="button"
                class="payment-chip is-waived"
                :class="{ 'is-active': paymentMode === 'waived' }"
                @click="setPaymentMode('waived')"
              >免单</button>
            </div>
            <p class="glass-caption payment-mode-hint">{{ paymentModeHint }}</p>
          </div>

          <!-- 新建时快捷标记「已收定金」：勾选后订单创建即进入待开始（看板待开始列），无需再进详情页收款 -->
          <div v-if="!order && paymentMode === 'normal'" class="glass-form-group">
            <label class="glass-label" for="deposit-received-toggle">已收定金：</label>
            <label class="glass-toggle mt-1" id="deposit-received-toggle">
              <input type="checkbox" class="glass-toggle-input" v-model="depositReceived" aria-label="已收定金" />
              <span class="glass-toggle-track"></span>
              <span class="glass-toggle-thumb"></span>
            </label>
            <p class="glass-caption mt-1.5">勾选后定金按预计金额登记到账，收款徽章显示「已收定金」</p>
          </div>

          <div class="glass-form-grid">
            <div class="glass-form-group">
              <label class="glass-label glass-label-required">预计金额（客户报价）：</label>
              <input
                :value="amountDraft.expected"
                type="text"
                inputmode="decimal"
                required
                class="glass-input"
                name="expectedAmount"
                aria-label="预计金额"
                placeholder="0.00"
                :disabled="paymentMode === 'waived'"
                @input="onAmountInput($event, 'expected')"
                @blur="onAmountBlur($event, 'expected')"
              />
              <!-- 手续费实时预览 -->
              <p v-if="selectedSource && form.expectedAmount > 0" class="glass-caption mt-1.5">
                手续费 {{ prefs.preferences.currencySymbol }}{{ feePreview.feeAmount.toFixed(2) }}，实际到手 <span class="text-[var(--color-success)] font-medium">{{ prefs.preferences.currencySymbol }}{{ feePreview.actualAmount.toFixed(2) }}</span>
              </p>
              <p v-else-if="!selectedSource && form.expectedAmount > 0" class="glass-caption mt-1.5">无来源手续费，到手即全额</p>
            </div>
            <div v-if="paymentMode !== 'waived'" class="glass-form-group">
              <label class="glass-label">定金金额（预计）：</label>
              <input
                :value="amountDraft.deposit"
                type="text"
                inputmode="decimal"
                class="glass-input"
                name="depositExpected"
                aria-label="定金金额"
                placeholder="0.00"
                @input="onAmountInput($event, 'deposit')"
                @blur="onAmountBlur($event, 'deposit')"
              />
            </div>
            <div v-if="paymentMode !== 'waived'" class="glass-form-group">
              <label class="glass-label">尾款金额（预计）：</label>
              <input
                :value="finalDisplay"
                type="text"
                readonly
                class="glass-input amount-readonly"
                name="finalExpected"
                aria-label="尾款金额"
              />
              <p class="glass-caption mt-1.5">尾款 = 预计金额 − 定金，自动计算</p>
            </div>
          </div>

          <p v-if="paymentMode === 'waived'" class="glass-caption waived-note">免单订单预计金额自动归零，无需填写定金与尾款</p>
        </section>

        <!-- 排期 -->
        <section class="glass-form-section">
          <div class="glass-form-section-head">
            <h4 class="glass-form-section-title">排期</h4>
          </div>
          <div class="glass-form-grid">
            <div class="glass-form-group">
              <label class="glass-label glass-label-required">预计交付日期：</label>
              <DatePicker v-model="form.expectedEndDate" placeholder="选择交付日期" />
            </div>
            <div class="glass-form-group">
              <label class="glass-label glass-label-required">预计开始日期：</label>
              <DatePicker v-model="form.expectedStartDate" placeholder="选择开始日期" />
            </div>
          </div>
        </section>

        <!-- 内容与备注 -->
        <section class="glass-form-section">
          <div class="glass-form-section-head">
            <h4 class="glass-form-section-title">内容与备注</h4>
          </div>
          <div class="glass-form-group">
            <label class="glass-label">订单内容 / 需求描述：</label>
            <textarea v-model="form.content" rows="2" class="glass-input resize-none" name="content" aria-label="订单内容" placeholder="如：构图参考、人物设定、背景要求等" />
          </div>
          <div class="glass-form-group">
            <label class="glass-label">稿件类别：</label>
            <div v-if="categoryOptions.length" class="category-chips">
              <button
                v-for="cat in categoryOptions"
                :key="cat.id"
                type="button"
                class="category-chip"
                :class="{ 'is-active': form.categoryIds.includes(cat.id) }"
                @click="toggleCategory(cat.id)"
              >
                {{ cat.name }}
              </button>
            </div>
            <p v-else class="glass-caption">暂无启用中的稿件类别，可在「设置 → 稿件类别」中配置</p>
          </div>
          <div class="glass-form-group">
            <label class="glass-label">备注：</label>
            <textarea v-model="form.notes" rows="2" class="glass-input resize-none" name="notes" aria-label="备注" placeholder="如：定金支付账号、特殊要求、交付方式等" />
          </div>
        </section>

        <!-- 底部操作：顶部用分隔线划分，与表格分页栏同语言 -->
        <div class="glass-modal-footer">
          <button type="button" @click="cancel" class="glass-btn glass-btn-outline">取消</button>
          <button type="submit" class="glass-btn glass-btn-primary">保存</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, reactive } from 'vue'
import { ClipboardList, ClipboardPen } from '@lucide/vue'
import { useOrderStore } from '@/stores/order'
import { useCustomerStore } from '@/stores/customer'
import { useSettingsStore } from '@/stores/settings'
import { usePreferencesStore } from '@/stores/preferences'
import { calcFee } from '@/domain/order/fee-calculator'
import DropdownSelect from '@/components/common/DropdownSelect.vue'
import DatePicker from '@/components/common/DatePicker.vue'
import type { Order, PaymentStatus } from '@/types'

const props = defineProps<{
  visible: boolean
  order: Order | null
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const orderStore = useOrderStore()
const customerStore = useCustomerStore()
const settingsStore = useSettingsStore()
const prefs = usePreferencesStore()

const form = ref({
  name: '',
  content: '',
  notes: '',
  customerId: '',
  sourceLink: '',
  usage: 'personal' as 'personal' | 'commercial',
  isUrgent: false,
  expectedAmount: 0,
  depositExpected: 0,
  finalExpected: 0,
  expectedStartDate: '',
  expectedEndDate: '',
  categoryIds: [] as string[],
})

// 金额输入草稿（仅数字 + 两位小数；正式值在失焦时提交到 form）
const amountDraft = reactive({ expected: '', deposit: '' })

// 收款方式：正常收款 / 欠款 / 免单（映射到订单收款状态）
const paymentMode = ref<'normal' | 'arrears' | 'waived'>('normal')

// 新建时快捷标记「已收定金」：勾选后创建即登记定金到账（进入待开始）
const depositReceived = ref(false)

const paymentModeHint = computed(() => {
  switch (paymentMode.value) {
    case 'arrears': return '欠款订单仍需填写定金与尾款金额'
    case 'waived': return '免单订单预计金额自动归零，定金与尾款无需填写'
    default: return '按定金与尾款分阶段收款'
  }
})

// ===== 接单来源与客户联动：由客户平台自动匹配来源模板（仅展示） =====
const selectedCustomer = computed(() =>
  customerStore.customers.find(c => c.id === form.value.customerId) || null,
)
const derivedSource = computed(() => {
  const platform = selectedCustomer.value?.platform?.trim()
  if (!platform) return null
  return settingsStore.sources.find(s => s.isEnabled && s.name === platform) || null
})
const sourceId = computed(() => derivedSource.value?.id ?? '')
const feeHint = computed(() => {
  const s = derivedSource.value
  if (!s) return ''
  return s.feeType === 'percentage' ? `${s.feeValue}% 手续费` : `固定 ${prefs.preferences.currencySymbol}${s.feeValue} 手续费`
})

const categoryOptions = computed(() => settingsStore.enabledCategories)

function toggleCategory(id: string) {
  const list = form.value.categoryIds
  form.value.categoryIds = list.includes(id) ? list.filter(c => c !== id) : [...list, id]
}

// ===== 金额：仅数字 + 保留两位小数 + 尾款自动相减 =====
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** 输入清洗：只留数字与一个小数点，小数最多两位 */
function sanitizeAmountInput(raw: string): string {
  let v = raw.replace(/[^\d.]/g, '')
  const dot = v.indexOf('.')
  if (dot !== -1) {
    v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '')
    const [int, dec] = v.split('.')
    v = `${int}.${(dec ?? '').slice(0, 2)}`
  }
  return v
}

function onAmountInput(e: Event, key: 'expected' | 'deposit') {
  const el = e.target as HTMLInputElement
  const v = sanitizeAmountInput(el.value)
  el.value = v
  amountDraft[key] = v
  const num = Number(v)
  if (key === 'expected') form.value.expectedAmount = num || 0
  else form.value.depositExpected = num || 0
  deriveFinal()
}

function onAmountBlur(e: Event, key: 'expected' | 'deposit') {
  const el = e.target as HTMLInputElement
  const num = Number(el.value)
  const formatted = isFinite(num) && num > 0 ? num.toFixed(2) : ''
  el.value = formatted
  amountDraft[key] = formatted
  if (key === 'expected') form.value.expectedAmount = isFinite(num) ? num : 0
  else form.value.depositExpected = isFinite(num) ? num : 0
  deriveFinal()
}

/** 尾款 = 预计金额 − 定金（下限 0） */
function deriveFinal() {
  form.value.finalExpected = round2(Math.max(0, form.value.expectedAmount - form.value.depositExpected))
}

const finalDisplay = computed(() =>
  paymentMode.value === 'waived' ? '0.00' : form.value.finalExpected.toFixed(2),
)

function setPaymentMode(mode: 'normal' | 'arrears' | 'waived') {
  paymentMode.value = mode
  // 欠款/免单下「已收定金」无意义，自动取消
  if (mode !== 'normal') depositReceived.value = false
  if (mode === 'waived') {
    // 免单：预计金额自动归零，定金/尾款清空
    form.value.expectedAmount = 0
    form.value.depositExpected = 0
    form.value.finalExpected = 0
    amountDraft.expected = ''
    amountDraft.deposit = ''
  } else {
    deriveFinal()
  }
}

// ===== 手续费预览（来源自动关联） =====
const selectedSource = computed(() =>
  settingsStore.sources.find(s => s.id === sourceId.value) || null,
)
const feePreview = computed(() => calcFee(form.value.expectedAmount, selectedSource.value))

// ===== 打开弹窗时初始化表单（编辑回填 / 新建置空） =====
watch(() => props.visible, async (v) => {
  if (!v) return
  const o = props.order
  const initMode: 'normal' | 'arrears' | 'waived' =
    o?.paymentStatus === 'arrears' ? 'arrears'
    : o?.paymentStatus === 'waived' ? 'waived'
    : 'normal'
  paymentMode.value = initMode
  depositReceived.value = false
  form.value = {
    name: o?.name ?? '',
    content: o?.content ?? '',
    notes: o?.notes ?? '',
    customerId: o?.customerId ?? '',
    sourceLink: o?.sourceLink ?? '',
    usage: o?.usage ?? 'personal',
    isUrgent: o?.isUrgent ?? false,
    expectedAmount: initMode === 'waived' ? 0 : (o?.expectedAmount ?? 0),
    depositExpected: initMode === 'waived' ? 0 : (o?.depositExpected ?? 0),
    finalExpected: initMode === 'waived' ? 0 : (o?.finalExpected ?? 0),
    expectedStartDate: o?.expectedStartDate ? o.expectedStartDate.slice(0, 10) : '',
    expectedEndDate: o?.expectedEndDate ? o.expectedEndDate.slice(0, 10) : '',
    categoryIds: [],
  }
  amountDraft.expected = initMode === 'waived' ? '' : (form.value.expectedAmount ? form.value.expectedAmount.toFixed(2) : '')
  amountDraft.deposit = initMode === 'waived' ? '' : (form.value.depositExpected ? form.value.depositExpected.toFixed(2) : '')
  if (initMode !== 'waived') deriveFinal()
  // 编辑时回填稿件类别
  if (o) {
    const cats = await orderStore.getOrderCategories(o.id)
    form.value.categoryIds = cats.map(c => c.categoryId)
  }
})

/** 收款方式 → 订单收款状态：欠款/免单直接映射；正常模式保留编辑前的已收状态，欠款/免单回退为未收款 */
function resolvePaymentStatus(): PaymentStatus {
  if (paymentMode.value === 'arrears') return 'arrears'
  if (paymentMode.value === 'waived') return 'waived'
  if (props.order) {
    const cur = props.order.paymentStatus
    return cur === 'arrears' || cur === 'waived' ? 'unpaid' : cur
  }
  return 'unpaid'
}

async function submit() {
  if (!form.value.name.trim() || !form.value.customerId) return

  // 排期必填（新建与编辑均要求）：预计开始/结束日期不能为空，结束不早于开始
  if (!form.value.expectedStartDate || !form.value.expectedEndDate) {
    alert('请先填写排期（预计开始日期与预计交付日期必填）')
    return
  }
  if (form.value.expectedEndDate < form.value.expectedStartDate) {
    alert('预计交付日期不能早于预计开始日期')
    return
  }

  const isWaived = paymentMode.value === 'waived'
  const payload = {
    name: form.value.name.trim(),
    content: form.value.content,
    notes: form.value.notes,
    customerId: form.value.customerId,
    sourceId: sourceId.value,
    sourceLink: form.value.sourceLink,
    usage: form.value.usage,
    isUrgent: form.value.isUrgent,
    expectedAmount: isWaived ? 0 : (form.value.expectedAmount || 0),
    depositExpected: isWaived ? 0 : (form.value.depositExpected || 0),
    finalExpected: isWaived ? 0 : (form.value.finalExpected || 0),
    expectedStartDate: form.value.expectedStartDate || '',
    expectedEndDate: form.value.expectedEndDate || '',
    paymentStatus: resolvePaymentStatus(),
  }

  if (props.order) {
    await orderStore.updateOrder(props.order.id, payload)
    await orderStore.saveOrderCategories(props.order.id, form.value.categoryIds)
  } else {
    const newOrder = await orderStore.createOrder({
      ...payload,
      actualAmount: 0,
      depositActual: 0,
      finalActual: 0,
      // 新建即进入看板「待开始」列（定金/尾款可后付，在工作台收定金/尾款）
      orderStatus: 'not_started',
      currentStage: 'st-pending',
    })
    await orderStore.saveOrderCategories(newOrder.id, form.value.categoryIds)
    // 勾选「已收定金」：复用收款事件（记定金到账 → 待开始 → 看板待开始列）
    if (depositReceived.value) {
      await orderStore.updatePaymentStatus(newOrder.id, 'deposit_paid')
    }
  }
  emit('saved')
}

function cancel() { emit('close') }
</script>

<style scoped>
/* ===== 新建/编辑订单弹窗：与客户弹窗一致的玻璃质感 ===== */

/* 加宽弹窗，为多区块表单留出呼吸感 */
.glass-order-form {
  width: clamp(360px, 95vw, 52rem);
}

/* 头部：与表格表头同款玻璃底（--glass-bg-strong + blur）与底部分隔线 */
.glass-order-form .glass-modal-header {
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

.glass-order-form .glass-modal-title {
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

/* 表单体：滚动容器 + 统一留白 */
.glass-order-form-body {
  padding: var(--space-4) var(--space-8) var(--space-6);
  max-height: 75vh;
  overflow-y: auto;
}

/* 分组：组间用分隔线划分（呼应表格表头/行分隔线语言） */
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

/* 标题右侧的渐变延伸线 */
.glass-form-section-head::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, var(--glass-border), transparent);
}

/* 字段：标签在上、控件在下 */
.glass-order-form .glass-form-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  row-gap: var(--space-3);
}

.glass-order-form .glass-form-group {
  margin-bottom: 0;
}

.glass-order-form .glass-label {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--color-text-secondary);
}

/* 底部操作：顶部用分隔线划分（呼应表格分页栏） */
.glass-order-form .glass-modal-footer {
  margin-top: var(--space-6);
  padding-top: var(--space-4);
  border-top: 1px solid var(--glass-border-soft);
}

/* ===== 接单来源：只读展示（灰色，与客户平台自动关联） ===== */
.source-readonly {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.4em;
  color: var(--color-text-secondary);
  cursor: default;
  user-select: none;
  box-shadow: none;
  opacity: 0.85;
}
.source-readonly.is-empty {
  color: var(--color-text-muted);
}
.source-readonly-hint {
  font-size: 0.8em;
  color: var(--color-text-muted);
}
.source-readonly-hint.is-warn {
  color: var(--color-warning);
}
.source-readonly-placeholder {
  color: var(--color-text-muted);
  font-style: italic;
}

/* ===== 收款方式：chips（正常 accent / 欠款 danger / 免单 success） ===== */
.payment-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.payment-chip {
  padding: 0.4em 1.2em;
  border-radius: var(--radius-full);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--color-text-secondary);
  font-size: 0.85em;
  font-weight: 500;
  font-family: var(--font-body);
  line-height: 1.4;
  cursor: pointer;
  transition: all 0.15s ease;
}
.payment-chip:hover {
  background: var(--glass-bg-hover);
  border-color: var(--glass-border);
  color: var(--color-text);
}
.payment-chip.is-active {
  background: var(--color-accent-soft);
  border-color: var(--color-accent-glow);
  color: var(--color-accent);
  box-shadow: 0 0 10px var(--color-accent-glow);
}
.payment-chip.is-arrears.is-active {
  background: var(--color-danger-soft);
  border-color: var(--color-danger-soft);
  color: var(--color-danger);
  box-shadow: 0 0 10px var(--color-danger-soft);
}
.payment-chip.is-waived.is-active {
  background: var(--color-success-soft);
  border-color: var(--color-success-soft);
  color: var(--color-success);
  box-shadow: 0 0 10px var(--color-success-soft);
}
.payment-mode-hint {
  margin-top: 0.5rem;
}

/* 免单提示 */
.waived-note {
  margin-top: 0.5rem;
  color: var(--color-success);
}

/* ===== 金额：只读尾款 ===== */
.amount-readonly {
  background: var(--glass-bg);
  color: var(--color-text-secondary);
  cursor: default;
  opacity: 0.85;
  box-shadow: none;
}

/* ===== 稿件类别：多选 chips（玻璃胶囊，选中态主题色） ===== */
.category-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.category-chip {
  padding: 0.4em 1em;
  border-radius: var(--radius-full);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--color-text-secondary);
  font-size: 0.85em;
  font-weight: 500;
  font-family: var(--font-body);
  line-height: 1.4;
  cursor: pointer;
  transition: all 0.15s ease;
}
.category-chip:hover {
  background: var(--glass-bg-hover);
  border-color: var(--glass-border);
  color: var(--color-text);
}
.category-chip.is-active {
  background: var(--color-accent-soft);
  border-color: var(--color-accent-glow);
  color: var(--color-accent);
  box-shadow: 0 0 10px var(--color-accent-glow);
}

/* 窄屏：两列折为单列 */
@media (max-width: 640px) {
  .glass-order-form .glass-form-grid {
    grid-template-columns: 1fr;
  }
}
</style>

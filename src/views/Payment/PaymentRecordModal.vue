<template>
  <div v-if="visible" class="glass-overlay" @click.self="cancel">
    <div class="glass-modal glass-payment-form">
      <div class="glass-modal-header">
        <div class="glass-modal-header-inner">
          <span class="glass-modal-header-icon">
            <HandCoins class="w-4 h-4" />
          </span>
          <div class="glass-modal-header-text">
            <h3 class="glass-modal-title">{{ modalTitle }}</h3>
            <p class="glass-modal-subtitle">{{ modalSubtitle }}</p>
          </div>
        </div>
      </div>

      <form @submit.prevent="submit" class="glass-modal-body glass-payment-form-body">
        <section class="glass-form-section">
          <div class="glass-form-section-head">
            <h4 class="glass-form-section-title">{{ form.direction === 'out' ? '退款信息' : '收款信息' }}</h4>
          </div>
          <div class="glass-form-grid">
            <div class="glass-form-group">
              <label class="glass-label glass-label-required">账单方向：</label>
              <div class="payment-type-chips">
                <button
                  v-for="d in directionOptions"
                  :key="d.value"
                  type="button"
                  class="payment-type-chip"
                  :class="[{ 'is-active': form.direction === d.value }, `is-${d.value}`]"
                  :disabled="directionDisabled"
                  @click="form.direction = d.value"
                >
                  {{ d.label }}
                </button>
              </div>
            </div>
            <div class="glass-form-group" :class="{ 'has-error': orderError }">
              <label class="glass-label glass-label-required">{{ form.direction === 'out' ? '退单订单：' : '关联订单：' }}</label>
              <DropdownSelect
                v-model="form.orderId"
                :options="orderOptions"
                searchable
                search-placeholder="搜索订单..."
                placeholder="请选择订单"
                aria-label="关联订单"
                :disabled="orderDisabled"
                teleport-to-body
              />
              <p v-if="orderError" class="glass-form-error">{{ orderError }}</p>
            </div>
            <div class="glass-form-group">
              <label class="glass-label">客户：</label>
              <div class="glass-input readonly-value">{{ customerName }}</div>
            </div>
            <div class="glass-form-group" v-if="form.direction !== 'out'">
              <label class="glass-label glass-label-required">收款类型：</label>
              <div class="payment-type-chips">
                <button
                  v-for="t in typeOptions"
                  :key="t.value"
                  type="button"
                  class="payment-type-chip"
                  :class="[{ 'is-active': form.type === t.value }, `is-${t.value}`]"
                  :disabled="typeDisabled"
                  @click="form.type = t.value"
                >
                  {{ t.label }}
                </button>
              </div>
            </div>
            <div class="glass-form-group" :class="{ 'has-error': amountError }">
              <label class="glass-label glass-label-required">{{ form.direction === 'out' ? '退款金额：' : '到账金额：' }}</label>
              <input
                :value="amountDraft"
                type="text"
                inputmode="decimal"
                class="glass-input"
                name="paymentAmount"
                aria-label="到账金额"
                placeholder="0.00"
                @input="onAmountInput"
                @blur="onAmountBlur"
              />
              <p v-if="amountError" class="glass-form-error">{{ amountError }}</p>
              <p class="glass-caption amount-hint">{{ amountHint }}</p>
            </div>
            <div class="glass-form-group">
              <label class="glass-label glass-label-required">到账日期：</label>
              <DatePicker v-model="form.receivedAt" placeholder="选择到账日期" aria-label="到账日期" />
            </div>
            <div class="glass-form-group">
              <label class="glass-label">备注（可选）：</label>
              <input
                v-model="form.notes"
                type="text"
                class="glass-input"
                name="paymentNotes"
                aria-label="收款备注"
                :placeholder="form.direction === 'out' ? '如：微信退款 / 平台原路退回' : '如：支付宝转账 / 尾款结清'"
              />
            </div>
          </div>

          <div class="fee-preview" v-if="selectedOrder && form.direction !== 'out'">
            <span class="fee-preview-label">手续费预览</span>
            <span class="fee-preview-text">
              按{{ sourceName }}规则{{ feeText }}，预计到手
              <b class="text-[var(--color-accent)]">{{ prefs.preferences.currencySymbol }}{{ netAmount.toFixed(2) }}</b>
            </span>
          </div>
        </section>

        <div class="glass-modal-footer">
          <button type="button" @click="cancel" class="glass-btn glass-btn-outline">取消</button>
          <button type="submit" class="glass-btn glass-btn-primary">
            <HandCoins class="w-4 h-4" /> {{ submitLabel }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { HandCoins } from '@lucide/vue'
import { useOrderStore } from '@/stores/order'
import { useCustomerStore } from '@/stores/customer'
import { useSettingsStore } from '@/stores/settings'
import { usePaymentStore } from '@/stores/payment'
import { usePreferencesStore } from '@/stores/preferences'
import DropdownSelect from '@/components/common/DropdownSelect.vue'
import DatePicker from '@/components/common/DatePicker.vue'
import {
  PAYMENT_RECORD_TYPES,
  PAYMENT_RECORD_TYPE_LABEL,
  PAYMENT_DIRECTIONS,
  PAYMENT_DIRECTION_LABEL,
  isOrderCollectible,
  orderRefundableAmount,
  type PaymentRecordType,
  type PaymentDirection,
} from '@/domain/payment/payment-record'
import { calcFee } from '@/domain/order/fee-calculator'
import { sanitizeAmountInput, formatAmountInput } from '@/domain/order/amount-input'
import type { PaymentRecord } from '@/types'

const props = defineProps<{
  visible: boolean
  /** 快捷入口：预选订单 */
  presetOrderId?: string
  /** 编辑模式：传入要编辑的收款记录（不传为新增） */
  record?: PaymentRecord | null
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const orderStore = useOrderStore()
const customerStore = useCustomerStore()
const settingsStore = useSettingsStore()
const paymentStore = usePaymentStore()
const prefs = usePreferencesStore()

const form = ref({
  orderId: '',
  direction: 'in' as PaymentDirection,
  type: 'deposit' as PaymentRecordType,
  receivedAt: '',
  notes: '',
})
const amountDraft = ref('')
const orderError = ref('')
const amountError = ref('')

const isEdit = computed(() => !!props.record)
const typeOptions = PAYMENT_RECORD_TYPES.map(t => ({ value: t, label: PAYMENT_RECORD_TYPE_LABEL[t] }))
const directionOptions = PAYMENT_DIRECTIONS.map(d => ({ value: d, label: PAYMENT_DIRECTION_LABEL[d] }))

// 编辑模式：订单/类型/方向锁定（只改金额/日期/备注，避免跨类型/跨订单/跨方向引发状态歧义）
const orderDisabled = computed(() => isEdit.value)
const typeDisabled = computed(() => isEdit.value)
const directionDisabled = computed(() => isEdit.value)

/** 每单可退金额（入账合计 − 已出账合计，来自全量账单）；退款模式的订单选项与默认金额依据 */
const orderRefundableMap = computed(() => {
  const byOrder = new Map<string, PaymentRecord[]>()
  for (const r of paymentStore.records) {
    const list = byOrder.get(r.orderId) ?? []
    list.push(r)
    byOrder.set(r.orderId, list)
  }
  const map = new Map<string, number>()
  for (const [oid, recs] of byOrder) map.set(oid, orderRefundableAmount(recs))
  return map
})

// 可选关联订单：
// - 入账：仅显示仍可收款的订单（已结单/退单/结清/免单的不可再收，需求 5.2.3）
// - 退款：仅显示已退单（voided）且尚有可退金额的订单
// 编辑模式仍显示原关联订单（即使状态已变化，需保留当前记录可回显）
const orderOptions = computed(() => {
  if (form.value.direction === 'out') {
    const list = orderStore.orders
      .filter(o => o.orderStatus === 'voided' && (orderRefundableMap.value.get(o.id) ?? 0) > 0)
      .map(o => ({ value: o.id, label: `${o.orderNo} ${o.name}` }))
    if (props.record) {
      const cur = orderStore.orders.find(o => o.id === props.record!.orderId)
      if (cur && !list.some(c => c.value === cur.id)) {
        list.unshift({ value: cur.id, label: `${cur.orderNo} ${cur.name}` })
      }
    }
    return list
  }
  const collectible = orderStore.activeOrders
    .filter(o => isOrderCollectible(o))
    .map(o => ({ value: o.id, label: `${o.orderNo} ${o.name}` }))
  if (props.record) {
    const cur = orderStore.orders.find(o => o.id === props.record!.orderId)
    if (cur && !collectible.some(c => c.value === cur.id)) {
      collectible.unshift({ value: cur.id, label: `${cur.orderNo} ${cur.name}` })
    }
  }
  return collectible
})

const selectedOrder = computed(() =>
  orderStore.orders.find(o => o.id === form.value.orderId) ?? null,
)

const customerName = computed(() => {
  const c = customerStore.customers.find(x => x.id === selectedOrder.value?.customerId)
  return c ? c.name : '—'
})

const expectedAmount = computed(() => {
  const o = selectedOrder.value
  if (!o) return 0
  // 退款：默认 = 可退金额（入账合计 − 已出账合计）
  if (form.value.direction === 'out') return orderRefundableMap.value.get(o.id) ?? 0
  return form.value.type === 'deposit' ? o.depositExpected : o.finalExpected
})

const expectedHint = computed(() => `${prefs.preferences.currencySymbol}${expectedAmount.value.toFixed(2)}`)
const amountHint = computed(() =>
  form.value.direction === 'out'
    ? `默认 ${expectedHint.value}（可退金额），实退可修改`
    : `默认 ${expectedHint.value}，实收可修改`,
)

const modalTitle = computed(() => {
  if (isEdit.value) return '编辑收款记录'
  return form.value.direction === 'out' ? '新增退款记录' : '新增入账记录'
})
const modalSubtitle = computed(() => {
  if (isEdit.value) return '修改金额/到账日期/备注，保存后自动联动订单'
  return form.value.direction === 'out'
    ? '登记一笔退款出账（退单退款），保存后自动冲抵客户消费'
    : '登记一笔资金到账，保存后自动更新关联订单'
})
const submitLabel = computed(() => {
  if (isEdit.value) return '保存修改'
  return form.value.direction === 'out' ? '保存退款' : '保存收款'
})

const sourceName = computed(() => {
  const s = settingsStore.sources.find(x => x.id === selectedOrder.value?.sourceId)
  return s?.name ?? '无来源'
})

const sourceFee = computed(() => {
  const s = settingsStore.sources.find(x => x.id === selectedOrder.value?.sourceId)
  return s ? { feeType: s.feeType, feeValue: s.feeValue } : null
})

const feeText = computed(() => {
  const s = sourceFee.value
  if (!s) return '（无手续费）'
  return s.feeType === 'percentage' ? `（${s.feeValue}%）` : `（固定 ${prefs.preferences.currencySymbol}${s.feeValue.toFixed(2)}）`
})

const amount = computed(() => {
  const n = Number(amountDraft.value)
  return isFinite(n) ? n : 0
})

const netAmount = computed(() => {
  const fee = calcFee(amount.value, sourceFee.value).feeAmount
  return amount.value - fee
})

watch(() => props.visible, (v) => {
  if (!v) return
  orderError.value = ''
  amountError.value = ''
  const r = props.record
  if (r) {
    // 编辑回填
    form.value = {
      orderId: r.orderId,
      direction: r.direction ?? 'in',
      type: r.type ?? 'deposit',
      receivedAt: r.receivedAt.slice(0, 10),
      notes: r.notes ?? '',
    }
    amountDraft.value = r.amount.toFixed(2)
    return
  }
  form.value = {
    orderId: props.presetOrderId ?? '',
    direction: 'in',
    type: 'deposit',
    receivedAt: new Date().toISOString().slice(0, 10),
    notes: '',
  }
  amountDraft.value = ''
})

// 切换方向：若当前订单不适用于新方向（退款需要退单订单/入账需要可收款订单），清空重选
watch(() => form.value.direction, (dir) => {
  if (!form.value.orderId) return
  const o = orderStore.orders.find(x => x.id === form.value.orderId)
  const valid = dir === 'out'
    ? !!o && o.orderStatus === 'voided' && (orderRefundableMap.value.get(form.value.orderId) ?? 0) > 0
    : !!o && isOrderCollectible(o)
  if (!valid) form.value.orderId = ''
})

// 切换订单/类型/方向：金额草稿回填默认值（用户可改）
watch([() => form.value.orderId, () => form.value.type, () => form.value.direction], () => {
  if (!form.value.orderId) { amountDraft.value = ''; return }
  amountDraft.value = expectedAmount.value ? expectedAmount.value.toFixed(2) : ''
})

watch(() => form.value.orderId, () => { orderError.value = '' })
watch(() => amountDraft.value, () => { amountError.value = '' })

function onAmountInput(e: Event) {
  const input = e.target as HTMLInputElement
  amountDraft.value = sanitizeAmountInput(input.value)
}

function onAmountBlur() {
  amountDraft.value = formatAmountInput(amountDraft.value)
}

async function submit() {
  if (!form.value.orderId) {
    orderError.value = '请选择关联订单'
    return
  }
  if (!form.value.receivedAt) {
    amountError.value = '请选择到账日期'
    return
  }
  if (amount.value <= 0) {
    amountError.value = form.value.direction === 'out' ? '退款金额需大于 0' : '到账金额需大于 0'
    return
  }
  const receivedAt = new Date(`${form.value.receivedAt}T12:00:00`)
  try {
    if (props.record) {
      await paymentStore.updatePaymentRecord(props.record.id, {
        amount: amount.value,
        receivedAt: receivedAt.toISOString(),
        notes: form.value.notes || undefined,
      })
    } else if (form.value.direction === 'out') {
      await paymentStore.addRefundRecord({
        orderId: form.value.orderId,
        amount: amount.value,
        receivedAt: receivedAt.toISOString(),
        notes: form.value.notes || undefined,
      })
    } else {
      await paymentStore.addPaymentRecord({
        orderId: form.value.orderId,
        type: form.value.type,
        amount: amount.value,
        receivedAt: receivedAt.toISOString(),
        notes: form.value.notes || undefined,
      })
    }
  } catch (e) {
    amountError.value = e instanceof Error ? e.message : '保存失败，请重试'
    return
  }
  emit('saved')
}

function cancel() { emit('close') }
</script>

<style scoped>
.glass-payment-form {
  width: clamp(360px, 95vw, 40rem);
}
.glass-payment-form .glass-modal-header {
  display: flex;
  align-items: center;
  padding: var(--space-4) var(--space-8);
  background: var(--glass-bg-strong);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
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
.glass-payment-form .glass-modal-title {
  font-family: var(--font-heading);
  font-size: 1.15rem;
  font-weight: 600;
  line-height: 1.3;
}
.glass-modal-subtitle {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-top: 0.15rem;
}
.glass-payment-form-body {
  padding: var(--space-4) var(--space-8) var(--space-6);
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
.glass-payment-form .glass-form-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  row-gap: var(--space-3);
}
.glass-payment-form .glass-form-group {
  margin-bottom: var(--space-3);
}
.glass-payment-form .glass-label {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--color-text-secondary);
}
.glass-payment-form .glass-form-group.has-error :deep(.glass-input),
.glass-payment-form .glass-form-group.has-error :deep(.dropdown-select-trigger) {
  border-color: var(--color-danger);
  box-shadow: 0 0 0 3px var(--color-danger-soft);
}
.glass-form-error {
  margin-top: var(--space-1);
  font-size: 0.75rem;
  color: var(--color-danger);
}
.readonly-value {
  display: flex;
  align-items: center;
  color: var(--color-text-secondary);
  cursor: default;
}
.amount-hint {
  margin-top: var(--space-1);
}
.payment-type-chips {
  display: flex;
  gap: var(--space-2);
}
.payment-type-chip {
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
.payment-type-chip.is-deposit.is-active {
  color: var(--color-accent);
  background: var(--color-accent-soft);
  border-color: var(--color-accent);
}
.payment-type-chip.is-final.is-active {
  color: var(--color-success);
  background: var(--color-success-soft);
  border-color: var(--color-success);
}
.payment-type-chip.is-in.is-active {
  color: var(--color-accent);
  background: var(--color-accent-soft);
  border-color: var(--color-accent);
}
.payment-type-chip.is-out.is-active {
  color: var(--color-danger);
  background: var(--color-danger-soft);
  border-color: var(--color-danger);
}
.fee-preview {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-1);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-accent-soft);
  border: 1px solid var(--color-accent-glow);
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}
.fee-preview-label {
  font-weight: 600;
  color: var(--color-accent);
  white-space: nowrap;
}
.glass-payment-form .glass-modal-footer {
  margin-top: var(--space-6);
  padding-top: var(--space-4);
  border-top: 1px solid var(--glass-border-soft);
}
@media (max-width: 640px) {
  .glass-payment-form .glass-form-grid {
    grid-template-columns: 1fr;
  }
}
</style>

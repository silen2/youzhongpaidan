<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ArrowLeft,
  Hash,
  User,
  Store,
  Link as LinkIcon,
  Briefcase,
  Flame,
  Flag,
  CalendarRange,
  CalendarDays,
  CalendarCheck,
  FileText,
  UserRound,
  Wallet,
  Timeline,
  Paperclip,
  CheckCircle2,
  StickyNote,
  Tag,
  GitBranch,
  MessageSquare,
  Pencil,
  Bell,
  MessageCircle,
  Upload,
  Trash2,
  Plus,
  Image as ImageIcon,
  Copy,
  Zap,
} from '@lucide/vue'
import { useOrderStore } from '@/stores/order'
import { usePaymentStore } from '@/stores/payment'
import { useCustomerStore } from '@/stores/customer'
import { useSettingsStore } from '@/stores/settings'
import { usePreferencesStore } from '@/stores/preferences'
import { calcFee } from '@/domain/order/fee-calculator'
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, orderStatusBadgeClass, paymentStatusBadgeClass } from '@/constants/order-labels'
import PageHeader from '@/components/common/PageHeader.vue'
import ImagePreview from '@/components/common/ImagePreview.vue'
import DropdownSelect from '@/components/common/DropdownSelect.vue'
import FollowUpFormModal from '@/views/FollowUp/FollowUpFormModal.vue'
import {
  ATTACHMENT_TYPES,
  ATTACHMENT_TYPE_LABEL,
  attachmentTypeLabel,
  type AttachmentType,
} from '@/domain/attachment/attachment'
import type { Order, OrderCategory, OrderAttachment } from '@/types'

const route = useRoute()
const router = useRouter()
const orderStore = useOrderStore()
const paymentStore = usePaymentStore()
const customerStore = useCustomerStore()
const settingsStore = useSettingsStore()
const prefs = usePreferencesStore()

const orderId = computed(() => route.params.id as string)
const order = computed<Order | null>(() => orderStore.selectedOrder)

const customerMap = computed(() => new Map(customerStore.customers.map(c => [c.id, c.name])))
const sourceMap = computed(() => new Map(settingsStore.sources.map(s => [s.id, s.name])))
const stageMap = computed(() => new Map(settingsStore.stages.map(s => [s.id, s.name])))

function customerName(id: string): string { return customerMap.value.get(id) || '—' }
function sourceName(id: string): string { return sourceMap.value.get(id) || '—' }
function stageName(id: string): string { return stageMap.value.get(id) || '—' }

const source = computed(() =>
  order.value ? settingsStore.sources.find(s => s.id === order.value!.sourceId) || null : null,
)

// 手续费与预计到手（来源自动计算）
const feePreview = computed(() => calcFee(order.value?.expectedAmount ?? 0, source.value))

// 收款操作按钮：按收款状态给出下一步；已退单（voided）不可收款（禁止返回流程）
const paymentActions = computed(() => {
  if (!order.value) return []
  const actions: { label: string; action: () => void }[] = []
  if (order.value.orderStatus !== 'voided' && order.value.paymentStatus === 'unpaid') {
    actions.push({ label: '收定金', action: () => pay('deposit_paid') })
  }
  if (order.value.orderStatus !== 'voided' && order.value.paymentStatus === 'deposit_paid' && order.value.orderStatus !== 'completed') {
    actions.push({ label: '收尾款', action: () => pay('final_paid') })
  }
  return actions
})

/** 快捷收款：走账单入账（生成流水 + 联动订单收款状态/金额/工作状态），与账单模块同源 */
async function pay(status: 'deposit_paid' | 'final_paid') {
  if (!order.value) return
  try {
    await paymentStore.addPaymentRecord({
      orderId: order.value.id,
      type: status === 'deposit_paid' ? 'deposit' : 'final',
    })
  } catch (e) {
    alert((e as Error).message)
    return
  }
  await reload()
}

function formatDate(value?: string): string {
  if (!value) return '—'
  return value.slice(0, 10)
}

function formatDateTime(value?: string): string {
  if (!value) return '—'
  const d = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatAmount(value: number): string {
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function goCustomer(id: string) { router.push(`/customers/${id}`) }

// ===== 快捷操作：复制订单 =====
// 复制业务字段（名称/内容/客户/来源/金额/排期/类别），新单重置为「未开始 + 待开始 + 未收款」，
// 与「新建订单直接进待开始」语义一致；已收金额/到账时间/状态流转不复制。
async function duplicateOrder() {
  if (!order.value) return
  const src = order.value
  const newOrder = await orderStore.createOrder({
    name: src.name,
    content: src.content,
    notes: src.notes,
    customerId: src.customerId,
    sourceId: src.sourceId,
    sourceLink: src.sourceLink,
    expectedAmount: src.expectedAmount,
    depositExpected: src.depositExpected,
    finalExpected: src.finalExpected,
    expectedStartDate: src.expectedStartDate,
    expectedEndDate: src.expectedEndDate,
    usage: src.usage,
    isUrgent: src.isUrgent,
    actualAmount: 0,
    depositActual: 0,
    finalActual: 0,
    currentStage: 'st-pending',
    orderStatus: 'not_started',
    paymentStatus: 'unpaid',
  })
  // 稿件类别一并复制
  if (orderCats.value.length) {
    await orderStore.saveOrderCategories(newOrder.id, orderCats.value.map(c => c.categoryId))
  }
  router.push(`/orders/${newOrder.id}`)
}

// ===== 稿件类别 =====
const orderCats = ref<OrderCategory[]>([])
const categoryMap = computed(() => new Map(settingsStore.categories.map(c => [c.id, c.name])))
function categoryName(id: string): string { return categoryMap.value.get(id) || '—' }

// ===== 跟进记录 =====
const followUps = computed(() => orderStore.orderFollowUps)
// 跟进类型模板映射：typeId 关联（改名实时反映），缺失/停用时回退名称快照
const followUpTypeMap = computed(() => new Map(settingsStore.followUpTypes.map(t => [t.id, t.name])))
function followUpTypeNameOf(f: { typeId?: string; type: string }): string {
  return (f.typeId && followUpTypeMap.value.get(f.typeId)) || f.type || '其他'
}
function followUpIconOf(f: { typeId?: string; type: string }) {
  switch (followUpTypeNameOf(f)) {
    case '客户反馈': return MessageSquare
    case '修改意见': return Pencil
    case '工作备忘': return StickyNote
    case '催收记录': return Bell
    default: return MessageCircle
  }
}
// 新建跟进入口（详情页时间线，预选当前订单）
const showFollowUpForm = ref(false)
function openFollowUpForm() { showFollowUpForm.value = true }
function closeFollowUpForm() { showFollowUpForm.value = false }
async function onFollowUpSaved() {
  showFollowUpForm.value = false
  await orderStore.fetchOrderFollowUps(orderId.value)
}
function priorityLabel(p: string): string {
  return p === 'high' ? '高' : p === 'medium' ? '中' : '低'
}
function priorityClass(p: string): string {
  return p === 'high' ? 'glass-badge-danger' : p === 'medium' ? 'glass-badge-warning' : 'glass-badge-default'
}

// ===== 附件管理 =====
const attachments = computed(() => orderStore.orderAttachments)

// 上传类型选择（卡片头工具栏）
const uploadTypeOptions = ATTACHMENT_TYPES.map(t => ({ value: t, label: ATTACHMENT_TYPE_LABEL[t] }))
const uploadType = ref<AttachmentType>('reference')
function onUploadTypeChange(value: string | number) {
  uploadType.value = String(value) as AttachmentType
}

// Tab 筛选：全部 / 参考图 / 草图 / 终稿 / 其他
const attachmentTabs: { value: 'all' | AttachmentType; label: string }[] = [
  { value: 'all', label: '全部' },
  ...ATTACHMENT_TYPES.map(t => ({ value: t, label: ATTACHMENT_TYPE_LABEL[t] })),
]
const attTab = ref<'all' | AttachmentType>('all')
const filteredAttachments = computed(() =>
  attTab.value === 'all'
    ? attachments.value
    : attachments.value.filter(a => a.type === attTab.value),
)
function tabCount(tab: 'all' | AttachmentType): number {
  return tab === 'all'
    ? attachments.value.length
    : attachments.value.filter(a => a.type === tab).length
}
function typeBadgeClass(t: AttachmentType): string {
  switch (t) {
    case 'final': return 'glass-badge-success'
    case 'draft': return 'glass-badge-warning'
    case 'reference': return 'glass-badge-primary'
    default: return 'glass-badge-default'
  }
}

// 上传：隐藏 input（按钮触发）+ 拖拽 drop 双入口
const fileInputRef = ref<HTMLInputElement | null>(null)
function pickFiles() { fileInputRef.value?.click() }
async function onFilesChosen(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  await handleFiles(files, uploadType.value)
}
const dragActive = ref(false)
function onDragOver(e: DragEvent) {
  e.preventDefault()
  dragActive.value = true
}
function onDragLeave() { dragActive.value = false }
async function onDrop(e: DragEvent) {
  e.preventDefault()
  dragActive.value = false
  const files = Array.from(e.dataTransfer?.files ?? [])
  if (!files.length) return
  // 拖拽上传类型跟随当前筛选 Tab：具体类型直接归该 Tab，否则默认「其他」
  const dropType: AttachmentType = attTab.value === 'all' ? 'other' : attTab.value
  await handleFiles(files, dropType)
}
async function handleFiles(files: File[], type: AttachmentType) {
  let failed = 0
  for (const f of files) {
    try {
      await orderStore.addOrderAttachment(orderId.value, type, f)
    } catch {
      failed++
    }
  }
  if (failed > 0) alert(`${failed} 个文件上传失败（仅支持图片）`)
}

// 删除
async function removeAttachment(att: OrderAttachment) {
  if (!confirm(`删除附件「${att.filename}」？`)) return
  await orderStore.deleteOrderAttachment(att.id, orderId.value)
  const u = thumbUrls.get(att.id)
  if (u) { URL.revokeObjectURL(u); thumbUrls.delete(att.id) }
}

// 缩略图 objectURL 缓存（卸载时统一释放）
const thumbUrls = new Map<string, string>()
function thumbUrl(att: OrderAttachment): string {
  let url = thumbUrls.get(att.id)
  if (!url) {
    url = URL.createObjectURL(att.thumbnailData ?? att.fileData)
    thumbUrls.set(att.id, url)
  }
  return url
}
function revokeThumbs() {
  thumbUrls.forEach(u => URL.revokeObjectURL(u))
  thumbUrls.clear()
}

// 大图预览
const previewUrl = ref<string | null>(null)
let previewObjectUrl: string | null = null
function openPreview(att: OrderAttachment) {
  previewObjectUrl = URL.createObjectURL(att.fileData)
  previewUrl.value = previewObjectUrl
}
function closePreview() {
  previewUrl.value = null
  if (previewObjectUrl) { URL.revokeObjectURL(previewObjectUrl); previewObjectUrl = null }
}

// ===== 绘制进度（阶段进度条） =====
// 进度条只展示「待开始 → 自定义阶段 → 完成」，退单为终止态单独提示
const progressStages = computed(() =>
  settingsStore.stagesByPosition.filter(s => s.id !== 'st-void'),
)
const currentStageIdx = computed(() => {
  if (!order.value) return -1
  return progressStages.value.findIndex(s => s.id === order.value!.currentStage)
})
const isVoided = computed(() =>
  order.value?.orderStatus === 'voided' || order.value?.currentStage === 'st-void',
)

async function reload() {
  await Promise.all([
    orderStore.getOrder(orderId.value),
    orderStore.fetchStageTransitions(orderId.value),
  ])
}

// 排期快速编辑
const showScheduleEditor = ref(false)
const scheduleStart = ref('')
const scheduleEnd = ref('')

function openScheduleEditor() {
  if (!order.value) return
  scheduleStart.value = order.value.expectedStartDate || ''
  scheduleEnd.value = order.value.expectedEndDate || ''
  showScheduleEditor.value = true
}

function closeScheduleEditor() {
  showScheduleEditor.value = false
  scheduleStart.value = ''
  scheduleEnd.value = ''
}

async function saveSchedule() {
  if (!order.value) return
  if (!scheduleStart.value || !scheduleEnd.value) {
    alert('请选择开始和结束日期')
    return
  }
  if (scheduleEnd.value < scheduleStart.value) {
    alert('结束日期不能早于开始日期')
    return
  }
  await orderStore.updateOrder(order.value.id, {
    expectedStartDate: scheduleStart.value,
    expectedEndDate: scheduleEnd.value,
  })
  closeScheduleEditor()
  await reload()
}

onMounted(async () => {
  await load()
})

// 路由参数变化（如「复制订单」跳转到新单、从列表连续打开不同订单）时组件实例复用，
// 需监听 orderId 重新加载，否则页面仍显示上一单的数据
watch(orderId, async () => {
  await load()
})

async function load() {
  await Promise.all([
    reload(),
    customerStore.fetchCustomers(),
    settingsStore.fetchSources(),
    settingsStore.fetchStages(),
    settingsStore.fetchCategories(),
    settingsStore.fetchFollowUpTypes(),
    orderStore.fetchOrderFollowUps(orderId.value),
    orderStore.fetchOrderAttachments(orderId.value),
    orderStore.getOrderCategories(orderId.value).then(cats => { orderCats.value = cats }),
  ])
}

onBeforeUnmount(revokeThumbs)
</script>

<template>
  <div class="fluid-container">
    <div>
      <button class="glass-btn glass-btn-ghost glass-btn-sm back-btn" @click="router.back()">
        <ArrowLeft class="w-3.5 h-3.5" /> 返回列表
      </button>
      <PageHeader :title="order ? order.name : '订单详情'" subtitle="订单完整信息、金额财务与流转记录" :icon="FileText">
        <template v-if="order" #actions>
          <span class="glass-badge" :class="orderStatusBadgeClass(order.orderStatus)">
            {{ ORDER_STATUS_LABEL[order.orderStatus] }}
          </span>
          <span class="glass-badge" :class="paymentStatusBadgeClass(order.paymentStatus)">
            {{ PAYMENT_STATUS_LABEL[order.paymentStatus] }}
          </span>
        </template>
      </PageHeader>
    </div>

    <div v-if="order" class="detail-grid">
      <!-- 通栏：绘制进度（阶段进度条，高亮当前节点） -->
      <div class="glass-card stage-progress-card">
        <div class="glass-card-header">
          <div class="glass-card-title-group">
            <span class="glass-card-title-icon"><GitBranch class="w-4 h-4" /></span>
            <h2 class="glass-section-title">绘制进度</h2>
          </div>
        </div>
        <div class="glass-card-body">
          <div v-if="isVoided" class="stage-hint is-void">订单已退单，绘制流程终止</div>
          <div v-else-if="currentStageIdx < 0" class="stage-hint">
            尚未排期{{ order.orderStatus === 'awaiting_deposit' ? '（待付定金）' : '' }}，进入排期后展示绘制阶段
          </div>
          <div v-else class="stage-progress">
            <div
              v-for="(s, i) in progressStages"
              :key="s.id"
              class="stage-node"
              :class="{ 'is-current': i === currentStageIdx, 'is-done': i < currentStageIdx, 'is-future': i > currentStageIdx }"
            >
              <span
                class="stage-dot"
                :style="{ background: i <= currentStageIdx ? s.color : 'transparent', borderColor: s.color }"
              ></span>
              <span class="stage-name">{{ s.name }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 左上：基本信息 -->
      <div class="glass-card">
        <div class="glass-card-header">
          <div class="glass-card-title-group">
            <span class="glass-card-title-icon"><UserRound class="w-4 h-4" /></span>
            <h2 class="glass-section-title">基本信息</h2>
          </div>
        </div>
        <div class="glass-card-body">
          <div class="detail-fields">
            <div class="detail-field">
              <span class="detail-field-icon"><Hash class="w-4 h-4" /></span>
              <div class="detail-field-main">
                <div class="detail-field-label">订单编号</div>
                <div class="detail-field-value font-mono">{{ order.orderNo }}</div>
              </div>
            </div>
            <div class="detail-field">
              <span class="detail-field-icon"><User class="w-4 h-4" /></span>
              <div class="detail-field-main">
                <div class="detail-field-label">客户</div>
                <div class="detail-field-value">
                  <span
                    class="cursor-pointer hover:text-[var(--color-accent)]"
                    @click="goCustomer(order.customerId)"
                  >{{ customerName(order.customerId) }}</span>
                </div>
              </div>
            </div>
            <div class="detail-field">
              <span class="detail-field-icon"><Store class="w-4 h-4" /></span>
              <div class="detail-field-main">
                <div class="detail-field-label">接单来源</div>
                <div class="detail-field-value">{{ sourceName(order.sourceId) }}</div>
              </div>
            </div>
            <div v-if="order.sourceLink" class="detail-field">
              <span class="detail-field-icon"><LinkIcon class="w-4 h-4" /></span>
              <div class="detail-field-main">
                <div class="detail-field-label">来源链接</div>
                <a :href="order.sourceLink" target="_blank" rel="noopener" class="detail-field-value text-[var(--color-accent)] hover:underline break-all">打开链接</a>
              </div>
            </div>
            <div class="detail-field">
              <span class="detail-field-icon"><Briefcase class="w-4 h-4" /></span>
              <div class="detail-field-main">
                <div class="detail-field-label">用途</div>
                <div class="detail-field-value">{{ order.usage === 'commercial' ? '商用' : '个人' }}</div>
              </div>
            </div>
            <div class="detail-field">
              <span class="detail-field-icon"><Flame class="w-4 h-4" /></span>
              <div class="detail-field-main">
                <div class="detail-field-label">紧急</div>
                <div class="detail-field-value">
                  <span v-if="order.isUrgent" class="text-[var(--color-danger)]">是</span>
                  <span v-else class="text-[var(--color-text-muted)]">否</span>
                </div>
              </div>
            </div>
            <div class="detail-field">
              <span class="detail-field-icon"><Flag class="w-4 h-4" /></span>
              <div class="detail-field-main">
                <div class="detail-field-label">当前阶段</div>
                <div class="detail-field-value">{{ stageName(order.currentStage) || '未排期' }}</div>
              </div>
            </div>
            <div class="detail-field">
              <span class="detail-field-icon"><CalendarRange class="w-4 h-4" /></span>
              <div class="detail-field-main">
                <div class="detail-field-label">预计周期</div>
                <div
                  class="detail-field-value whitespace-nowrap cursor-pointer hover:text-[var(--color-accent)]"
                  @click="openScheduleEditor"
                  title="点击编辑排期"
                >
                  <span v-if="order.expectedStartDate && order.expectedEndDate">{{ formatDate(order.expectedStartDate) }} → {{ formatDate(order.expectedEndDate) }}</span>
                  <span v-else class="text-[var(--color-warning)]">未排期（点击设置）</span>
                </div>
              </div>
            </div>
            <div class="detail-field">
              <span class="detail-field-icon"><CalendarDays class="w-4 h-4" /></span>
              <div class="detail-field-main">
                <div class="detail-field-label">创建时间</div>
                <div class="detail-field-value whitespace-nowrap">{{ formatDateTime(order.createdAt) }}</div>
              </div>
            </div>
            <div v-if="order.actualStartDate || order.actualEndDate" class="detail-field">
              <span class="detail-field-icon"><CalendarCheck class="w-4 h-4" /></span>
              <div class="detail-field-main">
                <div class="detail-field-label">实际周期</div>
                <div class="detail-field-value whitespace-nowrap">{{ formatDate(order.actualStartDate) }} → {{ formatDate(order.actualEndDate) }}</div>
              </div>
            </div>
            <div v-if="orderCats.length" class="detail-field detail-field-wide">
              <span class="detail-field-icon"><Tag class="w-4 h-4" /></span>
              <div class="detail-field-main">
                <div class="detail-field-label">稿件类别</div>
                <div class="detail-category-list">
                  <span
                    v-for="c in orderCats"
                    :key="c.categoryId"
                    class="glass-badge glass-badge-primary"
                  >{{ categoryName(c.categoryId) }}</span>
                </div>
              </div>
            </div>
            <div class="detail-field detail-field-wide">
              <span class="detail-field-icon"><FileText class="w-4 h-4" /></span>
              <div class="detail-field-main">
                <div class="detail-field-label">订单内容</div>
                <div class="detail-field-value whitespace-pre-wrap">{{ order.content || '—' }}</div>
              </div>
            </div>
            <div v-if="order.notes" class="detail-field detail-field-wide">
              <span class="detail-field-icon"><StickyNote class="w-4 h-4" /></span>
              <div class="detail-field-main">
                <div class="detail-field-label">备注</div>
                <div class="detail-field-value whitespace-pre-wrap">{{ order.notes }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右上：金额财务（明细清单式，数字右对齐） -->
      <div class="glass-card stat-card">
        <div class="glass-card-header">
          <div class="glass-card-title-group">
            <span class="glass-card-title-icon"><Wallet class="w-4 h-4" /></span>
            <h2 class="glass-section-title">金额财务</h2>
          </div>
        </div>
        <div class="glass-card-body stat-body">
          <div class="stat-rows">
            <div class="stat-row">
              <span class="stat-name">客户报价（预计）</span>
              <span class="stat-number">{{ prefs.preferences.currencySymbol }}{{ formatAmount(order.expectedAmount) }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-name">来源手续费</span>
              <span class="stat-number text-[var(--color-text-muted)]">{{ prefs.preferences.currencySymbol }}{{ formatAmount(feePreview.feeAmount) }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-name">预计到手</span>
              <span class="stat-number text-[var(--color-accent)]">{{ prefs.preferences.currencySymbol }}{{ formatAmount(feePreview.actualAmount) }}</span>
            </div>
            <div v-if="order.actualAmount > 0" class="stat-row">
              <span class="stat-name">实际到账</span>
              <span class="stat-number text-[var(--color-success)]">{{ prefs.preferences.currencySymbol }}{{ formatAmount(order.actualAmount) }}</span>
            </div>
            <div class="stat-row">
              <span class="stat-name">定金{{ order.depositExpected > 0 ? `（预计 ${prefs.preferences.currencySymbol}${formatAmount(order.depositExpected)}）` : '' }}</span>
              <div class="stat-value-stack">
                <span class="stat-number">{{ order.depositActual > 0 ? prefs.preferences.currencySymbol + formatAmount(order.depositActual) : '未收' }}</span>
                <span v-if="order.depositPaidAt" class="stat-date">{{ formatDate(order.depositPaidAt) }} 到账</span>
              </div>
            </div>
            <div class="stat-row">
              <span class="stat-name">尾款{{ order.finalExpected > 0 ? `（预计 ${prefs.preferences.currencySymbol}${formatAmount(order.finalExpected)}）` : '' }}</span>
              <div class="stat-value-stack">
                <span class="stat-number">{{ order.finalActual > 0 ? prefs.preferences.currencySymbol + formatAmount(order.finalActual) : '未收' }}</span>
                <span v-if="order.finalPaidAt" class="stat-date">{{ formatDate(order.finalPaidAt) }} 到账</span>
              </div>
            </div>
          </div>
          <div v-if="paymentActions.length" class="stat-actions">
            <button
              v-for="act in paymentActions"
              :key="act.label"
              class="glass-btn glass-btn-primary"
              @click="act.action"
            >
              {{ act.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- 左下：状态流转（固定高度，超出用滑块滚动查看） -->
      <div class="glass-card transition-card">
        <div class="glass-card-header">
          <div class="glass-card-title-group">
            <span class="glass-card-title-icon"><Timeline class="w-4 h-4" /></span>
            <h2 class="glass-section-title">状态流转</h2>
          </div>
          <span v-if="orderStore.stageTransitions.length" class="transition-count">
            {{ orderStore.stageTransitions.length }} 次流转
          </span>
        </div>
        <div class="glass-card-body">
          <div v-if="orderStore.stageTransitions.length === 0" class="timeline-empty">
            <Timeline class="timeline-empty-icon" />
            <p>{{ order.orderStatus === 'awaiting_deposit' ? '订单待付定金，尚未排期流转' : '暂无流转记录' }}</p>
          </div>
          <ol v-else class="timeline">
            <li v-for="t in orderStore.stageTransitions" :key="t.id" class="timeline-item">
              <span class="timeline-dot" :style="{ background: t.toStageColor || 'var(--color-accent)' }"></span>
              <div class="timeline-content">
                <div class="flex items-center gap-2">
                  <span class="timeline-name">{{ t.toStageName }}</span>
                  <CheckCircle2 v-if="t.toStageId === order.currentStage" class="w-3.5 h-3.5 text-[var(--color-success)]" />
                </div>
                <div class="glass-caption timeline-date">{{ formatDateTime(t.transitionDate) }}</div>
              </div>
            </li>
          </ol>
        </div>
      </div>

      <!-- 右下：附件管理（分类 Tab + 拖拽上传 + 预览；终稿在订单结单后自动进入客户画廊） -->
      <div class="glass-card gallery-card">
        <div class="glass-card-header">
          <div class="glass-card-title-group">
            <span class="glass-card-title-icon"><Paperclip class="w-4 h-4" /></span>
            <h2 class="glass-section-title">附件管理</h2>
          </div>
          <div class="attachment-toolbar">
            <DropdownSelect
              :model-value="uploadType"
              :options="uploadTypeOptions"
              :searchable="false"
              class="attachment-type-select"
              aria-label="上传类型"
              @update:model-value="onUploadTypeChange"
            />
            <button type="button" class="glass-btn glass-btn-primary glass-btn-sm" @click="pickFiles">
              <Upload class="w-3.5 h-3.5" />
              <span>上传</span>
            </button>
            <input ref="fileInputRef" type="file" accept="image/*" multiple class="hidden" @change="onFilesChosen" />
          </div>
        </div>
        <div class="glass-card-body attachment-body">
          <!-- 分类 Tab：全部 / 参考图 / 草图 / 终稿 / 其他 -->
          <div class="attachment-tabs">
            <button
              v-for="tab in attachmentTabs"
              :key="tab.value"
              type="button"
              class="attachment-tab"
              :class="{ 'is-active': attTab === tab.value }"
              @click="attTab = tab.value"
            >
              {{ tab.label }}
              <span class="attachment-tab-count">{{ tabCount(tab.value) }}</span>
            </button>
          </div>
          <!-- 上传区：整块可拖拽投放，图片留档于此 -->
          <div
            class="attachment-dropzone"
            :class="{ 'is-dragging': dragActive }"
            @dragover.prevent="onDragOver"
            @dragleave="onDragLeave"
            @drop.prevent="onDrop"
          >
            <div v-if="filteredAttachments.length === 0" class="attachment-empty">
              <ImageIcon class="attachment-empty-icon" />
              <p class="attachment-empty-title">
                暂无{{ attTab === 'all' ? '' : '「' + ATTACHMENT_TYPE_LABEL[attTab] + '」' }}附件
              </p>
              <p class="attachment-empty-sub">点击「上传」或拖拽图片到此处，图片留档于此</p>
            </div>
            <div v-else class="attachment-grid">
              <div
                v-for="att in filteredAttachments"
                :key="att.id"
                class="attachment-item"
                :title="att.filename"
                @click="openPreview(att)"
              >
                <img :src="thumbUrl(att)" :alt="att.filename" class="attachment-thumb" loading="lazy" />
                <span class="glass-badge attachment-type-badge" :class="typeBadgeClass(att.type)">
                  {{ attachmentTypeLabel(att.type) }}
                </span>
                <button
                  type="button"
                  class="attachment-remove"
                  title="删除附件"
                  @click.stop="removeAttachment(att)"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 通栏：快捷操作（复制订单 / 跳转客户详情） -->
      <div class="glass-card quick-actions-card">
        <div class="glass-card-header">
          <div class="glass-card-title-group">
            <span class="glass-card-title-icon"><Zap class="w-4 h-4" /></span>
            <h2 class="glass-section-title">快捷操作</h2>
          </div>
        </div>
        <div class="glass-card-body">
          <div class="quick-actions">
            <button type="button" class="glass-btn glass-btn-secondary" @click="duplicateOrder">
              <Copy class="w-4 h-4" /> 复制订单
            </button>
            <button
              v-if="order.customerId"
              type="button"
              class="glass-btn glass-btn-outline"
              @click="goCustomer(order.customerId)"
            >
              <UserRound class="w-4 h-4" /> 跳转客户详情
            </button>
          </div>
        </div>
      </div>

      <!-- 大图预览（Teleport 到 body 全屏遮罩） -->
      <ImagePreview :url="previewUrl" @close="closePreview" />

      <!-- 新建跟进入口（预选当前订单） -->
      <FollowUpFormModal
        :visible="showFollowUpForm"
        :follow-up="null"
        :preset-order-id="orderId"
        @close="closeFollowUpForm"
        @saved="onFollowUpSaved"
      />

      <!-- 通栏：跟进记录时间线 -->
      <div class="glass-card followup-card">
        <div class="glass-card-header">
          <div class="glass-card-title-group">
            <span class="glass-card-title-icon"><MessageSquare class="w-4 h-4" /></span>
            <h2 class="glass-section-title">跟进记录</h2>
          </div>
          <button type="button" class="glass-btn glass-btn-ghost glass-btn-sm" @click="openFollowUpForm">
            <Plus class="w-3.5 h-3.5" />
            <span>新建跟进</span>
          </button>
        </div>
        <div class="glass-card-body">
          <div v-if="followUps.length === 0" class="glass-body-sm">
            暂无跟进记录，后续可在跟进模块添加客户反馈、修改意见等工作笔记
          </div>
          <ol v-else class="followup-timeline">
            <li
              v-for="f in followUps"
              :key="f.id"
              class="followup-item"
              :class="{ 'is-completed': f.status === 'completed' }"
            >
              <span class="followup-icon">
                <component :is="followUpIconOf(f)" class="w-4 h-4" />
              </span>
              <div class="followup-content">
                <div class="followup-head">
                  <span class="followup-title">{{ f.title }}</span>
                  <span class="glass-badge" :class="priorityClass(f.priority)">{{ priorityLabel(f.priority) }}</span>
                </div>
                <div class="glass-caption followup-type">{{ followUpTypeNameOf(f) }}</div>
                <p v-if="f.content" class="followup-text">{{ f.content }}</p>
                <div class="glass-caption followup-date">{{ formatDateTime(f.createdAt) }}</div>
              </div>
            </li>
          </ol>
        </div>
      </div>
    </div>

    <div v-else class="glass-empty">加载中...</div>

    <!-- 排期快速编辑模态框 -->
    <Teleport to="body">
      <transition name="modal-fade">
        <div v-if="showScheduleEditor" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" @click.self="closeScheduleEditor">
          <div class="glass-card w-[420px] max-w-[90vw]">
            <div class="glass-card-header">
              <div class="glass-card-title-group">
                <span class="glass-card-title-icon"><CalendarRange class="w-4 h-4" /></span>
                <h2 class="glass-section-title">编辑排期</h2>
              </div>
              <button class="glass-btn glass-btn-ghost glass-btn-sm" @click="closeScheduleEditor">✕</button>
            </div>
            <div class="glass-card-body space-y-4">
              <div class="space-y-2">
                <label class="glass-label">开始日期</label>
                <input
                  v-model="scheduleStart"
                  type="date"
                  class="glass-input w-full"
                />
              </div>
              <div class="space-y-2">
                <label class="glass-label">结束日期</label>
                <input
                  v-model="scheduleEnd"
                  type="date"
                  class="glass-input w-full"
                />
              </div>
              <div v-if="scheduleStart && scheduleEnd" class="glass-caption">
                周期：{{ scheduleStart }} → {{ scheduleEnd }}（{{ Math.max(1, Math.floor((new Date(scheduleEnd).getTime() - new Date(scheduleStart).getTime()) / 86400000) + 1) }} 天）
              </div>
              <div class="flex justify-end gap-2 pt-2">
                <button class="glass-btn glass-btn-ghost" @click="closeScheduleEditor">取消</button>
                <button class="glass-btn glass-btn-primary" @click="saveSchedule">保存</button>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* 返回按钮：与页头之间留少量呼吸（随屏宽微调） */
.back-btn {
  margin-bottom: clamp(0.375rem, 0.8vw, 0.75rem);
}

/* ===== 卡片标题：小图标块 + 标题（与客户详情页同款语言） ===== */
.glass-card-title-group {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}
.glass-card-title-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: clamp(1.5rem, 2.5vw, 1.8rem);
  height: clamp(1.5rem, 2.5vw, 1.8rem);
  border-radius: var(--radius-md);
  background: var(--color-accent-soft);
  border: 1px solid var(--color-accent-glow);
  color: var(--color-accent);
}

/* ===== 基本信息：图标字段（2 列，宽字段跨两列） ===== */
.detail-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(0.75rem, 1.4vw, 1.15rem) clamp(0.9rem, 1.4vw, 1.4rem);
}
.detail-field {
  display: flex;
  align-items: flex-start;
  gap: clamp(0.55rem, 0.8vw, 0.75rem);
  min-width: 0;
}
.detail-field-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: clamp(1.8rem, 2.8vw, 2.1rem);
  height: clamp(1.8rem, 2.8vw, 2.1rem);
  border-radius: var(--radius-md);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border-soft);
  color: var(--color-text-muted);
  transition: all 0.15s ease;
}
.detail-field:hover .detail-field-icon {
  color: var(--color-accent);
  border-color: var(--color-accent-glow);
  background: var(--color-accent-soft);
}
.detail-field-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.detail-field-label {
  font-size: clamp(0.68rem, 0.6rem + 0.15vw, 0.8rem);
  line-height: 1.3;
  color: var(--color-text-muted);
}
.detail-field-value {
  font-size: clamp(0.9rem, 0.8rem + 0.3vw, 1.1rem);
  line-height: 1.5;
  color: var(--color-text);
  font-weight: 500;
  word-break: break-all;
}
.detail-field-wide {
  grid-column: 1 / -1;
}
@media (max-width: 640px) {
  .detail-fields {
    grid-template-columns: 1fr;
  }
}

/* ===== 田字型布局：左上基本信息 / 右上金额财务 / 左下状态流转 / 右下附件管理。
       同行卡片等高（grid 默认 stretch） ===== */
.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-section);
  align-items: stretch;
}
/* 卡片 hover：边框点亮 accent + 轻微浮起 */
.detail-grid .glass-card {
  transition: border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}
.detail-grid .glass-card:hover {
  border-color: var(--color-accent-glow);
  box-shadow: var(--shadow-glass-hover);
}
@media (max-width: 640px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
}

/* ===== 金额财务：明细清单式（8 行 flex:1 平分高度铺满整卡，数字右对齐） ===== */
.stat-card {
  display: flex;
  flex-direction: column;
}
.stat-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  /* 覆盖 glass-card-body 默认内边距：上下收紧，行更舒展地铺满整卡 */
  padding: 0.75rem clamp(0.75rem, 1.5vw, 1.25rem);
}
.stat-rows {
  flex: 1;
  display: flex;
  flex-direction: column;
}
.stat-row {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-width: 0;
  padding: 0 0.375rem;
}
.stat-row + .stat-row {
  border-top: 1px solid var(--glass-border-soft);
}
.stat-name {
  font-size: clamp(0.75rem, 0.65rem + 0.2vw, 0.9rem);
  line-height: 1.3;
  color: var(--color-text-muted);
  white-space: nowrap;
}
.stat-number {
  font-size: clamp(0.95rem, 0.9rem + 0.25vw, 1.2rem);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1.3;
  white-space: nowrap;
}
/* 定金/尾款：金额 + 到账日期纵向叠放，右对齐 */
.stat-value-stack {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.1rem;
  min-width: 0;
}
.stat-date {
  font-size: clamp(0.65rem, 0.58rem + 0.15vw, 0.75rem);
  line-height: 1.3;
  color: var(--color-text-muted);
  white-space: nowrap;
}
/* 收款操作区：底部通栏按钮 */
.stat-actions {
  display: flex;
  gap: var(--space-2);
  padding-top: 0.75rem;
  margin-top: 0.5rem;
  border-top: 1px solid var(--glass-border-soft);
}
.stat-actions .glass-btn {
  flex: 1;
}

/* ===== 状态流转：固定高度 + 内部滚动（accent 滑块），时间线 ===== */
.transition-card {
  display: flex;
  flex-direction: column;
  height: 320px; /* 固定高度：流转历史超出后用滑块滚动查看 */
}
.transition-card .glass-card-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 0.75rem; /* 为滚动条留白 */
  /* Firefox 滚动条：标准宽度（thin 太细难抓取） */
  scrollbar-width: auto;
  scrollbar-color: var(--color-accent-soft) transparent;
}
.transition-card .glass-card-body::-webkit-scrollbar {
  width: 10px;
}
.transition-card .glass-card-body::-webkit-scrollbar-track {
  background: transparent;
}
.transition-card .glass-card-body::-webkit-scrollbar-thumb {
  background: var(--color-accent-soft);
  border-radius: var(--radius-full);
}
.transition-card .glass-card-body::-webkit-scrollbar-thumb:hover {
  background: var(--color-accent);
}

/* 流转次数徽章：accent 胶囊（与看板列计数同款语言） */
.transition-count {
  margin-left: auto;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-accent);
  background: var(--color-accent-soft);
  border: 1px solid var(--color-accent-glow);
  border-radius: var(--radius-full);
  padding: 0.15em 0.65em;
  white-space: nowrap;
}

/* 时间线空态：accent 虚线框 + 图标居中 */
.timeline-empty {
  height: 100%;
  min-height: 140px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem;
  color: var(--color-text-muted);
  font-size: 0.85rem;
  text-align: center;
  border: 1px dashed var(--color-accent-glow);
  background: var(--color-accent-soft);
  border-radius: var(--radius-lg);
}
.timeline-empty-icon {
  width: 2rem;
  height: 2rem;
  color: var(--color-accent);
  opacity: 0.6;
}

.timeline {
  position: relative;
  list-style: none;
  margin: 0;
  padding: 0;
  border-left: 1px solid var(--glass-border);
  margin-left: 0.375rem;
}
.timeline-item {
  position: relative;
  padding: 0 0 1.25rem 1.25rem;
}
.timeline-item:last-child {
  padding-bottom: 0;
}
.timeline-dot {
  position: absolute;
  left: -0.325rem;
  top: 0.2rem;
  width: 0.65rem;
  height: 0.65rem;
  border-radius: var(--radius-full);
  box-shadow: 0 0 0 3px var(--color-accent-soft), 0 0 8px var(--color-accent-glow);
}
.timeline-name {
  font-size: 0.95em;
  font-weight: 500;
  line-height: 1.3;
  color: var(--color-text);
  transition: color 0.12s ease;
}
.timeline-item:hover .timeline-name {
  color: var(--color-accent);
}
.timeline-date {
  margin-top: 0.25rem;
}

/* ===== 绘制进度：阶段进度条（通栏卡，高亮当前节点） ===== */
.stage-progress-card {
  grid-column: 1 / -1;
}
.stage-hint {
  text-align: center;
  color: var(--color-text-muted);
  font-size: 0.9em;
  padding: 0.5rem 0;
}
.stage-hint.is-void {
  color: var(--color-danger);
  font-weight: 500;
}
.stage-progress {
  display: flex;
  padding: 0.25rem 0.5rem;
}
.stage-node {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  position: relative;
  min-width: 0;
}
/* 节点间连接线：从当前节点圆心延伸到下一节点圆心 */
.stage-node:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 0.375rem;
  left: 50%;
  width: 100%;
  height: 2px;
  background: var(--glass-border-soft);
  z-index: 0;
}
.stage-node.is-done:not(:last-child)::after {
  background: var(--color-accent);
  opacity: 0.55;
}
.stage-dot {
  position: relative;
  z-index: 1;
  width: 0.75rem;
  height: 0.75rem;
  border-radius: var(--radius-full);
  border: 2px solid;
  transition: all 0.2s ease;
}
.stage-node.is-current .stage-dot {
  transform: scale(1.35);
  box-shadow: 0 0 0 4px var(--color-accent-soft), 0 0 12px var(--color-accent-glow);
}
.stage-name {
  font-size: clamp(0.7rem, 0.62rem + 0.15vw, 0.82rem);
  line-height: 1.3;
  color: var(--color-text-muted);
  white-space: nowrap;
}
.stage-node.is-current .stage-name {
  color: var(--color-accent);
  font-weight: 600;
}

/* ===== 稿件类别：详情页徽章组 ===== */
.detail-category-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

/* ===== 快捷操作：通栏小卡，按钮横排 ===== */
.quick-actions-card {
  grid-column: 1 / -1;
}
.quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}
.quick-actions .glass-btn {
  min-width: 10rem;
}

/* ===== 跟进记录时间线（通栏卡） ===== */
.followup-card {
  grid-column: 1 / -1;
}
.followup-timeline {
  list-style: none;
  margin: 0;
  padding: 0;
}
.followup-item {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem;
  border-bottom: 1px solid var(--glass-border-soft);
  border-radius: var(--radius-md);
  transition: background 0.12s ease;
}
.followup-item:hover {
  background: var(--glass-bg-hover);
}
.followup-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.followup-item.is-completed {
  opacity: 0.55;
}
.followup-icon {
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
.followup-item.is-completed .followup-icon {
  color: var(--color-success);
  border-color: var(--color-success-soft);
}
.followup-content {
  flex: 1;
  min-width: 0;
}
.followup-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.followup-title {
  font-size: 0.95em;
  font-weight: 500;
  line-height: 1.3;
  color: var(--color-text);
}
.followup-type {
  margin-top: 0.125rem;
}
.followup-text {
  margin: 0.375rem 0 0;
  font-size: 0.9em;
  line-height: 1.6;
  color: var(--color-text-secondary);
  white-space: pre-wrap;
}
.followup-date {
  margin-top: 0.25rem;
}

/* ===== 附件管理：卡片头工具栏 + 分类 Tab + 网格上传区（与状态流转等高） ===== */
.gallery-card {
  display: flex;
  flex-direction: column;
  min-height: 280px;
}
.attachment-toolbar {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}
.attachment-type-select {
  width: auto;
  min-width: 0;
}
.attachment-type-select :deep(.dropdown-select-trigger) {
  min-width: 5.5rem;
}
.attachment-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-top: 0.625rem;
}
/* 分类 Tab：胶囊筛选（计数徽章） */
.attachment-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}
.attachment-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.3em 0.7em;
  border-radius: var(--radius-full);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--color-text-secondary);
  font-size: 0.78rem;
  font-weight: 500;
  font-family: var(--font-body);
  line-height: 1.4;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}
.attachment-tab:hover {
  color: var(--color-accent);
  border-color: var(--color-accent-glow);
}
.attachment-tab.is-active {
  color: var(--color-accent);
  background: var(--color-accent-soft);
  border-color: var(--color-accent-glow);
}
.attachment-tab-count {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--color-text-muted);
  background: var(--glass-bg-hover);
  border-radius: var(--radius-full);
  padding: 0.05em 0.5em;
}
.attachment-tab.is-active .attachment-tab-count {
  color: var(--color-accent);
}
/* 上传区：整块可拖拽；拖入时 accent 高亮 */
.attachment-dropzone {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  border-radius: var(--radius-lg);
  padding: 0.25rem;
  transition: background 0.15s ease, outline 0.15s ease;
}
.attachment-dropzone.is-dragging {
  background: var(--color-accent-soft);
  outline: 2px dashed var(--color-accent);
  outline-offset: -2px;
}
.attachment-empty {
  height: 100%;
  min-height: 130px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: 1px dashed var(--glass-border);
  border-radius: var(--radius-lg);
  background: linear-gradient(160deg, var(--color-accent-soft), transparent 60%);
  text-align: center;
  padding: 1rem;
}
.attachment-empty-icon {
  width: clamp(2rem, 3.5vw, 2.6rem);
  height: clamp(2rem, 3.5vw, 2.6rem);
  color: var(--color-accent);
  opacity: 0.6;
}
.attachment-empty-title {
  font-size: 0.95em;
  font-weight: 600;
  color: var(--color-text);
}
.attachment-empty-sub {
  font-size: 0.78em;
  color: var(--color-text-muted);
}
/* 网格缩略图 */
.attachment-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(86px, 1fr));
  gap: var(--space-2);
  padding-bottom: 0.25rem;
}
.attachment-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  cursor: zoom-in;
  transition: all 0.15s ease;
}
.attachment-item:hover {
  border-color: var(--color-accent-glow);
  transform: translateY(-2px);
  box-shadow: var(--shadow-glass);
}
.attachment-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.attachment-type-badge {
  position: absolute;
  left: 0.3rem;
  bottom: 0.3rem;
  font-size: 0.68rem;
  font-weight: 600;
  pointer-events: none;
}
.attachment-remove {
  position: absolute;
  top: 0.3rem;
  right: 0.3rem;
  display: grid;
  place-items: center;
  width: 1.6rem;
  height: 1.6rem;
  border-radius: var(--radius-full);
  border: none;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s ease, background 0.15s ease;
}
.attachment-item:hover .attachment-remove {
  opacity: 1;
}
.attachment-remove:hover {
  background: var(--color-danger);
}

/* 模态框动画 */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: all 0.2s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
.modal-fade-enter-from .glass-card,
.modal-fade-leave-to .glass-card {
  transform: scale(0.95) translateY(-10px);
}
</style>

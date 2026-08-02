<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  User as UserIcon,
  Link as LinkIcon,
  ArrowDown,
  ArrowUp,
  ArrowLeft,
  Images,
  UserRound,
  History,
  BarChart3,
  Store,
  MessageCircle,
  MessageSquare,
  Mail,
  Phone,
  CalendarDays,
  Heart,
  StickyNote,
  Copy,
  Check,
} from '@lucide/vue'
import { useCustomerStore } from '@/stores/customer'
import { useSettingsStore } from '@/stores/settings'
import { useOrderStore } from '@/stores/order'
import { usePreferencesStore } from '@/stores/preferences'
import { ORDER_STATUS_LABEL, orderStatusBadgeClass } from '@/constants/order-labels'
import { sortOrders, type OrderSortKey } from '@/domain/order/order-sort'
import { computeTotalPages } from '@/domain/shared/pagination'
import PageHeader from '@/components/common/PageHeader.vue'
import DataTable, { type ColumnDef } from '@/components/common/DataTable.vue'
import DropdownSelect from '@/components/common/DropdownSelect.vue'
import ImagePreview from '@/components/common/ImagePreview.vue'
import type { OrderStatus, OrderAttachment } from '@/types'

const route = useRoute()
const router = useRouter()
const customerStore = useCustomerStore()
const settingsStore = useSettingsStore()
const orderStore = useOrderStore()
const prefs = usePreferencesStore()

const customerId = computed(() => route.params.id as string)
const customer = computed(() => customerStore.selectedCustomer)

const typeMap = computed(() => new Map(settingsStore.customerTypes.map(t => [t.id, t.name])))
function typeName(id?: string): string { return id ? (typeMap.value.get(id) || '—') : '未分类' }

// 联系方式一键复制（需求 2.2.1：QQ/微信/邮箱/电话支持一键复制）
const copiedField = ref('')
async function copyText(field: string, text: string) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    copiedField.value = field
    setTimeout(() => { copiedField.value = '' }, 1200)
  } catch {
    // 剪贴板不可用（如非安全上下文）时静默失败
  }
}

// 关联订单（全部历史：含已完成/退单——历史订单查看入口）
const relatedOrders = computed(() =>
  orderStore.orders.filter(o => o.customerId === customerId.value),
)

// ===== 历史订单：排序（右上角，与客户列表同款组合控件） =====
const historySortKey = ref<OrderSortKey>('createdAt')
const historySortDirection = ref<'asc' | 'desc'>('desc')

const historySortOptions = [
  { value: 'createdAt', label: '创建时间' },
  { value: 'orderNo', label: '订单编号' },
  { value: 'name', label: '订单名称' },
  { value: 'orderStatus', label: '订单状态' },
  { value: 'expectedAmount', label: '应付金额' },
  { value: 'actualAmount', label: '实付金额' },
  { value: 'expectedEnd', label: '预计交付' },
]

const sortedOrders = computed(() =>
  sortOrders(relatedOrders.value, historySortKey.value, historySortDirection.value),
)

function toggleHistorySortDirection() {
  historySortDirection.value = historySortDirection.value === 'desc' ? 'asc' : 'desc'
}

function onHistorySortKeyChange(value: string | number) {
  historySortKey.value = String(value) as OrderSortKey
}

// ===== 历史订单：列定义（同客户列表样式；无勾选栏、无操作栏） =====
const orderColumnDefs = ref<ColumnDef[]>([
  { key: 'orderNo', label: '订单编号', minWidth: 130, draggable: true },
  { key: 'name', label: '订单名称', minWidth: 160, draggable: true },
  { key: 'orderStatus', label: '订单状态', minWidth: 100, draggable: true },
  { key: 'expectedAmount', label: '应付金额', minWidth: 110, align: 'right', isNumeric: true, draggable: true },
  { key: 'actualAmount', label: '实付金额', minWidth: 110, align: 'right', isNumeric: true, draggable: true },
  { key: 'expectedEndDate', label: '预计交付', minWidth: 110, draggable: true },
  { key: 'createdAt', label: '创建时间', minWidth: 110, draggable: true },
])

const currentPage = ref(1)
// 历史订单默认每页条数（跟随偏好设置）
const pageSize = ref(prefs.preferences.listPageSize)

watch(() => relatedOrders.value.length, () => {
  const totalPages = computeTotalPages(relatedOrders.value.length, pageSize.value)
  if (currentPage.value > totalPages) currentPage.value = Math.max(1, totalPages)
})

// ===== 客户画廊：该客户所有已结单订单的终稿附件（final 类型） =====
const gallery = ref<OrderAttachment[]>([])
async function loadGallery() {
  gallery.value = await orderStore.fetchCustomerGallery(customerId.value)
}
watch(customerId, loadGallery)

// 缩略图 objectURL 缓存（卸载时统一释放）
const galleryThumbUrls = new Map<string, string>()
function galleryThumbUrl(att: OrderAttachment): string {
  let url = galleryThumbUrls.get(att.id)
  if (!url) {
    url = URL.createObjectURL(att.thumbnailData ?? att.fileData)
    galleryThumbUrls.set(att.id, url)
  }
  return url
}
function revokeGalleryThumbs() {
  galleryThumbUrls.forEach(u => URL.revokeObjectURL(u))
  galleryThumbUrls.clear()
}

// 大图预览
const previewUrl = ref<string | null>(null)
let previewObjectUrl: string | null = null
function openGalleryPreview(att: OrderAttachment) {
  previewObjectUrl = URL.createObjectURL(att.fileData)
  previewUrl.value = previewObjectUrl
}
function closeGalleryPreview() {
  previewUrl.value = null
  if (previewObjectUrl) { URL.revokeObjectURL(previewObjectUrl); previewObjectUrl = null }
}

onMounted(async () => {
  await Promise.all([
    customerStore.getCustomer(customerId.value),
    settingsStore.fetchCustomerTypes(),
    orderStore.fetchOrders(),
    loadGallery(),
  ])
})

onBeforeUnmount(revokeGalleryThumbs)

function formatDate(value?: string): string {
  if (!value) return '—'
  return value.slice(0, 10)
}

function formatAmount(value: number): string {
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function goOrder(id: string) { router.push(`/orders/${id}`) }
</script>

<template>
  <div class="fluid-container">
    <div>
      <button class="glass-btn glass-btn-ghost glass-btn-sm back-btn" @click="router.back()">
        <ArrowLeft class="w-3.5 h-3.5" /> 返回列表
      </button>
      <PageHeader :title="customer ? customer.name : '客户详情'" subtitle="客户信息与历史订单" :icon="UserIcon">
        <template v-if="customer" #actions>
          <span class="glass-badge glass-badge-primary">{{ typeName(customer.typeId) }}</span>
          <span class="glass-badge" :class="customer.weight >= 80 ? 'glass-badge-success' : customer.weight >= 50 ? 'glass-badge-warning' : 'glass-badge-default'">
            权重 {{ customer.weight }}
          </span>
        </template>
      </PageHeader>
    </div>

    <div v-if="customer" class="detail-grid">
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
              <span class="detail-field-icon"><Store class="w-4 h-4" /></span>
              <div class="detail-field-main">
                <div class="detail-field-label">平台</div>
                <div class="detail-field-value">{{ customer.platform || '—' }}</div>
              </div>
            </div>
            <div v-if="customer.platformLink" class="detail-field">
              <span class="detail-field-icon"><LinkIcon class="w-4 h-4" /></span>
              <div class="detail-field-main">
                <div class="detail-field-label">平台主页</div>
                <a :href="customer.platformLink" target="_blank" rel="noopener" class="detail-field-value text-[var(--color-accent)] hover:underline break-all">打开链接</a>
              </div>
            </div>
            <div class="detail-field">
              <span class="detail-field-icon"><MessageCircle class="w-4 h-4" /></span>
              <div class="detail-field-main">
                <div class="detail-field-label">QQ</div>
                <div class="detail-field-value detail-contact-value">
                  <span>{{ customer.qq || '—' }}</span>
                  <button
                    v-if="customer.qq"
                    type="button"
                    class="contact-copy-btn"
                    title="复制 QQ"
                    @click="copyText('qq', customer.qq)"
                  >
                    <Check v-if="copiedField === 'qq'" class="w-3 h-3" />
                    <Copy v-else class="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
            <div class="detail-field">
              <span class="detail-field-icon"><MessageSquare class="w-4 h-4" /></span>
              <div class="detail-field-main">
                <div class="detail-field-label">微信</div>
                <div class="detail-field-value detail-contact-value">
                  <span>{{ customer.wechat || '—' }}</span>
                  <button
                    v-if="customer.wechat"
                    type="button"
                    class="contact-copy-btn"
                    title="复制微信"
                    @click="copyText('wechat', customer.wechat)"
                  >
                    <Check v-if="copiedField === 'wechat'" class="w-3 h-3" />
                    <Copy v-else class="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
            <div class="detail-field">
              <span class="detail-field-icon"><Mail class="w-4 h-4" /></span>
              <div class="detail-field-main">
                <div class="detail-field-label">邮箱</div>
                <div class="detail-field-value detail-contact-value">
                  <span class="break-all">{{ customer.email || '—' }}</span>
                  <button
                    v-if="customer.email"
                    type="button"
                    class="contact-copy-btn"
                    title="复制邮箱"
                    @click="copyText('email', customer.email)"
                  >
                    <Check v-if="copiedField === 'email'" class="w-3 h-3" />
                    <Copy v-else class="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
            <div class="detail-field">
              <span class="detail-field-icon"><Phone class="w-4 h-4" /></span>
              <div class="detail-field-main">
                <div class="detail-field-label">电话</div>
                <div class="detail-field-value detail-contact-value">
                  <span>{{ customer.phone || '—' }}</span>
                  <button
                    v-if="customer.phone"
                    type="button"
                    class="contact-copy-btn"
                    title="复制电话"
                    @click="copyText('phone', customer.phone)"
                  >
                    <Check v-if="copiedField === 'phone'" class="w-3 h-3" />
                    <Copy v-else class="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
            <div class="detail-field">
              <span class="detail-field-icon"><CalendarDays class="w-4 h-4" /></span>
              <div class="detail-field-main">
                <div class="detail-field-label">加入时间</div>
                <div class="detail-field-value">{{ formatDate(customer.createdAt) }}</div>
              </div>
            </div>
            <div class="detail-field detail-field-wide">
              <span class="detail-field-icon"><Heart class="w-4 h-4" /></span>
              <div class="detail-field-main">
                <div class="detail-field-label">偏好 / 习惯</div>
                <div class="detail-field-value whitespace-pre-wrap">{{ customer.preference || '—' }}</div>
              </div>
            </div>
            <div v-if="customer.notes" class="detail-field detail-field-wide">
              <span class="detail-field-icon"><StickyNote class="w-4 h-4" /></span>
              <div class="detail-field-main">
                <div class="detail-field-label">备注</div>
                <div class="detail-field-value whitespace-pre-wrap">{{ customer.notes }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

        <!-- 右上：统计指标：明细清单式（9 行 flex:1 平分高度铺满整卡，数字右对齐） -->
        <div class="glass-card stat-card">
          <div class="glass-card-header">
            <div class="glass-card-title-group">
              <span class="glass-card-title-icon"><BarChart3 class="w-4 h-4" /></span>
              <h2 class="glass-section-title">统计指标</h2>
            </div>
          </div>
          <div class="glass-card-body stat-body">
            <div class="stat-rows">
              <div class="stat-row">
                <span class="stat-name">客户权重</span>
                <span class="stat-number text-[var(--color-accent)]">{{ customer.weight }}</span>
              </div>
              <div class="stat-row">
                <span class="stat-name">累计消费</span>
                <span class="stat-number text-[var(--color-success)]">{{ prefs.preferences.currencySymbol }}{{ customer.totalSpent.toLocaleString() }}</span>
              </div>
              <div class="stat-row">
                <span class="stat-name">最大单</span>
                <span class="stat-number">{{ prefs.preferences.currencySymbol }}{{ customer.maxOrderAmount.toLocaleString() }}</span>
              </div>
              <div class="stat-row">
                <span class="stat-name">总订单</span>
                <span class="stat-number">{{ customer.orderCount }}</span>
              </div>
              <div class="stat-row">
                <span class="stat-name">已完成</span>
                <span class="stat-number text-[var(--color-success)]">{{ customer.completedCount }}</span>
              </div>
              <div class="stat-row">
                <span class="stat-name">退单</span>
                <span class="stat-number">{{ customer.voidedCount }}</span>
              </div>
              <div class="stat-row">
                <span class="stat-name">免单</span>
                <span class="stat-number">{{ customer.waivedCount }}</span>
              </div>
              <div class="stat-row">
                <span class="stat-name">欠款</span>
                <span class="stat-number text-[var(--color-danger)]">{{ customer.arrearsCount }}</span>
              </div>
              <div class="stat-row">
                <span class="stat-name">逾期</span>
                <span class="stat-number text-[var(--color-warning)]">{{ customer.latePaymentCount }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 左下：关联订单：固定高度（约 10 行），禁用导出与每页条数设置 -->
        <div class="glass-card overflow-hidden order-history-card">
          <div class="glass-card-header">
            <div class="glass-card-title-group">
              <span class="glass-card-title-icon"><History class="w-4 h-4" /></span>
              <h2 class="glass-section-title">历史订单</h2>
            </div>
            <!-- 右上角排序：与客户列表同款组合控件（方向按钮 + 字段下拉） -->
            <div class="order-history-sort">
              <span class="order-history-sort-label">排序：</span>
              <div class="advanced-search-sort">
                <button
                  type="button"
                  class="sort-direction-btn"
                  :class="{ 'is-asc': historySortDirection === 'asc' }"
                  @click="toggleHistorySortDirection"
                  :title="historySortDirection === 'desc' ? '当前从高到低，点击切换为从低到高' : '当前从低到高，点击切换为从高到低'"
                >
                  <ArrowDown v-if="historySortDirection === 'desc'" class="w-3.5 h-3.5" />
                  <ArrowUp v-else class="w-3.5 h-3.5" />
                  <span>{{ historySortDirection === 'desc' ? '高→低' : '低→高' }}</span>
                </button>
                <DropdownSelect
                  :model-value="historySortKey"
                  :options="historySortOptions"
                  :searchable="false"
                  aria-label="排序字段"
                  @update:model-value="onHistorySortKeyChange"
                />
              </div>
            </div>
          </div>
          <DataTable
            :columns="orderColumnDefs"
            :data="sortedOrders"
            row-key="id"
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            page-size-storage-key="pagination.customer.orders.pageSize"
            columns-storage-key="dataTable.columns.customerOrders"
            :selectable="false"
            :exportable="false"
            :page-size-editable="false"
          >
            <!-- 订单编号：点击跳转订单详情 -->
            <template #td-orderNo="{ row }">
              <span
                class="whitespace-nowrap cursor-pointer hover:text-[var(--color-accent)]"
                @click="goOrder(row.id)"
              >
                {{ row.orderNo }}
              </span>
            </template>

            <!-- 订单名称（+ 紧急标记） -->
            <template #td-name="{ row }">
              <span class="whitespace-nowrap">{{ row.name }}</span>
              <span v-if="row.isUrgent" class="glass-badge glass-badge-danger ml-2">紧急</span>
            </template>

            <!-- 订单状态 -->
            <template #td-orderStatus="{ row }">
              <span class="glass-badge" :class="orderStatusBadgeClass(row.orderStatus)">
                {{ ORDER_STATUS_LABEL[row.orderStatus as OrderStatus] }}
              </span>
            </template>

            <!-- 应付金额 -->
            <template #td-expectedAmount="{ row }">
              <span>{{ prefs.preferences.currencySymbol }}{{ formatAmount(row.expectedAmount) }}</span>
            </template>

            <!-- 实付金额（未收款显示 0.00） -->
            <template #td-actualAmount="{ row }">
              <span>{{ prefs.preferences.currencySymbol }}{{ formatAmount(row.actualAmount) }}</span>
            </template>

            <!-- 预计交付 -->
            <template #td-expectedEndDate="{ row }">
              <span class="glass-caption whitespace-nowrap">{{ formatDate(row.expectedEndDate) }}</span>
            </template>

            <!-- 创建时间 -->
            <template #td-createdAt="{ row }">
              <span class="glass-caption whitespace-nowrap">{{ formatDate(row.createdAt) }}</span>
            </template>

            <template #empty>
              该客户暂无订单
            </template>
          </DataTable>
        </div>

        <!-- 右下：画廊：展示该客户所有已结单订单的终稿图片（final 类型），点击预览大图 -->
        <div class="glass-card gallery-card">
          <div class="glass-card-header">
            <div class="glass-card-title-group">
              <span class="glass-card-title-icon"><Images class="w-4 h-4" /></span>
              <h2 class="glass-section-title">画廊</h2>
            </div>
            <span v-if="gallery.length" class="gallery-count">{{ gallery.length }} 张成稿</span>
          </div>
          <div class="glass-card-body gallery-body">
            <div v-if="gallery.length === 0" class="gallery-placeholder">
              <Images class="gallery-placeholder-icon" />
              <p class="gallery-placeholder-title">暂无成稿</p>
              <p class="gallery-placeholder-sub">该客户已结单订单的终稿图片会自动展示在这里</p>
            </div>
            <div v-else class="gallery-grid">
              <div
                v-for="att in gallery"
                :key="att.id"
                class="gallery-item"
                :title="att.filename"
                @click="openGalleryPreview(att)"
              >
                <img :src="galleryThumbUrl(att)" :alt="att.filename" class="gallery-thumb" loading="lazy" />
              </div>
            </div>
          </div>
        </div>
        <ImagePreview :url="previewUrl" @close="closeGalleryPreview" />
    </div>

    <div v-else class="glass-empty">加载中...</div>
  </div>
</template>

<style scoped>
/* 返回按钮：与页头之间留少量呼吸（随屏宽微调） */
.back-btn {
  margin-bottom: clamp(0.375rem, 0.8vw, 0.75rem);
}

/* ===== 卡片标题：小图标块 + 标题（与表单弹窗 header 图标语言一致） ===== */
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
  /* 字段间距随屏宽放大：平板紧凑、大屏舒展 */
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
  gap: 0.125rem;
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
/* 联系方式：值 + 一键复制小按钮（需求 2.2.1） */
.detail-contact-value {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}
.contact-copy-btn {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 1.4rem;
  height: 1.4rem;
  border: none;
  border-radius: var(--radius-full);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border-soft);
  color: var(--color-text-muted);
  cursor: pointer;
  opacity: 0;
  transition: all 0.15s ease;
}
.detail-field:hover .contact-copy-btn {
  opacity: 1;
}
.contact-copy-btn:hover {
  color: var(--color-accent);
  border-color: var(--color-accent-glow);
  background: var(--color-accent-soft);
}
.detail-field-wide {
  grid-column: 1 / -1;
}
@media (max-width: 640px) {
  .detail-fields {
    grid-template-columns: 1fr;
  }
}

/* ===== 田字型布局：左上基本信息 / 右上统计指标 / 左下历史订单 / 右下画廊。
       同行卡片等高（grid 默认 stretch）：第一行 = 基本信息 ≈ 统计指标，
       第二行 = 历史订单 556px = 画廊 556px ===== */
.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  /* 卡片组间距随屏宽放大（与页头/工具栏同一节奏） */
  gap: var(--space-section);
  align-items: stretch;
}
@media (max-width: 640px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }
}

/* ===== 画廊卡片：与历史订单等高（556px），终稿网格，超出滚动 ===== */
.gallery-card {
  display: flex;
  flex-direction: column;
  height: 556px;
}
.gallery-count {
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
.gallery-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
}
.gallery-placeholder {
  flex: 1;
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
.gallery-placeholder-icon {
  width: clamp(2.25rem, 4vw, 3rem);
  height: clamp(2.25rem, 4vw, 3rem);
  color: var(--color-accent);
  opacity: 0.6;
}
.gallery-placeholder-title {
  font-size: 1em;
  font-weight: 600;
  color: var(--color-text);
}
.gallery-placeholder-sub {
  font-size: 0.8em;
  color: var(--color-text-muted);
}
/* 终稿网格 */
.gallery-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: var(--space-2);
  align-content: start;
  padding-bottom: 0.25rem;
}
.gallery-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  cursor: zoom-in;
  transition: all 0.15s ease;
}
.gallery-item:hover {
  border-color: var(--color-accent-glow);
  transform: translateY(-2px);
  box-shadow: var(--shadow-glass);
}
.gallery-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* ===== 统计指标：明细清单式（8 行 flex:1 平分高度铺满整卡，数字右对齐） ===== */
.stat-card {
  display: flex;
  flex-direction: column;
}
.stat-body {
  flex: 1;
  min-height: 0;
  display: flex;
  /* 覆盖 glass-card-body 默认内边距：上下收紧，让 8 行更舒展地平铺整个面板 */
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

/* ===== 历史订单卡片：固定高度（约 10 行：表头 3.5rem + 10 × 2.75rem 行 + 分页栏） ===== */
.order-history-card {
  display: flex;
  flex-direction: column;
  /* 表头 56px + 10 行 × 44px + 分页栏 ≈ 55px + 卡片边框，留少量余量避免恰好贴边 */
  height: 556px;
}

/* ===== 历史订单右上角排序组合控件（与客户列表/高级搜索同款） ===== */
.order-history-sort {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  white-space: nowrap;
}
/* 「排序：」标签与排序组合按钮同高（33px），垂直居中对齐 */
.order-history-sort-label {
  display: inline-flex;
  align-items: center;
  height: 33px;
  font-size: 0.8rem;
  font-weight: 500;
  line-height: 1.5;
  color: var(--color-text-secondary);
}
.advanced-search-sort {
  display: inline-flex;
  align-items: stretch;
  flex-direction: row;
  flex-wrap: nowrap;
  gap: 0;
  min-width: 0;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  background: var(--glass-bg);
  /* 不可裁剪：下拉面板需溢出显示 */
  overflow: visible;
  transition: all 0.15s;
}
.advanced-search-sort:focus-within {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-soft);
}
.sort-direction-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.5em 0.7em;
  border: none;
  border-right: 1px solid var(--glass-border-soft);
  border-radius: var(--radius-md) 0 0 var(--radius-md);
  background: transparent;
  color: var(--color-text-muted);
  /* 与输入框/下拉框同字号，保持等高 */
  font-size: 0.8rem;
  font-weight: 500;
  font-family: var(--font-body);
  line-height: 1.5;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.15s;
}
.sort-direction-btn:hover {
  background: var(--glass-bg-hover);
  color: var(--color-text);
}
.sort-direction-btn.is-asc {
  color: var(--color-accent);
}
/* 下拉触发器融入组合容器：去掉自身边框与圆角 */
.advanced-search-sort :deep(.dropdown-select) {
  flex: 1;
}
.advanced-search-sort :deep(.dropdown-select-trigger) {
  border: none;
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  background: transparent;
  min-width: 7.5rem;
  font-size: 0.8rem;
}
.advanced-search-sort :deep(.dropdown-select-trigger:hover) {
  background: var(--glass-bg-hover);
}
</style>

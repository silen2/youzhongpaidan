<template>
  <div v-if="visible" class="glass-overlay" @click.self="cancel">
    <div class="glass-modal glass-modal-lg glass-customer-form">
      <!-- 头部：与表格表头一致的玻璃质感（--glass-bg-strong + blur）+ 底部分隔线 -->
      <div class="glass-modal-header">
        <div class="glass-modal-header-inner">
          <span class="glass-modal-header-icon">
            <UserPlus v-if="!customer" class="w-4 h-4" />
            <UserPen v-else class="w-4 h-4" />
          </span>
          <div class="glass-modal-header-text">
            <h3 class="glass-modal-title">{{ customer ? '编辑客户' : '新建客户' }}</h3>
            <p class="glass-modal-subtitle">{{ customer ? '修改客户资料，保存后立即生效' : '录入客户的基本信息与联系方式' }}</p>
          </div>
        </div>
      </div>

      <form @submit.prevent="submit" class="glass-modal-body glass-customer-form-body">
        <!-- 基本信息 -->
        <section class="glass-form-section">
          <div class="glass-form-section-head">
            <h4 class="glass-form-section-title">基本信息</h4>
          </div>
          <div class="glass-form-grid">
            <div class="glass-form-group">
              <label class="glass-label glass-label-required">客户名称：</label>
              <input v-model="form.name" type="text" required class="glass-input" name="customerName" aria-label="客户名称" placeholder="如：阿伟、米画师-XX 等" />
            </div>
            <div class="glass-form-group">
              <label class="glass-label">客户类型：</label>
              <DropdownSelect
                v-model="form.typeId"
                :options="[{ value: '', label: '未分类' }, ...settingsStore.enabledCustomerTypes.map(t => ({ value: t.id, label: t.name }))]"
                search-placeholder="搜索类型..."
                aria-label="客户类型"
                teleport-to-body
              />
            </div>
          </div>
        </section>

        <!-- 平台信息 -->
        <section class="glass-form-section">
          <div class="glass-form-section-head">
            <h4 class="glass-form-section-title">平台信息</h4>
          </div>
          <div class="glass-form-grid">
            <div class="glass-form-group" :class="{ 'has-error': submitError }">
              <label class="glass-label glass-label-required">平台：</label>
              <DropdownSelect
                v-model="form.platform"
                :options="platformOptions"
                placeholder="请选择平台"
                search-placeholder="搜索平台..."
                aria-label="平台（必填）"
                teleport-to-body
              />
              <p v-if="submitError" class="glass-form-error">{{ submitError }}</p>
            </div>
            <div class="glass-form-group">
              <label class="glass-label">平台主页链接：</label>
              <input v-model="form.platformLink" type="text" class="glass-input" name="platformLink" aria-label="平台主页链接" placeholder="可粘贴主页链接" />
            </div>
          </div>
        </section>

        <!-- 联系方式 -->
        <section class="glass-form-section">
          <div class="glass-form-section-head">
            <h4 class="glass-form-section-title">联系方式</h4>
          </div>
          <div class="glass-form-grid">
            <div class="glass-form-group">
              <label class="glass-label">QQ：</label>
              <input v-model="form.qq" type="text" class="glass-input" name="qq" aria-label="QQ" />
            </div>
            <div class="glass-form-group">
              <label class="glass-label">微信：</label>
              <input v-model="form.wechat" type="text" class="glass-input" name="wechat" aria-label="微信" />
            </div>
            <div class="glass-form-group">
              <label class="glass-label">邮箱：</label>
              <input v-model="form.email" type="email" class="glass-input" name="email" aria-label="邮箱" />
            </div>
            <div class="glass-form-group">
              <label class="glass-label">电话：</label>
              <input v-model="form.phone" type="tel" class="glass-input" name="phone" aria-label="电话" />
            </div>
          </div>
        </section>

        <!-- 偏好与备注 -->
        <section class="glass-form-section">
          <div class="glass-form-section-head">
            <h4 class="glass-form-section-title">偏好与备注</h4>
          </div>
          <div class="glass-form-group">
            <label class="glass-label">偏好 / 习惯（可选）：</label>
            <textarea v-model="form.preference" rows="2" class="glass-input resize-none" name="preference" aria-label="偏好或习惯" placeholder="如：偏好半身像、常用画风、忌讳等" />
          </div>
          <div class="glass-form-group">
            <label class="glass-label">备注（可选）：</label>
            <textarea v-model="form.notes" rows="2" class="glass-input resize-none" name="notes" aria-label="备注" />
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
import { ref, computed, watch } from 'vue'
import { UserPlus, UserPen } from '@lucide/vue'
import { useCustomerStore } from '@/stores/customer'
import { useSettingsStore } from '@/stores/settings'
import DropdownSelect from '@/components/common/DropdownSelect.vue'
import type { Customer } from '@/types'

const props = defineProps<{
  visible: boolean
  customer: Customer | null
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const customerStore = useCustomerStore()
const settingsStore = useSettingsStore()

const form = ref({
  name: '',
  typeId: '',
  platform: '',
  platformLink: '',
  qq: '',
  wechat: '',
  email: '',
  phone: '',
  preference: '',
  notes: '',
})

// 平台选项：从「设置 → 来源」模板中选择（值为来源名称，与既有 platform 字符串兼容）；
// 平台为必填项（后续订单生成用它计算手续费），不留空选项；
// 历史自由文本平台不在模板中时兜底显示为自定义项，避免编辑回填丢失
const platformOptions = computed(() => {
  const opts: { value: string; label: string }[] = []
  for (const s of settingsStore.enabledSources) opts.push({ value: s.name, label: s.name })
  if (form.value.platform && !opts.some(o => o.value === form.value.platform)) {
    opts.push({ value: form.value.platform, label: `${form.value.platform}（自定义）` })
  }
  return opts
})

// 平台必填校验错误信息（保存时提示，选择平台后自动清除）
const submitError = ref('')

// 打开弹窗时初始化表单（编辑回填 / 新建置空），并重置平台校验错误
watch(() => props.visible, (v) => {
  if (!v) return
  submitError.value = ''
  const c = props.customer
  form.value = {
    name: c?.name ?? '',
    typeId: c?.typeId ?? '',
    platform: c?.platform ?? '',
    platformLink: c?.platformLink ?? '',
    qq: c?.qq ?? '',
    wechat: c?.wechat ?? '',
    email: c?.email ?? '',
    phone: c?.phone ?? '',
    preference: c?.preference ?? '',
    notes: c?.notes ?? '',
  }
})

// 选择平台后自动清除必填错误提示
watch(() => form.value.platform, () => {
  submitError.value = ''
})

async function submit() {
  if (!form.value.name.trim()) return
  // 平台为必填项（后续订单生成用它计算手续费）
  if (!form.value.platform) {
    submitError.value = '请选择平台（后续订单生成需要它计算手续费）'
    return
  }
  submitError.value = ''
  const payload = {
    name: form.value.name.trim(),
    typeId: form.value.typeId || undefined,
    platform: form.value.platform,
    platformLink: form.value.platformLink || undefined,
    qq: form.value.qq || undefined,
    wechat: form.value.wechat || undefined,
    email: form.value.email || undefined,
    phone: form.value.phone || undefined,
    preference: form.value.preference || undefined,
    notes: form.value.notes || undefined,
  }

  if (props.customer) {
    await customerStore.updateCustomer(props.customer.id, payload)
  } else {
    await customerStore.createCustomer(payload)
  }
  emit('saved')
}

function cancel() { emit('close') }
</script>

<style scoped>
/* ===== 新建/编辑客户弹窗：与表格一致的玻璃质感 ===== */

/* 加宽弹窗，为两列表单留出呼吸感 */
.glass-customer-form {
  width: clamp(360px, 95vw, 48rem);
}

/* 头部：与表格表头同款玻璃底（--glass-bg-strong + blur）与底部分隔线 */
.glass-customer-form .glass-modal-header {
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

.glass-customer-form .glass-modal-title {
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

/* 表单体：滚动容器 + 统一留白 */
.glass-customer-form-body {
  padding: var(--space-4) var(--space-8) var(--space-6);
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

/* 字段：标签在上、控件在下，控件与表格正文同字号（15.4px） */
.glass-customer-form .glass-form-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  row-gap: var(--space-3);
}

.glass-customer-form .glass-form-group {
  margin-bottom: 0;
}

.glass-customer-form .glass-label {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--color-text-secondary);
}

/* 平台必填校验错误：字段下拉框红边框 + 红色提示文字 */
.glass-customer-form .glass-form-group.has-error :deep(.dropdown-select-trigger) {
  border-color: var(--color-danger);
  box-shadow: 0 0 0 3px var(--color-danger-soft);
}
.glass-form-error {
  margin-top: var(--space-1);
  font-size: 0.75rem;
  color: var(--color-danger);
}

/* 底部操作：顶部用分隔线划分（呼应表格分页栏） */
.glass-customer-form .glass-modal-footer {
  margin-top: var(--space-6);
  padding-top: var(--space-4);
  border-top: 1px solid var(--glass-border-soft);
}

/* 窄屏：两列折为单列 */
@media (max-width: 640px) {
  .glass-customer-form .glass-form-grid {
    grid-template-columns: 1fr;
  }
}
</style>

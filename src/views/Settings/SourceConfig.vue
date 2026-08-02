<template>
  <div class="glass-card settings-card">
    <div class="glass-card-header">
      <h2 class="glass-section-title">来源模板管理</h2>
      <button @click="openAddModal" class="glass-btn glass-btn-primary glass-btn-sm">
        <component :is="Plus" class="w-3.5 h-3.5" />
        新增来源
      </button>
    </div>

    <div class="glass-card-body">
      <div class="overflow-x-auto">
        <table class="glass-table source-config-table">
          <thead>
            <tr>
              <th class="min-w-[8rem]">名称</th>
              <th>手续费类型</th>
              <th class="text-right">手续费值</th>
              <th class="min-w-[10rem]">备注</th>
              <th>状态</th>
              <th class="text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="source in pagedSources" :key="source.id">
              <td>
                <input
                  v-if="editingId === source.id"
                  v-model="editForm.name"
                  class="glass-input"
                  @keyup.escape="cancelEdit"
                  autofocus
                />
                <span v-else class="font-medium text-[var(--color-text)]">{{ source.name }}</span>
              </td>
              <td>
                <DropdownSelect
                  v-if="editingId === source.id"
                  v-model="editForm.feeType"
                  :options="[
                    { value: 'percentage', label: '百分比' },
                    { value: 'fixed', label: '固定金额' },
                  ]"
                  :searchable="false"
                  teleport-to-body
                  @select="editFeeValueError = ''"
                />
                <span v-else class="glass-body-sm">{{ source.feeType === 'percentage' ? '百分比' : '固定金额' }}</span>
              </td>
              <td class="text-right">
                <div v-if="editingId === source.id" class="glass-form-row justify-end">
                  <input
                    v-model.number="editForm.feeValue"
                    type="number"
                    :min="editForm.feeType === 'percentage' ? 0 : 0.01"
                    :max="editForm.feeType === 'percentage' ? 100 : undefined"
                    :step="editForm.feeType === 'percentage' ? 0.1 : 0.01"
                    required
                    class="glass-input w-20"
                    :class="{ 'glass-input-error': editFeeValueError }"
                    @input="editFeeValueError = ''"
                    @blur="onFeeValueBlur(editForm)"
                    @keyup.escape="cancelEdit"
                  />
                  <span class="glass-caption">{{ editForm.feeType === 'percentage' ? '%' : prefs.preferences.currencySymbol }}</span>
                </div>
                <span v-else class="glass-body-sm">{{ formatDisplayFee(source) }}</span>
                <p v-if="editFeeValueError" class="glass-caption fee-value-error">{{ editFeeValueError }}</p>
              </td>
              <td>
                <input
                  v-if="editingId === source.id"
                  v-model="editForm.notes"
                  class="glass-input"
                  placeholder="备注"
                  @keyup.escape="cancelEdit"
                />
                <span
                  v-else
                  class="glass-body-sm text-[var(--color-text-muted)] block truncate max-w-[16rem]"
                  :title="source.notes || ''"
                >
                  {{ source.notes || '—' }}
                </span>
              </td>
              <td>
                <label class="glass-toggle">
                  <input type="checkbox" class="glass-toggle-input" :checked="source.isEnabled" @change="toggleEnabled(source)" />
                  <span class="glass-toggle-track"></span>
                  <span class="glass-toggle-thumb"></span>
                </label>
              </td>
              <td class="text-right">
                <button
                  @click="editingId === source.id ? saveEdit(source) : startEdit(source)"
                  class="glass-btn glass-btn-ghost glass-btn-sm"
                  :class="{ 'source-save-btn': editingId === source.id }"
                >{{ editingId === source.id ? '保存' : '编辑' }}</button>
              </td>
            </tr>
            <tr v-if="store.sources.length === 0">
              <td colspan="6" class="glass-empty">暂无来源数据，点击右上角新增</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="store.sources.length"
        page-size-storage-key="pagination.settings.source.pageSize"
      />
    </div>

    <!-- 新增弹窗 -->
    <div v-if="showAddModal" class="glass-overlay">
      <div class="glass-modal glass-modal-md">
        <div class="glass-modal-header">
          <h3 class="glass-modal-title">新增来源</h3>
        </div>
        <form @submit.prevent="handleAdd" novalidate class="glass-modal-body space-y-4">
          <div class="glass-form-group" :class="{ 'has-error': newNameError }">
            <label class="glass-label glass-label-required">来源名称</label>
            <input v-model="newSource.name" type="text" required class="glass-input" :class="{ 'glass-input-error': newNameError }" placeholder="如：米画师、微博等" @input="newNameError = ''" />
            <p v-if="newNameError" class="glass-form-error">{{ newNameError }}</p>
          </div>
          <div class="glass-form-grid">
            <div class="glass-form-group">
              <label class="glass-label glass-label-required">手续费类型</label>
              <DropdownSelect
                v-model="newSource.feeType"
                :options="[
                  { value: 'percentage', label: '百分比' },
                  { value: 'fixed', label: '固定金额' },
                ]"
                :searchable="false"
                teleport-to-body
                @select="newFeeValueError = ''"
              />
            </div>
            <div class="glass-form-group" :class="{ 'has-error': newFeeValueError }">
              <label class="glass-label glass-label-required">手续费值</label>
              <div class="glass-form-row">
                <input
                  v-model.number="newSource.feeValue"
                  type="number"
                  :min="newSource.feeType === 'percentage' ? 0 : 0.01"
                  :max="newSource.feeType === 'percentage' ? 100 : undefined"
                  :step="newSource.feeType === 'percentage' ? 0.1 : 0.01"
                  required
                  class="glass-input flex-1"
                  :class="{ 'glass-input-error': newFeeValueError }"
                  @input="newFeeValueError = ''"
                  @blur="onFeeValueBlur(newSource)"
                />
                <span class="glass-caption">{{ newSource.feeType === 'percentage' ? '%' : prefs.preferences.currencySymbol }}</span>
              </div>
              <p v-if="newFeeValueError" class="glass-form-error">{{ newFeeValueError }}</p>
            </div>
          </div>
          <div class="glass-form-group">
            <label class="glass-label">备注（可选）</label>
            <textarea v-model="newSource.notes" rows="2" class="glass-input resize-none" />
          </div>
          <div class="glass-modal-footer">
            <button type="button" @click="cancelAdd" class="glass-btn glass-btn-outline">取消</button>
            <button type="submit" class="glass-btn glass-btn-primary">确认</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { Plus } from '@lucide/vue'
import { useSettingsStore } from '@/stores/settings'
import { usePreferencesStore } from '@/stores/preferences'
import { computePageItems, computeTotalPages } from '@/domain/shared/pagination'
import { validateFeeValue, formatFeeValue, type FeeType } from '@/domain/source/fee-value'
import Pagination from '@/components/common/Pagination.vue'
import DropdownSelect from '@/components/common/DropdownSelect.vue'
import type { Source } from '@/types'

const store = useSettingsStore()
const prefs = usePreferencesStore()
const PAGE_SIZE_KEY = 'pagination.settings.source.pageSize'

const showAddModal = ref(false)
const editingId = ref<string | null>(null)
const editForm = ref({ name: '', feeType: 'percentage' as FeeType, feeValue: 0, notes: '' })
const newSource = ref({ name: '', feeType: 'percentage' as FeeType, feeValue: 0, notes: '' })
// 校验错误：行内编辑的手续费值 / 新增弹窗的名称与手续费值
const editFeeValueError = ref('')
const newNameError = ref('')
const newFeeValueError = ref('')

const currentPage = ref(1)
const pageSize = ref(Number(localStorage.getItem(PAGE_SIZE_KEY)) || 10)

const pagedSources = computed(() => {
  const { slice } = computePageItems(store.sources.length, pageSize.value, currentPage.value)
  return store.sources.slice(slice[0], slice[1])
})

watch(() => store.sources.length, () => {
  const totalPages = computeTotalPages(store.sources.length, pageSize.value)
  if (currentPage.value > totalPages) currentPage.value = Math.max(1, totalPages)
})

onMounted(() => { store.fetchSources() })

function startEdit(source: Source) {
  editFeeValueError.value = ''
  editingId.value = source.id
  editForm.value = { name: source.name, feeType: source.feeType, feeValue: source.feeValue, notes: source.notes || '' }
}
function cancelEdit() { editingId.value = null }

/** 手续费值失焦：按类型取整小数位（百分比 1 位 / 固定 2 位）；范围由保存时校验显式报错 */
function onFeeValueBlur(form: { feeType: FeeType; feeValue: number }) {
  const n = Number(form.feeValue)
  form.feeValue = isFinite(n) ? formatFeeValue(form.feeType, n) : 0
}

/** 展示格式：百分比至多一位小数；固定金额两位小数 */
function formatDisplayFee(source: Source): string {
  if (source.feeType === 'percentage') return `${formatFeeValue('percentage', source.feeValue)}%`
  return `${prefs.preferences.currencySymbol}${formatFeeValue('fixed', source.feeValue).toFixed(2)}`
}

async function saveEdit(source: Source) {
  const feeError = validateFeeValue(editForm.value.feeType, Number(editForm.value.feeValue))
  if (feeError) {
    editFeeValueError.value = feeError
    return // 校验不通过：停留在编辑态，由用户修正
  }
  editFeeValueError.value = ''
  if (editForm.value.name.trim()) {
    await store.updateSource(source.id, {
      name: editForm.value.name.trim(),
      feeType: editForm.value.feeType,
      feeValue: formatFeeValue(editForm.value.feeType, Number(editForm.value.feeValue)),
      notes: editForm.value.notes,
    })
  }
  cancelEdit()
}

async function toggleEnabled(source: Source) { await store.toggleSourceEnabled(source.id) }

function openAddModal() {
  cancelEdit() // 先退出行内编辑，避免新增后编辑态残留无法退出
  newNameError.value = ''
  newFeeValueError.value = ''
  showAddModal.value = true
}
function cancelAdd() {
  showAddModal.value = false
  newSource.value = { name: '', feeType: 'percentage', feeValue: 0, notes: '' }
  newNameError.value = ''
  newFeeValueError.value = ''
}

async function handleAdd() {
  const name = newSource.value.name.trim()
  if (!name) {
    newNameError.value = '请填写来源名称'
    return
  }
  newNameError.value = ''
  const feeError = validateFeeValue(newSource.value.feeType, Number(newSource.value.feeValue))
  if (feeError) {
    newFeeValueError.value = feeError
    return
  }
  newFeeValueError.value = ''
  await store.createSource({
    name,
    feeType: newSource.value.feeType,
    feeValue: formatFeeValue(newSource.value.feeType, Number(newSource.value.feeValue)),
    isEnabled: true,
    notes: newSource.value.notes,
  })
  cancelAdd()
  currentPage.value = computeTotalPages(store.sources.length, pageSize.value)
}
</script>

<style scoped>
/* 来源模板表格：统一单元格字号与行内编辑控件高度。
   原名称输入框用 0.875em + py-0.5 收缩高度，与后面列的 .glass-body-sm（clamp 放大）
   字体大小不一致；现全部统一为 1em（相对表格 0.875em 正文），输入框高度也一致 */
.source-config-table {
  /* fixed 布局：列宽只由表头决定，编辑态 w-full 输入框的固有宽度不再驱动
     auto 布局重新分配列宽（否则一点「编辑」整个表格列宽都会变） */
  table-layout: fixed;
  width: 100%;
}
.source-config-table td {
  font-size: 1em;
}
.source-config-table td .glass-body-sm,
.source-config-table td .glass-caption {
  font-size: 1em;
}
.source-config-table td .glass-input,
.source-config-table td :deep(.dropdown-select-trigger) {
  font-size: 1em;
}
/* 表头显式列宽（按内容比例），保证编辑/展示两态列宽恒定 */
.source-config-table th:nth-child(1) { width: 20%; }
.source-config-table th:nth-child(2) { width: 17%; }
.source-config-table th:nth-child(3) { width: 15%; }
.source-config-table th:nth-child(4) { width: 25%; }
.source-config-table th:nth-child(5) { width: 11%; }
.source-config-table th:nth-child(6) { width: 12%; }
/* fixed 布局下名称列超长时省略号截断，避免撑破行 */
.source-config-table td:first-child > span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 编辑态「保存」按钮用主题色强调，与「编辑」区分 */
.source-save-btn {
  color: var(--color-accent);
}

/* 行内编辑的手续费值校验错误：右对齐小字，红色 */
.fee-value-error {
  margin-top: 0.25rem;
  font-size: 0.8em;
  color: var(--color-danger);
  text-align: right;
  white-space: nowrap;
}
</style>

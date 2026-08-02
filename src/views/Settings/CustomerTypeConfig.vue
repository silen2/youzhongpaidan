<template>
  <div class="glass-card settings-card">
    <div class="glass-card-header">
      <h2 class="glass-section-title">客户类型管理</h2>
      <button @click="handleAdd" class="glass-btn glass-btn-primary glass-btn-sm">
        <component :is="Plus" class="w-3.5 h-3.5" />
        新增类型
      </button>
    </div>

    <div class="glass-card-body space-y-2.5">
      <div v-for="type in pagedCustomerTypes" :key="type.id" class="glass-stage-item">
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-4 flex-1">
            <input
              v-if="editingId === type.id"
              v-model="editingName"
              @blur="saveEdit(type)"
              @keyup.enter="saveEdit(type)"
              @keyup.escape="cancelEdit"
              class="font-medium text-sm text-[var(--color-text)] border-b-2 border-[var(--color-accent)] outline-none bg-transparent flex-1 max-w-xs"
              autofocus
            />
            <span
              v-else
              class="font-medium text-sm text-[var(--color-text)] cursor-pointer hover:text-[var(--color-accent)]"
              @click="startEdit(type)"
            >
              {{ type.name }}
            </span>
          </div>
          <div class="flex items-center gap-3">
            <label class="glass-toggle">
              <input type="checkbox" class="glass-toggle-input" :checked="type.isEnabled" @change="toggleEnabled(type)" />
              <span class="glass-toggle-track"></span>
              <span class="glass-toggle-thumb"></span>
            </label>
            <span class="glass-badge" :class="type.isEnabled ? 'glass-badge-success' : 'glass-badge-default'">
              {{ type.isEnabled ? '已启用' : '已停用' }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="store.customerTypes.length === 0" class="glass-empty">暂无客户类型数据</div>

      <Pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="store.customerTypes.length"
        page-size-storage-key="pagination.settings.customerType.pageSize"
      />
    </div>

    <!-- 新增弹窗 -->
    <div v-if="showAddModal" class="glass-overlay">
      <div class="glass-modal glass-modal-sm">
        <div class="glass-modal-header">
          <h3 class="glass-modal-title">新增客户类型</h3>
        </div>
        <form @submit.prevent="confirmAdd" class="glass-modal-body space-y-4">
          <div class="glass-form-group">
            <label class="glass-label glass-label-required">类型名称</label>
            <input v-model="newTypeName" type="text" required class="glass-input" placeholder="如：新客户、VIP客户等" />
          </div>
          <div class="glass-modal-footer">
            <button type="button" @click="showAddModal = false" class="glass-btn glass-btn-outline">取消</button>
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
import { computePageItems, computeTotalPages } from '@/domain/shared/pagination'
import Pagination from '@/components/common/Pagination.vue'
import type { CustomerType } from '@/types'

const store = useSettingsStore()
const PAGE_SIZE_KEY = 'pagination.settings.customerType.pageSize'

const showAddModal = ref(false)
const newTypeName = ref('')
const editingId = ref<string | null>(null)
const editingName = ref('')

const currentPage = ref(1)
const pageSize = ref(Number(localStorage.getItem(PAGE_SIZE_KEY)) || 10)

const pagedCustomerTypes = computed(() => {
  const { slice } = computePageItems(store.customerTypes.length, pageSize.value, currentPage.value)
  return store.customerTypes.slice(slice[0], slice[1])
})

// CRUD 后修正越界 currentPage（删除末页项时自动回退前一页）
watch(() => store.customerTypes.length, () => {
  const totalPages = computeTotalPages(store.customerTypes.length, pageSize.value)
  if (currentPage.value > totalPages) currentPage.value = Math.max(1, totalPages)
})

onMounted(() => { store.fetchCustomerTypes() })

function handleAdd() {
  cancelEdit() // 先退出行内编辑，避免新增后编辑态残留无法退出
  newTypeName.value = ''
  showAddModal.value = true
}

async function confirmAdd() {
  if (!newTypeName.value.trim()) return
  await store.createCustomerType({ name: newTypeName.value.trim(), isEnabled: true })
  showAddModal.value = false
  // 新增后跳到末页，让用户立刻看到新项
  currentPage.value = computeTotalPages(store.customerTypes.length, pageSize.value)
}

function startEdit(type: CustomerType) { editingId.value = type.id; editingName.value = type.name }
function cancelEdit() { editingId.value = null }

async function saveEdit(type: CustomerType) {
  if (editingName.value.trim()) {
    await store.updateCustomerType(type.id, { name: editingName.value.trim() })
  }
  cancelEdit()
}

async function toggleEnabled(type: CustomerType) { await store.toggleCustomerTypeEnabled(type.id) }
</script>

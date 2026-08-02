<template>
  <div class="glass-card settings-card">
    <div class="glass-card-header">
      <h2 class="glass-section-title">跟进类型管理</h2>
      <button @click="handleAdd" class="glass-btn glass-btn-primary glass-btn-sm">
        <component :is="Plus" class="w-3.5 h-3.5" />
        新增类型
      </button>
    </div>

    <div class="glass-card-body space-y-2.5">
      <div v-for="type in pagedTypes" :key="type.id" class="glass-stage-item">
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-3 flex-1 min-w-0">
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
              class="font-medium text-sm text-[var(--color-text)] cursor-pointer hover:text-[var(--color-accent)] truncate"
              :title="type.isPreset ? '预置类型' : '点击重命名'"
              @click="startEdit(type)"
            >
              {{ type.name }}
            </span>
            <span v-if="type.isPreset" class="glass-badge glass-badge-default shrink-0">预置</span>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <label class="glass-toggle" :title="type.isPreset ? '预置类型也可停用' : '启用/停用'">
              <input
                type="checkbox"
                class="glass-toggle-input"
                :checked="type.isEnabled !== false"
                @change="toggleEnabled(type)"
              />
              <span class="glass-toggle-track"></span>
              <span class="glass-toggle-thumb"></span>
            </label>
            <span class="glass-badge" :class="type.isEnabled !== false ? 'glass-badge-success' : 'glass-badge-default'">
              {{ type.isEnabled !== false ? '已启用' : '已停用' }}
            </span>
            <button
              v-if="!type.isPreset"
              class="glass-btn glass-btn-ghost glass-btn-sm text-[var(--color-danger)]"
              title="删除"
              @click="handleDelete(type)"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div v-if="store.followUpTypes.length === 0" class="glass-empty">暂无跟进类型数据</div>

      <Pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="store.followUpTypes.length"
        page-size-storage-key="pagination.settings.followUpType.pageSize"
      />
    </div>

    <!-- 新增弹窗 -->
    <div v-if="showAddModal" class="glass-overlay">
      <div class="glass-modal glass-modal-sm">
        <div class="glass-modal-header">
          <h3 class="glass-modal-title">新增跟进类型</h3>
        </div>
        <form @submit.prevent="confirmAdd" class="glass-modal-body space-y-4">
          <div class="glass-form-group">
            <label class="glass-label glass-label-required">类型名称</label>
            <input v-model="newTypeName" type="text" required class="glass-input" placeholder="如：客户反馈、修改意见等" />
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
import { Plus, Trash2 } from '@lucide/vue'
import { useSettingsStore } from '@/stores/settings'
import { computePageItems, computeTotalPages } from '@/domain/shared/pagination'
import Pagination from '@/components/common/Pagination.vue'
import type { FollowUpType } from '@/types'

const store = useSettingsStore()
const PAGE_SIZE_KEY = 'pagination.settings.followUpType.pageSize'

const showAddModal = ref(false)
const newTypeName = ref('')
const editingId = ref<string | null>(null)
const editingName = ref('')

const currentPage = ref(1)
const pageSize = ref(Number(localStorage.getItem(PAGE_SIZE_KEY)) || 10)

const pagedTypes = computed(() => {
  const { slice } = computePageItems(store.followUpTypes.length, pageSize.value, currentPage.value)
  return store.followUpTypes.slice(slice[0], slice[1])
})

watch(() => store.followUpTypes.length, () => {
  const totalPages = computeTotalPages(store.followUpTypes.length, pageSize.value)
  if (currentPage.value > totalPages) currentPage.value = Math.max(1, totalPages)
})

onMounted(() => { store.fetchFollowUpTypes() })

function handleAdd() {
  cancelEdit()
  newTypeName.value = ''
  showAddModal.value = true
}

async function confirmAdd() {
  if (!newTypeName.value.trim()) return
  await store.createFollowUpType({ name: newTypeName.value.trim() })
  showAddModal.value = false
  currentPage.value = computeTotalPages(store.followUpTypes.length, pageSize.value)
}

function startEdit(type: FollowUpType) { editingId.value = type.id; editingName.value = type.name }
function cancelEdit() { editingId.value = null }

async function saveEdit(type: FollowUpType) {
  if (editingName.value.trim()) {
    await store.updateFollowUpType(type.id, { name: editingName.value.trim() })
  }
  cancelEdit()
}

async function toggleEnabled(type: FollowUpType) {
  await store.toggleFollowUpTypeEnabled(type.id)
}

async function handleDelete(type: FollowUpType) {
  if (!confirm(`确定删除跟进类型"${type.name}"吗？`)) return
  try {
    await store.deleteFollowUpType(type.id)
  } catch (e: any) {
    alert(e.message)
  }
}
</script>

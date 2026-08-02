<template>
  <div class="glass-card settings-card">
    <div class="glass-card-header">
      <h2 class="glass-section-title">稿件类别管理</h2>
      <button @click="handleAdd" class="glass-btn glass-btn-primary glass-btn-sm">
        <component :is="Plus" class="w-3.5 h-3.5" />
        新增类别
      </button>
    </div>

    <div class="glass-card-body">
      <div class="fluid-grid" style="grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr)); gap: 0.75rem;">
        <div v-for="(category, index) in pagedCategories" :key="category.id" class="glass-grid-card">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <span class="glass-grid-card-index">{{ index + 1 }}</span>
              <input
                v-if="editingId === category.id"
                v-model="editingName"
                @blur="saveEdit(category)"
                @keyup.enter="saveEdit(category)"
                @keyup.escape="cancelEdit"
                class="font-medium text-sm text-[var(--color-text)] border-b-2 border-[var(--color-accent)] outline-none bg-transparent w-full"
                autofocus
              />
              <span
                v-else
                class="font-medium text-sm text-[var(--color-text)] cursor-pointer hover:text-[var(--color-accent)] truncate"
                :title="'点击重命名'"
                @click="startEdit(category)"
              >
                {{ category.name }}
              </span>
            </div>
          </div>
          <div class="mt-3 flex items-center justify-between">
            <label class="glass-toggle">
              <input type="checkbox" class="glass-toggle-input" :checked="category.isEnabled" @change="toggleEnabled(category)" />
              <span class="glass-toggle-track"></span>
              <span class="glass-toggle-thumb"></span>
            </label>
            <span class="glass-badge" :class="category.isEnabled ? 'glass-badge-success' : 'glass-badge-default'">
              {{ category.isEnabled ? '已启用' : '已停用' }}
            </span>
          </div>
        </div>
      </div>

      <Pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="store.categories.length"
        page-size-storage-key="pagination.settings.category.pageSize"
      />
    </div>

    <!-- 新增弹窗 -->
    <div v-if="showAddModal" class="glass-overlay">
      <div class="glass-modal glass-modal-sm">
        <div class="glass-modal-header">
          <h3 class="glass-modal-title">新增稿件类别</h3>
        </div>
        <form @submit.prevent="confirmAdd" class="glass-modal-body space-y-4">
          <div class="glass-form-group">
            <label class="glass-label glass-label-required">类别名称</label>
            <input v-model="newCategoryName" type="text" required class="glass-input" placeholder="如：立绘、插画、Q版等" />
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
import type { Category } from '@/types'

const store = useSettingsStore()
const PAGE_SIZE_KEY = 'pagination.settings.category.pageSize'

const showAddModal = ref(false)
const newCategoryName = ref('')
const editingId = ref<string | null>(null)
const editingName = ref('')

const currentPage = ref(1)
const pageSize = ref(Number(localStorage.getItem(PAGE_SIZE_KEY)) || 10)

const pagedCategories = computed(() => {
  const { slice } = computePageItems(store.categories.length, pageSize.value, currentPage.value)
  return store.categories.slice(slice[0], slice[1])
})

watch(() => store.categories.length, () => {
  const totalPages = computeTotalPages(store.categories.length, pageSize.value)
  if (currentPage.value > totalPages) currentPage.value = Math.max(1, totalPages)
})

onMounted(() => { store.fetchCategories() })

function handleAdd() {
  cancelEdit() // 先退出行内编辑，避免新增后编辑态残留无法退出
  newCategoryName.value = ''
  showAddModal.value = true
}

async function confirmAdd() {
  if (!newCategoryName.value.trim()) return
  await store.createCategory({ name: newCategoryName.value.trim(), isEnabled: true })
  showAddModal.value = false
  currentPage.value = computeTotalPages(store.categories.length, pageSize.value)
}

function startEdit(category: Category) { editingId.value = category.id; editingName.value = category.name }
function cancelEdit() { editingId.value = null }

async function saveEdit(category: Category) {
  if (editingName.value.trim()) {
    await store.updateCategory(category.id, { name: editingName.value.trim() })
  }
  cancelEdit()
}

async function toggleEnabled(category: Category) { await store.toggleCategoryEnabled(category.id) }
</script>

<style scoped>
/* 类别卡片序号徽标：accent 色小圆标，强化网格卡片的秩序感 */
.glass-grid-card-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  flex-shrink: 0;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--color-accent);
  background: var(--color-accent-soft);
  border: 1px solid var(--color-accent-glow);
  border-radius: var(--radius-full);
}
</style>

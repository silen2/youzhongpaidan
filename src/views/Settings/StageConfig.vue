<template>
  <div class="space-y-5">
    <div class="glass-card settings-card">
      <div class="glass-card-header">
        <h2 class="glass-section-title">绘制阶段配置</h2>
        <button
          @click="showAddModal = true"
          class="glass-btn glass-btn-primary glass-btn-sm"
        >
          <component :is="Plus" class="w-3.5 h-3.5" />
          新增阶段
        </button>
      </div>

      <div class="glass-card-body space-y-3">
        <!-- 系统阶段：待开始 -->
        <div class="glass-stage-item glass-stage-item-system">
          <div class="flex items-center gap-3">
            <div class="glass-color-dot" :style="{ backgroundColor: getStageColor('st-pending') }" />
            <span class="font-medium text-sm text-[var(--color-text)]">待开始</span>
            <span class="glass-badge glass-badge-default">系统</span>
            <span class="ml-auto glass-badge glass-badge-default shrink-0">不可修改位置</span>
          </div>
        </div>

        <!-- 自定义阶段列表 -->
        <div v-for="(stage, index) in customStages" :key="stage.id" class="glass-stage-item">
          <div class="flex items-center gap-3">
            <div
              class="glass-color-dot"
              :style="{ backgroundColor: stage.color }"
              :title="'修改颜色：' + stage.color"
              @click="openColorPicker(stage)"
            />
            <input
              v-if="editingId === stage.id"
              v-model="editingName"
              @blur="saveEdit(stage)"
              @keyup.enter="saveEdit(stage)"
              @keyup.escape="cancelEdit"
              class="font-medium text-sm text-[var(--color-text)] border-b-2 border-[var(--color-accent)] outline-none bg-transparent flex-1 max-w-xs"
              autofocus
            />
            <span
              v-else
              class="font-medium text-sm text-[var(--color-text)] cursor-pointer hover:text-[var(--color-accent)]"
              @click="startEdit(stage)"
            >
              {{ stage.name }}
            </span>
            <span class="glass-badge glass-badge-primary">自定义</span>

            <div class="ml-auto flex items-center gap-0.5 stage-actions">
              <button
                @click="moveUp(stage)"
                :disabled="index === 0"
                class="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--glass-bg-hover)] rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="上移"
              >
                <component :is="ArrowUp" class="w-3.5 h-3.5" />
              </button>
              <button
                @click="moveDown(stage)"
                :disabled="index === customStages.length - 1"
                class="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--glass-bg-hover)] rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="下移"
              >
                <component :is="ArrowDown" class="w-3.5 h-3.5" />
              </button>
              <button
                @click="handleDelete(stage)"
                class="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] rounded transition-colors"
                title="删除"
              >
                <component :is="Trash2" class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <!-- 系统阶段：完成 -->
        <div class="glass-stage-item glass-stage-item-system">
          <div class="flex items-center gap-3">
            <div class="glass-color-dot" :style="{ backgroundColor: getStageColor('st-done') }" />
            <span class="font-medium text-sm text-[var(--color-text)]">完成</span>
            <span class="glass-badge glass-badge-default">系统</span>
            <span class="ml-auto glass-badge glass-badge-default shrink-0">不可修改位置</span>
          </div>
        </div>

        <!-- 系统阶段：退单 -->
        <div class="glass-stage-item glass-stage-item-system">
          <div class="flex items-center gap-3">
            <div class="glass-color-dot" :style="{ backgroundColor: getStageColor('st-void') }" />
            <span class="font-medium text-sm text-[var(--color-text)]">退单</span>
            <span class="glass-badge glass-badge-default">系统</span>
            <span class="ml-auto glass-badge glass-badge-default shrink-0">不可修改位置</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 新增阶段弹窗 -->
    <div v-if="showAddModal" class="glass-overlay">
      <div class="glass-modal glass-modal-md">
        <div class="glass-modal-header">
          <h3 class="glass-modal-title">新增自定义阶段</h3>
        </div>
        <form @submit.prevent="handleAdd" class="glass-modal-body space-y-4">
          <div class="glass-form-group">
            <label class="glass-label glass-label-required">阶段名称</label>
            <input v-model="newStage.name" type="text" required class="glass-input" placeholder="请输入阶段名称" />
          </div>
          <div class="glass-form-group">
            <label class="glass-label">阶段颜色</label>
            <div class="glass-form-row">
              <input v-model="newStage.color" type="color" class="w-10 h-9 rounded cursor-pointer border border-[var(--glass-border)] bg-transparent" />
              <input v-model="newStage.color" type="text" class="glass-input flex-1" placeholder="#3b82f6" />
            </div>
          </div>
          <div class="glass-modal-footer">
            <button type="button" @click="cancelAdd" class="glass-btn glass-btn-outline">取消</button>
            <button type="submit" class="glass-btn glass-btn-primary">确认</button>
          </div>
        </form>
      </div>
    </div>

    <!-- 颜色选择器弹窗 -->
    <div v-if="colorPickerStage" class="glass-overlay">
      <div class="glass-modal glass-modal-sm">
        <div class="glass-modal-header">
          <h3 class="glass-modal-title">选择阶段颜色</h3>
        </div>
        <div class="glass-modal-body space-y-4">
          <div class="grid grid-cols-5 gap-2">
            <button
              v-for="color in presetColors"
              :key="color"
              @click="selectColor(color)"
              class="w-9 h-9 rounded-lg border-2 transition-transform hover:scale-110"
              :class="{ 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent-soft)]': newColor === color, 'border-[var(--glass-border)]': newColor !== color }"
              :style="{ backgroundColor: color }"
            />
          </div>
          <div class="glass-form-row">
            <input type="color" :value="newColor" @input="updateColor($event)" class="w-9 h-9 rounded cursor-pointer border border-[var(--glass-border)] bg-transparent" />
            <input v-model="newColor" type="text" class="glass-input flex-1" placeholder="#3b82f6" @keyup.enter="confirmColor" />
          </div>
          <div class="glass-modal-footer">
            <button @click="colorPickerStage = null" class="glass-btn glass-btn-outline">取消</button>
            <button @click="confirmColor" class="glass-btn glass-btn-primary">确认</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ArrowUp, ArrowDown, Trash2, Plus } from '@lucide/vue'
import { useSettingsStore } from '@/stores/settings'
import type { Stage } from '@/types'

const store = useSettingsStore()

const showAddModal = ref(false)
const newStage = ref({ name: '', color: '#818cf8' })
const editingId = ref<string | null>(null)
const editingName = ref('')
const colorPickerStage = ref<Stage | null>(null)
const newColor = ref('')

const presetColors = [
  '#f87171', '#fb923c', '#fbbf24', '#a3e635', '#34d399',
  '#22d3ee', '#60a5fa', '#818cf8', '#a78bfa', '#e879f9',
  '#f472b6', '#94a3b8', '#64748b', '#475569', '#334155',
]

const customStages = computed(() => store.customStages)

onMounted(() => { store.fetchStages() })

function getStageColor(id: string): string {
  const stage = store.stages.find(s => s.id === id)
  return stage?.color || '#94a3b8'
}

function moveUp(stage: Stage) {
  const idx = customStages.value.findIndex(s => s.id === stage.id)
  if (idx > 0) store.moveStage(stage.id, 'up')
}

function moveDown(stage: Stage) {
  const idx = customStages.value.findIndex(s => s.id === stage.id)
  if (idx < customStages.value.length - 1) store.moveStage(stage.id, 'down')
}

function startEdit(stage: Stage) {
  editingId.value = stage.id
  editingName.value = stage.name
}

function cancelEdit() {
  editingId.value = null
  editingName.value = ''
}

async function saveEdit(stage: Stage) {
  if (editingName.value.trim()) {
    await store.updateStage(stage.id, { name: editingName.value.trim() })
  }
  cancelEdit()
}

async function handleDelete(stage: Stage) {
  if (confirm(`确定删除阶段"${stage.name}"吗？`)) {
    try { await store.deleteStage(stage.id) }
    catch (e: any) { alert(e.message) }
  }
}

function openColorPicker(stage: Stage) {
  colorPickerStage.value = stage
  newColor.value = stage.color
}

function selectColor(color: string) { newColor.value = color }
function updateColor(e: Event) { newColor.value = (e.target as HTMLInputElement).value }

async function confirmColor() {
  if (colorPickerStage.value) {
    await store.updateStage(colorPickerStage.value.id, { color: newColor.value })
  }
  colorPickerStage.value = null
}

function cancelAdd() {
  showAddModal.value = false
  newStage.value = { name: '', color: '#818cf8' }
}

async function handleAdd() {
  if (!newStage.value.name.trim()) return
  try {
    // position 由 store 统一计算（插入在「完成」之前），这里不传避免排错位
    await store.createStage({
      name: newStage.value.name.trim(),
      color: newStage.value.color,
      type: 'custom',
    })
    cancelAdd()
  } catch (e: any) { alert(e.message) }
}
</script>

<style scoped>
/* 行内操作按钮：鼠标设备上默认半透明，行 hover 时浮现（与全局表格一致的手法） */
@media (hover: hover) {
  .stage-actions {
    opacity: 0.35;
    transition: opacity 0.18s ease;
  }
  .glass-stage-item:hover .stage-actions {
    opacity: 1;
  }
}
</style>

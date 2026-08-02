<template>
  <div class="glass-card settings-card">
    <div class="glass-card-header">
      <div class="settings-card-title">
        <component :is="ImageIcon" class="settings-card-icon" />
        <div>
          <h2 class="glass-section-title">自定义头图</h2>
          <p class="glass-section-subtitle">上传图片替换左上角头图与浏览器图标；未设置时使用内置默认图</p>
        </div>
      </div>
      <button v-if="isCustom" class="glass-btn glass-btn-ghost glass-btn-sm" @click="removeImage">
        <component :is="Trash2" class="w-3.5 h-3.5" />
        恢复默认
      </button>
    </div>

    <div class="glass-card-body">
      <!-- 预览：与侧边栏头图同尺寸比例，默认图带角标 -->
      <div class="brand-preview">
        <div class="brand-preview-wrap">
          <img :src="displayImage" alt="头图预览" class="brand-preview-img" />
          <span v-if="!isCustom" class="brand-preview-badge">默认</span>
        </div>
      </div>

      <div class="flex gap-2 flex-wrap mt-3">
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          class="hidden"
          @change="handleFileUpload"
        />
        <button class="glass-btn glass-btn-primary" @click="fileInput?.click()">
          <component :is="Upload" class="w-4 h-4" />
          {{ isCustom ? '更换图片' : '上传自定义图片' }}
        </button>
        <button v-if="isCustom" class="glass-btn glass-btn-outline" @click="openCropModal">
          <component :is="Crop" class="w-4 h-4" />
          调整裁剪
        </button>
      </div>
      <p class="glass-caption mt-2">
        图片将显示在应用左上角的正方形头图中（cover 铺满），并同时用作浏览器标签页图标。点「恢复默认」可回到内置默认图。
      </p>
    </div>
  </div>

  <!-- 裁剪弹窗（与主题背景裁剪同款交互） -->
  <div v-if="showCropModal" class="glass-overlay" @click.self="cancelCrop">
    <div class="glass-modal glass-modal-lg">
      <div class="glass-modal-header">
        <h3 class="glass-modal-title">调整头图显示区域</h3>
        <button class="glass-btn glass-btn-ghost glass-btn-sm" @click="cancelCrop" title="取消">
          <component :is="X" class="w-4 h-4" />
        </button>
      </div>
      <div class="glass-modal-body">
        <div
          ref="cropStageRef"
          class="crop-stage"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
        >
          <img
            v-if="original"
            :src="original"
            class="crop-image"
            draggable="false"
            alt="待裁剪图片"
          />
          <div class="crop-selection" :style="selectionStyle" @pointerdown="startDrag($event, 'move')">
            <div class="crop-grid"></div>
            <div class="crop-handle crop-handle-nw" @pointerdown.stop="startDrag($event, 'nw')"></div>
            <div class="crop-handle crop-handle-n" @pointerdown.stop="startDrag($event, 'n')"></div>
            <div class="crop-handle crop-handle-ne" @pointerdown.stop="startDrag($event, 'ne')"></div>
            <div class="crop-handle crop-handle-e" @pointerdown.stop="startDrag($event, 'e')"></div>
            <div class="crop-handle crop-handle-se" @pointerdown.stop="startDrag($event, 'se')"></div>
            <div class="crop-handle crop-handle-s" @pointerdown.stop="startDrag($event, 's')"></div>
            <div class="crop-handle crop-handle-sw" @pointerdown.stop="startDrag($event, 'sw')"></div>
            <div class="crop-handle crop-handle-w" @pointerdown.stop="startDrag($event, 'w')"></div>
          </div>
        </div>
        <p class="glass-caption mt-3">
          拖动方框选择要显示的图片区域，拖动八个边角可调整大小。
        </p>
      </div>
      <div class="glass-modal-footer">
        <button class="glass-btn glass-btn-outline" @click="cancelCrop">取消</button>
        <button class="glass-btn glass-btn-primary" @click="applyCrop">
          <component :is="Check" class="w-4 h-4" />
          应用
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { Image as ImageIcon, Upload, Crop, Trash2, X, Check } from '@lucide/vue'
import { useThemeStore } from '@/stores/theme'
import { cropImage, downscaleImage, type CropRegion } from '@/utils/image-processing'

/** 内置默认头图（public 静态资源，打包后 /brand-logo.jpg） */
const DEFAULT_BRAND = '/brand-logo.jpg'

const theme = useThemeStore()
const fileInput = ref<HTMLInputElement | null>(null)

// 原始图仅存内存（会话内可重新裁剪），裁剪结果由 store 持久化
const original = ref('')

const isCustom = computed(() => !!theme.customBrandImage)
const displayImage = computed(() => theme.customBrandImage || DEFAULT_BRAND)

async function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  if (file.size > 5 * 1024 * 1024) {
    alert('图片大小不能超过 5MB')
    target.value = ''
    return
  }
  const reader = new FileReader()
  reader.onload = async (e) => {
    const dataUrl = e.target?.result as string
    if (!dataUrl) return
    const processed = await downscaleImage(dataUrl, 800, 0.92).catch(() => dataUrl)
    original.value = processed
    theme.setCustomBrandImage(processed)
    // 上传后直接进入裁剪
    openCropModal()
  }
  reader.readAsDataURL(file)
  target.value = ''
}

function removeImage() {
  if (!confirm('确定恢复内置默认头图吗？当前自定义图片将被移除。')) return
  original.value = ''
  theme.setCustomBrandImage(null)
}

// ===== 裁剪（与主题背景裁剪同款交互） =====
const showCropModal = ref(false)
const cropStageRef = ref<HTMLElement | null>(null)
const cropRect = reactive<CropRegion>({ x: 0, y: 0, w: 1, h: 1 })
const dragMode = ref<string | null>(null)
const dragStart = ref<{ px: number; py: number; rect: CropRegion } | null>(null)

const selectionStyle = computed(() => ({
  left: `${cropRect.x * 100}%`,
  top: `${cropRect.y * 100}%`,
  width: `${cropRect.w * 100}%`,
  height: `${cropRect.h * 100}%`,
}))

function openCropModal() {
  // 未上传新图时，用当前显示图作为裁剪底图
  const source = original.value || theme.customBrandImage || ''
  if (!source) return
  if (!original.value) original.value = source
  cropRect.x = 0
  cropRect.y = 0
  cropRect.w = 1
  cropRect.h = 1
  showCropModal.value = true
}

function cancelCrop() {
  showCropModal.value = false
}

function startDrag(e: PointerEvent, mode: string) {
  e.preventDefault()
  e.stopPropagation()
  const stage = cropStageRef.value
  if (!stage) return
  try {
    stage.setPointerCapture(e.pointerId)
  } catch {
    // ignore capture errors
  }
  dragMode.value = mode
  dragStart.value = {
    px: e.clientX,
    py: e.clientY,
    rect: { ...cropRect },
  }
}

function onPointerMove(e: PointerEvent) {
  if (!dragMode.value || !dragStart.value) return
  const stage = cropStageRef.value
  if (!stage) return
  const rect = stage.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return
  const dx = (e.clientX - dragStart.value.px) / rect.width
  const dy = (e.clientY - dragStart.value.py) / rect.height
  const start = dragStart.value.rect
  const MIN = 0.1
  const mode = dragMode.value

  if (mode === 'move') {
    let x = start.x + dx
    let y = start.y + dy
    x = Math.max(0, Math.min(x, 1 - start.w))
    y = Math.max(0, Math.min(y, 1 - start.h))
    cropRect.x = x
    cropRect.y = y
    cropRect.w = start.w
    cropRect.h = start.h
    return
  }

  let left = start.x
  let top = start.y
  let right = start.x + start.w
  let bottom = start.y + start.h
  if (mode.includes('w')) left = start.x + dx
  if (mode.includes('e')) right = start.x + start.w + dx
  if (mode.includes('n')) top = start.y + dy
  if (mode.includes('s')) bottom = start.y + start.h + dy

  left = Math.max(0, Math.min(left, 1))
  right = Math.max(0, Math.min(right, 1))
  top = Math.max(0, Math.min(top, 1))
  bottom = Math.max(0, Math.min(bottom, 1))

  if (right - left < MIN) {
    if (mode.includes('w')) left = right - MIN
    else right = left + MIN
  }
  if (bottom - top < MIN) {
    if (mode.includes('n')) top = bottom - MIN
    else bottom = top + MIN
  }
  left = Math.max(0, left)
  right = Math.min(1, right)
  top = Math.max(0, top)
  bottom = Math.min(1, bottom)

  cropRect.x = left
  cropRect.y = top
  cropRect.w = Math.max(0.01, right - left)
  cropRect.h = Math.max(0.01, bottom - top)
}

function onPointerUp(e: PointerEvent) {
  const stage = cropStageRef.value
  if (stage && e.pointerId !== undefined) {
    try {
      stage.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }
  dragMode.value = null
  dragStart.value = null
}

async function applyCrop() {
  if (!original.value) return
  try {
    const cropped = await cropImage(original.value, { ...cropRect }, 800, 0.92)
    theme.setCustomBrandImage(cropped)
    showCropModal.value = false
  } catch {
    alert('裁剪失败，请重试')
  }
}
</script>

<style scoped>
.brand-preview {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
  border: 1px dashed var(--glass-border);
  border-radius: var(--radius-lg);
  background: var(--glass-bg);
}
.brand-preview-wrap {
  position: relative;
}
.brand-preview-img {
  display: block;
  width: 4rem;
  height: 4rem;
  border-radius: 6px;
  object-fit: cover;
  box-shadow: var(--shadow-glass);
}
/* 「默认」角标：标识当前使用内置默认图 */
.brand-preview-badge {
  position: absolute;
  right: -0.5rem;
  bottom: -0.5rem;
  padding: 0.1em 0.6em;
  font-size: 0.65rem;
  font-weight: 600;
  line-height: 1.4;
  color: var(--color-text-secondary);
  background: var(--glass-bg-panel);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  backdrop-filter: blur(8px);
}
.brand-preview-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text-muted);
}

/* ===== 裁剪（与主题背景裁剪同款样式） ===== */
.crop-stage {
  position: relative;
  display: inline-block;
  max-width: 100%;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
  line-height: 0;
  border-radius: 0.5rem;
  overflow: hidden;
}
.crop-image {
  display: block;
  max-width: 100%;
  max-height: 55vh;
  width: auto;
  height: auto;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
}
.crop-selection {
  position: absolute;
  border: 2px solid var(--color-accent);
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.55);
  cursor: move;
  touch-action: none;
  box-sizing: border-box;
}
.crop-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(to right, rgba(255, 255, 255, 0.35) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255, 255, 255, 0.35) 1px, transparent 1px);
  background-size: 33.333% 33.333%;
}
.crop-handle {
  position: absolute;
  width: 14px;
  height: 14px;
  background: var(--color-accent);
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
  z-index: 2;
  box-sizing: border-box;
}
.crop-handle-nw { top: 3px; left: 3px; cursor: nwse-resize; }
.crop-handle-n  { top: 3px; left: 50%; margin-left: -7px; cursor: ns-resize; }
.crop-handle-ne { top: 3px; right: 3px; cursor: nesw-resize; }
.crop-handle-e  { top: 50%; right: 3px; margin-top: -7px; cursor: ew-resize; }
.crop-handle-se { bottom: 3px; right: 3px; cursor: nwse-resize; }
.crop-handle-s  { bottom: 3px; left: 50%; margin-left: -7px; cursor: ns-resize; }
.crop-handle-sw { bottom: 3px; left: 3px; cursor: nesw-resize; }
.crop-handle-w  { top: 50%; left: 3px; margin-top: -7px; cursor: ew-resize; }

@media (max-width: 640px) {
  .crop-handle {
    width: 18px;
    height: 18px;
  }
  .crop-handle-nw { top: 4px; left: 4px; }
  .crop-handle-n  { top: 4px; margin-left: -9px; }
  .crop-handle-ne { top: 4px; right: 4px; }
  .crop-handle-e  { right: 4px; margin-top: -9px; }
  .crop-handle-se { bottom: 4px; right: 4px; }
  .crop-handle-s  { bottom: 4px; margin-left: -9px; }
  .crop-handle-sw { bottom: 4px; left: 4px; }
  .crop-handle-w  { left: 4px; margin-top: -9px; }
}
</style>

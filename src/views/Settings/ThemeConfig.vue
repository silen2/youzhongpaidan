<template>
  <div class="theme-config space-y-5">
    <!-- Preset Themes -->
    <section class="glass-card settings-card">
      <div class="glass-card-header">
        <div>
          <h2 class="glass-section-title">预设主题</h2>
          <p class="glass-section-subtitle">一键切换应用配色方案</p>
        </div>
      </div>
      <div class="glass-card-body">
        <div class="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <button
            v-for="preset in theme.presets"
            :key="preset.id"
            @click="theme.setTheme(preset.id)"
            class="theme-preset-card group"
            :class="{ 'theme-preset-active': theme.currentTheme === preset.id }"
          >
            <div
              class="theme-preset-preview"
              :style="{ background: preset.preview }"
            >
              <div
                class="theme-preset-accent"
                :style="{ backgroundColor: preset.accent }"
              />
            </div>
            <span class="theme-preset-label">{{ preset.name }}</span>
            <Check v-if="theme.currentTheme === preset.id" class="theme-preset-check" />
          </button>
        </div>
      </div>
    </section>

    <!-- Custom Background -->
    <section class="glass-card settings-card">
      <div class="glass-card-header">
        <div>
          <h2 class="glass-section-title">自定义背景</h2>
          <p class="glass-section-subtitle">上传图片并裁剪显示区域，自动适配文字颜色</p>
        </div>
        <button class="glass-btn glass-btn-ghost glass-btn-sm" @click="resetToDefault">
          <component :is="RotateCcw" class="w-3.5 h-3.5" />
          恢复默认
        </button>
      </div>
      <div class="glass-card-body">
        <div class="bg-layout">
          <!-- Preview + Actions -->
          <div class="bg-preview-side">
            <div
              class="preview-thumbnail"
              :class="{ 'preview-empty': !theme.customBackground }"
            >
              <img
                v-if="theme.customBackground"
                :src="theme.customBackground"
                alt="Background preview"
                class="preview-img"
              />
              <div v-else class="preview-placeholder">
                <ImageIcon class="w-8 h-8 mx-auto mb-2 opacity-50" />
                <span class="glass-caption">暂无背景</span>
              </div>
            </div>

            <input
              ref="fileInput"
              type="file"
              accept="image/*"
              class="hidden"
              @change="handleFileUpload"
            />
            <div class="flex gap-2 flex-wrap">
              <button
                class="glass-btn glass-btn-primary"
                @click="fileInput?.click()"
              >
                <Upload class="w-4 h-4" />
                上传图片
              </button>
              <button
                v-if="theme.originalBackground"
                class="glass-btn glass-btn-outline"
                @click="openCropModal"
              >
                <Crop class="w-4 h-4" />
                调整裁剪
              </button>
              <button
                v-if="theme.customBackground"
                class="glass-btn glass-btn-outline"
                @click="removeBackground"
              >
                <Trash2 class="w-4 h-4" />
                移除
              </button>
            </div>
            <p class="glass-caption">
              支持 JPG / PNG / WebP，建议分辨率不低于 1920×1080。
            </p>
          </div>

          <!-- Settings -->
          <div class="bg-settings-side">
            <div v-if="!theme.customBackground" class="bg-empty-hint">
              <ImageIcon class="w-7 h-7 opacity-40" />
              <p class="glass-caption">上传图片后可在此调整亮度检测、遮罩透明度与启用状态</p>
            </div>

            <template v-if="theme.customBackground">
              <!-- Brightness Detection -->
              <div class="setting-block">
                <div class="setting-block-head">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="setting-label">背景亮度检测</span>
                    <span
                      v-if="theme.detectedIsLight !== null"
                      class="glass-badge"
                      :class="theme.detectedIsLight ? 'glass-badge-warning' : 'glass-badge-primary'"
                    >
                      <component :is="theme.detectedIsLight ? Sun : Moon" class="w-3 h-3" />
                      {{ theme.detectedIsLight ? '检测为亮色' : '检测为暗色' }}
                    </span>
                    <span v-else class="glass-caption">检测中...</span>
                  </div>
                  <button
                    class="glass-btn glass-btn-ghost glass-btn-sm"
                    @click="reDetectBrightness"
                    title="重新检测"
                  >
                    <RefreshCw class="w-3.5 h-3.5" />
                    重新检测
                  </button>
                </div>
                <div class="manual-row">
                  <span class="glass-body-sm font-medium">手动覆盖</span>
                  <label class="glass-toggle">
                    <input
                      type="checkbox"
                      class="glass-toggle-input"
                      :checked="theme.manualOverrideEnabled"
                      @change="toggleManualOverride"
                    />
                    <span class="glass-toggle-track"></span>
                    <span class="glass-toggle-thumb"></span>
                  </label>
                  <template v-if="theme.manualOverrideEnabled">
                    <span class="glass-caption">文字颜色</span>
                    <button
                      class="glass-btn glass-btn-sm"
                      :class="{ 'glass-btn-primary': theme.manualForcedLight, 'glass-btn-outline': !theme.manualForcedLight }"
                      @click="setManualDark"
                    >
                      <Moon class="w-3.5 h-3.5" />
                      深色字
                    </button>
                    <button
                      class="glass-btn glass-btn-sm"
                      :class="{ 'glass-btn-primary': !theme.manualForcedLight, 'glass-btn-outline': theme.manualForcedLight }"
                      @click="setManualLight"
                    >
                      <Sun class="w-3.5 h-3.5" />
                      浅色字
                    </button>
                  </template>
                  <span v-else class="glass-caption">自动检测</span>
                </div>
              </div>

              <!-- Overlay Opacity -->
              <div class="setting-block">
                <div class="setting-block-head">
                  <span class="setting-label">遮罩透明度</span>
                  <span class="glass-caption">{{ Math.round(theme.overlayOpacity * 100) }}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  :value="theme.overlayOpacity"
                  @input="handleOpacityChange"
                  class="opacity-slider"
                />
                <div class="flex gap-1 mt-2 flex-wrap">
                  <button
                    v-for="v in [0.3, 0.5, 0.7, 0.9]"
                    :key="v"
                    @click="theme.setOverlayOpacity(v)"
                    class="opacity-preset"
                    :class="{ 'opacity-preset-active': Math.abs(theme.overlayOpacity - v) < 0.01 }"
                  >
                    {{ Math.round(v * 100) }}%
                  </button>
                </div>
                <p class="glass-caption mt-2">
                  遮罩层保证背景图片上的文字清晰可读，值越高文字越清晰。
                </p>
              </div>

              <!-- Enable Toggle -->
              <div class="setting-block setting-block-row">
                <div class="min-w-0">
                  <span class="setting-label">启用自定义背景</span>
                  <p class="glass-caption">{{ theme.useCustomBg ? '已启用，使用自定义图片' : '已停用，使用主题渐变背景' }}</p>
                </div>
                <label
                  class="glass-toggle"
                  :title="theme.useCustomBg ? '已启用，点击停用' : '已停用，点击启用'"
                >
                  <input
                    type="checkbox"
                    class="glass-toggle-input"
                    :checked="theme.useCustomBg"
                    @change="theme.toggleCustomBackground(!theme.useCustomBg)"
                  />
                  <span class="glass-toggle-track"></span>
                  <span class="glass-toggle-thumb"></span>
                </label>
              </div>
            </template>
          </div>
        </div>
      </div>
    </section>

    <!-- 自定义头图（品牌位 + 浏览器图标） -->
    <BrandImageConfig />

    <!-- Background Crop Modal -->
    <div v-if="showCropModal" class="glass-overlay" @click.self="cancelCrop">
      <div class="glass-modal glass-modal-lg">
        <div class="glass-modal-header">
          <h3 class="glass-modal-title">调整背景显示区域</h3>
          <button class="glass-btn glass-btn-ghost glass-btn-sm" @click="cancelCrop" title="取消">
            <X class="w-4 h-4" />
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
              v-if="theme.originalBackground"
              :src="theme.originalBackground"
              class="crop-image"
              draggable="false"
              alt="待裁剪背景"
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
            拖动方框选择要显示的背景区域，拖动八个边角可调整大小。选定区域将铺满整个屏幕。
          </p>
        </div>
        <div class="glass-modal-footer">
          <button class="glass-btn glass-btn-outline" @click="cancelCrop">取消</button>
          <button class="glass-btn glass-btn-primary" @click="applyCrop">
            <Check class="w-4 h-4" />
            应用
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from 'vue'
import { Check, Upload, Trash2, Image as ImageIcon, RotateCcw, Sun, Moon, RefreshCw, Crop, X } from '@lucide/vue'
import { useThemeStore, type CropRegion } from '@/stores/theme'
import BrandImageConfig from './BrandImageConfig.vue'

const theme = useThemeStore()
const fileInput = ref<HTMLInputElement | null>(null)

function handleFileUpload(event: Event) {
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
    if (dataUrl) {
      // Reset manual override when uploading new image
      theme.setManualOverride(false)
      await theme.setCustomBackground(dataUrl)
      // Open the crop modal so the user can pick which part to display
      openCropModal()
    }
  }
  reader.readAsDataURL(file)
  target.value = ''
}

function removeBackground() {
  theme.setManualOverride(false)
  theme.setCustomBackground(null)
}

function handleOpacityChange(event: Event) {
  const target = event.target as HTMLInputElement
  theme.setOverlayOpacity(parseFloat(target.value))
}

function toggleManualOverride() {
  theme.setManualOverride(
    !theme.manualOverrideEnabled,
    theme.manualOverrideEnabled ? false : !theme.isLightBackground
  )
}

function setManualDark() {
  // Dark text = light background (isLight = true means text is dark)
  theme.setManualOverride(true, true)
}

function setManualLight() {
  // Light text = dark background (isLight = false means text is light)
  theme.setManualOverride(true, false)
}

async function reDetectBrightness() {
  if (theme.customBackground) {
    const isLight = await theme.detectImageBrightness(theme.customBackground)
    theme.detectedIsLight = isLight
    if (!theme.manualOverrideEnabled) {
      theme.applyTheme()
    }
  }
}

function resetToDefault() {
  if (confirm('确定要恢复默认主题设置吗？这将重置所有外观配置。')) {
    theme.resetToDefault()
  }
}

// ===== Background crop modal =====
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
  if (!theme.originalBackground) return
  const r = theme.cropRegion ?? { x: 0, y: 0, w: 1, h: 1 }
  cropRect.x = r.x
  cropRect.y = r.y
  cropRect.w = r.w
  cropRect.h = r.h
  showCropModal.value = true
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
  await theme.applyCrop({ ...cropRect })
  showCropModal.value = false
}

function cancelCrop() {
  showCropModal.value = false
}
</script>

<style scoped>
/* ===== Preset Themes ===== */
.theme-preset-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  padding: 0.625rem 0.375rem;
  background: var(--glass-bg);
  border: 2px solid transparent;
  border-radius: 0.75rem;
  transition: all 0.2s ease;
  cursor: pointer;
}
.theme-preset-card:hover {
  background: var(--glass-bg-hover);
  transform: translateY(-2px);
}
.theme-preset-active {
  border-color: var(--color-accent);
  box-shadow: 0 0 12px var(--color-accent-glow);
}
.theme-preset-preview {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 0.5rem;
  position: relative;
  overflow: hidden;
  border: 1px solid var(--glass-border);
}
.theme-preset-accent {
  position: absolute;
  bottom: 0.375rem;
  right: 0.375rem;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  box-shadow: 0 0 6px currentColor;
}
.theme-preset-label {
  font-size: 0.7rem;
  color: var(--color-text-secondary);
  white-space: nowrap;
}
.theme-preset-active .theme-preset-label {
  color: var(--color-accent);
  font-weight: 500;
}
.theme-preset-check {
  position: absolute;
  top: 0.375rem;
  left: 0.375rem;
  width: 1rem;
  height: 1rem;
  color: var(--color-accent);
  filter: drop-shadow(0 0 4px currentColor);
}

/* ===== Background Two-Column Layout ===== */
.bg-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-6);
  align-items: start;
}
@media (min-width: 880px) {
  .bg-layout {
    grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
  }
}
.bg-preview-side {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.bg-settings-side {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* ===== Background Preview ===== */
.preview-thumbnail {
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: var(--radius-lg);
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
}
.preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.preview-empty {
  display: flex;
  align-items: center;
  justify-content: center;
}
.preview-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--color-text-muted);
}

.bg-empty-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  text-align: center;
  padding: var(--space-12) var(--space-4);
  border: 1px dashed var(--glass-border);
  border-radius: var(--radius-lg);
  min-height: 220px;
}

/* ===== Setting Blocks ===== */
.setting-block {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border-soft);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
}
.setting-block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
  flex-wrap: wrap;
}
.setting-block > .opacity-slider + .flex,
.setting-block > .opacity-slider {
  margin-top: 0;
}
.setting-label {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text-secondary);
}
.setting-block-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
.manual-row {
  display: flex;
  align-items: center;
  gap: var(--space-2) var(--space-3);
  flex-wrap: wrap;
}

/* ===== Opacity Slider ===== */
.opacity-slider {
  width: 100%;
  height: 4px;
  appearance: none;
  background: var(--glass-border);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}
.opacity-slider::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-accent);
  box-shadow: 0 0 8px var(--color-accent-glow);
  cursor: pointer;
  border: 2px solid white;
}
.opacity-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-accent);
  box-shadow: 0 0 8px var(--color-accent-glow);
  cursor: pointer;
  border: 2px solid white;
}

.opacity-preset {
  padding: 0.25rem 0.625rem;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  transition: all 0.15s ease;
  cursor: pointer;
}
.opacity-preset:hover {
  background: var(--glass-bg-hover);
  color: var(--color-text);
}
.opacity-preset-active {
  background: var(--color-accent-soft);
  color: var(--color-accent);
  border-color: var(--color-accent-glow);
}

/* ===== Background Crop Modal ===== */
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

<template>
  <Teleport to="body">
    <transition name="image-preview-fade">
      <div v-if="url" class="image-preview-overlay" @click.self="close">
        <img :src="url" class="image-preview-img" alt="预览" @click="close" />
        <button type="button" class="image-preview-close" title="关闭" aria-label="关闭预览" @click="close">
          <X class="w-5 h-5" />
        </button>
      </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
import { watch, onBeforeUnmount } from 'vue'
import { X } from '@lucide/vue'

const props = defineProps<{ url: string | null }>()
const emit = defineEmits<{ close: [] }>()

function close() {
  emit('close')
}

// Esc 关闭 + 打开时锁定 body 滚动（避免遮罩下层页面滚动）
watch(
  () => props.url,
  (url) => {
    if (url) {
      document.addEventListener('keydown', onKeydown)
      document.body.style.overflow = 'hidden'
    } else {
      document.removeEventListener('keydown', onKeydown)
      document.body.style.overflow = ''
    }
  },
)

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<style scoped>
.image-preview-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 8, 25, 0.78);
  backdrop-filter: blur(6px);
  padding: clamp(1rem, 4vw, 3rem);
  cursor: zoom-out;
}
.image-preview-img {
  max-width: 92vw;
  max-height: 88vh;
  border-radius: var(--radius-lg);
  box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5);
  cursor: zoom-out;
  object-fit: contain;
}
.image-preview-close {
  position: absolute;
  top: clamp(0.75rem, 2vw, 1.5rem);
  right: clamp(0.75rem, 2vw, 1.5rem);
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--glass-border);
  background: var(--glass-bg-strong);
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.15s ease;
}
.image-preview-close:hover {
  color: var(--color-danger);
  background: var(--color-danger-soft);
}
.image-preview-fade-enter-active,
.image-preview-fade-leave-active {
  transition: opacity 0.18s ease;
}
.image-preview-fade-enter-from,
.image-preview-fade-leave-to {
  opacity: 0;
}
</style>

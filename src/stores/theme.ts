import { defineStore, acceptHMRUpdate } from 'pinia'
import { ref, computed, watch } from 'vue'
import {
  hexToRgba,
  detectImageBrightness,
  downscaleImage,
  cropImage,
  type CropRegion,
} from '@/utils/image-processing'

// 重新导出 CropRegion，兼容既有 `import { type CropRegion } from '@/stores/theme'`
export type { CropRegion }

export type ThemeName =
  | 'aurora-blue'
  | 'aurora-green'
  | 'sunset-orange'
  | 'twilight-purple'
  | 'sakura-pink'
  | 'cyber-cyan'
  | 'paper-white'
  | 'bright-yellow'
  | 'girl-pink'
  | 'soft-green'
  | 'lively-blue'

export interface ThemePreset {
  id: ThemeName
  name: string
  isLight: boolean
  /** 背景渐变 → --color-bg-gradient */
  bgGradient: string
  /** 背景实色 → --color-bg（兼作自定义背景遮罩基色） */
  bgSolid: string
  /** 主强调色 → --color-accent（UI 预览也复用） */
  accent: string
  /** 强调色 hover → --color-accent-hover */
  accentHover: string
  /** 强调色辉光 → --color-accent-glow */
  accentGlow: string
  /** 强调色柔和背景 → --color-accent-soft */
  accentSoft: string
  /** 成功色 → --color-success */
  success: string
  /** 警告色 → --color-warning */
  warning: string
  /** 危险色 → --color-danger */
  danger: string
  /** UI 预览渐变（非 CSS 变量，仅供 ThemeConfig 预览块使用） */
  preview: string
}

const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'aurora-blue',
    name: '深空蓝',
    isLight: false,
    bgGradient: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
    bgSolid: '#0f0c29',
    accent: '#818cf8',
    accentHover: '#6366f1',
    accentGlow: 'rgba(129, 140, 248, 0.5)',
    accentSoft: 'rgba(129, 140, 248, 0.15)',
    success: '#34d399',
    warning: '#fbbf24',
    danger: '#f87171',
    preview: 'linear-gradient(135deg, #0f0c29, #302b63)',
  },
  {
    id: 'aurora-green',
    name: '极光绿',
    isLight: false,
    bgGradient: 'linear-gradient(135deg, #0a2a2e 0%, #0d3b3e 50%, #1a5a52 100%)',
    bgSolid: '#0a2a2e',
    accent: '#34d399',
    accentHover: '#10b981',
    accentGlow: 'rgba(52, 211, 153, 0.5)',
    accentSoft: 'rgba(52, 211, 153, 0.15)',
    success: '#34d399',
    warning: '#fbbf24',
    danger: '#f87171',
    preview: 'linear-gradient(135deg, #0a2a2e, #0d3b3e)',
  },
  {
    id: 'sunset-orange',
    name: '日落橙',
    isLight: false,
    bgGradient: 'linear-gradient(135deg, #2d1b3d 0%, #4a2040 50%, #6b2d3f 100%)',
    bgSolid: '#2d1b3d',
    accent: '#fb923c',
    accentHover: '#f97316',
    accentGlow: 'rgba(251, 146, 60, 0.5)',
    accentSoft: 'rgba(251, 146, 60, 0.15)',
    success: '#4ade80',
    warning: '#facc15',
    danger: '#f87171',
    preview: 'linear-gradient(135deg, #2d1b3d, #4a2040)',
  },
  {
    id: 'twilight-purple',
    name: '暮色紫',
    isLight: false,
    bgGradient: 'linear-gradient(135deg, #1a0b2e 0%, #3d1f5c 50%, #2d1b4e 100%)',
    bgSolid: '#1a0b2e',
    accent: '#c084fc',
    accentHover: '#a855f7',
    accentGlow: 'rgba(192, 132, 252, 0.5)',
    accentSoft: 'rgba(192, 132, 252, 0.15)',
    success: '#34d399',
    warning: '#fbbf24',
    danger: '#f87171',
    preview: 'linear-gradient(135deg, #1a0b2e, #3d1f5c)',
  },
  {
    id: 'sakura-pink',
    name: '樱花粉',
    isLight: false,
    bgGradient: 'linear-gradient(135deg, #2d1a2e 0%, #5c2e4e 50%, #3d1a3d 100%)',
    bgSolid: '#2d1a2e',
    accent: '#f9a8d4',
    accentHover: '#ec4899',
    accentGlow: 'rgba(249, 168, 212, 0.5)',
    accentSoft: 'rgba(249, 168, 212, 0.15)',
    success: '#34d399',
    warning: '#fbbf24',
    danger: '#f87171',
    preview: 'linear-gradient(135deg, #2d1a2e, #5c2e4e)',
  },
  {
    id: 'cyber-cyan',
    name: '赛博青',
    isLight: false,
    bgGradient: 'linear-gradient(135deg, #0a1628 0%, #0d2944 50%, #0a3040 100%)',
    bgSolid: '#0a1628',
    accent: '#22d3ee',
    accentHover: '#06b6d4',
    accentGlow: 'rgba(34, 211, 238, 0.5)',
    accentSoft: 'rgba(34, 211, 238, 0.15)',
    success: '#34d399',
    warning: '#fbbf24',
    danger: '#f87171',
    preview: 'linear-gradient(135deg, #0a1628, #0d2944)',
  },
  {
    id: 'paper-white',
    name: '纯白',
    isLight: true,
    bgGradient: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 50%, #f0f2f5 100%)',
    bgSolid: '#ffffff',
    accent: '#4f46e5',
    accentHover: '#4338ca',
    accentGlow: 'rgba(79, 70, 229, 0.4)',
    accentSoft: 'rgba(79, 70, 229, 0.12)',
    success: '#059669',
    warning: '#d97706',
    danger: '#dc2626',
    preview: 'linear-gradient(135deg, #ffffff, #f8f9fa)',
  },
  {
    id: 'bright-yellow',
    name: '明亮黄',
    isLight: true,
    bgGradient: 'linear-gradient(135deg, #fffde7 0%, #fff9c4 50%, #fff59d 100%)',
    bgSolid: '#fffde7',
    accent: '#ca8a04',
    accentHover: '#a16207',
    accentGlow: 'rgba(202, 138, 4, 0.4)',
    accentSoft: 'rgba(202, 138, 4, 0.12)',
    success: '#059669',
    warning: '#d97706',
    danger: '#dc2626',
    preview: 'linear-gradient(135deg, #fffde7, #fff9c4)',
  },
  {
    id: 'girl-pink',
    name: '少女粉',
    isLight: true,
    bgGradient: 'linear-gradient(135deg, #fce4ec 0%, #f8bbd0 50%, #f48fb1 100%)',
    bgSolid: '#fce4ec',
    accent: '#db2777',
    accentHover: '#be185d',
    accentGlow: 'rgba(219, 39, 119, 0.4)',
    accentSoft: 'rgba(219, 39, 119, 0.12)',
    success: '#059669',
    warning: '#d97706',
    danger: '#dc2626',
    preview: 'linear-gradient(135deg, #fce4ec, #f8bbd0)',
  },
  {
    id: 'soft-green',
    name: '轻柔绿',
    isLight: true,
    bgGradient: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 50%, #a5d6a7 100%)',
    bgSolid: '#e8f5e9',
    accent: '#16a34a',
    accentHover: '#15803d',
    accentGlow: 'rgba(22, 163, 74, 0.4)',
    accentSoft: 'rgba(22, 163, 74, 0.12)',
    success: '#059669',
    warning: '#d97706',
    danger: '#dc2626',
    preview: 'linear-gradient(135deg, #e8f5e9, #c8e6c9)',
  },
  {
    id: 'lively-blue',
    name: '灵动蓝',
    isLight: true,
    bgGradient: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 50%, #90caf9 100%)',
    bgSolid: '#e3f2fd',
    accent: '#2563eb',
    accentHover: '#1d4ed8',
    accentGlow: 'rgba(37, 99, 235, 0.4)',
    accentSoft: 'rgba(37, 99, 235, 0.12)',
    success: '#059669',
    warning: '#d97706',
    danger: '#dc2626',
    preview: 'linear-gradient(135deg, #e3f2fd, #bbdefb)',
  },
]

const STORAGE_KEY = 'hetong-theme-settings'

interface ThemeSettings {
  theme: ThemeName
  backgroundImage: string | null
  overlayOpacity: number
  useCustomBackground: boolean
  detectedIsLight: boolean | null
  /** 自定义头图（侧边栏品牌位 + 浏览器图标）；null 表示使用内置默认图 */
  customBrandImage: string | null
}

function loadFromStorage(): ThemeSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    // ignore
  }
  return {
    theme: 'aurora-blue',
    backgroundImage: null,
    overlayOpacity: 0.6,
    useCustomBackground: false,
    detectedIsLight: null,
    customBrandImage: null,
  }
}

export const useThemeStore = defineStore('theme', () => {
  const saved = loadFromStorage()

  const currentTheme = ref<ThemeName>(saved.theme)
  const customBackground = ref<string | null>(saved.backgroundImage)
  // Original (un-cropped) image kept in-memory so the user can re-crop within a session.
  // Not persisted to avoid doubling localStorage usage; reload resets to the cropped result.
  const originalBackground = ref<string | null>(null)
  const cropRegion = ref<CropRegion | null>(null)
  const overlayOpacity = ref<number>(saved.overlayOpacity)
  const useCustomBg = ref<boolean>(saved.useCustomBackground)
  const detectedIsLight = ref<boolean | null>(saved.detectedIsLight)
  // 自定义头图：null 表示使用内置默认图（public/brand-logo.jpg）
  const customBrandImage = ref<string | null>(saved.customBrandImage ?? null)

  // Manual override state
  const manualOverrideEnabled = ref(false)
  const manualForcedLight = ref(false)  // true = force light text (dark bg), false = force dark text (light bg)

  const presets = computed(() => THEME_PRESETS)

  const currentPreset = computed(() =>
    THEME_PRESETS.find((t) => t.id === currentTheme.value) ?? THEME_PRESETS[0]
  )

  const isLightBackground = computed(() => {
    // 手动覆盖优先
    if (manualOverrideEnabled.value) {
      return manualForcedLight.value
    }
    // 文字配色跟随主题：自定义背景的 overlay 使用主题 bgSolid 着色，
    // 会把图像拉向主题亮度（暗主题→暗、亮主题→亮），故文字方案应与主题一致。
    // detectedIsLight 仍被检测并展示在 UI，供用户判断是否需要手动覆盖，但不再驱动文字方案。
    return currentPreset.value.isLight
  })

  const backgroundCssValue = computed(() => {
    if (useCustomBg.value && customBackground.value) {
      return `url(${customBackground.value})`
    }
    return 'none'
  })

  const overlayCssValue = computed(() => {
    if (useCustomBg.value && customBackground.value) {
      // overlay 始终用主题 bgSolid 着色：暗色主题→暗色遮罩（图像变暗），
      // 亮色主题→亮色遮罩（图像变亮）。保留主题色彩身份，
      // 避免"亮图 + 暗主题"被白色遮罩强制变亮（旧 bug：切换深空蓝后背景仍为白色）。
      return hexToRgba(currentPreset.value.bgSolid, overlayOpacity.value)
    }
    return 'none'
  })

  function applyTheme() {
    const root = document.documentElement
    // data-theme 仅作 devtools 调试标识，CSS 不再依赖它（token 由运行时注入）
    root.setAttribute('data-theme', currentTheme.value)

    // ===== 运行时注入主题 token（store 为唯一数据源）=====
    // 覆盖 style.css 的 :root 默认值与 [data-theme] 块（后续步骤将删除后者）
    const preset = currentPreset.value
    root.style.setProperty('--color-bg-gradient', preset.bgGradient)
    root.style.setProperty('--color-bg', preset.bgSolid)
    root.style.setProperty('--color-accent', preset.accent)
    root.style.setProperty('--color-accent-hover', preset.accentHover)
    root.style.setProperty('--color-accent-glow', preset.accentGlow)
    root.style.setProperty('--color-accent-soft', preset.accentSoft)
    root.style.setProperty('--color-success', preset.success)
    root.style.setProperty('--color-warning', preset.warning)
    root.style.setProperty('--color-danger', preset.danger)

    // Apply text/material color scheme based on light/dark background
    // 由 CSS [data-text-scheme] 选择器接管，JS 仅切换属性
    root.setAttribute('data-text-scheme', isLightBackground.value ? 'light' : 'dark')

    // Apply background image or gradient
    if (useCustomBg.value && customBackground.value) {
      root.style.setProperty('--user-bg-image', backgroundCssValue.value)
      root.style.setProperty('--user-bg-overlay', overlayCssValue.value)
      root.style.setProperty('--user-bg-overlay-opacity', '1')
    } else {
      root.style.removeProperty('--user-bg-image')
      root.style.removeProperty('--user-bg-overlay')
      root.style.removeProperty('--user-bg-overlay-opacity')
    }
  }

  function setTheme(theme: ThemeName) {
    currentTheme.value = theme
    // Don't reset detection when custom background is active —
    // the detected brightness is a property of the image, not the theme
    if (!useCustomBg.value || !customBackground.value) {
      detectedIsLight.value = null
    }
    applyTheme()
  }

  async function setCustomBackground(imageDataUrl: string | null) {
    if (imageDataUrl) {
      // Downscale the uploaded original for efficient storage and use as the
      // initial full-image background. The crop modal can refine it afterwards.
      let processed = imageDataUrl
      try {
        processed = await downscaleImage(imageDataUrl)
      } catch {
        processed = imageDataUrl
      }
      originalBackground.value = processed
      cropRegion.value = { x: 0, y: 0, w: 1, h: 1 }
      customBackground.value = processed
      useCustomBg.value = true
      // Reset manual override so auto-detection takes effect
      manualOverrideEnabled.value = false
      // Auto-detect background brightness
      try {
        const isLight = await detectImageBrightness(processed)
        detectedIsLight.value = isLight
      } catch {
        detectedIsLight.value = false
      }
    } else {
      customBackground.value = null
      originalBackground.value = null
      cropRegion.value = null
      useCustomBg.value = false
      detectedIsLight.value = null
    }
    applyTheme()
  }

  /**
   * Re-crop the original background image to the given normalized region.
   * The cropped result becomes the displayed background.
   */
  async function applyCrop(region: CropRegion) {
    if (!originalBackground.value) return
    cropRegion.value = region
    try {
      const cropped = await cropImage(originalBackground.value, region)
      customBackground.value = cropped
      // Re-detect brightness on the cropped region (may differ from full image)
      const isLight = await detectImageBrightness(cropped)
      detectedIsLight.value = isLight
    } catch {
      // keep previous background if cropping fails
    }
    applyTheme()
  }

  function setOverlayOpacity(opacity: number) {
    overlayOpacity.value = Math.max(0, Math.min(1, opacity))
    if (useCustomBg.value && customBackground.value) {
      applyTheme()
    }
  }

  function toggleCustomBackground(enabled: boolean) {
    useCustomBg.value = enabled
    applyTheme()
  }

  function setManualOverride(enabled: boolean, forceLight: boolean = false) {
    manualOverrideEnabled.value = enabled
    manualForcedLight.value = forceLight
    applyTheme()
  }

  /**
   * 设置自定义头图（null 恢复内置默认图）。
   * 无需 applyTheme：头图由 App.vue 响应式读取并同步 favicon。
   */
  function setCustomBrandImage(dataUrl: string | null) {
    customBrandImage.value = dataUrl
  }

  function resetToDefault() {
    currentTheme.value = 'aurora-blue'
    customBackground.value = null
    originalBackground.value = null
    cropRegion.value = null
    overlayOpacity.value = 0.6
    useCustomBg.value = false
    detectedIsLight.value = null
    manualOverrideEnabled.value = false
    manualForcedLight.value = false
    customBrandImage.value = null
    applyTheme()
  }

  // Persist to localStorage
  watch(
    [currentTheme, customBackground, overlayOpacity, useCustomBg, detectedIsLight, customBrandImage],
    () => {
      try {
        const settings: ThemeSettings = {
          theme: currentTheme.value,
          backgroundImage: customBackground.value,
          overlayOpacity: overlayOpacity.value,
          useCustomBackground: useCustomBg.value,
          detectedIsLight: detectedIsLight.value,
          customBrandImage: customBrandImage.value,
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
      } catch {
        // storage full or unavailable, ignore
      }
    },
    { deep: true }
  )

  // Initialize theme on store creation
  applyTheme()

  // If custom background is set but detection is pending (null), re-run detection
  if (useCustomBg.value && customBackground.value && detectedIsLight.value === null) {
    detectImageBrightness(customBackground.value)
      .then((isLight) => {
        detectedIsLight.value = isLight
        applyTheme()
      })
      .catch(() => {
        detectedIsLight.value = false
        applyTheme()
      })
  }

  return {
    // State
    currentTheme,
    customBackground,
    originalBackground,
    cropRegion,
    overlayOpacity,
    useCustomBg,
    detectedIsLight,
    manualOverrideEnabled,
    manualForcedLight,
    customBrandImage,
    // Getters
    presets,
    currentPreset,
    isLightBackground,
    // Actions
    setTheme,
    setCustomBackground,
    applyCrop,
    setOverlayOpacity,
    toggleCustomBackground,
    setManualOverride,
    setCustomBrandImage,
    resetToDefault,
    applyTheme,
    detectImageBrightness,
  }
})

// 让 HMR 能热更新 store 逻辑（避免改 store 后旧实例闭包残留，需硬刷新才生效）
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useThemeStore, import.meta.hot))
}
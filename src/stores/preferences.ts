import { defineStore } from 'pinia'
import { ref } from 'vue'
import { DEFAULT_PREFERENCES, sanitizePreferences, type AppPreferences } from '@/domain/config/app-preferences'

const STORAGE_KEY = 'hetong-app-preferences'

export function loadPreferences(): AppPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return sanitizePreferences(JSON.parse(raw))
  } catch {
    // 损坏数据忽略
  }
  return { ...DEFAULT_PREFERENCES }
}

export function savePreferences(p: AppPreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {
    // 配额错误忽略
  }
}

export const usePreferencesStore = defineStore('preferences', () => {
  const preferences = ref<AppPreferences>(loadPreferences())

  function update(patch: Partial<AppPreferences>) {
    preferences.value = sanitizePreferences({ ...preferences.value, ...patch })
    savePreferences(preferences.value)
  }

  function reset() {
    preferences.value = { ...DEFAULT_PREFERENCES }
    savePreferences(preferences.value)
  }

  return { preferences, update, reset }
})

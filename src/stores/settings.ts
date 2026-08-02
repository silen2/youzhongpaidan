import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { db, generateId, resetDatabase } from '@/db'
import { validateWeightConfig } from '@/domain/config/weight-config'
import { matchPreset } from '@/domain/config/weight-presets'
import type { Source, Category, CustomerType, Stage, WeightConfig, FollowUpType, Customer, Order } from '@/types'

/** 权重实时预览所需数据（store 只取数，不算权重；计算由 view 调领域纯函数完成） */
export interface WeightPreviewData {
  customerOrders: Order[]
  allCustomers: Customer[]
  allOrders: Order[]
}

export const useSettingsStore = defineStore('settings', () => {
  // State
  const sources = ref<Source[]>([])
  const categories = ref<Category[]>([])
  const customerTypes = ref<CustomerType[]>([])
  const stages = ref<Stage[]>([])
  const weightConfig = ref<WeightConfig | null>(null)
  const followUpTypes = ref<FollowUpType[]>([])
  const loading = ref(false)

  // Getters
  const enabledSources = computed(() => sources.value.filter(s => s.isEnabled))
  const enabledCategories = computed(() => categories.value.filter(c => c.isEnabled))
  const enabledCustomerTypes = computed(() => customerTypes.value.filter(c => c.isEnabled))
  const enabledFollowUpTypes = computed(() => followUpTypes.value.filter(t => t.isEnabled !== false))
  const systemStages = computed(() => stages.value.filter(s => s.type === 'system'))
  const customStages = computed(() => stages.value.filter(s => s.type === 'custom').sort((a, b) => a.position - b.position))
  const stagesByPosition = computed(() => [...stages.value].sort((a, b) => a.position - b.position))

  // Actions
  async function fetchSources() {
    loading.value = true
    try {
      sources.value = await db.sources.toArray()
    } finally {
      loading.value = false
    }
  }

  async function createSource(data: Omit<Source, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = new Date().toISOString()
    const newSource: Source = { ...data, id: generateId(), createdAt: now, updatedAt: now }
    await db.sources.add(newSource)
    await fetchSources()
    return newSource
  }

  async function updateSource(id: string, data: Partial<Source>) {
    await db.sources.update(id, { ...data, updatedAt: new Date().toISOString() })
    await fetchSources()
  }

  async function toggleSourceEnabled(id: string) {
    const source = await db.sources.get(id)
    if (source) {
      await updateSource(id, { isEnabled: !source.isEnabled })
    }
  }

  async function fetchCategories() {
    loading.value = true
    try {
      categories.value = await db.categories.toArray()
    } finally {
      loading.value = false
    }
  }

  async function createCategory(data: Omit<Category, 'id'>) {
    const newCategory: Category = { ...data, id: generateId() }
    await db.categories.add(newCategory)
    await fetchCategories()
    return newCategory
  }

  async function updateCategory(id: string, data: Partial<Category>) {
    await db.categories.update(id, data)
    await fetchCategories()
  }

  async function toggleCategoryEnabled(id: string) {
    const category = await db.categories.get(id)
    if (category) {
      await updateCategory(id, { isEnabled: !category.isEnabled })
    }
  }

  async function fetchCustomerTypes() {
    loading.value = true
    try {
      customerTypes.value = await db.customerTypes.toArray()
    } finally {
      loading.value = false
    }
  }

  async function createCustomerType(data: Omit<CustomerType, 'id'>) {
    const newType: CustomerType = { ...data, id: generateId() }
    await db.customerTypes.add(newType)
    await fetchCustomerTypes()
    return newType
  }

  async function updateCustomerType(id: string, data: Partial<CustomerType>) {
    await db.customerTypes.update(id, data)
    await fetchCustomerTypes()
  }

  async function toggleCustomerTypeEnabled(id: string) {
    const type = await db.customerTypes.get(id)
    if (type) {
      await updateCustomerType(id, { isEnabled: !type.isEnabled })
    }
  }

  async function fetchStages() {
    loading.value = true
    try {
      stages.value = await db.stages.toArray()
      // 兜底修正：旧数据新增阶段曾传 position=999 导致排到退单之后。
      // 检测到自定义阶段落在「完成/退单」之后时，按模板顺序重排并持久化。
      const pending = stages.value.find(s => s.id === 'st-pending')
      const done = stages.value.find(s => s.id === 'st-done')
      const pendingPos = pending ? pending.position : 0
      const donePos = done ? done.position : Infinity
      const hasMisplaced = stages.value.some(s => s.type === 'custom' && s.position >= donePos)
      if (hasMisplaced) {
        const customs = stages.value.filter(s => s.type === 'custom').sort((a, b) => a.position - b.position)
        const updates = customs.map((s, i) => db.stages.update(s.id, { position: pendingPos + 1 + i }))
        // 完成/退单固定排在自定义阶段之后
        if (done) updates.push(db.stages.update(done.id, { position: pendingPos + 1 + customs.length }))
        const voidStage = stages.value.find(s => s.id === 'st-void')
        if (voidStage) updates.push(db.stages.update(voidStage.id, { position: pendingPos + 2 + customs.length }))
        await Promise.all(updates)
        stages.value = await db.stages.toArray()
      }
    } finally {
      loading.value = false
    }
  }

  async function createStage(data: Omit<Stage, 'id' | 'position'> & { position?: number }) {
    // 新自定义阶段固定插入在「完成」（st-done）之前、最后一个自定义阶段之后：
    // 无视调用方传入的 position（StageConfig 曾传 999 导致排到退单后面），统一重算。
    const doneStage = stages.value.find(s => s.id === 'st-done')
    const customStagesSorted = customStages.value
    const lastCustomPos = customStagesSorted.length > 0
      ? customStagesSorted[customStagesSorted.length - 1].position
      : -1
    // 完成阶段的 position；无完成阶段时（异常数据）追加在末尾
    const donePos = doneStage ? doneStage.position : Infinity
    // 新阶段插在自定义阶段与完成阶段之间：取「最后一个自定义 + 1」与「完成」之间的空位；
    // 若完成阶段紧随其后（无空位），则把完成及之后阶段整体后移一位，给新阶段腾位置。
    let newPosition = lastCustomPos + 1
    if (donePos !== Infinity && newPosition >= donePos) {
      // 将完成阶段及之后的所有阶段后移一位
      const shifts = stages.value
        .filter(s => s.position >= donePos)
        .map(s => db.stages.update(s.id, { position: s.position + 1 }))
      await Promise.all(shifts)
      newPosition = donePos
    }

    const newStage: Stage = {
      ...data,
      id: generateId(),
      position: newPosition,
    }
    await db.stages.add(newStage)
    await fetchStages()
    return newStage
  }

  async function updateStage(id: string, data: Partial<Stage>) {
    await db.stages.update(id, data)
    await fetchStages()
  }

  async function deleteStage(id: string) {
    // Check if stage has any orders
    const orderCount = await db.orders
      .where('currentStage')
      .equals(id)
      .count()
    if (orderCount > 0) {
      throw new Error('该阶段存在正在进行中的订单，无法删除')
    }
    await db.stages.delete(id)
    await fetchStages()
  }

  async function moveStage(id: string, direction: 'up' | 'down') {
    const stage = stages.value.find(s => s.id === id)
    if (!stage || stage.type === 'system') return

    const customList = customStages.value
    const idx = customList.findIndex(s => s.id === id)

    if (direction === 'up' && idx > 0) {
      const prev = customList[idx - 1]
      await updateStage(id, { position: prev.position })
      await updateStage(prev.id, { position: stage.position })
    } else if (direction === 'down' && idx < customList.length - 1) {
      const next = customList[idx + 1]
      await updateStage(id, { position: next.position })
      await updateStage(next.id, { position: stage.position })
    }
  }

  async function fetchWeightConfig() {
    loading.value = true
    try {
      const config = await db.weightConfig.get(1)
      if (config && !config.activePreset) {
        // 旧 DB 行无 activePreset 字段：用 matchPreset 回填并持久化
        const presetId = matchPreset(config)
        weightConfig.value = { ...config, activePreset: presetId }
        await db.weightConfig.update(1, { activePreset: presetId })
      } else {
        weightConfig.value = config || null
      }
    } finally {
      loading.value = false
    }
  }

  async function saveWeightConfig(data: Omit<WeightConfig, 'id'>) {
    validateWeightConfig(data)

    if (weightConfig.value) {
      await db.weightConfig.update(1, data)
    } else {
      await db.weightConfig.add({ ...data, id: 1 })
    }
    await fetchWeightConfig()
  }

  /** 取实时预览所需数据（store 只取数；计算由 view 调 computeWeightFactors 完成） */
  async function fetchWeightPreviewData(customerId: string): Promise<WeightPreviewData> {
    const customerOrders = await db.orders
      .where('customerId')
      .equals(customerId)
      .toArray()
    const allCustomers = await db.customers.toArray()
    const allOrders = await db.orders.toArray()
    return { customerOrders, allCustomers, allOrders }
  }

  async function fetchFollowUpTypes() {
    loading.value = true
    try {
      followUpTypes.value = await db.followUpTypes.toArray()
    } finally {
      loading.value = false
    }
  }

  async function createFollowUpType(data: Omit<FollowUpType, 'id' | 'isPreset'>) {
    const newType: FollowUpType = { ...data, id: generateId(), isPreset: false, isEnabled: true }
    await db.followUpTypes.add(newType)
    await fetchFollowUpTypes()
    return newType
  }

  async function updateFollowUpType(id: string, data: Partial<FollowUpType>) {
    await db.followUpTypes.update(id, data)
    await fetchFollowUpTypes()
  }

  async function toggleFollowUpTypeEnabled(id: string) {
    const type = await db.followUpTypes.get(id)
    if (type) {
      await updateFollowUpType(id, { isEnabled: type.isEnabled !== false ? false : true })
    }
  }

  async function deleteFollowUpType(id: string) {
    const type = followUpTypes.value.find(t => t.id === id)
    if (type?.isPreset) {
      throw new Error('预置类型不可删除')
    }
    await db.followUpTypes.delete(id)
    await fetchFollowUpTypes()
  }

  /** 初始化：清除全部数据（业务数据 + 模板配置），随后由调用方刷新页面重建默认数据 */
  async function resetAllData() {
    await resetDatabase()
    // 内存态清空，等待页面刷新后由 initializeDb 重新写入默认模板
    sources.value = []
    categories.value = []
    customerTypes.value = []
    stages.value = []
    followUpTypes.value = []
    weightConfig.value = null
  }

  async function initAll() {
    loading.value = true
    try {
      await Promise.all([
        fetchSources(),
        fetchCategories(),
        fetchCustomerTypes(),
        fetchStages(),
        fetchWeightConfig(),
        fetchFollowUpTypes(),
      ])
    } finally {
      loading.value = false
    }
  }

  return {
    // State
    sources,
    categories,
    customerTypes,
    stages,
    weightConfig,
    followUpTypes,
    loading,
    // Getters
    enabledSources,
    enabledCategories,
    enabledCustomerTypes,
    enabledFollowUpTypes,
    systemStages,
    customStages,
    stagesByPosition,
    // Actions
    fetchSources,
    createSource,
    updateSource,
    toggleSourceEnabled,
    fetchCategories,
    createCategory,
    updateCategory,
    toggleCategoryEnabled,
    fetchCustomerTypes,
    createCustomerType,
    updateCustomerType,
    toggleCustomerTypeEnabled,
    fetchStages,
    createStage,
    updateStage,
    deleteStage,
    moveStage,
    fetchWeightConfig,
    saveWeightConfig,
    fetchWeightPreviewData,
    fetchFollowUpTypes,
    createFollowUpType,
    updateFollowUpType,
    toggleFollowUpTypeEnabled,
    deleteFollowUpType,
    resetAllData,
    initAll,
  }
})

import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Raid } from '@/types'
import { api } from '@/lib/api'

export const useRaidsStore = defineStore('raids', () => {
  const raids = ref<Raid[]>([])
  const loading = ref(false)

  async function load() {
    loading.value = true
    try {
      const data = await api.get<Raid[]>('/api/raids')
      raids.value = Array.isArray(data) ? data : []
    } catch (err) {
      console.error('Failed to load raids:', err)
      raids.value = []
    } finally {
      loading.value = false
    }
  }

  async function save(data: Partial<Raid>) {
    const result = await api.post<Raid>('/api/raids', data)
    await load()
    return result
  }

  async function remove(id: string) {
    await api.del(`/api/raids?id=${encodeURIComponent(id)}`)
    await load()
  }

  return { raids, loading, load, save, remove }
})

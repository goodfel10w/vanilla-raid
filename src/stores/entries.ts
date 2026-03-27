import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Entry } from '@/types'
import { api } from '@/lib/api'
import { migrateLegacyAvail } from '@/lib/utils'

export const useEntriesStore = defineStore('entries', () => {
  const entries = ref<Entry[]>([])
  const loading = ref(false)

  async function load() {
    loading.value = true
    try {
      const data = await api.get<Entry[]>('/api/entries')
      entries.value = (Array.isArray(data) ? data : []).map(e => ({
        ...e,
        availability: e.availability ? migrateLegacyAvail(e.availability) : {},
      }))
    } catch (err) {
      console.error('Failed to load entries:', err)
      entries.value = []
    } finally {
      loading.value = false
    }
  }

  async function save(data: Partial<Entry>) {
    const result = await api.post<Entry>('/api/entries', data)
    await load()
    return result
  }

  async function remove(id: string) {
    await api.del(`/api/entries?id=${encodeURIComponent(id)}`)
    await load()
  }

  async function unlinkUser(id: string) {
    await api.post('/api/entries', { action: 'unlink-user', id })
    await load()
  }

  return { entries, loading, load, save, remove, unlinkUser }
})

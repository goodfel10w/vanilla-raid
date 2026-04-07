import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Entry } from '@/types'
import { api } from '@/lib/api'
import { migrateLegacyAvail } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'

export const useEntriesStore = defineStore('entries', () => {
  const entries = ref<Entry[]>([])
  const loading = ref(false)

  const myEntries = computed(() => {
    const auth = useAuthStore()
    if (!auth.user) return []
    return entries.value.filter(e => e.userId === auth.user!.userId)
  })

  const mainEntry = computed(() => {
    const main = myEntries.value.find(e => e.isMain)
    return main || myEntries.value[0] || null
  })

  const myEntryCount = computed(() => myEntries.value.length)

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

  async function setMain(id: string) {
    const entry = entries.value.find(e => e.id === id)
    if (!entry) return
    await save({
      id: entry.id,
      charName: entry.charName,
      className: entry.className,
      specs: entry.specs,
      roles: entry.roles,
      availability: entry.availability,
      notes: entry.notes,
      isMain: true,
    })
  }

  return { entries, loading, myEntries, mainEntry, myEntryCount, load, save, remove, unlinkUser, setMain }
})

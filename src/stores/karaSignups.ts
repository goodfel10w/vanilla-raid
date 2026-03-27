import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { KaraSignup } from '@/types'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { weekKeyDate, getIdWeekStart, getIdWeekEnd } from '@/composables/useKaraPersistence'

export { weekKeyDate, getIdWeekStart, getIdWeekEnd }

export const useKaraSignupsStore = defineStore('karaSignups', () => {
  const signups = ref<KaraSignup[]>([])
  const loading = ref(false)
  const saving = ref(false)

  const weekOffset = ref(0)

  const currentWeekKey = computed(() => weekKeyDate(weekOffset.value))

  async function load(offset = 0) {
    weekOffset.value = offset
    const week = weekKeyDate(offset)
    loading.value = true
    try {
      const data = await api.get<{ signups: KaraSignup[] }>(`/api/kara-signups?week=${week}`)
      signups.value = Array.isArray(data.signups) ? data.signups : []
    } catch {
      signups.value = []
    } finally {
      loading.value = false
    }
  }

  const mySignup = computed(() => {
    const auth = useAuthStore()
    if (!auth.user) return null
    return signups.value.find(s => s.userId === auth.user!.userId) ?? null
  })

  const roleCounts = computed(() => {
    const counts = { Tank: 0, Heiler: 0, DPS: 0 }
    for (const s of signups.value) {
      if (s.role in counts) counts[s.role as keyof typeof counts]++
    }
    return counts
  })

  async function signup(data: {
    entryId: string
    spec: string
    days: string[]
    customSlots?: Record<string, 'yes' | 'tentative'>
    useCustomTimes: boolean
  }) {
    const week = weekKeyDate(weekOffset.value)
    saving.value = true
    try {
      await api.post('/api/kara-signups', { week, ...data })
      await load(weekOffset.value)
    } finally {
      saving.value = false
    }
  }

  async function withdraw() {
    const week = weekKeyDate(weekOffset.value)
    saving.value = true
    try {
      await api.del(`/api/kara-signups?week=${week}`)
      await load(weekOffset.value)
    } finally {
      saving.value = false
    }
  }

  return {
    signups,
    loading,
    saving,
    weekOffset,
    currentWeekKey,
    mySignup,
    roleCounts,
    load,
    signup,
    withdraw,
  }
})

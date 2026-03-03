import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
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

  async function signup(raidId: string, payload: Record<string, any>) {
    await api.post('/api/raids', { action: 'signup', raidId, ...payload })
    await load()
  }

  async function unsignup(raidId: string) {
    await api.post('/api/raids', { action: 'unsignup', raidId })
    await load()
  }

  async function lock(raidId: string) {
    await api.post('/api/raids', { action: 'lock', raidId })
    await load()
  }

  async function unlock(raidId: string) {
    await api.post('/api/raids', { action: 'unlock', raidId })
    await load()
  }

  async function confirmPlayer(raidId: string, targetUserId: string) {
    await api.post('/api/raids', { action: 'confirm', raidId, targetUserId })
    await load()
  }

  async function unconfirmPlayer(raidId: string, targetUserId: string) {
    await api.post('/api/raids', { action: 'unconfirm', raidId, targetUserId })
    await load()
  }

  async function benchPlayer(raidId: string, targetUserId: string) {
    await api.post('/api/raids', { action: 'bench', raidId, targetUserId })
    await load()
  }

  async function removePlayer(raidId: string, targetUserId: string) {
    await api.post('/api/raids', { action: 'remove-signup', raidId, targetUserId })
    await load()
  }

  async function assignSpec(raidId: string, targetUserId: string, assignedSpec: string | null) {
    await api.post('/api/raids', { action: 'assign-spec', raidId, targetUserId, assignedSpec })
    await load()
  }

  async function confirmLineup(raidId: string, userIds: string[]) {
    await api.post('/api/raids', { action: 'confirm-lineup', raidId, userIds })
    await load()
  }

  async function signupOther(raidId: string, payload: Record<string, any>) {
    await api.post('/api/raids', { action: 'signup-other', raidId, ...payload })
    await load()
  }

  async function postDiscord(raidId: string) {
    await api.post('/api/discord', { action: 'post', raidId })
  }

  function getRaid(id: string): Raid | undefined {
    return raids.value.find(r => r.id === id)
  }

  const upcomingRaids = computed(() => {
    const today = new Date().toISOString().slice(0, 10)
    return raids.value
      .filter(r => r.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
  })

  const pastRaids = computed(() => {
    const today = new Date().toISOString().slice(0, 10)
    return raids.value
      .filter(r => r.date < today)
      .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
  })

  return {
    raids, loading, load, save, remove,
    signup, unsignup, lock, unlock,
    confirmPlayer, unconfirmPlayer, benchPlayer, removePlayer,
    assignSpec, confirmLineup, signupOther, postDiscord,
    getRaid, upcomingRaids, pastRaids,
  }
})

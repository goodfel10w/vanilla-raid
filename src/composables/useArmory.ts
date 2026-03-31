import { ref, readonly } from 'vue'
import type { ArmoryProfile } from '@/types'

const profileCache = new Map<string, { data: ArmoryProfile; fetchedAt: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 min client-side cache

const BNET_REALM = 'thunderstrike'
const BNET_REGION = 'EU'

export function useArmory() {
  const profiles = ref<Record<string, ArmoryProfile>>({})
  const loading = ref<Record<string, boolean>>({})
  const errors = ref<Record<string, string>>({})

  async function fetchProfile(charName: string, realm?: string): Promise<ArmoryProfile | null> {
    const r = realm || BNET_REALM
    const key = `${r}_${charName}`.toLowerCase()

    // Check client cache
    const cached = profileCache.get(key)
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
      profiles.value = { ...profiles.value, [key]: cached.data }
      return cached.data
    }

    loading.value = { ...loading.value, [key]: true }
    delete errors.value[key]

    try {
      const params = new URLSearchParams({ name: charName, realm: r })
      const res = await fetch(`/api/armory?${params}`)

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unbekannter Fehler' }))
        errors.value = { ...errors.value, [key]: err.error }
        return null
      }

      const data: ArmoryProfile = await res.json()
      profileCache.set(key, { data, fetchedAt: Date.now() })
      profiles.value = { ...profiles.value, [key]: data }
      return data
    } catch {
      errors.value = { ...errors.value, [key]: 'Netzwerkfehler' }
      return null
    } finally {
      loading.value = { ...loading.value, [key]: false }
    }
  }

  async function fetchProfiles(charNames: string[], realm?: string) {
    await Promise.all(charNames.map(name => fetchProfile(name, realm)))
  }

  function getProfile(charName: string, realm?: string): ArmoryProfile | undefined {
    const r = realm || BNET_REALM
    const key = `${r}_${charName}`.toLowerCase()
    return profiles.value[key]
  }

  function isLoading(charName: string, realm?: string): boolean {
    const r = realm || BNET_REALM
    const key = `${r}_${charName}`.toLowerCase()
    return !!loading.value[key]
  }

  function armoryUrl(charName: string, realm?: string): string {
    const r = realm || BNET_REALM
    return `https://classicwowarmory.com/character/${BNET_REGION}/${r}/${encodeURIComponent(charName)}?game_version=classic`
  }

  return {
    profiles: readonly(profiles),
    loading: readonly(loading),
    errors: readonly(errors),
    fetchProfile,
    fetchProfiles,
    getProfile,
    isLoading,
    armoryUrl,
  }
}

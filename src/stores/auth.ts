import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AuthUser, BnetCharacter } from '@/types'
import { useDkpStore } from '@/stores/dkp'

const STORAGE_KEY = 'raid-auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const bnetCharacters = ref<BnetCharacter[]>([])

  const isLoggedIn = computed(() => !!user.value?.token)
  const isAdmin = computed(() => !!user.value?.isAdmin || !!user.value?.isSiteAdmin)

  const hasAdminAccess = computed(() => {
    if (isAdmin.value) return true
    if (!user.value) return false
    const dkp = useDkpStore()
    const uname = user.value.username?.toLowerCase().split('#')[0]
    if (!uname) return false
    const roles = dkp.config.roles || {}
    return roles[uname] === 'admin' || roles[uname] === 'officer'
  })

  const dkpRole = computed(() => {
    if (!user.value) return null
    const dkp = useDkpStore()
    const uname = user.value.username?.toLowerCase().split('#')[0]
    if (!uname) return null
    const roles = dkp.config.roles || {}
    return roles[uname] || null
  })

  function clearSession() {
    user.value = null
    bnetCharacters.value = []
    localStorage.removeItem(STORAGE_KEY)
  }

  async function validate() {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return
    try {
      const data = JSON.parse(stored) as AuthUser
      user.value = data
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.token}`,
        },
        body: JSON.stringify({ action: 'validate' }),
      })
      if (!res.ok) throw new Error('Validation failed')
      const j = await res.json()
      user.value = {
        ...data,
        username: j.username,
        userId: j.userId,
        isAdmin: j.isAdmin || false,
        isSiteAdmin: j.isSiteAdmin || false,
        discordLinked: j.discordLinked || data.discordLinked,
        discordUsername: j.discordUsername || data.discordUsername,
        discordGuildMember: j.discordGuildMember || data.discordGuildMember,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user.value))
      await loadBnetCharacters()
    } catch {
      clearSession()
    }
  }

  function restoreSession() {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        user.value = JSON.parse(stored) as AuthUser
      } catch {
        clearSession()
      }
    }
  }

  function saveSession(userData: AuthUser) {
    user.value = userData
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData))
  }

  async function bnetLogin() {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'bnet-login' }),
    })
    const j = await res.json()
    if (j.url) {
      window.location.href = j.url
    }
  }

  async function logout() {
    if (user.value?.token) {
      try {
        await fetch('/api/auth', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.value.token}`,
          },
          body: JSON.stringify({ action: 'logout' }),
        })
      } catch { /* ignore */ }
    }
    clearSession()
  }

  async function discordLink() {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(user.value?.token ? { Authorization: `Bearer ${user.value.token}` } : {}),
      },
      body: JSON.stringify({ action: 'discord-link' }),
    })
    const j = await res.json()
    if (j.url) {
      window.location.href = j.url
    }
  }

  async function discordUnlink() {
    await fetch('/api/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(user.value?.token ? { Authorization: `Bearer ${user.value.token}` } : {}),
      },
      body: JSON.stringify({ action: 'discord-unlink' }),
    })
    if (user.value) {
      user.value = { ...user.value, discordLinked: false, discordUsername: undefined }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user.value))
    }
  }

  async function loadBnetCharacters() {
    if (!user.value?.token) return
    try {
      const res = await fetch('/api/bnet-characters', {
        headers: { Authorization: `Bearer ${user.value.token}` },
      })
      if (res.ok) {
        const data = await res.json()
        bnetCharacters.value = Array.isArray(data) ? data : []
      }
    } catch { /* ignore */ }
  }

  return {
    user,
    bnetCharacters,
    isLoggedIn,
    isAdmin,
    hasAdminAccess,
    dkpRole,
    clearSession,
    validate,
    restoreSession,
    saveSession,
    bnetLogin,
    logout,
    discordLink,
    discordUnlink,
    loadBnetCharacters,
  }
})

import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useDkpStore } from '@/stores/dkp'

export function useDkpRole() {
  const auth = useAuthStore()
  const dkp = useDkpStore()

  function getRole(): string | null {
    const username = auth.user?.username
    if (!username) return null
    const roles = dkp.config.roles || {}
    const lower = username.toLowerCase()
    if (roles[lower]) return roles[lower]
    const prefix = lower.split('#')[0]
    if (prefix !== lower && roles[prefix]) return roles[prefix]
    return null
  }

  const isDkpAdmin = computed(() => {
    if (!auth.user) return false
    return getRole() === 'admin' || auth.isAdmin
  })

  const isDkpOfficer = computed(() => {
    if (!auth.user) return false
    const role = getRole()
    return role === 'admin' || role === 'officer' || auth.isAdmin
  })

  return { isDkpAdmin, isDkpOfficer }
}

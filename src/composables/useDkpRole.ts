import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useDkpStore } from '@/stores/dkp'

export function useDkpRole() {
  const auth = useAuthStore()
  const dkp = useDkpStore()

  const dkpUsername = computed(() =>
    auth.user?.username?.toLowerCase().split('#')[0] ?? ''
  )

  const isDkpAdmin = computed(() => {
    if (!auth.user) return false
    const roles = dkp.config.roles || {}
    return roles[dkpUsername.value] === 'admin' || auth.isAdmin
  })

  const isDkpOfficer = computed(() => {
    if (!auth.user) return false
    const roles = dkp.config.roles || {}
    return roles[dkpUsername.value] === 'admin' || roles[dkpUsername.value] === 'officer' || auth.isAdmin
  })

  return { isDkpAdmin, isDkpOfficer }
}

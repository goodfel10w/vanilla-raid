import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AvailabilityMap } from '@/types'

export const useUiStore = defineStore('ui', () => {
  const sidebarExpanded = ref(true)
  const dkpView = ref<'overview' | 'award' | 'spend' | 'decay' | 'settings'>('overview')
  const dkpPlayerDetail = ref<string | null>(null)
  const dkpSortCol = ref('balance')
  const dkpSortDir = ref<'asc' | 'desc'>('desc')
  const dkpSearchQuery = ref('')
  const dkpTxFilter = ref<'all' | 'earn' | 'spend' | 'decay' | 'adjust'>('all')

  const formState = ref({
    name: '',
    cls: '',
    specs: [] as string[],
    roles: [] as string[],
    avail: {} as AvailabilityMap,
    notes: '',
  })

  function resetForm() {
    formState.value = {
      name: '',
      cls: '',
      specs: [],
      roles: [],
      avail: {},
      notes: '',
    }
  }

  return {
    sidebarExpanded,
    dkpView, dkpPlayerDetail, dkpSortCol, dkpSortDir, dkpSearchQuery, dkpTxFilter,
    formState, resetForm,
  }
})

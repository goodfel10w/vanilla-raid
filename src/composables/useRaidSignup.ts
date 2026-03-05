import { ref, computed } from 'vue'
import { useRaidsStore } from '@/stores/raids'
import { useAuthStore } from '@/stores/auth'
import { useEntriesStore } from '@/stores/entries'
import { useToast } from '@/composables/useToast'
import { CLASS_SPECS } from '@/lib/constants'
import type { Raid } from '@/types'

export function useRaidSignup(raidId: () => string) {
  const raidsStore = useRaidsStore()
  const authStore = useAuthStore()
  const entriesStore = useEntriesStore()
  const { toast } = useToast()

  const showForm = ref(false)
  const submitting = ref(false)
  const selectedChar = ref('')
  const selectedClass = ref('')
  const selectedStatus = ref<string>('accepted')
  const selectedSpecs = ref<string[]>([])
  const note = ref('')

  const raid = computed(() => raidsStore.getRaid(raidId()))

  const myChars = computed(() =>
    entriesStore.entries.filter(e => e.userId === authStore.user?.userId)
  )

  const mySignup = computed(() =>
    (raid.value?.signups || []).find(s => s.userId === authStore.user?.userId)
  )

  const isRaidPast = computed(() => {
    if (!raid.value) return true
    return raid.value.date < new Date().toISOString().slice(0, 10)
  })

  const deadlinePassed = computed(() => {
    if (!raid.value?.deadline) return false
    return new Date() > new Date(raid.value.deadline)
  })

  const isOwner = computed(() => {
    if (!authStore.user) return false
    return raid.value?.createdBy === authStore.user.userId || authStore.isAdmin
  })

  const canSignup = computed(() => {
    if (!authStore.isLoggedIn || isRaidPast.value) return false
    if (isOwner.value) return true
    return !deadlinePassed.value && !raid.value?.locked
  })

  function specRole(className: string, specName: string): string {
    const specs = CLASS_SPECS[className] || []
    const sp = specs.find(s => s.name === specName)
    return sp?.role || 'DPS'
  }

  function openForm() {
    const signup = mySignup.value
    if (signup) {
      selectedChar.value = signup.charName
      selectedClass.value = signup.className
      selectedStatus.value = signup.status === 'benched' ? 'accepted' : signup.status
      selectedSpecs.value = signup.offeredSpecs ? [...signup.offeredSpecs] : []
      note.value = signup.note || ''
    } else if (myChars.value.length) {
      const ch = myChars.value[0]
      selectedChar.value = ch.charName
      selectedClass.value = ch.className
      selectedSpecs.value = ch.specs ? [...ch.specs] : []
      selectedStatus.value = 'accepted'
      note.value = ''
    } else {
      selectedChar.value = ''
      selectedClass.value = ''
      selectedSpecs.value = []
      selectedStatus.value = 'accepted'
      note.value = ''
    }
    showForm.value = true
  }

  function closeForm() {
    showForm.value = false
  }

  function onCharChange(charName: string) {
    selectedChar.value = charName
    const ch = myChars.value.find(c => c.charName === charName)
    if (ch) {
      selectedClass.value = ch.className
      selectedSpecs.value = ch.specs ? [...ch.specs] : []
    }
  }

  function onClassChange(cls: string) {
    selectedClass.value = cls
    selectedSpecs.value = []
  }

  function toggleSpec(specName: string) {
    const idx = selectedSpecs.value.indexOf(specName)
    if (idx >= 0) {
      selectedSpecs.value.splice(idx, 1)
    } else {
      selectedSpecs.value.push(specName)
    }
  }

  async function doSignup() {
    const charName = selectedChar.value.trim()
    if (!charName) { toast('Bitte Charakter angeben'); return }
    if (!selectedSpecs.value.length) { toast('Bitte mindestens einen Spec waehlen'); return }

    const role = specRole(selectedClass.value, selectedSpecs.value[0])
    submitting.value = true
    try {
      await raidsStore.signup(raidId(), {
        charName,
        className: selectedClass.value,
        offeredSpecs: selectedSpecs.value,
        role,
        status: selectedStatus.value,
        note: note.value.trim() || undefined,
      })
      const label = selectedStatus.value === 'accepted' ? 'Angemeldet' :
        selectedStatus.value === 'tentative' ? 'Vielleicht' : 'Abgesagt'
      toast(label)
      showForm.value = false
    } catch (e: unknown) {
      toast('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannter Fehler'))
    } finally {
      submitting.value = false
    }
  }

  async function doUnsignup() {
    submitting.value = true
    try {
      await raidsStore.unsignup(raidId())
      toast('Abgemeldet')
    } catch (e: unknown) {
      toast('Fehler: ' + (e instanceof Error ? e.message : 'Unbekannter Fehler'))
    } finally {
      submitting.value = false
    }
  }

  return {
    showForm,
    submitting,
    selectedChar,
    selectedClass,
    selectedStatus,
    selectedSpecs,
    note,
    raid,
    myChars,
    mySignup,
    isRaidPast,
    deadlinePassed,
    isOwner,
    canSignup,
    specRole,
    openForm,
    closeForm,
    onCharChange,
    onClassChange,
    toggleSpec,
    doSignup,
    doUnsignup,
  }
}

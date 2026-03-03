import { useEntriesStore } from '@/stores/entries'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { useRouter } from 'vue-router'
import { specsToRoles } from '@/lib/utils'
import type { AvailabilityMap } from '@/types'

export interface FormData {
  name: string
  cls: string
  specs: string[]
  avail: AvailabilityMap
  notes: string
}

export function useFormSubmit() {
  const entriesStore = useEntriesStore()
  const auth = useAuthStore()
  const { toast } = useToast()
  const router = useRouter()

  async function submit(formData: FormData, editId: string | null): Promise<boolean> {
    const roles = specsToRoles(formData.cls, formData.specs)

    try {
      await entriesStore.save({
        id: editId || undefined,
        charName: formData.name,
        className: formData.cls as any,
        specs: formData.specs,
        roles,
        availability: formData.avail,
        notes: formData.notes,
      })

      toast(editId ? 'Eintrag aktualisiert \u2713' : 'Eintrag gespeichert \u2713')
      router.push('/roster')
      return true
    } catch (e: any) {
      if (e.message === 'Nicht angemeldet' || e.message === 'Sitzung ungültig') {
        auth.clearSession()
        toast('Sitzung abgelaufen \u2014 bitte erneut anmelden')
      } else if (e.message === 'Keine Berechtigung') {
        toast('Du kannst nur eigene Einträge bearbeiten')
      } else {
        toast('Fehler: ' + e.message)
      }
      return false
    }
  }

  return { submit }
}

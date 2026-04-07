import { useEntriesStore } from '@/stores/entries'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
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

      toast(editId ? 'Charakter aktualisiert \u2713' : 'Charakter gespeichert \u2713')
      return true
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : ''
      if (msg === 'Nicht angemeldet' || msg === 'Sitzung ungültig') {
        auth.clearSession()
        toast('Sitzung abgelaufen \u2014 bitte erneut anmelden')
      } else if (msg === 'Keine Berechtigung') {
        toast('Du kannst nur eigene Einträge bearbeiten')
      } else {
        toast('Fehler: ' + (msg || 'Unbekannter Fehler'))
      }
      return false
    }
  }

  return { submit }
}

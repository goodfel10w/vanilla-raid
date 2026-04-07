import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useFormSubmit } from '@/composables/useFormSubmit'
import { useEntriesStore } from '@/stores/entries'
import { useAuthStore } from '@/stores/auth'

// Mock vue-router
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useRoute: () => ({
    query: {},
  }),
}))

describe('useFormSubmit', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockPush.mockClear()
  })

  it('calls entries store save with correct data', async () => {
    const entriesStore = useEntriesStore()
    entriesStore.save = vi.fn().mockResolvedValue({})
    const auth = useAuthStore()
    auth.user = { token: 'tok', username: 'u', userId: '1' }

    const { submit } = useFormSubmit()
    const result = await submit(
      {
        name: 'TestChar',
        cls: 'Krieger',
        specs: ['Prot'],
        avail: { Montag_18: 'yes' as const },
        notes: 'test',
      },
      null
    )

    expect(result).toBe(true)
    expect(entriesStore.save).toHaveBeenCalledWith({
      id: undefined,
      charName: 'TestChar',
      className: 'Krieger',
      specs: ['Prot'],
      roles: ['Tank'],
      availability: { Montag_18: 'yes' },
      notes: 'test',
    })
  })

  it('returns true on success without navigating', async () => {
    const entriesStore = useEntriesStore()
    entriesStore.save = vi.fn().mockResolvedValue({})

    const { submit } = useFormSubmit()
    const result = await submit(
      { name: 'A', cls: 'Krieger', specs: ['Prot'], avail: {}, notes: '' },
      null
    )

    expect(result).toBe(true)
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('passes editId when editing', async () => {
    const entriesStore = useEntriesStore()
    entriesStore.save = vi.fn().mockResolvedValue({})

    const { submit } = useFormSubmit()
    await submit(
      { name: 'A', cls: 'Krieger', specs: ['Arms'], avail: {}, notes: '' },
      'edit-123'
    )

    expect(entriesStore.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'edit-123' })
    )
  })

  it('returns false and clears session on auth error', async () => {
    const entriesStore = useEntriesStore()
    entriesStore.save = vi.fn().mockRejectedValue(new Error('Nicht angemeldet'))
    const auth = useAuthStore()
    auth.user = { token: 'tok', username: 'u', userId: '1' }

    const { submit } = useFormSubmit()
    const result = await submit(
      { name: 'A', cls: 'Krieger', specs: ['Prot'], avail: {}, notes: '' },
      null
    )

    expect(result).toBe(false)
    expect(auth.user).toBeNull()
  })

  it('returns false on permission error', async () => {
    const entriesStore = useEntriesStore()
    entriesStore.save = vi.fn().mockRejectedValue(new Error('Keine Berechtigung'))

    const { submit } = useFormSubmit()
    const result = await submit(
      { name: 'A', cls: 'Krieger', specs: ['Prot'], avail: {}, notes: '' },
      'id1'
    )

    expect(result).toBe(false)
  })
})

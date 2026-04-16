import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import KaraView from '@/views/KaraView.vue'
import { useEntriesStore } from '@/stores/entries'
import { useAuthStore } from '@/stores/auth'
import { useDkpStore } from '@/stores/dkp'
import type { Entry } from '@/types'

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: '1',
    charName: 'Testchar',
    className: 'Krieger',
    specs: ['Prot'],
    roles: ['Tank'],
    availability: {},
    notes: '',
    timestamp: new Date().toISOString(),
    ...overrides,
  }
}

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/kara', component: KaraView },
    ],
  })
}

function seedOfficer(role: 'officer' | 'admin' = 'officer') {
  const auth = useAuthStore()
  const dkp = useDkpStore()
  auth.user = {
    token: 'test',
    username: 'karaboss',
    userId: 'u1',
  }
  dkp.config.roles = { karaboss: role }
}

describe('KaraView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('renders with #v-kara container', () => {
    const router = createTestRouter()
    const wrapper = mount(KaraView, {
      global: { plugins: [router] },
    })
    expect(wrapper.find('#v-kara').exists()).toBe(true)
  })

  it('shows access denied when not officer or admin', () => {
    const router = createTestRouter()
    const wrapper = mount(KaraView, {
      global: { plugins: [router] },
    })
    expect(wrapper.text()).toContain('Kein Zugriff')
    expect(wrapper.text()).not.toContain('Raidwoche')
  })

  it('does not show access denied for DKP officer', () => {
    const router = createTestRouter()
    seedOfficer('officer')
    const wrapper = mount(KaraView, {
      global: { plugins: [router] },
    })
    expect(wrapper.text()).not.toContain('Kein Zugriff')
    expect(wrapper.text()).toContain('Raidwoche')
  })

  it('does not show access denied for DKP admin', () => {
    const router = createTestRouter()
    seedOfficer('admin')
    const wrapper = mount(KaraView, {
      global: { plugins: [router] },
    })
    expect(wrapper.text()).not.toContain('Kein Zugriff')
    expect(wrapper.text()).toContain('Raidwoche')
  })

  it('does not show access denied for site admin', () => {
    const router = createTestRouter()
    const auth = useAuthStore()
    auth.user = {
      token: 'test',
      username: 'siteadmin',
      userId: 'u2',
      isAdmin: true,
    }
    const wrapper = mount(KaraView, {
      global: { plugins: [router] },
    })
    expect(wrapper.text()).not.toContain('Kein Zugriff')
    expect(wrapper.text()).toContain('Raidwoche')
  })

  it('shows ID-Woche header with week navigation', () => {
    const router = createTestRouter()
    seedOfficer()
    const wrapper = mount(KaraView, {
      global: { plugins: [router] },
    })
    expect(wrapper.text()).toContain('Raidwoche')
  })

  it('shows action buttons', () => {
    const router = createTestRouter()
    seedOfficer()
    const wrapper = mount(KaraView, {
      global: { plugins: [router] },
    })
    expect(wrapper.text()).toContain('Zeiten finden')
    expect(wrapper.text()).toContain('Auto-Verteilen')
    expect(wrapper.text()).toContain('Export')
    expect(wrapper.text()).toContain('Reset')
  })

  it('shows empty pool message when no entries', () => {
    const router = createTestRouter()
    seedOfficer()
    const wrapper = mount(KaraView, {
      global: { plugins: [router] },
    })
    expect(wrapper.text()).toContain('Keine Eintraege vorhanden')
  })

  it('shows pool with entries', () => {
    const router = createTestRouter()
    seedOfficer()
    const store = useEntriesStore()
    store.entries = [
      makeEntry({ id: '1', charName: 'Tank1', roles: ['Tank'] }),
      makeEntry({ id: '2', charName: 'Healer1', className: 'Priester', roles: ['Heiler'] }),
    ]

    const wrapper = mount(KaraView, {
      global: { plugins: [router] },
    })
    expect(wrapper.text()).toContain('Tank1')
    expect(wrapper.text()).toContain('Healer1')
  })

  it('shows default 2 Kara groups', () => {
    const router = createTestRouter()
    seedOfficer()
    const wrapper = mount(KaraView, {
      global: { plugins: [router] },
    })
    expect(wrapper.text()).toContain('Karazhan 1')
    expect(wrapper.text()).toContain('Karazhan 2')
    expect(wrapper.text()).toContain('Gruppe hinzufuegen')
  })

  it('shows summary cards', () => {
    const router = createTestRouter()
    seedOfficer()
    const wrapper = mount(KaraView, {
      global: { plugins: [router] },
    })
    expect(wrapper.text()).toContain('Verteilt')
    expect(wrapper.text()).toContain('Offen')
    expect(wrapper.text()).toContain('Links')
    expect(wrapper.text()).toContain('Zeiten')
  })

  it('shows pool filter', () => {
    const router = createTestRouter()
    seedOfficer()
    const wrapper = mount(KaraView, {
      global: { plugins: [router] },
    })
    expect(wrapper.text()).toContain('Filter:')
  })
})

import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import AdminView from '@/views/AdminView.vue'
import { useAuthStore } from '@/stores/auth'
import { useEntriesStore } from '@/stores/entries'
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
      { path: '/admin', component: AdminView },
    ],
  })
}

describe('AdminView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders with #v-admin container', () => {
    const router = createTestRouter()
    const wrapper = mount(AdminView, {
      global: { plugins: [router] },
    })
    expect(wrapper.find('#v-admin').exists()).toBe(true)
  })

  it('shows access denied when not admin', () => {
    const router = createTestRouter()
    const wrapper = mount(AdminView, {
      global: { plugins: [router] },
    })
    expect(wrapper.text()).toContain('Kein Zugriff')
  })

  it('does not show tabs when not admin', () => {
    const router = createTestRouter()
    const wrapper = mount(AdminView, {
      global: { plugins: [router] },
    })
    expect(wrapper.findAll('.adm-tab').length).toBe(0)
  })

  it('shows tabs when admin', () => {
    const router = createTestRouter()
    const authStore = useAuthStore()
    authStore.user = {
      token: 'test',
      username: 'admin',
      userId: '1',
      isAdmin: true,
    }

    const wrapper = mount(AdminView, {
      global: { plugins: [router] },
    })
    const tabs = wrapper.findAll('.adm-tab')
    expect(tabs.length).toBe(4)
    expect(tabs[0].text()).toBe('Uebersicht')
    expect(tabs[1].text()).toBe('Eintraege')
    expect(tabs[2].text()).toBe('Rollen')
    expect(tabs[3].text()).toBe('Verwaltung')
  })

  it('shows overview stats when admin', () => {
    const router = createTestRouter()
    const authStore = useAuthStore()
    authStore.user = {
      token: 'test',
      username: 'admin',
      userId: '1',
      isAdmin: true,
    }
    const entriesStore = useEntriesStore()
    entriesStore.entries = [
      makeEntry({ id: '1', roles: ['Tank'] }),
      makeEntry({ id: '2', roles: ['Heiler'], className: 'Priester', charName: 'Healer' }),
      makeEntry({ id: '3', roles: ['DPS'], className: 'Magier', charName: 'Mage' }),
    ]

    const wrapper = mount(AdminView, {
      global: { plugins: [router] },
    })
    // Should show raider count
    expect(wrapper.text()).toContain('Raider')
    expect(wrapper.text()).toContain('Tanks')
    expect(wrapper.text()).toContain('Heiler')
    expect(wrapper.text()).toContain('DPS')
  })

  it('switches to entries tab', async () => {
    const router = createTestRouter()
    const authStore = useAuthStore()
    authStore.user = {
      token: 'test',
      username: 'admin',
      userId: '1',
      isAdmin: true,
    }
    const entriesStore = useEntriesStore()
    entriesStore.entries = [
      makeEntry({ id: '1', charName: 'TestWarrior' }),
    ]

    const wrapper = mount(AdminView, {
      global: { plugins: [router] },
    })
    await wrapper.findAll('.adm-tab')[1].trigger('click')
    expect(wrapper.text()).toContain('Alle Eintraege')
    expect(wrapper.text()).toContain('TestWarrior')
  })

  it('switches to manage tab', async () => {
    const router = createTestRouter()
    const authStore = useAuthStore()
    authStore.user = {
      token: 'test',
      username: 'admin',
      userId: '1',
      isAdmin: true,
    }

    const wrapper = mount(AdminView, {
      global: { plugins: [router] },
    })
    await wrapper.findAll('.adm-tab')[3].trigger('click')
    expect(wrapper.text()).toContain('Verwaltung')
    expect(wrapper.text()).toContain('Gefahrenzone')
  })

  it('shows class distribution in overview', () => {
    const router = createTestRouter()
    const authStore = useAuthStore()
    authStore.user = {
      token: 'test',
      username: 'admin',
      userId: '1',
      isAdmin: true,
    }
    const entriesStore = useEntriesStore()
    entriesStore.entries = [
      makeEntry({ id: '1', className: 'Krieger' }),
      makeEntry({ id: '2', className: 'Krieger', charName: 'War2' }),
      makeEntry({ id: '3', className: 'Magier', charName: 'Mage1' }),
    ]

    const wrapper = mount(AdminView, {
      global: { plugins: [router] },
    })
    expect(wrapper.text()).toContain('Klassenverteilung')
    expect(wrapper.text()).toContain('Raidbereitschaft')
  })
})

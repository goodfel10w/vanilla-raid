import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import DashboardView from '@/views/DashboardView.vue'
import { useEntriesStore } from '@/stores/entries'
import { useRaidsStore } from '@/stores/raids'
import type { Entry, Raid } from '@/types'

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
      { path: '/dashboard', component: DashboardView },
      { path: '/form', component: { template: '<div />' } },
      { path: '/raids', component: { template: '<div />' } },
      { path: '/dkp', component: { template: '<div />' } },
      { path: '/roster', component: { template: '<div />' } },
    ],
  })
}

describe('DashboardView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders with #v-dashboard container', () => {
    const router = createTestRouter()
    const wrapper = mount(DashboardView, {
      global: { plugins: [router] },
    })
    expect(wrapper.find('#v-dashboard').exists()).toBe(true)
  })

  it('shows quick action links', () => {
    const router = createTestRouter()
    const wrapper = mount(DashboardView, {
      global: { plugins: [router] },
    })
    const links = wrapper.findAll('.qa-link')
    expect(links.length).toBe(3)
    expect(links[0].text()).toBe('Eintragen')
    expect(links[1].text()).toBe('Raids')
    expect(links[2].text()).toBe('DKP')
  })

  it('shows role distribution when entries exist', () => {
    const router = createTestRouter()
    const store = useEntriesStore()
    store.entries = [
      makeEntry({ id: '1', roles: ['Tank'] }),
      makeEntry({ id: '2', roles: ['Heiler'], className: 'Priester', charName: 'Healer' }),
      makeEntry({ id: '3', roles: ['DPS'], className: 'Magier', charName: 'Mage' }),
    ]

    const wrapper = mount(DashboardView, {
      global: { plugins: [router] },
    })
    const roleItems = wrapper.findAll('.role-an-item')
    expect(roleItems.length).toBe(3)
    expect(roleItems[0].find('.big').text()).toBe('1')
    expect(roleItems[0].find('.sm').text()).toContain('Tank')
  })

  it('shows upcoming raids card', () => {
    const router = createTestRouter()
    const raidsStore = useRaidsStore()
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateStr = tomorrow.toISOString().slice(0, 10)
    raidsStore.raids = [
      {
        id: 'r1',
        instance: 'Karazhan',
        date: dateStr,
        time: '20:00',
        maxPlayers: 10,
        locked: false,
        notes: '',
        description: '',
        signups: [],
        timestamp: new Date().toISOString(),
      } as Raid,
    ]

    const wrapper = mount(DashboardView, {
      global: { plugins: [router] },
    })
    expect(wrapper.text()).toContain('Kommende Raids')
    expect(wrapper.text()).toContain('Karazhan')
    expect(wrapper.text()).toContain('0/10 angemeldet')
  })

  it('shows empty state when no entries', () => {
    const router = createTestRouter()
    const wrapper = mount(DashboardView, {
      global: { plugins: [router] },
    })
    expect(wrapper.find('.empty').exists()).toBe(true)
  })

  it('links navigate to correct routes', () => {
    const router = createTestRouter()
    const wrapper = mount(DashboardView, {
      global: { plugins: [router] },
    })
    const links = wrapper.findAll('.qa-link')
    expect(links[0].attributes('href')).toContain('/form')
    expect(links[1].attributes('href')).toContain('/raids')
    expect(links[2].attributes('href')).toContain('/dkp')
  })
})

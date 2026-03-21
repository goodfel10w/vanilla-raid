import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import DashboardView from '@/views/DashboardView.vue'
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

  it('shows class distribution sorted by count', () => {
    const router = createTestRouter()
    const store = useEntriesStore()
    store.entries = [
      makeEntry({ id: '1', className: 'Magier', charName: 'Mage1' }),
      makeEntry({ id: '2', className: 'Magier', charName: 'Mage2' }),
      makeEntry({ id: '3', className: 'Krieger', charName: 'War1' }),
    ]

    const wrapper = mount(DashboardView, {
      global: { plugins: [router] },
    })
    const bars = wrapper.findAll('.bar-row')
    expect(bars.length).toBe(2)
    // Magier first (2 entries), then Krieger (1 entry)
    expect(bars[0].find('.bar-lbl').text()).toBe('Magier')
    expect(bars[1].find('.bar-lbl').text()).toBe('Krieger')
  })

  it('shows empty state when no entries', () => {
    const router = createTestRouter()
    const wrapper = mount(DashboardView, {
      global: { plugins: [router] },
    })
    expect(wrapper.find('.empty').exists()).toBe(true)
    expect(wrapper.findAll('.bar-row').length).toBe(0)
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

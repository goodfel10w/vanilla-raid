import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import RosterView from '@/views/RosterView.vue'
import { useEntriesStore } from '@/stores/entries'
import { useAuthStore } from '@/stores/auth'
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
      { path: '/roster', component: RosterView },
      { path: '/form', component: { template: '<div />' } },
    ],
  })
}

describe('RosterView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders with #v-roster container', () => {
    const router = createTestRouter()
    const wrapper = mount(RosterView, {
      global: { plugins: [router], stubs: { Teleport: true } },
    })
    expect(wrapper.find('#v-roster').exists()).toBe(true)
  })

  it('shows empty state when no entries', () => {
    const router = createTestRouter()
    const wrapper = mount(RosterView, {
      global: { plugins: [router], stubs: { Teleport: true } },
    })
    expect(wrapper.find('.empty').exists()).toBe(true)
  })

  it('renders role summary cards', () => {
    const router = createTestRouter()
    const store = useEntriesStore()
    store.entries = [
      makeEntry({ id: '1', roles: ['Tank'] }),
      makeEntry({ id: '2', charName: 'Healer', className: 'Priester', roles: ['Heiler'], specs: ['Holy'] }),
    ]
    const wrapper = mount(RosterView, {
      global: { plugins: [router], stubs: { Teleport: true } },
    })
    const cards = wrapper.findAll('.rcard')
    expect(cards).toHaveLength(3) // Tank, Heiler, DPS
    // Tank card has 1
    expect(cards[0].find('.num').text()).toBe('1')
    // Heiler card has 1
    expect(cards[1].find('.num').text()).toBe('1')
  })

  it('renders entries with character names', () => {
    const router = createTestRouter()
    const store = useEntriesStore()
    store.entries = [
      makeEntry({ id: '1', charName: 'Warrior1' }),
      makeEntry({ id: '2', charName: 'Mage1', className: 'Magier' }),
    ]
    const wrapper = mount(RosterView, {
      global: { plugins: [router], stubs: { Teleport: true } },
    })
    const entries = wrapper.findAll('.entry')
    expect(entries).toHaveLength(2)
    const names = wrapper.findAll('.e-name')
    expect(names[0].text()).toContain('Mage1') // sorted by name
    expect(names[1].text()).toContain('Warrior1')
  })

  it('sorts by class when selected', async () => {
    const router = createTestRouter()
    const store = useEntriesStore()
    store.entries = [
      makeEntry({ id: '1', charName: 'Warrior1', className: 'Krieger' }),
      makeEntry({ id: '2', charName: 'Druid1', className: 'Druide' }),
    ]
    const wrapper = mount(RosterView, {
      global: { plugins: [router], stubs: { Teleport: true } },
    })
    const select = wrapper.find('.sort-sel')
    await select.setValue('class')
    const names = wrapper.findAll('.e-name')
    // Druide comes before Krieger alphabetically in CLS
    expect(names[0].text()).toContain('Druid1')
    expect(names[1].text()).toContain('Warrior1')
  })

  it('shows CSV export button when entries exist', () => {
    const router = createTestRouter()
    const store = useEntriesStore()
    store.entries = [makeEntry()]
    const wrapper = mount(RosterView, {
      global: { plugins: [router], stubs: { Teleport: true } },
    })
    expect(wrapper.find('.btn-export').exists()).toBe(true)
  })

  it('hides CSV export button when no entries', () => {
    const router = createTestRouter()
    const wrapper = mount(RosterView, {
      global: { plugins: [router], stubs: { Teleport: true } },
    })
    expect(wrapper.find('.btn-export').exists()).toBe(false)
  })

  it('shows sort dropdown when entries exist', () => {
    const router = createTestRouter()
    const store = useEntriesStore()
    store.entries = [makeEntry()]
    const wrapper = mount(RosterView, {
      global: { plugins: [router], stubs: { Teleport: true } },
    })
    expect(wrapper.find('.sort-sel').exists()).toBe(true)
  })

  it('shows edit/delete buttons for own entries', () => {
    const router = createTestRouter()
    const store = useEntriesStore()
    const auth = useAuthStore()
    auth.user = { token: 't', username: 'user', userId: 'u1', isAdmin: false } as any
    store.entries = [makeEntry({ id: '1', userId: 'u1' })]
    const wrapper = mount(RosterView, {
      global: { plugins: [router], stubs: { Teleport: true } },
    })
    expect(wrapper.find('[data-edit]').exists()).toBe(true)
    expect(wrapper.find('[data-del]').exists()).toBe(true)
  })

  it('hides edit/delete buttons for other users entries', () => {
    const router = createTestRouter()
    const store = useEntriesStore()
    const auth = useAuthStore()
    auth.user = { token: 't', username: 'user', userId: 'u1', isAdmin: false } as any
    store.entries = [makeEntry({ id: '1', userId: 'u2' })]
    const wrapper = mount(RosterView, {
      global: { plugins: [router], stubs: { Teleport: true } },
    })
    expect(wrapper.find('[data-edit]').exists()).toBe(false)
    expect(wrapper.find('[data-del]').exists()).toBe(false)
  })

  it('shows edit/delete for admin on any entry', () => {
    const router = createTestRouter()
    const store = useEntriesStore()
    const auth = useAuthStore()
    auth.user = { token: 't', username: 'admin', userId: 'a1', isAdmin: true } as any
    store.entries = [makeEntry({ id: '1', userId: 'u2' })]
    const wrapper = mount(RosterView, {
      global: { plugins: [router], stubs: { Teleport: true } },
    })
    expect(wrapper.find('[data-edit]').exists()).toBe(true)
    expect(wrapper.find('[data-del]').exists()).toBe(true)
  })

  it('shows claim hint when logged in user has no entry', () => {
    const router = createTestRouter()
    const store = useEntriesStore()
    const auth = useAuthStore()
    auth.user = { token: 't', username: 'user', userId: 'u1' } as any
    store.entries = [makeEntry({ id: '1', userId: undefined })]
    const wrapper = mount(RosterView, {
      global: { plugins: [router], stubs: { Teleport: true } },
    })
    expect(wrapper.text()).toContain('noch keinen Charakter')
  })

  it('renders class breakdown in role summary cards', () => {
    const router = createTestRouter()
    const store = useEntriesStore()
    store.entries = [
      makeEntry({ id: '1', charName: 'War1', className: 'Krieger', roles: ['Tank'] }),
      makeEntry({ id: '2', charName: 'Druid1', className: 'Druide', roles: ['Tank'] }),
    ]
    const wrapper = mount(RosterView, {
      global: { plugins: [router], stubs: { Teleport: true } },
    })
    const tankCard = wrapper.findAll('.rcard')[0]
    expect(tankCard.find('.num').text()).toBe('2')
    const classRows = tankCard.findAll('.rcls-row')
    expect(classRows.length).toBe(2)
  })
})

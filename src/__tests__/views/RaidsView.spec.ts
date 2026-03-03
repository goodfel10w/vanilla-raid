import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import RaidsView from '@/views/RaidsView.vue'
import { useRaidsStore } from '@/stores/raids'
import { useAuthStore } from '@/stores/auth'
import type { Raid } from '@/types'

function makeRouter() {
  return createRouter({
    history: createWebHashHistory(),
    routes: [
      { path: '/', redirect: '/raids' },
      { path: '/raids', component: RaidsView },
      { path: '/raids/:id', component: { template: '<div>Detail</div>' } },
    ],
  })
}

function sampleRaid(overrides: Partial<Raid> = {}): Raid {
  return {
    id: 'r1',
    instance: 'Karazhan',
    date: '2099-12-01',
    time: '20:00',
    maxPlayers: 10,
    locked: false,
    notes: '',
    description: '',
    signups: [],
    timestamp: new Date().toISOString(),
    ...overrides,
  }
}

describe('RaidsView', () => {
  let pinia: ReturnType<typeof createPinia>
  let router: ReturnType<typeof makeRouter>

  beforeEach(async () => {
    pinia = createPinia()
    setActivePinia(pinia)
    router = makeRouter()
    router.push('/raids')
    await router.isReady()
  })

  function mountView() {
    return mount(RaidsView, {
      global: {
        plugins: [pinia, router],
        stubs: { Teleport: true },
      },
    })
  }

  it('renders the raids view wrapper', () => {
    const wrapper = mountView()
    expect(wrapper.find('#v-raids').exists()).toBe(true)
  })

  it('shows empty state when no raids', () => {
    const wrapper = mountView()
    expect(wrapper.text()).toContain('Noch keine Raids geplant')
  })

  it('shows view mode toggle buttons', () => {
    const wrapper = mountView()
    expect(wrapper.text()).toContain('Uebersicht')
    expect(wrapper.text()).toContain('Woche')
    expect(wrapper.text()).toContain('Monat')
  })

  it('shows size filter buttons', () => {
    const wrapper = mountView()
    expect(wrapper.text()).toContain('Alle')
    expect(wrapper.text()).toContain('10er')
    expect(wrapper.text()).toContain('25er')
  })

  it('shows auth hint when not logged in', () => {
    const wrapper = mountView()
    expect(wrapper.text()).toContain('Melde dich an')
  })

  it('shows create button when logged in', () => {
    const auth = useAuthStore()
    auth.user = { token: 't', username: 'u', userId: 'uid1' }
    const wrapper = mountView()
    expect(wrapper.text()).toContain('+ Raid erstellen')
  })

  it('does not show create button when not logged in', () => {
    const wrapper = mountView()
    expect(wrapper.text()).not.toContain('+ Raid erstellen')
  })

  it('renders upcoming raid cards', () => {
    const raids = useRaidsStore()
    raids.raids = [sampleRaid()]
    const wrapper = mountView()
    expect(wrapper.text()).toContain('Karazhan')
    expect(wrapper.text()).toContain('Kommende Raids')
  })

  it('renders past raids with past label', () => {
    const raids = useRaidsStore()
    raids.raids = [sampleRaid({ date: '2020-01-01' })]
    const wrapper = mountView()
    expect(wrapper.text()).toContain('Vergangene Raids')
  })

  it('filters raids by size', async () => {
    const raids = useRaidsStore()
    raids.raids = [
      sampleRaid({ id: 'r1', maxPlayers: 10 }),
      sampleRaid({ id: 'r2', instance: 'Schwarzer Tempel', maxPlayers: 25 }),
    ]
    const wrapper = mountView()
    // Click 10er filter
    const btns = wrapper.findAll('.rf-btn')
    const btn10 = btns.find(b => b.text() === '10er')
    await btn10!.trigger('click')
    expect(wrapper.text()).toContain('Karazhan')
    expect(wrapper.text()).not.toContain('Schwarzer Tempel')
  })

  it('switches to create form', async () => {
    const auth = useAuthStore()
    auth.user = { token: 't', username: 'u', userId: 'uid1' }
    const wrapper = mountView()
    const createBtn = wrapper.findAll('.rt-btn').find(b => b.text().includes('Raid erstellen'))
    await createBtn!.trigger('click')
    expect(wrapper.text()).toContain('Instanz')
    expect(wrapper.text()).toContain('Datum')
    expect(wrapper.text()).toContain('Erstellen')
  })

  it('shows weekly calendar when toggled', async () => {
    const wrapper = mountView()
    const weekBtn = wrapper.findAll('.rt-btn').find(b => b.text() === 'Woche')
    await weekBtn!.trigger('click')
    expect(wrapper.text()).toContain('Heute')
    // Calendar navigation should appear
    expect(wrapper.find('.cal-nav').exists()).toBe(true)
  })

  it('shows monthly calendar when toggled', async () => {
    const wrapper = mountView()
    const monthBtn = wrapper.findAll('.rt-btn').find(b => b.text() === 'Monat')
    await monthBtn!.trigger('click')
    expect(wrapper.find('.cal-grid').exists()).toBe(true)
  })

  it('separates upcoming and past raids', () => {
    const raids = useRaidsStore()
    raids.raids = [
      sampleRaid({ id: 'r1', date: '2099-12-01' }),
      sampleRaid({ id: 'r2', instance: 'Gruuls Unterschlupf', date: '2020-01-01', maxPlayers: 25 }),
    ]
    const wrapper = mountView()
    expect(wrapper.text()).toContain('Kommende Raids (1)')
    expect(wrapper.text()).toContain('Vergangene Raids (1)')
  })

  it('renders raid card with role counts', () => {
    const raids = useRaidsStore()
    raids.raids = [sampleRaid({
      signups: [
        { entryId: 'e1', charName: 'Tank1', className: 'Krieger', spec: 'Prot', role: 'Tank', status: 'accepted' },
        { entryId: 'e2', charName: 'Heal1', className: 'Priester', spec: 'Holy', role: 'Heiler', status: 'accepted' },
        { entryId: 'e3', charName: 'Dps1', className: 'Magier', spec: 'Fire', role: 'DPS', status: 'accepted' },
      ],
    })]
    const wrapper = mountView()
    expect(wrapper.text()).toContain('Tank')
    expect(wrapper.text()).toContain('Heiler')
    expect(wrapper.text()).toContain('DPS')
  })
})

import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import RaidDetailView from '@/views/RaidDetailView.vue'
import { useRaidsStore } from '@/stores/raids'
import { useAuthStore } from '@/stores/auth'
import type { Raid } from '@/types'

function makeRouter() {
  return createRouter({
    history: createWebHashHistory(),
    routes: [
      { path: '/', redirect: '/raids' },
      { path: '/raids', component: { template: '<div>Raids</div>' } },
      { path: '/raids/:id', component: RaidDetailView },
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
    description: 'Testenraidebeschreibung',
    signups: [],
    timestamp: new Date().toISOString(),
    createdBy: 'owner1',
    createdByName: 'TestUser',
    ...overrides,
  }
}

describe('RaidDetailView', () => {
  let pinia: ReturnType<typeof createPinia>
  let router: ReturnType<typeof makeRouter>

  beforeEach(async () => {
    pinia = createPinia()
    setActivePinia(pinia)
    router = makeRouter()
    router.push('/raids/r1')
    await router.isReady()
  })

  function mountView() {
    return mount(RaidDetailView, {
      global: {
        plugins: [pinia, router],
        stubs: { Teleport: true },
      },
    })
  }

  it('shows not found when raid does not exist', () => {
    const wrapper = mountView()
    expect(wrapper.text()).toContain('Raid nicht gefunden')
  })

  it('renders raid header with instance name', () => {
    const raids = useRaidsStore()
    raids.raids = [sampleRaid()]
    const wrapper = mountView()
    expect(wrapper.find('.raid-inst').text()).toBe('Karazhan')
  })

  it('renders raid date and time', () => {
    const raids = useRaidsStore()
    raids.raids = [sampleRaid()]
    const wrapper = mountView()
    expect(wrapper.text()).toContain('01.12.2099')
    expect(wrapper.text()).toContain('20:00 Uhr')
  })

  it('shows role counts', () => {
    const raids = useRaidsStore()
    raids.raids = [sampleRaid({
      signups: [
        { entryId: 'e1', charName: 'T1', className: 'Krieger', spec: 'Prot', role: 'Tank', status: 'accepted' },
        { entryId: 'e2', charName: 'H1', className: 'Priester', spec: 'Holy', role: 'Heiler', status: 'accepted' },
      ],
    })]
    const wrapper = mountView()
    expect(wrapper.text()).toContain('Tank')
    expect(wrapper.text()).toContain('Heiler')
    expect(wrapper.text()).toContain('DPS')
  })

  it('renders signups grouped by role', () => {
    const raids = useRaidsStore()
    raids.raids = [sampleRaid({
      signups: [
        { entryId: 'e1', charName: 'Tankchar', className: 'Krieger', spec: 'Prot', role: 'Tank', status: 'accepted' },
        { entryId: 'e2', charName: 'Healchar', className: 'Priester', spec: 'Holy', role: 'Heiler', status: 'accepted' },
        { entryId: 'e3', charName: 'Dpschar', className: 'Magier', spec: 'Fire', role: 'DPS', status: 'accepted' },
      ],
    })]
    const wrapper = mountView()
    expect(wrapper.text()).toContain('Tankchar')
    expect(wrapper.text()).toContain('Healchar')
    expect(wrapper.text()).toContain('Dpschar')
  })

  it('shows back link to raids list', () => {
    const raids = useRaidsStore()
    raids.raids = [sampleRaid()]
    const wrapper = mountView()
    expect(wrapper.find('.back-link').text()).toContain('Alle Raids')
  })

  it('shows signup button when logged in and not past', () => {
    const raids = useRaidsStore()
    raids.raids = [sampleRaid()]
    const auth = useAuthStore()
    auth.user = { token: 't', username: 'u', userId: 'uid1' }
    const wrapper = mountView()
    expect(wrapper.find('.btn-signup').exists()).toBe(true)
  })

  it('does not show signup button when not logged in', () => {
    const raids = useRaidsStore()
    raids.raids = [sampleRaid()]
    const wrapper = mountView()
    expect(wrapper.find('.btn-signup').exists()).toBe(false)
  })

  it('shows owner controls when user is creator', () => {
    const raids = useRaidsStore()
    raids.raids = [sampleRaid({ createdBy: 'uid1' })]
    const auth = useAuthStore()
    auth.user = { token: 't', username: 'u', userId: 'uid1' }
    const wrapper = mountView()
    expect(wrapper.text()).toContain('Bearbeiten')
    expect(wrapper.text()).toContain('Sperren')
    expect(wrapper.text()).toContain('Discord')
    expect(wrapper.text()).toContain('Loeschen')
  })

  it('does not show owner controls for non-owners', () => {
    const raids = useRaidsStore()
    raids.raids = [sampleRaid({ createdBy: 'other' })]
    const auth = useAuthStore()
    auth.user = { token: 't', username: 'u', userId: 'uid1' }
    const wrapper = mountView()
    expect(wrapper.find('.btn-raid-del').exists()).toBe(false)
  })

  it('shows description when present', () => {
    const raids = useRaidsStore()
    raids.raids = [sampleRaid({ description: 'Loot nach DKP' })]
    const wrapper = mountView()
    expect(wrapper.text()).toContain('Loot nach DKP')
  })

  it('shows locked status', () => {
    const raids = useRaidsStore()
    raids.raids = [sampleRaid({ locked: true })]
    const wrapper = mountView()
    expect(wrapper.text()).toContain('Gesperrt')
  })

  it('shows declined signups', () => {
    const raids = useRaidsStore()
    raids.raids = [sampleRaid({
      signups: [
        { entryId: 'e1', charName: 'Absager', className: 'Magier', spec: 'Fire', role: 'DPS', status: 'declined' },
      ],
    })]
    const wrapper = mountView()
    expect(wrapper.text()).toContain('Abgesagt')
    expect(wrapper.text()).toContain('Absager')
  })

  it('shows confirmed badge for confirmed signups', () => {
    const raids = useRaidsStore()
    raids.raids = [sampleRaid({
      signups: [
        { entryId: 'e1', charName: 'Bestchar', className: 'Krieger', spec: 'Prot', role: 'Tank', status: 'confirmed' },
      ],
    })]
    const wrapper = mountView()
    expect(wrapper.text()).toContain('Bestaetigt')
  })
})

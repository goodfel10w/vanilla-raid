import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import DkpAwardForm from '@/components/dkp/DkpAwardForm.vue'
import { useDkpStore } from '@/stores/dkp'
import { useEntriesStore } from '@/stores/entries'
import { useRaidsStore } from '@/stores/raids'
import { useUiStore } from '@/stores/ui'

function makeRouter() {
  return createRouter({
    history: createWebHashHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/dkp', component: { template: '<div />' } },
    ],
  })
}

function mountAward() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = makeRouter()

  const wrapper = mount(DkpAwardForm, {
    global: {
      plugins: [pinia, router],
      stubs: { Teleport: true },
    },
  })

  const dkp = useDkpStore()
  const entries = useEntriesStore()
  const raids = useRaidsStore()
  const ui = useUiStore()

  return { wrapper, dkp, entries, raids, ui }
}

// Helper to create a past raid
function makePastRaid(id: string, instance: string, signups: any[] = []) {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const date = yesterday.toISOString().slice(0, 10)
  return {
    id,
    instance,
    date,
    time: '20:00',
    maxPlayers: 25,
    locked: false,
    notes: '',
    description: '',
    signups,
    timestamp: new Date().toISOString(),
  }
}

describe('DkpAwardForm', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders form title', () => {
    const { wrapper } = mountAward()
    expect(wrapper.text()).toContain('DKP vergeben')
  })

  it('shows player chips from entries', async () => {
    const { wrapper, entries } = mountAward()
    entries.entries = [
      { id: '1', charName: 'Thrall', className: 'Schamane', specs: [], roles: [], availability: {}, notes: '', timestamp: '' },
      { id: '2', charName: 'Jaina', className: 'Magier', specs: [], roles: [], availability: {}, notes: '', timestamp: '' },
    ] as any
    await wrapper.vm.$nextTick()

    const chips = wrapper.findAll('.dkp-pchip')
    expect(chips.length).toBe(2)
    expect(chips[0].text()).toBe('Thrall')
    expect(chips[1].text()).toBe('Jaina')
  })

  it('shows empty message when no entries', () => {
    const { wrapper } = mountAward()
    expect(wrapper.text()).toContain('Keine Spieler im Kader')
  })

  it('toggles player selection on chip click', async () => {
    const { wrapper, entries } = mountAward()
    entries.entries = [
      { id: '1', charName: 'Thrall', className: 'Schamane', specs: [], roles: [], availability: {}, notes: '', timestamp: '' },
    ] as any
    await wrapper.vm.$nextTick()

    const chip = wrapper.find('.dkp-pchip')
    expect(chip.classes()).not.toContain('active')

    await chip.trigger('click')
    expect(chip.classes()).toContain('active')

    await chip.trigger('click')
    expect(chip.classes()).not.toContain('active')
  })

  it('selects all players on Alle click', async () => {
    const { wrapper, entries } = mountAward()
    entries.entries = [
      { id: '1', charName: 'Thrall', className: 'Schamane', specs: [], roles: [], availability: {}, notes: '', timestamp: '' },
      { id: '2', charName: 'Jaina', className: 'Magier', specs: [], roles: [], availability: {}, notes: '', timestamp: '' },
    ] as any
    await wrapper.vm.$nextTick()

    // The first .dkp-selectall is on the player section
    const selectAlls = wrapper.findAll('.dkp-selectall')
    const playerSelectAll = selectAlls[selectAlls.length - 1]
    await playerSelectAll.trigger('click')
    const activeChips = wrapper.findAll('.dkp-pchip.active')
    expect(activeChips.length).toBe(2)
  })

  it('has award amount input when not in boss mode', () => {
    const { wrapper } = mountAward()
    expect(wrapper.find('#dkp-award-amount').exists()).toBe(true)
  })

  it('has award reason input', () => {
    const { wrapper } = mountAward()
    expect(wrapper.find('#dkp-award-reason').exists()).toBe(true)
  })

  it('submit button is disabled when no players selected', () => {
    const { wrapper } = mountAward()
    const btn = wrapper.find('#dkp-award-btn')
    expect(btn.attributes('disabled')).toBeDefined()
  })

  it('shows preview when players and amount are set', async () => {
    const { wrapper, entries } = mountAward()
    entries.entries = [
      { id: '1', charName: 'Thrall', className: 'Schamane', specs: [], roles: [], availability: {}, notes: '', timestamp: '' },
    ] as any
    await wrapper.vm.$nextTick()

    // Select player
    await wrapper.find('.dkp-pchip').trigger('click')
    // Set amount
    await wrapper.find('#dkp-award-amount').setValue('10')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('#dkp-award-preview').exists()).toBe(true)
    expect(wrapper.text()).toContain('10 DKP')
  })

  it('calls award on submit', async () => {
    const { wrapper, entries, dkp, ui } = mountAward()
    entries.entries = [
      { id: '1', charName: 'Thrall', className: 'Schamane', specs: [], roles: [], availability: {}, notes: '', timestamp: '' },
    ] as any
    dkp.award = vi.fn()
    await wrapper.vm.$nextTick()

    // Select player
    await wrapper.find('.dkp-pchip').trigger('click')
    // Fill amount
    await wrapper.find('#dkp-award-amount').setValue('10')
    // Fill reason
    await wrapper.find('#dkp-award-reason').setValue('Boss Kill')
    await wrapper.vm.$nextTick()

    // Submit
    await wrapper.find('#dkp-award-btn').trigger('click')
    expect(dkp.award).toHaveBeenCalledWith(
      [{ name: 'Thrall', className: 'Schamane' }],
      10,
      'Boss Kill',
    )
  })

  // --- Multi-raid selection tests ---

  it('shows raid chips for past raids', async () => {
    const { wrapper, raids } = mountAward()
    raids.raids = [
      makePastRaid('r1', 'Gruuls Unterschlupf'),
      makePastRaid('r2', 'Magtheridons Kammer'),
    ] as any
    await wrapper.vm.$nextTick()

    const raidChips = wrapper.findAll('.raid-chip')
    expect(raidChips.length).toBe(2)
    expect(raidChips[0].text()).toContain('Gruuls Unterschlupf')
    expect(raidChips[1].text()).toContain('Magtheridons Kammer')
  })

  it('selects a raid and loads its players', async () => {
    const { wrapper, raids, entries } = mountAward()
    entries.entries = [
      { id: 'e1', charName: 'Thrall', className: 'Schamane', specs: [], roles: [], availability: {}, notes: '', timestamp: '' },
      { id: 'e2', charName: 'Jaina', className: 'Magier', specs: [], roles: [], availability: {}, notes: '', timestamp: '' },
    ] as any
    raids.raids = [
      makePastRaid('r1', 'Gruuls Unterschlupf', [
        { entryId: 'e1', charName: 'Thrall', className: 'Schamane', status: 'accepted', spec: '', role: 'DPS' },
        { entryId: 'e2', charName: 'Jaina', className: 'Magier', status: 'declined', spec: '', role: 'DPS' },
      ]),
    ] as any
    await wrapper.vm.$nextTick()

    await wrapper.find('.raid-chip').trigger('click')
    await wrapper.vm.$nextTick()

    // Only Thrall should be selected (Jaina is declined)
    const activeChips = wrapper.findAll('.dkp-pchip.active')
    expect(activeChips.length).toBe(1)
    expect(activeChips[0].text()).toBe('Thrall')
  })

  it('combines players from multiple raids', async () => {
    const { wrapper, raids, entries } = mountAward()
    entries.entries = [
      { id: 'e1', charName: 'Thrall', className: 'Schamane', specs: [], roles: [], availability: {}, notes: '', timestamp: '' },
      { id: 'e2', charName: 'Jaina', className: 'Magier', specs: [], roles: [], availability: {}, notes: '', timestamp: '' },
      { id: 'e3', charName: 'Arthas', className: 'Paladin', specs: [], roles: [], availability: {}, notes: '', timestamp: '' },
    ] as any
    raids.raids = [
      makePastRaid('r1', 'Gruuls Unterschlupf', [
        { entryId: 'e1', charName: 'Thrall', className: 'Schamane', status: 'accepted', spec: '', role: 'DPS' },
        { entryId: 'e2', charName: 'Jaina', className: 'Magier', status: 'accepted', spec: '', role: 'DPS' },
      ]),
      makePastRaid('r2', 'Magtheridons Kammer', [
        { entryId: 'e2', charName: 'Jaina', className: 'Magier', status: 'accepted', spec: '', role: 'DPS' },
        { entryId: 'e3', charName: 'Arthas', className: 'Paladin', status: 'accepted', spec: '', role: 'Tank' },
      ]),
    ] as any
    await wrapper.vm.$nextTick()

    // Select both raids
    const raidChips = wrapper.findAll('.raid-chip')
    await raidChips[0].trigger('click')
    await raidChips[1].trigger('click')
    await wrapper.vm.$nextTick()

    // Should have 3 unique players (Thrall, Jaina, Arthas)
    const activeChips = wrapper.findAll('.dkp-pchip.active')
    expect(activeChips.length).toBe(3)

    // Should show combined hint
    expect(wrapper.text()).toContain('2 Raids kombiniert')
  })

  it('shows boss-mode toggle when raids with bosses are selected', async () => {
    const { wrapper, raids } = mountAward()
    raids.raids = [
      makePastRaid('r1', 'Gruuls Unterschlupf', [
        { entryId: 'e1', charName: 'Thrall', className: 'Schamane', status: 'accepted', spec: '', role: 'DPS' },
      ]),
    ] as any
    await wrapper.vm.$nextTick()

    // Before selecting raid, no boss toggle
    expect(wrapper.find('.boss-mode-toggle').exists()).toBe(false)

    // Select raid
    await wrapper.find('.raid-chip').trigger('click')
    await wrapper.vm.$nextTick()

    // Now boss toggle should appear
    expect(wrapper.find('.boss-mode-toggle').exists()).toBe(true)
  })

  it('shows boss chips when boss mode is enabled', async () => {
    const { wrapper, raids } = mountAward()
    raids.raids = [
      makePastRaid('r1', 'Gruuls Unterschlupf', [
        { entryId: 'e1', charName: 'Thrall', className: 'Schamane', status: 'accepted', spec: '', role: 'DPS' },
      ]),
    ] as any
    await wrapper.vm.$nextTick()

    // Select raid
    await wrapper.find('.raid-chip').trigger('click')
    await wrapper.vm.$nextTick()

    // Enable boss mode
    await wrapper.find('.boss-mode-toggle input').setValue(true)
    await wrapper.vm.$nextTick()

    // Should show Gruul bosses (Maulgar, Gruul)
    const bossChips = wrapper.findAll('.boss-chip')
    expect(bossChips.length).toBe(2)
    expect(bossChips[0].text()).toContain('Maulgar')
    expect(bossChips[1].text()).toContain('Gruul')
  })

  it('hides amount input in boss mode', async () => {
    const { wrapper, raids } = mountAward()
    raids.raids = [
      makePastRaid('r1', 'Gruuls Unterschlupf', [
        { entryId: 'e1', charName: 'Thrall', className: 'Schamane', status: 'accepted', spec: '', role: 'DPS' },
      ]),
    ] as any
    await wrapper.vm.$nextTick()

    // Amount input visible before boss mode
    expect(wrapper.find('#dkp-award-amount').exists()).toBe(true)

    await wrapper.find('.raid-chip').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('.boss-mode-toggle input').setValue(true)
    await wrapper.vm.$nextTick()

    // Amount input hidden in boss mode
    expect(wrapper.find('#dkp-award-amount').exists()).toBe(false)
  })

  it('calculates DKP total from selected bosses', async () => {
    const { wrapper, raids, entries } = mountAward()
    entries.entries = [
      { id: 'e1', charName: 'Thrall', className: 'Schamane', specs: [], roles: [], availability: {}, notes: '', timestamp: '' },
    ] as any
    raids.raids = [
      makePastRaid('r1', 'Gruuls Unterschlupf', [
        { entryId: 'e1', charName: 'Thrall', className: 'Schamane', status: 'accepted', spec: '', role: 'DPS' },
      ]),
    ] as any
    await wrapper.vm.$nextTick()

    // Select raid + boss mode
    await wrapper.find('.raid-chip').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('.boss-mode-toggle input').setValue(true)
    await wrapper.vm.$nextTick()

    // Select both bosses: Maulgar (3 DKP) + Gruul (5 DKP) = 8 DKP
    const bossChips = wrapper.findAll('.boss-chip')
    await bossChips[0].trigger('click')
    await bossChips[1].trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('8 DKP')
    expect(wrapper.find('.boss-total').text()).toContain('2 Bosse')
  })

  it('shows bosses from multiple combined raids', async () => {
    const { wrapper, raids } = mountAward()
    raids.raids = [
      makePastRaid('r1', 'Gruuls Unterschlupf', [
        { entryId: 'e1', charName: 'Thrall', className: 'Schamane', status: 'accepted', spec: '', role: 'DPS' },
      ]),
      makePastRaid('r2', 'Magtheridons Kammer', [
        { entryId: 'e1', charName: 'Thrall', className: 'Schamane', status: 'accepted', spec: '', role: 'DPS' },
      ]),
    ] as any
    await wrapper.vm.$nextTick()

    // Select both raids
    const raidChips = wrapper.findAll('.raid-chip')
    await raidChips[0].trigger('click')
    await raidChips[1].trigger('click')
    await wrapper.vm.$nextTick()

    // Enable boss mode
    await wrapper.find('.boss-mode-toggle input').setValue(true)
    await wrapper.vm.$nextTick()

    // Should show bosses from both instances
    const bossInstances = wrapper.findAll('.boss-instance')
    expect(bossInstances.length).toBe(2)

    // Gruul bosses (2) + Magtheridon bosses (1) = 3 total boss chips
    const bossChips = wrapper.findAll('.boss-chip')
    expect(bossChips.length).toBe(3)
  })

  it('submits with boss DKP total in boss mode', async () => {
    const { wrapper, raids, entries, dkp } = mountAward()
    entries.entries = [
      { id: 'e1', charName: 'Thrall', className: 'Schamane', specs: [], roles: [], availability: {}, notes: '', timestamp: '' },
    ] as any
    raids.raids = [
      makePastRaid('r1', 'Gruuls Unterschlupf', [
        { entryId: 'e1', charName: 'Thrall', className: 'Schamane', status: 'accepted', spec: '', role: 'DPS' },
      ]),
    ] as any
    dkp.award = vi.fn()
    await wrapper.vm.$nextTick()

    // Select raid + boss mode
    await wrapper.find('.raid-chip').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('.boss-mode-toggle input').setValue(true)
    await wrapper.vm.$nextTick()

    // Select Gruul boss only (5 DKP)
    const bossChips = wrapper.findAll('.boss-chip')
    await bossChips[1].trigger('click') // Gruul
    await wrapper.vm.$nextTick()

    // Submit
    await wrapper.find('#dkp-award-btn').trigger('click')
    await wrapper.vm.$nextTick()

    expect(dkp.award).toHaveBeenCalledWith(
      [{ name: 'Thrall', className: 'Schamane' }],
      5,
      expect.stringContaining('Gruul'),
    )
  })
})

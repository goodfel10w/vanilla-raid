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

    await wrapper.find('.dkp-selectall').trigger('click')
    const activeChips = wrapper.findAll('.dkp-pchip.active')
    expect(activeChips.length).toBe(2)
  })

  it('has award amount input', () => {
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
})

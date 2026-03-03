import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AnalyticsView from '@/views/AnalyticsView.vue'
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

function fullHourAvail(day: string, hour: number): Record<string, 'yes' | 'tentative'> {
  const avail: Record<string, 'yes' | 'tentative'> = {}
  for (const m of [0, 15, 30, 45]) {
    avail[`${day}_${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')}`] = 'yes'
  }
  return avail
}

describe('AnalyticsView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders with #v-analytics container', () => {
    const wrapper = mount(AnalyticsView)
    expect(wrapper.find('#v-analytics').exists()).toBe(true)
  })

  it('shows empty state when no entries', () => {
    const wrapper = mount(AnalyticsView)
    expect(wrapper.find('.empty').exists()).toBe(true)
  })

  it('shows role distribution with counts', () => {
    const store = useEntriesStore()
    store.entries = [
      makeEntry({ id: '1', roles: ['Tank'] }),
      makeEntry({ id: '2', charName: 'Healer', className: 'Priester', roles: ['Heiler'], specs: ['Holy'] }),
      makeEntry({ id: '3', charName: 'DPS1', className: 'Magier', roles: ['DPS'], specs: ['Fire'] }),
    ]
    const wrapper = mount(AnalyticsView)
    const roleItems = wrapper.findAll('.role-an-item')
    expect(roleItems).toHaveLength(3)
    // Tank: 1, Heiler: 1, DPS: 1
    expect(roleItems[0].find('.big').text()).toBe('1')
    expect(roleItems[1].find('.big').text()).toBe('1')
    expect(roleItems[2].find('.big').text()).toBe('1')
  })

  it('shows flexibility info', () => {
    const store = useEntriesStore()
    store.entries = [
      makeEntry({ id: '1', specs: ['Prot', 'Arms'], roles: ['Tank', 'DPS'] }),
      makeEntry({ id: '2', charName: 'Single', specs: ['Fire'], roles: ['DPS'], className: 'Magier' }),
    ]
    const wrapper = mount(AnalyticsView)
    const flexInfo = wrapper.find('.flex-info')
    expect(flexInfo.exists()).toBe(true)
    expect(flexInfo.text()).toContain('Mehrfach-Spec')
  })

  it('shows class distribution bars', () => {
    const store = useEntriesStore()
    store.entries = [
      makeEntry({ id: '1', className: 'Magier', charName: 'M1' }),
      makeEntry({ id: '2', className: 'Magier', charName: 'M2' }),
      makeEntry({ id: '3', className: 'Krieger', charName: 'W1' }),
    ]
    const wrapper = mount(AnalyticsView)
    const bars = wrapper.findAll('.bar-row')
    expect(bars.length).toBe(2)
    // Magier first (count 2)
    expect(bars[0].find('.bar-lbl').text()).toBe('Magier')
    expect(bars[1].find('.bar-lbl').text()).toBe('Krieger')
  })

  it('shows best raid times section', () => {
    const store = useEntriesStore()
    store.entries = [
      makeEntry({
        id: '1',
        availability: fullHourAvail('Montag', 20),
      }),
    ]
    const wrapper = mount(AnalyticsView)
    const bsCards = wrapper.findAll('.bs-card')
    expect(bsCards.length).toBeGreaterThanOrEqual(1)
  })

  it('shows role breakdown in best raid times', () => {
    const store = useEntriesStore()
    store.entries = [
      makeEntry({
        id: '1',
        roles: ['Tank'],
        availability: fullHourAvail('Montag', 20),
      }),
    ]
    const wrapper = mount(AnalyticsView)
    const bsRoles = wrapper.findAll('.bs-role')
    expect(bsRoles.length).toBeGreaterThanOrEqual(3) // Tank, Heiler, DPS
  })

  it('shows player availability ranking', () => {
    const store = useEntriesStore()
    store.entries = [
      makeEntry({
        id: '1',
        charName: 'Active',
        availability: {
          ...fullHourAvail('Montag', 18),
          ...fullHourAvail('Montag', 19),
        },
      }),
      makeEntry({ id: '2', charName: 'Lazy', className: 'Magier' }),
    ]
    const wrapper = mount(AnalyticsView)
    const pbarRows = wrapper.findAll('.pbar-row')
    expect(pbarRows).toHaveLength(2)
    // Active player first (more slots)
    expect(pbarRows[0].find('.pbar-name').text()).toBe('Active')
    expect(pbarRows[0].find('.pbar-val').text()).toContain('8 Slots')
    expect(pbarRows[1].find('.pbar-name').text()).toBe('Lazy')
    expect(pbarRows[1].find('.pbar-val').text()).toContain('0 Slots')
  })

  it('hides all sections when no entries', () => {
    const wrapper = mount(AnalyticsView)
    expect(wrapper.findAll('.role-an-item').length).toBe(0)
    expect(wrapper.findAll('.bar-row').length).toBe(0)
    expect(wrapper.findAll('.bs-card').length).toBe(0)
    expect(wrapper.findAll('.pbar-row').length).toBe(0)
  })
})

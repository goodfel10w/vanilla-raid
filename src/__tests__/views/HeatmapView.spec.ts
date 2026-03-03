import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HeatmapView from '@/views/HeatmapView.vue'
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

describe('HeatmapView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders with #v-heatmap container', () => {
    const wrapper = mount(HeatmapView, {
      global: { stubs: { Teleport: true } },
    })
    expect(wrapper.find('#v-heatmap').exists()).toBe(true)
  })

  it('renders mode toggle buttons', () => {
    const wrapper = mount(HeatmapView, {
      global: { stubs: { Teleport: true } },
    })
    const buttons = wrapper.findAll('.ht-btn')
    expect(buttons).toHaveLength(3)
    expect(buttons[0].text()).toContain('1h')
    expect(buttons[1].text()).toContain('3h')
    expect(buttons[2].text()).toContain('4h')
  })

  it('1h mode is active by default', () => {
    const wrapper = mount(HeatmapView, {
      global: { stubs: { Teleport: true } },
    })
    const active = wrapper.findAll('.ht-btn.active')
    expect(active).toHaveLength(1)
    expect(active[0].text()).toContain('1h')
  })

  it('switches to 3h mode on click', async () => {
    const wrapper = mount(HeatmapView, {
      global: { stubs: { Teleport: true } },
    })
    const btn3h = wrapper.findAll('.ht-btn')[1]
    await btn3h.trigger('click')
    expect(btn3h.classes()).toContain('active')
  })

  it('renders two heatmap tables (weekday and weekend)', () => {
    const wrapper = mount(HeatmapView, {
      global: { stubs: { Teleport: true } },
    })
    const tables = wrapper.findAll('.htable')
    expect(tables).toHaveLength(2)
  })

  it('renders section labels', () => {
    const wrapper = mount(HeatmapView, {
      global: { stubs: { Teleport: true } },
    })
    const labels = wrapper.findAll('.sec-l')
    expect(labels.length).toBeGreaterThanOrEqual(2)
    expect(labels[0].text()).toBe('Unter der Woche')
    expect(labels[1].text()).toBe('Wochenende')
  })

  it('renders heatmap cells', () => {
    const store = useEntriesStore()
    store.entries = [
      makeEntry({ id: '1', availability: fullHourAvail('Montag', 18) }),
    ]
    const wrapper = mount(HeatmapView, {
      global: { stubs: { Teleport: true } },
    })
    const cells = wrapper.findAll('.hcell')
    expect(cells.length).toBeGreaterThan(0)
  })

  it('shows top raid windows when entries exist', () => {
    const store = useEntriesStore()
    store.entries = [
      makeEntry({ id: '1', availability: fullHourAvail('Montag', 18) }),
    ]
    const wrapper = mount(HeatmapView, {
      global: { stubs: { Teleport: true } },
    })
    const topSlots = wrapper.findAll('.tslot')
    expect(topSlots.length).toBeGreaterThanOrEqual(1)
  })

  it('renders tooltip element', () => {
    const wrapper = mount(HeatmapView, {
      global: { stubs: { Teleport: true } },
    })
    expect(wrapper.find('#htooltip').exists()).toBe(true)
  })

  it('switches to 4h mode on click', async () => {
    const wrapper = mount(HeatmapView, {
      global: { stubs: { Teleport: true } },
    })
    const btn4h = wrapper.findAll('.ht-btn')[2]
    await btn4h.trigger('click')
    expect(btn4h.classes()).toContain('active')
  })
})

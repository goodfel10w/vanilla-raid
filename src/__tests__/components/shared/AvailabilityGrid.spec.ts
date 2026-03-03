import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AvailabilityGrid from '@/components/shared/AvailabilityGrid.vue'

describe('AvailabilityGrid', () => {
  it('renders 7 day rows', () => {
    const wrapper = mount(AvailabilityGrid, {
      props: { modelValue: {} },
    })
    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(7)
  })

  it('renders 48 cells per day row', () => {
    const wrapper = mount(AvailabilityGrid, {
      props: { modelValue: {} },
    })
    const firstRow = wrapper.find('tbody tr')
    const cells = firstRow.findAll('.tl-cell')
    expect(cells).toHaveLength(48)
  })

  it('marks "yes" slots with .on class', () => {
    const wrapper = mount(AvailabilityGrid, {
      props: { modelValue: { 'Montag_14:00': 'yes' } },
    })
    const onCell = wrapper.find('.tl-cell.on')
    expect(onCell.exists()).toBe(true)
  })

  it('marks "tentative" slots with .tent class', () => {
    const wrapper = mount(AvailabilityGrid, {
      props: { modelValue: { 'Montag_14:00': 'tentative' } },
    })
    const tentCell = wrapper.find('.tl-cell.tent')
    expect(tentCell.exists()).toBe(true)
  })

  it('cycles on click: empty -> yes', async () => {
    const wrapper = mount(AvailabilityGrid, {
      props: { modelValue: {} },
    })
    const cell = wrapper.find('[data-k="Montag_12:00"]')

    // Click 1: empty -> yes
    await cell.trigger('mousedown')
    let emitted = wrapper.emitted('update:modelValue')!
    expect(emitted[0][0]).toHaveProperty('Montag_12:00', 'yes')
  })

  it('renders day short labels', () => {
    const wrapper = mount(AvailabilityGrid, {
      props: { modelValue: {} },
    })
    expect(wrapper.text()).toContain('Mo')
    expect(wrapper.text()).toContain('Di')
    expect(wrapper.text()).toContain('So')
  })

  it('renders hour labels in header', () => {
    const wrapper = mount(AvailabilityGrid, {
      props: { modelValue: {} },
    })
    expect(wrapper.text()).toContain('12')
    expect(wrapper.text()).toContain('23')
  })
})

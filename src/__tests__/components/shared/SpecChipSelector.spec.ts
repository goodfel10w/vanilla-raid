import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SpecChipSelector from '@/components/shared/SpecChipSelector.vue'

describe('SpecChipSelector', () => {
  it('shows specs for Krieger', () => {
    const wrapper = mount(SpecChipSelector, {
      props: { className: 'Krieger', modelValue: [] },
    })
    expect(wrapper.text()).toContain('Prot')
    expect(wrapper.text()).toContain('Arms')
    expect(wrapper.text()).toContain('Fury')
  })

  it('shows "Wahle zuerst eine Klasse" when no class selected', () => {
    const wrapper = mount(SpecChipSelector, {
      props: { className: '', modelValue: [] },
    })
    expect(wrapper.text()).toContain('Wähle zuerst eine Klasse')
  })

  it('marks selected spec as active', () => {
    const wrapper = mount(SpecChipSelector, {
      props: { className: 'Krieger', modelValue: ['Prot'] },
    })
    const active = wrapper.findAll('.rchip.active')
    expect(active).toHaveLength(1)
    expect(active[0].text()).toContain('Prot')
  })

  it('emits toggle on click', async () => {
    const wrapper = mount(SpecChipSelector, {
      props: { className: 'Krieger', modelValue: [] },
    })
    const chips = wrapper.findAll('.rchip')
    await chips[0].trigger('click')
    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    expect(emitted![0][0]).toContain('Prot')
  })

  it('supports multi-select', async () => {
    const wrapper = mount(SpecChipSelector, {
      props: { className: 'Krieger', modelValue: ['Prot'] },
    })
    const chips = wrapper.findAll('.rchip')
    // Click on Arms (second chip)
    await chips[1].trigger('click')
    const emitted = wrapper.emitted('update:modelValue')
    expect(emitted![0][0]).toContain('Prot')
    expect(emitted![0][0]).toContain('Arms')
  })
})

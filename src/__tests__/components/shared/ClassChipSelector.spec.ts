import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ClassChipSelector from '@/components/shared/ClassChipSelector.vue'

describe('ClassChipSelector', () => {
  it('renders 9 class chips', () => {
    const wrapper = mount(ClassChipSelector, {
      props: { modelValue: null },
    })
    const chips = wrapper.findAll('.chip')
    expect(chips).toHaveLength(9)
  })

  it('marks selected class as active', () => {
    const wrapper = mount(ClassChipSelector, {
      props: { modelValue: 'Krieger' },
    })
    const active = wrapper.findAll('.chip.active')
    expect(active).toHaveLength(1)
    expect(active[0].text()).toContain('Krieger')
  })

  it('emits update on click', async () => {
    const wrapper = mount(ClassChipSelector, {
      props: { modelValue: null },
    })
    const chips = wrapper.findAll('.chip')
    await chips[0].trigger('click')
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')![0][0]).toBe('Druide')
  })

  it('has radiogroup aria role', () => {
    const wrapper = mount(ClassChipSelector, {
      props: { modelValue: null },
    })
    expect(wrapper.find('[role="radiogroup"]').exists()).toBe(true)
  })

  it('shows WoW class icons', () => {
    const wrapper = mount(ClassChipSelector, {
      props: { modelValue: null },
    })
    const icons = wrapper.findAll('.wow-ico')
    expect(icons).toHaveLength(9)
  })
})

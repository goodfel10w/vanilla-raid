import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ConfirmModal from '@/components/shared/ConfirmModal.vue'

describe('ConfirmModal', () => {
  it('is not visible when open is false', () => {
    const wrapper = mount(ConfirmModal, {
      props: { open: false, title: 'Test' },
    })
    expect(wrapper.find('.modal-bg').exists()).toBe(false)
  })

  it('renders when open', () => {
    const wrapper = mount(ConfirmModal, {
      props: { open: true, title: 'Löschen?' },
      global: { stubs: { Teleport: true } },
    })
    expect(wrapper.find('.modal-bg').exists()).toBe(true)
    expect(wrapper.find('.modal-title').text()).toBe('Löschen?')
  })

  it('emits confirm on confirm click', async () => {
    const wrapper = mount(ConfirmModal, {
      props: { open: true, title: 'Test' },
      global: { stubs: { Teleport: true } },
    })
    await wrapper.find('.modal-confirm').trigger('click')
    expect(wrapper.emitted('confirm')).toBeTruthy()
  })

  it('emits cancel on cancel click', async () => {
    const wrapper = mount(ConfirmModal, {
      props: { open: true, title: 'Test' },
      global: { stubs: { Teleport: true } },
    })
    await wrapper.find('.modal-cancel').trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  it('shows custom button labels', () => {
    const wrapper = mount(ConfirmModal, {
      props: {
        open: true,
        title: 'Test',
        confirmLabel: 'Ja',
        cancelLabel: 'Nein',
      },
      global: { stubs: { Teleport: true } },
    })
    expect(wrapper.find('.modal-confirm').text()).toBe('Ja')
    expect(wrapper.find('.modal-cancel').text()).toBe('Nein')
  })
})

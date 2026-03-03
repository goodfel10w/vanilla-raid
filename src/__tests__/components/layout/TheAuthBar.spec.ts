import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth'
import TheAuthBar from '@/components/layout/TheAuthBar.vue'

describe('TheAuthBar', () => {
  it('shows login button when not logged in', () => {
    const pinia = createPinia()
    const wrapper = mount(TheAuthBar, {
      global: { plugins: [pinia] },
    })
    expect(wrapper.find('.btn-bnet').exists()).toBe(true)
    expect(wrapper.find('.btn-logout').exists()).toBe(false)
  })

  it('shows username and logout when logged in', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const auth = useAuthStore()
    auth.saveSession({ token: 'test', username: 'TestPlayer', userId: 'u1' })

    const wrapper = mount(TheAuthBar, {
      global: { plugins: [pinia] },
    })
    expect(wrapper.find('.auth-user').exists()).toBe(true)
    expect(wrapper.text()).toContain('TestPlayer')
    expect(wrapper.find('.btn-logout').exists()).toBe(true)
  })

  it('has #auth-bar id', () => {
    const pinia = createPinia()
    const wrapper = mount(TheAuthBar, {
      global: { plugins: [pinia] },
    })
    expect(wrapper.find('#auth-bar').exists()).toBe(true)
  })
})

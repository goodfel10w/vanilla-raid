import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import TheSidebar from '@/components/layout/TheSidebar.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/dashboard', component: { template: '<div>Dashboard</div>' } },
    { path: '/form', component: { template: '<div>Form</div>' } },
    { path: '/raids', component: { template: '<div>Raids</div>' } },
    { path: '/roster', component: { template: '<div>Roster</div>' } },
    { path: '/heatmap', component: { template: '<div>Heatmap</div>' } },
    { path: '/analytics', component: { template: '<div>Analytics</div>' } },
    { path: '/dkp', component: { template: '<div>DKP</div>' } },
    { path: '/kara', component: { template: '<div>Kara</div>' } },
    { path: '/admin', component: { template: '<div>Admin</div>' } },
  ],
})

describe('TheSidebar', () => {
  it('renders all navigation items', () => {
    const wrapper = mount(TheSidebar, {
      global: { plugins: [createPinia(), router] },
    })
    const tabs = wrapper.findAll('.tab')
    expect(tabs.length).toBeGreaterThanOrEqual(8)
  })

  it('includes guild name', () => {
    const wrapper = mount(TheSidebar, {
      global: { plugins: [createPinia(), router] },
    })
    expect(wrapper.text()).toContain('Vanilla')
  })

  it('does not show admin tab by default', () => {
    const wrapper = mount(TheSidebar, {
      global: { plugins: [createPinia(), router] },
    })
    expect(wrapper.text()).not.toContain('Admin')
  })
})

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from '../App.vue'

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

describe('App', () => {
  it('mounts without error', () => {
    const wrapper = mount(App, {
      global: {
        plugins: [createPinia(), router],
      }
    })
    expect(wrapper.exists()).toBe(true)
  })

  it('renders guild name and title', () => {
    const wrapper = mount(App, {
      global: {
        plugins: [createPinia(), router],
      }
    })
    expect(wrapper.text()).toContain('Vanilla')
    expect(wrapper.text()).toContain('Raid-Planer')
  })
})

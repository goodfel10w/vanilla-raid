import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import DkpView from '@/views/DkpView.vue'
import { useDkpStore } from '@/stores/dkp'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { useEntriesStore } from '@/stores/entries'

function makeRouter() {
  return createRouter({
    history: createWebHashHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/dkp', component: DkpView },
      { path: '/dkp/player/:name', component: { template: '<div />' } },
    ],
  })
}

function mountDkp(options?: { admin?: boolean; officer?: boolean }) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = makeRouter()

  const wrapper = mount(DkpView, {
    global: {
      plugins: [pinia, router],
      stubs: { Teleport: true },
    },
  })

  const dkp = useDkpStore()
  const auth = useAuthStore()
  const ui = useUiStore()
  const entries = useEntriesStore()

  // Stub load to prevent actual fetch
  dkp.load = vi.fn()

  if (options?.admin || options?.officer) {
    auth.user = {
      token: 'test-token',
      username: 'testadmin',
      userId: 'u1',
      isAdmin: options?.admin ?? false,
    }
    if (options?.admin) {
      dkp.config.roles = { testadmin: 'admin' }
    } else if (options?.officer) {
      dkp.config.roles = { testadmin: 'officer' }
    }
  }

  return { wrapper, dkp, auth, ui, entries }
}

describe('DkpView', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders DKP actions bar', () => {
    const { wrapper } = mountDkp()
    expect(wrapper.find('.dkp-actions-bar').exists()).toBe(true)
  })

  it('shows Übersicht tab by default', () => {
    const { wrapper } = mountDkp()
    const buttons = wrapper.findAll('.ht-btn')
    expect(buttons[0].text()).toBe('Übersicht')
    expect(buttons[0].classes()).toContain('active')
  })

  it('shows standings when no sub-view selected', () => {
    const { wrapper } = mountDkp()
    expect(wrapper.find('.dkp-toolbar').exists()).toBe(true)
  })

  it('does not show officer tabs for unauthenticated users', () => {
    const { wrapper } = mountDkp()
    const texts = wrapper.findAll('.ht-btn').map(b => b.text())
    expect(texts).not.toContain('Vergeben')
    expect(texts).not.toContain('Beute')
    expect(texts).not.toContain('Verfall')
    expect(texts).not.toContain('Einstellungen')
  })

  it('shows officer tabs for officers', async () => {
    const { wrapper } = mountDkp({ officer: true })
    await wrapper.vm.$nextTick()
    const texts = wrapper.findAll('.ht-btn').map(b => b.text())
    expect(texts).toContain('Vergeben')
    expect(texts).toContain('Beute')
  })

  it('shows admin tabs for admins', async () => {
    const { wrapper } = mountDkp({ admin: true })
    await wrapper.vm.$nextTick()
    const texts = wrapper.findAll('.ht-btn').map(b => b.text())
    expect(texts).toContain('Verfall')
    expect(texts).toContain('Einstellungen')
  })

  it('displays empty state when no balances', () => {
    const { wrapper } = mountDkp()
    expect(wrapper.text()).toContain('Noch keine DKP-Einträge')
  })

  it('renders standings table when balances exist', async () => {
    const { wrapper, dkp } = mountDkp()
    dkp.balances = [
      { playerName: 'Thrall', className: 'Schamane', balance: 100, lastUpdated: '2024-01-01' },
      { playerName: 'Jaina', className: 'Magier', balance: 50, lastUpdated: '2024-01-01' },
    ]
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.dkp-standings').exists()).toBe(true)
    expect(wrapper.text()).toContain('Thrall')
    expect(wrapper.text()).toContain('Jaina')
  })

  it('shows undo button for admin with transactions', async () => {
    const { wrapper, dkp } = mountDkp({ admin: true })
    dkp.transactions = [
      { id: 'tx1', playerName: 'Thrall', type: 'earn', amount: 10, reason: 'Boss Kill', createdBy: 'admin', timestamp: '2024-01-01T12:00:00Z' },
    ]
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.dkp-undo').exists()).toBe(true)
  })

  it('shows CSV export button', () => {
    const { wrapper } = mountDkp()
    expect(wrapper.find('.dkp-toolbar-btn').text()).toContain('CSV Export')
  })

  it('switches to award form', async () => {
    const { wrapper, ui } = mountDkp({ officer: true })
    ui.dkpView = 'award'
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('DKP vergeben')
  })

  it('switches to spend form', async () => {
    const { wrapper, ui } = mountDkp({ officer: true })
    ui.dkpView = 'spend'
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Beute verteilen')
  })

  it('switches to decay form', async () => {
    const { wrapper, ui } = mountDkp({ admin: true })
    ui.dkpView = 'decay'
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Wöchentlicher Verfall')
  })

  it('switches to settings', async () => {
    const { wrapper, ui } = mountDkp({ admin: true })
    ui.dkpView = 'settings'
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('DKP-Einstellungen')
  })

  it('renders transaction filter buttons', async () => {
    const { wrapper, dkp } = mountDkp()
    dkp.transactions = [
      { id: 'tx1', playerName: 'Thrall', type: 'earn', amount: 10, reason: 'Boss Kill', createdBy: 'admin', timestamp: '2024-01-01T12:00:00Z' },
    ]
    await wrapper.vm.$nextTick()
    const filters = wrapper.findAll('.dkp-tx-filter')
    expect(filters.length).toBe(5)
    expect(filters[0].text()).toBe('Alle')
    expect(filters[1].text()).toBe('Verdient')
    expect(filters[2].text()).toBe('Beute')
    expect(filters[3].text()).toBe('Verfall')
    expect(filters[4].text()).toBe('Anpassung')
  })

  it('renders balance display with correct class', async () => {
    const { wrapper, dkp } = mountDkp()
    dkp.balances = [
      { playerName: 'Thrall', className: 'Schamane', balance: 100, lastUpdated: '2024-01-01' },
      { playerName: 'Jaina', className: 'Magier', balance: -10, lastUpdated: '2024-01-01' },
    ]
    await wrapper.vm.$nextTick()
    const bals = wrapper.findAll('.dkp-bal')
    expect(bals[0].classes()).toContain('dkp-pos')
    expect(bals[1].classes()).toContain('dkp-neg')
  })

  it('renders sortable columns with data-dkp-sort', async () => {
    const { wrapper, dkp } = mountDkp()
    dkp.balances = [
      { playerName: 'Thrall', className: 'Schamane', balance: 100, lastUpdated: '2024-01-01' },
    ]
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-dkp-sort="name"]').exists()).toBe(true)
    expect(wrapper.find('[data-dkp-sort="class"]').exists()).toBe(true)
    expect(wrapper.find('[data-dkp-sort="balance"]').exists()).toBe(true)
  })

  it('renders search input', () => {
    const { wrapper } = mountDkp()
    expect(wrapper.find('#dkp-search-input').exists()).toBe(true)
  })
})

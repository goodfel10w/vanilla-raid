import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import DkpStandings from '@/components/dkp/DkpStandings.vue'
import { useDkpStore } from '@/stores/dkp'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'

function makeRouter() {
  return createRouter({
    history: createWebHashHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/dkp', component: { template: '<div />' } },
      { path: '/dkp/player/:name', component: { template: '<div />' } },
    ],
  })
}

function mountStandings(options?: { admin?: boolean }) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = makeRouter()

  const wrapper = mount(DkpStandings, {
    global: {
      plugins: [pinia, router],
      stubs: { Teleport: true },
    },
  })

  const dkp = useDkpStore()
  const auth = useAuthStore()
  const ui = useUiStore()

  if (options?.admin) {
    auth.user = {
      token: 'test-token',
      username: 'testadmin',
      userId: 'u1',
      isAdmin: true,
    }
    dkp.config.roles = { testadmin: 'admin' }
  }

  return { wrapper, dkp, auth, ui }
}

describe('DkpStandings', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('shows empty state when no balances', () => {
    const { wrapper } = mountStandings()
    expect(wrapper.text()).toContain('Noch keine DKP-Einträge')
  })

  it('renders standings table with players', async () => {
    const { wrapper, dkp } = mountStandings()
    dkp.balances = [
      { playerName: 'Thrall', className: 'Schamane', balance: 100, lastUpdated: '2024-01-01' },
      { playerName: 'Jaina', className: 'Magier', balance: 50, lastUpdated: '2024-01-01' },
    ]
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.dkp-standings').exists()).toBe(true)
    const rows = wrapper.findAll('.dkp-standings tbody tr')
    expect(rows.length).toBe(2)
    expect(rows[0].text()).toContain('Thrall')
    expect(rows[1].text()).toContain('Jaina')
  })

  it('sorts by balance desc by default', async () => {
    const { wrapper, dkp } = mountStandings()
    dkp.balances = [
      { playerName: 'Jaina', className: 'Magier', balance: 50, lastUpdated: '2024-01-01' },
      { playerName: 'Thrall', className: 'Schamane', balance: 100, lastUpdated: '2024-01-01' },
    ]
    await wrapper.vm.$nextTick()
    const rows = wrapper.findAll('.dkp-standings tbody tr')
    expect(rows[0].text()).toContain('Thrall')
    expect(rows[1].text()).toContain('Jaina')
  })

  it('toggles sort direction on column click', async () => {
    const { wrapper, dkp, ui } = mountStandings()
    dkp.balances = [
      { playerName: 'Thrall', className: 'Schamane', balance: 100, lastUpdated: '2024-01-01' },
      { playerName: 'Jaina', className: 'Magier', balance: 50, lastUpdated: '2024-01-01' },
    ]
    await wrapper.vm.$nextTick()

    // Click balance header (already sorted desc, should toggle to asc)
    await wrapper.find('[data-dkp-sort="balance"]').trigger('click')
    expect(ui.dkpSortDir).toBe('asc')

    await wrapper.vm.$nextTick()
    const rows = wrapper.findAll('.dkp-standings tbody tr')
    expect(rows[0].text()).toContain('Jaina')
  })

  it('sorts by name on name header click', async () => {
    const { wrapper, dkp, ui } = mountStandings()
    dkp.balances = [
      { playerName: 'Thrall', className: 'Schamane', balance: 100, lastUpdated: '2024-01-01' },
      { playerName: 'Arthas', className: 'Paladin', balance: 50, lastUpdated: '2024-01-01' },
    ]
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-dkp-sort="name"]').trigger('click')
    expect(ui.dkpSortCol).toBe('name')
    expect(ui.dkpSortDir).toBe('asc')

    await wrapper.vm.$nextTick()
    const rows = wrapper.findAll('.dkp-standings tbody tr')
    expect(rows[0].text()).toContain('Arthas')
  })

  it('filters by search query', async () => {
    const { wrapper, dkp, ui } = mountStandings()
    dkp.balances = [
      { playerName: 'Thrall', className: 'Schamane', balance: 100, lastUpdated: '2024-01-01' },
      { playerName: 'Jaina', className: 'Magier', balance: 50, lastUpdated: '2024-01-01' },
    ]
    await wrapper.vm.$nextTick()

    ui.dkpSearchQuery = 'thr'
    await wrapper.vm.$nextTick()

    const rows = wrapper.findAll('.dkp-standings tbody tr')
    expect(rows.length).toBe(1)
    expect(rows[0].text()).toContain('Thrall')
  })

  it('shows filter count when searching', async () => {
    const { wrapper, dkp, ui } = mountStandings()
    dkp.balances = [
      { playerName: 'Thrall', className: 'Schamane', balance: 100, lastUpdated: '2024-01-01' },
      { playerName: 'Jaina', className: 'Magier', balance: 50, lastUpdated: '2024-01-01' },
    ]
    await wrapper.vm.$nextTick()

    ui.dkpSearchQuery = 'thr'
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('1 von 2')
  })

  it('shows no results message when search has no match', async () => {
    const { wrapper, dkp, ui } = mountStandings()
    dkp.balances = [
      { playerName: 'Thrall', className: 'Schamane', balance: 100, lastUpdated: '2024-01-01' },
    ]
    await wrapper.vm.$nextTick()

    ui.dkpSearchQuery = 'zzz'
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Keine Treffer')
  })

  it('renders DKP balance with positive class', async () => {
    const { wrapper, dkp } = mountStandings()
    dkp.balances = [
      { playerName: 'Thrall', className: 'Schamane', balance: 100, lastUpdated: '2024-01-01' },
    ]
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.dkp-bal.dkp-pos').exists()).toBe(true)
    expect(wrapper.find('.dkp-bal').text()).toContain('+100')
  })

  it('renders DKP balance with negative class', async () => {
    const { wrapper, dkp } = mountStandings()
    dkp.balances = [
      { playerName: 'Thrall', className: 'Schamane', balance: -20, lastUpdated: '2024-01-01' },
    ]
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.dkp-bal.dkp-neg').exists()).toBe(true)
  })

  it('shows CSV export button', () => {
    const { wrapper } = mountStandings()
    expect(wrapper.find('.dkp-toolbar-btn').text()).toBe('CSV Export')
  })

  it('shows undo button for admin with transactions', async () => {
    const { wrapper, dkp } = mountStandings({ admin: true })
    dkp.transactions = [
      { id: 'tx1', playerName: 'Thrall', type: 'earn', amount: 10, reason: 'Boss', createdBy: 'admin', timestamp: '2024-01-01T00:00:00Z' },
    ]
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.dkp-undo').exists()).toBe(true)
  })

  it('does not show undo button for non-admin', async () => {
    const { wrapper, dkp } = mountStandings()
    dkp.transactions = [
      { id: 'tx1', playerName: 'Thrall', type: 'earn', amount: 10, reason: 'Boss', createdBy: 'admin', timestamp: '2024-01-01T00:00:00Z' },
    ]
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.dkp-undo').exists()).toBe(false)
  })

  it('renders recent transactions section', async () => {
    const { wrapper, dkp } = mountStandings()
    dkp.balances = [
      { playerName: 'Thrall', className: 'Schamane', balance: 100, lastUpdated: '2024-01-01' },
    ]
    dkp.transactions = [
      { id: 'tx1', playerName: 'Thrall', type: 'earn', amount: 10, reason: 'Boss Kill', createdBy: 'admin', timestamp: '2024-01-01T12:00:00Z' },
    ]
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Letzte Transaktionen')
    expect(wrapper.find('.dkp-tx').exists()).toBe(true)
  })

  it('renders transaction type labels', async () => {
    const { wrapper, dkp } = mountStandings()
    dkp.balances = [
      { playerName: 'Thrall', className: 'Schamane', balance: 100, lastUpdated: '2024-01-01' },
    ]
    dkp.transactions = [
      { id: 'tx1', playerName: 'Thrall', type: 'earn', amount: 10, reason: 'Boss Kill', createdBy: 'admin', timestamp: '2024-01-01T12:00:00Z' },
    ]
    await wrapper.vm.$nextTick()
    expect(wrapper.find('.dkp-tx-type.dkp-tx-earn').text()).toBe('Verdient')
  })

  it('filters transactions by type', async () => {
    const { wrapper, dkp, ui } = mountStandings()
    dkp.balances = [
      { playerName: 'Thrall', className: 'Schamane', balance: 100, lastUpdated: '2024-01-01' },
    ]
    dkp.transactions = [
      { id: 'tx1', playerName: 'Thrall', type: 'earn', amount: 10, reason: 'Boss', createdBy: 'admin', timestamp: '2024-01-01T12:00:00Z' },
      { id: 'tx2', playerName: 'Thrall', type: 'spend', amount: -5, reason: '[Sword]', createdBy: 'admin', timestamp: '2024-01-01T12:00:00Z' },
    ]
    await wrapper.vm.$nextTick()

    ui.dkpTxFilter = 'earn'
    await wrapper.vm.$nextTick()

    const txRows = wrapper.findAll('.dkp-tx')
    expect(txRows.length).toBe(1)
    expect(txRows[0].find('.dkp-tx-type').text()).toBe('Verdient')
  })

  it('has data-dkp-player on rows', async () => {
    const { wrapper, dkp } = mountStandings()
    dkp.balances = [
      { playerName: 'Thrall', className: 'Schamane', balance: 100, lastUpdated: '2024-01-01' },
    ]
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-dkp-player]').exists()).toBe(true)
  })
})

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import FormView from '@/views/FormView.vue'
import { useAuthStore } from '@/stores/auth'
import { useEntriesStore } from '@/stores/entries'
import type { Entry } from '@/types'

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 'e1',
    charName: 'Testchar',
    className: 'Krieger',
    specs: ['Prot'],
    roles: ['Tank'],
    availability: {},
    notes: 'Test notes',
    userId: 'u1',
    timestamp: new Date().toISOString(),
    ...overrides,
  }
}

function createTestRouter(initialRoute = '/form') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/form', component: FormView },
      { path: '/roster', component: { template: '<div />' } },
      { path: '/dashboard', component: { template: '<div />' } },
    ],
  })
  return router
}

async function mountForm(opts: { loggedIn?: boolean; editId?: string; entries?: Entry[] } = {}) {
  const router = createTestRouter()
  if (opts.editId) {
    router.push({ path: '/form', query: { edit: opts.editId } })
  } else {
    router.push('/form')
  }
  await router.isReady()

  if (opts.loggedIn !== false) {
    const auth = useAuthStore()
    auth.user = {
      token: 'test-token',
      username: 'TestUser',
      userId: 'u1',
    }
  }

  if (opts.entries) {
    const entriesStore = useEntriesStore()
    entriesStore.entries = opts.entries
  }

  const wrapper = mount(FormView, {
    global: { plugins: [router] },
  })

  return { wrapper, router }
}

describe('FormView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders with #v-form container', async () => {
    const { wrapper } = await mountForm()
    expect(wrapper.find('#v-form').exists()).toBe(true)
  })

  it('shows auth hint when not logged in', async () => {
    const { wrapper } = await mountForm({ loggedIn: false })
    expect(wrapper.find('.auth-hint').exists()).toBe(true)
    expect(wrapper.find('.btn-bnet').exists()).toBe(true)
    expect(wrapper.find('#f-name').exists()).toBe(false)
  })

  it('shows form when logged in', async () => {
    const { wrapper } = await mountForm()
    expect(wrapper.find('.auth-hint').exists()).toBe(false)
    expect(wrapper.find('#f-name').exists()).toBe(true)
    expect(wrapper.find('#f-submit').exists()).toBe(true)
  })

  it('renders class chip selector', async () => {
    const { wrapper } = await mountForm()
    expect(wrapper.findAll('.chip').length).toBe(9)
  })

  it('shows spec selector after class is selected', async () => {
    const { wrapper } = await mountForm()
    // Initially no specs shown
    expect(wrapper.find('.no-class-hint').exists()).toBe(true)
    expect(wrapper.findAll('.rchip').length).toBe(0)

    // Select Krieger class
    const chips = wrapper.findAll('.chip')
    const kriegerChip = chips.find(c => c.text().includes('Krieger'))
    await kriegerChip!.trigger('click')

    // Now specs should appear
    expect(wrapper.find('.no-class-hint').exists()).toBe(false)
    const rchips = wrapper.findAll('.rchip')
    expect(rchips.length).toBe(3) // Prot, Arms, Fury
  })

  it('disables submit when form is incomplete', async () => {
    const { wrapper } = await mountForm()
    const btn = wrapper.find('#f-submit')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('enables submit when all required fields filled', async () => {
    const { wrapper } = await mountForm()

    // Fill name
    const nameInput = wrapper.find('#f-name')
    await nameInput.setValue('Testchar')

    // Select class
    const kriegerChip = wrapper.findAll('.chip').find(c => c.text().includes('Krieger'))
    await kriegerChip!.trigger('click')

    // Select spec
    const protChip = wrapper.findAll('.rchip').find(c => c.text().includes('Prot'))
    await protChip!.trigger('click')

    const btn = wrapper.find('#f-submit')
    expect((btn.element as HTMLButtonElement).disabled).toBe(false)
  })

  it('shows validation message listing missing fields', async () => {
    const { wrapper } = await mountForm()
    const msg = wrapper.find('.validation-msg')
    expect(msg.exists()).toBe(true)
    expect(msg.text()).toContain('Charaktername')
    expect(msg.text()).toContain('Klasse')
    expect(msg.text()).toContain('Spezialisierung')
  })

  it('shows Eintragen label for new entry', async () => {
    const { wrapper } = await mountForm()
    expect(wrapper.find('#f-submit').text()).toBe('Eintragen')
  })

  it('does not show cancel button for new entry', async () => {
    const { wrapper } = await mountForm()
    expect(wrapper.find('.btn-s').exists()).toBe(false)
  })

  it('pre-fills form in edit mode', async () => {
    const entry = makeEntry()
    const { wrapper } = await mountForm({ editId: 'e1', entries: [entry] })

    expect((wrapper.find('#f-name').element as HTMLInputElement).value).toBe('Testchar')
    expect(wrapper.find('#f-submit').text()).toBe('Aktualisieren')
    expect(wrapper.find('.btn-s').exists()).toBe(true)
  })

  it('resets form on cancel edit', async () => {
    const entry = makeEntry()
    const { wrapper } = await mountForm({ editId: 'e1', entries: [entry] })

    await wrapper.find('.btn-s').trigger('click')

    expect((wrapper.find('#f-name').element as HTMLInputElement).value).toBe('')
    expect(wrapper.find('#f-submit').text()).toBe('Eintragen')
    expect(wrapper.find('.btn-s').exists()).toBe(false)
  })

  it('renders availability grid', async () => {
    const { wrapper } = await mountForm()
    expect(wrapper.find('.tl-wrap').exists()).toBe(true)
    expect(wrapper.findAll('.tl-cell').length).toBeGreaterThan(0)
  })

  it('clears specs when changing class', async () => {
    const { wrapper } = await mountForm()

    // Select Krieger and a spec
    const kriegerChip = wrapper.findAll('.chip').find(c => c.text().includes('Krieger'))
    await kriegerChip!.trigger('click')
    const protChip = wrapper.findAll('.rchip').find(c => c.text().includes('Prot'))
    await protChip!.trigger('click')
    expect(wrapper.findAll('.rchip.active').length).toBe(1)

    // Change to Magier
    const magierChip = wrapper.findAll('.chip').find(c => c.text().includes('Magier'))
    await magierChip!.trigger('click')

    // Specs should be reset - no active rchips
    expect(wrapper.findAll('.rchip.active').length).toBe(0)
    // Should now show Mage specs
    expect(wrapper.findAll('.rchip').length).toBe(3) // Arcane, Fire, Frost
  })
})

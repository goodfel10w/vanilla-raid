import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import EntryCard from '@/components/roster/EntryCard.vue'
import type { Entry } from '@/types'

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: '1',
    charName: 'Testkrieger',
    className: 'Krieger',
    specs: ['Prot'],
    roles: ['Tank'],
    availability: {},
    notes: '',
    timestamp: new Date().toISOString(),
    ...overrides,
  }
}

describe('EntryCard', () => {
  it('renders character name with class color', () => {
    const wrapper = mount(EntryCard, {
      props: { entry: makeEntry(), canEdit: false },
    })
    const name = wrapper.find('.e-name')
    expect(name.text()).toContain('Testkrieger')
    // jsdom normalizes hex colors to rgb
    expect(name.attributes('style')).toContain('color:')
    expect(name.attributes('style')).toMatch(/rgb\(198, 155, 109\)|#C69B6D/i)
  })

  it('renders class name', () => {
    const wrapper = mount(EntryCard, {
      props: { entry: makeEntry(), canEdit: false },
    })
    expect(wrapper.find('.e-class').text()).toBe('Krieger')
  })

  it('renders role badges from specs', () => {
    const wrapper = mount(EntryCard, {
      props: {
        entry: makeEntry({ specs: ['Prot', 'Arms'], roles: ['Tank', 'DPS'] }),
        canEdit: false,
      },
    })
    const badges = wrapper.findAll('.rbadge')
    expect(badges.length).toBeGreaterThanOrEqual(2)
    expect(badges[0].text()).toContain('Prot')
    expect(badges[1].text()).toContain('Arms')
  })

  it('shows edit/delete buttons when canEdit is true', () => {
    const wrapper = mount(EntryCard, {
      props: { entry: makeEntry(), canEdit: true },
    })
    expect(wrapper.find('[data-edit]').exists()).toBe(true)
    expect(wrapper.find('[data-del]').exists()).toBe(true)
  })

  it('hides edit/delete buttons when canEdit is false', () => {
    const wrapper = mount(EntryCard, {
      props: { entry: makeEntry(), canEdit: false },
    })
    expect(wrapper.find('[data-edit]').exists()).toBe(false)
    expect(wrapper.find('[data-del]').exists()).toBe(false)
  })

  it('emits edit event with entry id', async () => {
    const wrapper = mount(EntryCard, {
      props: { entry: makeEntry({ id: 'abc' }), canEdit: true },
    })
    await wrapper.find('[data-edit]').trigger('click')
    expect(wrapper.emitted('edit')).toBeTruthy()
    expect(wrapper.emitted('edit')![0][0]).toBe('abc')
  })

  it('emits delete event with entry id', async () => {
    const wrapper = mount(EntryCard, {
      props: { entry: makeEntry({ id: 'xyz' }), canEdit: true },
    })
    await wrapper.find('[data-del]').trigger('click')
    expect(wrapper.emitted('delete')).toBeTruthy()
    expect(wrapper.emitted('delete')![0][0]).toBe('xyz')
  })

  it('renders time slot tags', () => {
    const wrapper = mount(EntryCard, {
      props: {
        entry: makeEntry({
          availability: {
            'Montag_18:00': 'yes',
            'Montag_18:15': 'yes',
            'Montag_18:30': 'yes',
            'Montag_18:45': 'yes',
          },
        }),
        canEdit: false,
      },
    })
    const tags = wrapper.findAll('.stag')
    expect(tags.length).toBeGreaterThanOrEqual(1)
    expect(tags[0].text()).toContain('Mo')
  })

  it('renders tentative tags with tent class', () => {
    const wrapper = mount(EntryCard, {
      props: {
        entry: makeEntry({
          availability: {
            'Montag_18:00': 'tentative',
            'Montag_18:15': 'tentative',
          },
        }),
        canEdit: false,
      },
    })
    const tentTags = wrapper.findAll('.stag.tent')
    expect(tentTags.length).toBeGreaterThanOrEqual(1)
  })

  it('renders notes when present', () => {
    const wrapper = mount(EntryCard, {
      props: {
        entry: makeEntry({ notes: 'Nur Abends' }),
        canEdit: false,
      },
    })
    const notes = wrapper.find('.e-notes')
    expect(notes.exists()).toBe(true)
    expect(notes.text()).toContain('Nur Abends')
  })

  it('hides notes when empty', () => {
    const wrapper = mount(EntryCard, {
      props: {
        entry: makeEntry({ notes: '' }),
        canEdit: false,
      },
    })
    expect(wrapper.find('.e-notes').exists()).toBe(false)
  })

  it('falls back to role badges when no specs', () => {
    const wrapper = mount(EntryCard, {
      props: {
        entry: makeEntry({ specs: [], roles: ['Tank', 'DPS'] }),
        canEdit: false,
      },
    })
    const badges = wrapper.findAll('.rbadge')
    expect(badges.length).toBe(2)
    expect(badges[0].text()).toContain('Tank')
    expect(badges[1].text()).toContain('DPS')
  })
})

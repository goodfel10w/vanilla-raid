import { describe, it, expect } from 'vitest'
import { useHeatmapData } from '@/composables/useHeatmapData'
import type { Entry } from '@/types'

function makeEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: '1',
    charName: 'Testchar',
    className: 'Krieger',
    specs: ['Prot'],
    roles: ['Tank'],
    availability: {},
    notes: '',
    timestamp: new Date().toISOString(),
    ...overrides,
  }
}

describe('useHeatmapData', () => {
  it('heatData aggregates 1h slots from entries', () => {
    const entries: Entry[] = [
      makeEntry({
        id: '1',
        charName: 'Tank1',
        availability: {
          'Montag_12:00': 'yes',
          'Montag_12:15': 'yes',
          'Montag_12:30': 'yes',
          'Montag_12:45': 'yes',
        },
      }),
    ]
    const { heatData } = useHeatmapData(() => entries)
    const hd = heatData()
    expect(hd['Montag_12']).toEqual({ yes: 1, tent: 0, total: 1 })
    expect(hd['Montag_13']).toEqual({ yes: 0, tent: 0, total: 0 })
  })

  it('counts tentative entries separately', () => {
    const entries: Entry[] = [
      makeEntry({
        id: '1',
        availability: {
          'Montag_12:00': 'yes',
          'Montag_12:15': 'yes',
          'Montag_12:30': 'tentative',
          'Montag_12:45': 'yes',
        },
      }),
    ]
    const { heatData } = useHeatmapData(() => entries)
    const hd = heatData()
    expect(hd['Montag_12']).toEqual({ yes: 0, tent: 1, total: 1 })
  })

  it('avForSlot returns players available for all 4 quarters', () => {
    const entries: Entry[] = [
      makeEntry({
        id: '1',
        charName: 'Full',
        availability: {
          'Montag_12:00': 'yes',
          'Montag_12:15': 'yes',
          'Montag_12:30': 'yes',
          'Montag_12:45': 'yes',
        },
      }),
      makeEntry({
        id: '2',
        charName: 'Partial',
        availability: {
          'Montag_12:00': 'yes',
          'Montag_12:15': 'yes',
        },
      }),
    ]
    const { avForSlot } = useHeatmapData(() => entries)
    const players = avForSlot('Montag', '12')
    expect(players).toHaveLength(1)
    expect(players[0].charName).toBe('Full')
    expect(players[0]._availType).toBe('yes')
  })

  it('heatData3h generates correct window labels', () => {
    const { windowLabels3h } = useHeatmapData(() => [])
    const labels = windowLabels3h()
    expect(labels).toHaveLength(10) // 12..21
    expect(labels[0]).toBe('12:00\u201315:00')
    expect(labels[9]).toBe('21:00\u201300:00')
  })

  it('heatData4h generates correct window labels', () => {
    const { windowLabels4h } = useHeatmapData(() => [])
    const labels = windowLabels4h()
    expect(labels).toHaveLength(9) // 12..20
    expect(labels[0]).toBe('12:00\u201316:00')
    expect(labels[8]).toBe('20:00\u201300:00')
  })

  it('isRaidReady returns correct thresholds', () => {
    const { isRaidReady } = useHeatmapData(() => [])

    // Not enough
    const notReady = isRaidReady([
      { roles: ['Tank'] },
      { roles: ['Heiler'] },
    ])
    expect(notReady.ready).toBe(false)
    expect(notReady.t).toBe(1)
    expect(notReady.hl).toBe(1)

    // Enough: 2T + 5H + 18D
    const players: Pick<Entry, 'roles'>[] = []
    for (let i = 0; i < 2; i++) players.push({ roles: ['Tank'] })
    for (let i = 0; i < 5; i++) players.push({ roles: ['Heiler'] })
    for (let i = 0; i < 18; i++) players.push({ roles: ['DPS'] })
    const ready = isRaidReady(players)
    expect(ready.ready).toBe(true)
    expect(ready.t).toBe(2)
    expect(ready.hl).toBe(5)
    expect(ready.dp).toBe(18)
  })

  it('heatMode defaults to 1h', () => {
    const { heatMode } = useHeatmapData(() => [])
    expect(heatMode.value).toBe('1h')
  })

  it('setHeatMode changes mode', () => {
    const { heatMode, setHeatMode } = useHeatmapData(() => [])
    setHeatMode('3h')
    expect(heatMode.value).toBe('3h')
    setHeatMode('4h')
    expect(heatMode.value).toBe('4h')
  })

  it('heatData3h counts players available for all 12 quarter-slots', () => {
    const avail: Record<string, 'yes' | 'tentative'> = {}
    for (let h = 12; h < 15; h++) {
      for (const m of [0, 15, 30, 45]) {
        avail[`Montag_${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`] = 'yes'
      }
    }
    const entries: Entry[] = [makeEntry({ id: '1', availability: avail })]
    const { heatData3h } = useHeatmapData(() => entries)
    const hd = heatData3h()
    expect(hd['Montag_12:00\u201315:00']).toEqual({ yes: 1, tent: 0, total: 1 })
  })

  it('avForWindow3h returns players for window', () => {
    const avail: Record<string, 'yes' | 'tentative'> = {}
    for (let h = 12; h < 15; h++) {
      for (const m of [0, 15, 30, 45]) {
        avail[`Montag_${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`] = 'yes'
      }
    }
    const entries: Entry[] = [makeEntry({ id: '1', charName: 'Test', availability: avail })]
    const { avForWindow3h } = useHeatmapData(() => entries)
    const players = avForWindow3h('Montag', '12:00\u201315:00')
    expect(players).toHaveLength(1)
    expect(players[0].charName).toBe('Test')
  })
})

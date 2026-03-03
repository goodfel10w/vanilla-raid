import { describe, it, expect } from 'vitest'
import { CLS, CLASS_SPECS, ROLES, DAYS, SLOTS, TBC_RAIDS, HOUR_LABELS, DAY_SHORT, ROLE_COLORS, WOW_ICONS } from '@/lib/constants'

describe('Constants', () => {
  it('has 9 WoW classes', () => {
    expect(CLS).toHaveLength(9)
  })

  it('each class has name, color, and icon', () => {
    CLS.forEach(c => {
      expect(c.name).toBeTruthy()
      expect(c.color).toMatch(/^#[0-9A-Fa-f]{6}$/)
      expect(c.icon).toBeTruthy()
    })
  })

  it('has correct class names in German', () => {
    const names = CLS.map(c => c.name)
    expect(names).toContain('Druide')
    expect(names).toContain('Krieger')
    expect(names).toContain('Schurke')
    expect(names).toContain('Jäger')
  })

  it('has 3 roles: Tank, Heiler, DPS', () => {
    expect(ROLES).toEqual(['Tank', 'Heiler', 'DPS'])
  })

  it('has role colors for all roles', () => {
    ROLES.forEach(r => {
      expect(ROLE_COLORS[r]).toMatch(/^#[0-9a-f]{6}$/)
    })
  })

  it('has 7 days (Mon-Sun in German)', () => {
    expect(DAYS).toHaveLength(7)
    expect(DAYS[0]).toBe('Montag')
    expect(DAYS[6]).toBe('Sonntag')
  })

  it('has day short names for all days', () => {
    DAYS.forEach(d => {
      expect(DAY_SHORT[d]).toBeTruthy()
      expect(DAY_SHORT[d]).toHaveLength(2)
    })
  })

  it('has 48 time slots (12:00 to 23:45)', () => {
    expect(SLOTS).toHaveLength(48)
    expect(SLOTS[0]).toBe('12:00')
    expect(SLOTS[47]).toBe('23:45')
  })

  it('has 12 hour labels (12 to 23)', () => {
    expect(HOUR_LABELS).toHaveLength(12)
    expect(HOUR_LABELS[0]).toBe('12')
    expect(HOUR_LABELS[11]).toBe('23')
  })

  it('has specs for all 9 classes', () => {
    CLS.forEach(c => {
      expect(CLASS_SPECS[c.name]).toBeDefined()
      expect(CLASS_SPECS[c.name].length).toBeGreaterThan(0)
    })
  })

  it('each spec has name, role, and icon', () => {
    Object.values(CLASS_SPECS).forEach(specs => {
      specs.forEach(s => {
        expect(s.name).toBeTruthy()
        expect(['Tank', 'Heiler', 'DPS']).toContain(s.role)
        expect(s.icon).toBeTruthy()
      })
    })
  })

  it('Krieger has Prot (Tank), Arms (DPS), Fury (DPS)', () => {
    const kriegSpecs = CLASS_SPECS['Krieger']
    expect(kriegSpecs.find(s => s.name === 'Prot')?.role).toBe('Tank')
    expect(kriegSpecs.find(s => s.name === 'Arms')?.role).toBe('DPS')
    expect(kriegSpecs.find(s => s.name === 'Fury')?.role).toBe('DPS')
  })

  it('Paladin has Holy (Heiler), Prot (Tank), Retri (DPS)', () => {
    const palSpecs = CLASS_SPECS['Paladin']
    expect(palSpecs.find(s => s.name === 'Holy')?.role).toBe('Heiler')
    expect(palSpecs.find(s => s.name === 'Prot')?.role).toBe('Tank')
    expect(palSpecs.find(s => s.name === 'Retri')?.role).toBe('DPS')
  })

  it('has 9 TBC raids', () => {
    expect(TBC_RAIDS).toHaveLength(9)
  })

  it('TBC raids have correct structure', () => {
    TBC_RAIDS.forEach(r => {
      expect(r.name).toBeTruthy()
      expect([10, 25]).toContain(r.maxPlayers)
      expect(r.tier).toBeTruthy()
    })
  })

  it('Karazhan is 10-man T4', () => {
    const kara = TBC_RAIDS.find(r => r.name === 'Karazhan')
    expect(kara?.maxPlayers).toBe(10)
    expect(kara?.tier).toBe('T4')
  })

  it('WOW_ICONS is a valid CDN URL', () => {
    expect(WOW_ICONS).toContain('cdn.jsdelivr.net')
  })
})

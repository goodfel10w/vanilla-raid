import { describe, it, expect } from 'vitest'
import { getGermanWeekday, getWeeklyResetWindow } from '@/lib/utils'

describe('getGermanWeekday()', () => {
  it('returns Montag for a known Monday', () => {
    expect(getGermanWeekday('2026-03-02')).toBe('Montag')
  })

  it('returns Mittwoch for a known Wednesday', () => {
    expect(getGermanWeekday('2026-03-04')).toBe('Mittwoch')
  })

  it('returns Freitag for a known Friday', () => {
    expect(getGermanWeekday('2026-03-06')).toBe('Freitag')
  })

  it('returns Sonntag for a known Sunday', () => {
    expect(getGermanWeekday('2026-03-08')).toBe('Sonntag')
  })

  it('returns Samstag for a known Saturday', () => {
    expect(getGermanWeekday('2026-03-07')).toBe('Samstag')
  })

  it('returns Dienstag for a known Tuesday', () => {
    expect(getGermanWeekday('2026-03-03')).toBe('Dienstag')
  })

  it('returns Donnerstag for a known Thursday', () => {
    expect(getGermanWeekday('2026-03-05')).toBe('Donnerstag')
  })
})

describe('getWeeklyResetWindow()', () => {
  it('returns Wednesday to Tuesday window when called on a Wednesday', () => {
    const wed = new Date(2026, 2, 4, 15, 0, 0) // March 4 2026 is Wednesday
    const { start, end } = getWeeklyResetWindow(wed)
    expect(start.getDay()).toBe(3) // Wednesday
    expect(start.getDate()).toBe(4)
    expect(start.getHours()).toBe(0)
    expect(end.getDay()).toBe(2) // Tuesday
    expect(end.getDate()).toBe(10)
    expect(end.getHours()).toBe(23)
  })

  it('returns correct window when called on a Friday', () => {
    const fri = new Date(2026, 2, 6, 10, 0, 0) // March 6 2026 is Friday
    const { start, end } = getWeeklyResetWindow(fri)
    expect(start.getDay()).toBe(3) // Wednesday
    expect(start.getDate()).toBe(4)
    expect(end.getDay()).toBe(2) // Tuesday
    expect(end.getDate()).toBe(10)
  })

  it('returns correct window when called on a Monday', () => {
    const mon = new Date(2026, 2, 9, 10, 0, 0) // March 9 2026 is Monday
    const { start, end } = getWeeklyResetWindow(mon)
    expect(start.getDay()).toBe(3) // Wednesday
    expect(start.getDate()).toBe(4)
    expect(end.getDay()).toBe(2) // Tuesday
    expect(end.getDate()).toBe(10)
  })

  it('returns correct window when called on a Tuesday', () => {
    const tue = new Date(2026, 2, 10, 10, 0, 0) // March 10 2026 is Tuesday
    const { start, end } = getWeeklyResetWindow(tue)
    expect(start.getDay()).toBe(3) // Wednesday
    expect(start.getDate()).toBe(4)
    expect(end.getDay()).toBe(2) // Tuesday
    expect(end.getDate()).toBe(10)
  })

  it('start is at 00:00:00 and end is at 23:59:59', () => {
    const { start, end } = getWeeklyResetWindow(new Date(2026, 2, 6))
    expect(start.getHours()).toBe(0)
    expect(start.getMinutes()).toBe(0)
    expect(start.getSeconds()).toBe(0)
    expect(end.getHours()).toBe(23)
    expect(end.getMinutes()).toBe(59)
    expect(end.getSeconds()).toBe(59)
  })

  it('window spans exactly 7 days', () => {
    const { start, end } = getWeeklyResetWindow(new Date(2026, 2, 6))
    const diff = end.getTime() - start.getTime()
    const days = diff / (1000 * 60 * 60 * 24)
    expect(days).toBeGreaterThan(6)
    expect(days).toBeLessThan(7.01)
  })
})

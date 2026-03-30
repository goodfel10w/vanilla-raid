import type { Entry, KaraSignup, AvailabilityMap } from '@/types'

/**
 * Resolve the effective kara availability for a player.
 *
 * - If the player has a kara signup with custom times, use those (filtered to signup days).
 * - If the player has a kara signup without custom times, use their general entry availability
 *   but only for the days they signed up for.
 * - If no signup exists, fall back to the full entry availability.
 */
export function resolveKaraAvailability(
  entry: Entry,
  signup: KaraSignup | undefined,
): AvailabilityMap {
  if (!signup) return entry.availability ?? {}

  const daySet = new Set<string>(signup.days)
  const source = signup.useCustomTimes && signup.customSlots
    ? signup.customSlots
    : entry.availability ?? {}

  const filtered: AvailabilityMap = {}
  for (const key in source) {
    const underscoreIdx = key.indexOf('_')
    if (underscoreIdx < 0) continue
    const day = key.substring(0, underscoreIdx)
    if (daySet.has(day)) {
      filtered[key] = source[key]
    }
  }
  return filtered
}

/**
 * Build a map of entryId → effective kara availability for all entries.
 */
export function buildKaraAvailabilityMap(
  entries: Entry[],
  signupsByEntryId: Map<string, KaraSignup>,
): Map<string, AvailabilityMap> {
  const map = new Map<string, AvailabilityMap>()
  for (const entry of entries) {
    map.set(entry.id, resolveKaraAvailability(entry, signupsByEntryId.get(entry.id)))
  }
  return map
}

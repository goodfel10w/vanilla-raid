import { DAYS, SLOTS, HOUR_LABELS } from '@/lib/constants'
import { hourQuarters } from '@/lib/utils'
import type { Entry } from '@/types'
import type { KaraGroupPlayer, KaraLink } from './useKaraPersistence'

const KARA_TANKS = 2
const KARA_HEALERS = 2
const KARA_DPS = 6
const KARA_SIZE = 10
const KARA_GROUPS_COUNT = 3

export interface SlotSuggestion {
  day: string
  startH: number
  windowLabel: string
  key: string
  players: Entry[]
  playerIds: Set<string>
  total: number
  tanks: number
  healers: number
  dps: number
  yesCount: number
  score: number
}

function karaPlayersForWindow(entries: Entry[], day: string, startH: number): Entry[] {
  const qs: string[] = []
  for (let wh = startH; wh < startH + 3; wh++) {
    for (const m of [0, 15, 30, 45]) {
      qs.push(day + '_' + String(wh).padStart(2, '0') + ':' + String(m).padStart(2, '0'))
    }
  }
  return entries.filter(e => {
    if (!e.availability) return false
    return qs.every(q => e.availability[q] === 'yes' || e.availability[q] === 'tentative')
  })
}

export function parseSlotKey(key: string): { day: string; windowLabel: string } | null {
  if (!key) return null
  const idx = key.indexOf('_')
  if (idx < 0) return null
  return { day: key.substring(0, idx), windowLabel: key.substring(idx + 1) }
}

export function karaPlayersForSlotKey(entries: Entry[], key: string): Entry[] {
  const parsed = parseSlotKey(key)
  if (!parsed) return []
  const startH = parseInt(parsed.windowLabel)
  return karaPlayersForWindow(entries, parsed.day, startH)
}

export function karaSuggestSlots(entries: Entry[], excludePlayerIds?: Set<string>): SlotSuggestion[] {
  const exclude = excludePlayerIds || new Set<string>()
  const suggestions: SlotSuggestion[] = []

  DAYS.forEach(d => {
    for (let h = 12; h <= 21; h++) {
      const endH = h + 3
      const windowLabel = String(h).padStart(2, '0') + ':00\u2013' + String(endH === 24 ? 0 : endH).padStart(2, '0') + ':00'
      const key = d + '_' + windowLabel
      const allPlayers = karaPlayersForWindow(entries, d, h)
      const players = allPlayers.filter(e => !exclude.has(e.id))
      let t = 0, hl = 0, dp = 0
      players.forEach(p => {
        const roles = p.roles || []
        if (roles.includes('Tank')) t++
        if (roles.includes('Heiler')) hl++
        if (roles.includes('DPS')) dp++
      })

      let score = players.length * 10
      if (t >= KARA_TANKS) score += 30
      if (hl >= KARA_HEALERS) score += 30
      if (dp >= KARA_DPS) score += 20
      if (t === 0) score -= 50
      if (hl === 0) score -= 50
      if (players.length >= 10) score += 20

      const qs: string[] = []
      for (let wh = h; wh < h + 3; wh++) {
        for (const m of [0, 15, 30, 45]) {
          qs.push(d + '_' + String(wh).padStart(2, '0') + ':' + String(m).padStart(2, '0'))
        }
      }
      let yesCount = 0
      players.forEach(p => {
        if (qs.every(q => {
          const v = p.availability[q]
          return v === 'yes'
        })) yesCount++
      })
      score += yesCount * 2

      suggestions.push({
        day: d,
        startH: h,
        windowLabel,
        key,
        players,
        playerIds: new Set(players.map(e => e.id)),
        total: players.length,
        tanks: t,
        healers: hl,
        dps: dp,
        yesCount,
        score,
      })
    }
  })

  suggestions.sort((a, b) => b.score - a.score || b.total - a.total)
  return suggestions
}

export function karaAutoPickSlots(entries: Entry[]): string[] | null {
  const allSuggestions = karaSuggestSlots(entries)
  const viable = allSuggestions.filter(s => s.total >= 5 && s.tanks >= 1 && s.healers >= 1)
  const top = viable.slice(0, 25)
  let bestCombo: string[] | null = null
  let bestScore = -Infinity

  for (let i = 0; i < top.length; i++) {
    for (let j = i + 1; j < top.length; j++) {
      for (let k = j + 1; k < top.length; k++) {
        const a = top[i], b = top[j], c = top[k]
        const allIds = new Set<string>()
        a.playerIds.forEach(id => allIds.add(id))
        b.playerIds.forEach(id => allIds.add(id))
        c.playerIds.forEach(id => allIds.add(id))
        const uniqueCount = allIds.size
        const capped = Math.min(a.total, 10) + Math.min(b.total, 10) + Math.min(c.total, 10)
        let roleScore = 0
        ;[a, b, c].forEach(s => {
          if (s.tanks >= KARA_TANKS) roleScore += 15
          if (s.healers >= KARA_HEALERS) roleScore += 15
          if (s.dps >= KARA_DPS) roleScore += 10
        })
        const score = uniqueCount * 5 + capped * 2 + roleScore
        if (score > bestScore) {
          bestScore = score
          bestCombo = [a.key, b.key, c.key]
        }
      }
    }
  }
  return bestCombo
}

export interface RoleCounts {
  t: number
  hl: number
  dp: number
}

export function karaGroupRoles(group: KaraGroupPlayer[], entries: Entry[]): RoleCounts {
  let t = 0, hl = 0, dp = 0
  group.forEach(p => {
    const entry = entries.find(e => e.id === p.entryId)
    if (!entry) return
    const roles = entry.roles || []
    if (roles.includes('Tank')) t++
    if (roles.includes('Heiler')) hl++
    if (roles.includes('DPS')) dp++
  })
  return { t, hl, dp }
}

function primaryRole(entry: Entry): string {
  const roles = entry.roles || []
  if (roles.includes('Tank')) return 'Tank'
  if (roles.includes('Heiler')) return 'Heiler'
  return 'DPS'
}

function groupScore(group: KaraGroupPlayer[], entries: Entry[]): number {
  const roles = karaGroupRoles(group, entries)
  let score = 0
  score -= Math.max(0, KARA_TANKS - roles.t) * 10
  score -= Math.max(0, KARA_HEALERS - roles.hl) * 10
  score -= Math.max(0, KARA_DPS - roles.dp) * 8
  score -= Math.max(0, roles.t - KARA_TANKS) * 3
  score -= Math.max(0, roles.hl - KARA_HEALERS) * 3
  const classes = new Set<string>()
  group.forEach(p => {
    const entry = entries.find(e => e.id === p.entryId)
    if (entry) classes.add(entry.className)
  })
  score += classes.size * 2
  return score
}

export function karaAutoGenerate(
  allEntries: Entry[],
  groups: KaraGroupPlayer[][],
  links: KaraLink[],
  groupSlots: string[],
  filterDay: string,
  filterTime: string,
): { groups: KaraGroupPlayer[][]; message: string } {
  const hasSlots = groupSlots.some(s => s)

  // Collect pinned players
  const pinnedIds = new Set<string>()
  groups.forEach(g => g.forEach(p => { if (p.pinned) pinnedIds.add(p.entryId) }))

  // Remove non-pinned entries from groups
  const newGroups: KaraGroupPlayer[][] = groups.map(g => g.filter(p => p.pinned))

  // Build per-group available player pools
  const groupPools: Entry[][] = []
  for (let gi = 0; gi < KARA_GROUPS_COUNT; gi++) {
    const slot = groupSlots[gi]
    let pool: Entry[]
    if (slot) {
      pool = karaPlayersForSlotKey(allEntries, slot).filter(e => !pinnedIds.has(e.id))
    } else if (filterDay) {
      pool = allEntries.filter(e => {
        if (pinnedIds.has(e.id)) return false
        if (!e.availability) return false
        if (filterTime) {
          const qs = hourQuarters(filterTime).map(q => filterDay + '_' + q)
          return qs.every(q => e.availability[q] === 'yes' || e.availability[q] === 'tentative')
        }
        return SLOTS.some(s => e.availability[filterDay + '_' + s])
      })
    } else {
      pool = allEntries.filter(e => !pinnedIds.has(e.id))
    }
    groupPools.push(pool)
  }

  // Linked sets
  const linkedSets = links.map(lk => ({
    ids: lk.ids.filter(id => !pinnedIds.has(id)),
    color: lk.color,
  }))

  const placed = new Set<string>()
  newGroups.forEach(g => g.forEach(p => placed.add(p.entryId)))

  function canPlace(entryId: string, gi: number): boolean {
    if (placed.has(entryId)) return false
    if (newGroups[gi].length >= 10) return false
    const poolIds = new Set(groupPools[gi].map(e => e.id))
    return poolIds.has(entryId)
  }

  function needsRoleForEntry(entry: Entry): number {
    const role = primaryRole(entry)
    let bestGi = -1, bestNeed = 0
    for (let gi = 0; gi < KARA_GROUPS_COUNT; gi++) {
      if (!canPlace(entry.id, gi)) continue
      const roles = karaGroupRoles(newGroups[gi], allEntries)
      let need = 0
      if (role === 'Tank') need = Math.max(0, KARA_TANKS - roles.t)
      if (role === 'Heiler') need = Math.max(0, KARA_HEALERS - roles.hl)
      if (role === 'DPS') need = Math.max(0, KARA_DPS - roles.dp)
      if (need > bestNeed || (need === bestNeed && newGroups[gi].length < (bestGi >= 0 ? newGroups[bestGi].length : 99))) {
        bestNeed = need
        bestGi = gi
      }
    }
    return bestGi
  }

  function smallestEligibleGroup(entryId: string): number {
    let bestGi = -1, bestSize = 99
    for (let gi = 0; gi < KARA_GROUPS_COUNT; gi++) {
      if (!canPlace(entryId, gi)) continue
      if (newGroups[gi].length < bestSize) { bestSize = newGroups[gi].length; bestGi = gi }
    }
    return bestGi
  }

  function getEntryLinkGroup(entryId: string): KaraLink | null {
    return links.find(l => l.ids.includes(entryId)) || null
  }

  // Place linked sets together
  linkedSets.forEach(ls => {
    if (ls.ids.length === 0) return
    let targetGi = -1
    for (let gi = 0; gi < KARA_GROUPS_COUNT; gi++) {
      if (newGroups[gi].some(p => ls.ids.includes(p.entryId))) { targetGi = gi; break }
    }
    if (targetGi < 0) {
      let bestCount = 0
      for (let gi = 0; gi < KARA_GROUPS_COUNT; gi++) {
        const eligibleCount = ls.ids.filter(id => !placed.has(id) && new Set(groupPools[gi].map(e => e.id)).has(id)).length
        if (eligibleCount > bestCount && newGroups[gi].length < 10) { bestCount = eligibleCount; targetGi = gi }
      }
    }
    if (targetGi < 0) return
    ls.ids.forEach(id => {
      if (placed.has(id)) return
      if (newGroups[targetGi].length >= 10) return
      if (newGroups[targetGi].some(p => p.entryId === id)) return
      const poolIds = new Set(groupPools[targetGi].map(e => e.id))
      if (!poolIds.has(id) && hasSlots) return
      newGroups[targetGi].push({ entryId: id, pinned: false })
      placed.add(id)
    })
  })

  // Collect all unplaced players
  const allAvailable = new Map<string, Entry>()
  groupPools.forEach(pool => {
    pool.forEach(e => {
      if (!placed.has(e.id)) allAvailable.set(e.id, e)
    })
  })

  const roleOrder: Record<string, number> = { Tank: 0, Heiler: 1, DPS: 2 }
  const sortedAvailable = [...allAvailable.values()].sort((a, b) => {
    return (roleOrder[primaryRole(a)] ?? 2) - (roleOrder[primaryRole(b)] ?? 2)
  })
  // Shuffle within same role
  for (let i = 0; i < sortedAvailable.length;) {
    let j = i
    while (j < sortedAvailable.length && primaryRole(sortedAvailable[j]) === primaryRole(sortedAvailable[i])) j++
    const slice = sortedAvailable.slice(i, j)
    slice.sort(() => Math.random() - 0.5)
    for (let k = 0; k < slice.length; k++) sortedAvailable[i + k] = slice[k]
    i = j
  }

  // Assign by role need
  sortedAvailable.forEach(entry => {
    if (placed.has(entry.id)) return
    const gi = needsRoleForEntry(entry)
    if (gi >= 0) {
      newGroups[gi].push({ entryId: entry.id, pinned: false })
      placed.add(entry.id)
    }
  })

  // Fill remaining
  sortedAvailable.forEach(entry => {
    if (placed.has(entry.id)) return
    const gi = smallestEligibleGroup(entry.id)
    if (gi >= 0) {
      newGroups[gi].push({ entryId: entry.id, pinned: false })
      placed.add(entry.id)
    }
  })

  // Optimize swaps
  for (let iter = 0; iter < 50; iter++) {
    let improved = false
    for (let gi = 0; gi < KARA_GROUPS_COUNT; gi++) {
      const poolIdsI = new Set(groupPools[gi].map(e => e.id))
      for (let gj = gi + 1; gj < KARA_GROUPS_COUNT; gj++) {
        const poolIdsJ = new Set(groupPools[gj].map(e => e.id))
        for (let pi = 0; pi < newGroups[gi].length; pi++) {
          if (newGroups[gi][pi].pinned) continue
          const eiId = newGroups[gi][pi].entryId
          const eiLink = getEntryLinkGroup(eiId)
          if (hasSlots && !poolIdsJ.has(eiId)) continue
          for (let pj = 0; pj < newGroups[gj].length; pj++) {
            if (newGroups[gj][pj].pinned) continue
            const ejId = newGroups[gj][pj].entryId
            const ejLink = getEntryLinkGroup(ejId)
            if (hasSlots && !poolIdsI.has(ejId)) continue
            if (eiLink && eiLink.ids.some(id => newGroups[gi].some(p => p.entryId === id && p.entryId !== eiId))) continue
            if (ejLink && ejLink.ids.some(id => newGroups[gj].some(p => p.entryId === id && p.entryId !== ejId))) continue

            const scoreBefore = groupScore(newGroups[gi], allEntries) + groupScore(newGroups[gj], allEntries)
            const tmp = newGroups[gi][pi]
            newGroups[gi][pi] = newGroups[gj][pj]
            newGroups[gj][pj] = tmp
            const scoreAfter = groupScore(newGroups[gi], allEntries) + groupScore(newGroups[gj], allEntries)
            if (scoreAfter > scoreBefore) {
              improved = true
            } else {
              newGroups[gj][pj] = newGroups[gi][pi]
              newGroups[gi][pi] = tmp
            }
          }
        }
      }
    }
    if (!improved) break
  }

  const totalPlaced = newGroups.reduce((s, g) => s + g.length, 0)
  const totalEntries = allEntries.length
  let message: string
  if (totalPlaced < totalEntries && hasSlots) {
    message = `${totalPlaced} verteilt, ${totalEntries - totalPlaced} ohne passende Zeit`
  } else {
    message = 'Gruppen automatisch verteilt'
  }

  return { groups: newGroups, message }
}

export { KARA_TANKS, KARA_HEALERS, KARA_DPS, KARA_SIZE, KARA_GROUPS_COUNT }

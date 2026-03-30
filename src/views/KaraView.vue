<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useEntriesStore } from '@/stores/entries'
import { useKaraSignupsStore } from '@/stores/karaSignups'
import { useRaidsStore } from '@/stores/raids'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { useKaraPersistence, getIdWeekStart, getIdWeekEnd } from '@/composables/useKaraPersistence'
import type { KaraLink } from '@/composables/useKaraPersistence'
import { useKaraDragDrop } from '@/composables/useKaraDragDrop'
import {
  karaSuggestSlots,
  karaAutoPickSlots,
  karaAutoGenerate,
  karaGroupRoles,
  karaGroupTankTotal,
  karaPlayersForSlotKey,
  parseSlotKey,
  KARA_MT,
  KARA_OT,
  KARA_TANKS,
  KARA_HEALERS,
  KARA_DPS,
  KARA_SIZE,
} from '@/composables/useKaraAutoSuggest'
import { DAYS, HOUR_LABELS, SLOTS, CLS, ROLES, ROLE_COLORS } from '@/lib/constants'
import type { RoleName } from '@/lib/constants'
import { formatDate, cc, h, hourQuarters, specsToRoles } from '@/lib/utils'
import ConfirmModal from '@/components/shared/ConfirmModal.vue'
import KaraPool from '@/components/kara/KaraPool.vue'
import KaraGroup from '@/components/kara/KaraGroup.vue'

const router = useRouter()
const entriesStore = useEntriesStore()
const karaSignupsStore = useKaraSignupsStore()
const raidsStore = useRaidsStore()
const authStore = useAuthStore()
const { toast } = useToast()
const persistence = useKaraPersistence()
const dragDrop = useKaraDragDrop()

const suggestMode = ref(false)
const showExport = ref(false)
const filterDay = ref('')
const filterTime = ref('')
const filterSignedUp = ref(false)
const filterRole = ref('')
const filterClass = ref('')
const filterName = ref('')
const linkPending = ref<string | null>(null)
const showResetModal = ref(false)
const showAssigned = ref(false)
const removeGroupTarget = ref(-1)

// Load state on mount and when entries or week change
async function reloadState() {
  await persistence.load(entriesStore.entries)
  karaSignupsStore.load(persistence.weekOffset.value)
}
reloadState()

watch(() => entriesStore.entries, reloadState)
watch(() => persistence.weekOffset.value, reloadState)

// Signup map: entryId → KaraSignup for quick lookup
const signupMap = computed(() => {
  const map = new Map<string, typeof karaSignupsStore.signups[number]>()
  for (const s of karaSignupsStore.signups) {
    map.set(s.entryId, s)
  }
  return map
})

// Computed
const weekStart = computed(() => getIdWeekStart(persistence.weekOffset.value))
const weekEnd = computed(() => getIdWeekEnd(weekStart.value))
const weekStartStr = computed(() => formatDateLocal(weekStart.value))
const weekEndStr = computed(() => formatDateLocal(weekEnd.value))

function formatDateLocal(d: Date): string {
  return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear()
}

const groupCount = computed(() => persistence.groups.value.length)

const assignedIds = computed(() => {
  const s = new Set<string>()
  persistence.groups.value.forEach(g => g.forEach(p => s.add(p.entryId)))
  return s
})

const pool = computed(() => {
  let poolEntries = entriesStore.entries.filter(e => !assignedIds.value.has(e.id))
  if (filterSignedUp.value) {
    poolEntries = poolEntries.filter(e => signupMap.value.has(e.id))
  }
  if (filterRole.value) {
    poolEntries = poolEntries.filter(e => (e.roles || []).includes(filterRole.value as RoleName))
  }
  if (filterClass.value) {
    poolEntries = poolEntries.filter(e => e.className === filterClass.value)
  }
  if (filterName.value) {
    const q = filterName.value.toLowerCase()
    poolEntries = poolEntries.filter(e => e.charName.toLowerCase().includes(q))
  }
  if (filterDay.value) {
    poolEntries = poolEntries.filter(e => {
      if (!e.availability) return false
      if (filterTime.value) {
        const qs = hourQuarters(filterTime.value).map(q => filterDay.value + '_' + q)
        return qs.every(q => e.availability[q] === 'yes' || e.availability[q] === 'tentative')
      }
      return SLOTS.some(s => e.availability[filterDay.value + '_' + s])
    })
  }
  return poolEntries
})

const totalAssigned = computed(() =>
  persistence.groups.value.reduce((s, g) => s + g.length, 0)
)
const unassignedCount = computed(() =>
  entriesStore.entries.filter(e => !assignedIds.value.has(e.id)).length
)
const linkCount = computed(() => persistence.links.value.length)
const slotsSetCount = computed(() =>
  persistence.groupSlots.value.filter(s => s).length
)

const hasAnySlot = computed(() => persistence.groupSlots.value.some(s => s))

// Overlap map: for each assigned player, which OTHER groups' slots they're also available for
const overlapMap = computed(() => {
  const map = new Map<string, number[]>()
  if (!hasAnySlot.value) return map
  persistence.groups.value.forEach((group, gi) => {
    group.forEach(p => {
      const otherGroups: number[] = []
      persistence.groupSlots.value.forEach((slot, ogi) => {
        if (ogi === gi || !slot) return
        const available = karaPlayersForSlotKey(entriesStore.entries, slot)
        if (available.some(e => e.id === p.entryId)) {
          otherGroups.push(ogi)
        }
      })
      if (otherGroups.length > 0) {
        map.set(p.entryId, otherGroups)
      }
    })
  })
  return map
})

// Assigned players for pool ghost display
const assignedPlayers = computed(() => {
  const result: { entry: any; groupIndex: number }[] = []
  persistence.groups.value.forEach((group, gi) => {
    group.forEach(p => {
      const entry = entriesStore.entries.find(e => e.id === p.entryId)
      if (entry) result.push({ entry, groupIndex: gi })
    })
  })
  return result
})

// Suggestions
const suggestions = computed(() => {
  if (!suggestMode.value) return []
  const claimedIds = new Set<string>()
  persistence.groupSlots.value.forEach((slot) => {
    if (!slot) return
    const slotPlayers = karaPlayersForSlotKey(entriesStore.entries, slot)
    slotPlayers.slice(0, KARA_SIZE).forEach(p => claimedIds.add(p.id))
  })
  return karaSuggestSlots(entriesStore.entries, claimedIds).filter(s => s.total >= 3)
})

const maxSuggestTotal = computed(() =>
  suggestions.value.length ? suggestions.value[0].total : 1
)

// Actions
function prevWeek() {
  persistence.weekOffset.value--
  suggestMode.value = false
}

function nextWeek() {
  persistence.weekOffset.value++
  suggestMode.value = false
}

function toggleSuggest() {
  suggestMode.value = !suggestMode.value
}

async function autoPickSlots() {
  const result = karaAutoPickSlots(entriesStore.entries, groupCount.value)
  if (result) {
    persistence.groupSlots.value = result
    await persistence.save()
    toast('Optimale Zeiten automatisch gewaehlt')
  } else {
    toast('Nicht genug Spieler fuer ' + groupCount.value + ' Gruppen')
  }
}

async function assignSlot(gi: number, key: string) {
  persistence.groupSlots.value[gi] = key
  await persistence.save()
}

async function removeSlot(gi: number) {
  persistence.groupSlots.value[gi] = ''
  await persistence.save()
}

async function autoGenerate() {
  const result = karaAutoGenerate(
    entriesStore.entries,
    persistence.groups.value.map(g => [...g]),
    persistence.links.value,
    persistence.groupSlots.value,
    filterDay.value,
    filterTime.value,
  )
  persistence.groups.value = result.groups
  await persistence.save()
  toast(result.message)
}

function confirmReset() {
  showResetModal.value = true
}

async function doReset() {
  await persistence.reset()
  showResetModal.value = false
  toast('Gruppen zurueckgesetzt')
}

function toggleExport() {
  showExport.value = !showExport.value
}

// Group management
async function handleAddGroup() {
  if (persistence.addGroup()) {
    await persistence.save()
    toast('Gruppe hinzugefuegt')
  } else {
    toast('Maximal ' + persistence.KARA_MAX_GROUPS + ' Gruppen')
  }
}

function confirmRemoveGroup(gi: number) {
  removeGroupTarget.value = gi
}

async function doRemoveGroup() {
  const gi = removeGroupTarget.value
  removeGroupTarget.value = -1
  if (persistence.removeGroup(gi)) {
    await persistence.save()
    toast('Gruppe entfernt')
  }
}

// Tank role management
async function handleSetTankRole(entryId: string, role: 'MT' | 'OT' | undefined) {
  for (const group of persistence.groups.value) {
    const player = group.find(p => p.entryId === entryId)
    if (player) {
      player.tankRole = role
      break
    }
  }
  await persistence.save()
}

// Drag & Drop handlers
async function onSaved() {
  await persistence.save()
}

function handleDragStart(entryId: string, event: DragEvent) {
  dragDrop.onDragStart(entryId, event)
}

function handleDragEnd() {
  dragDrop.onDragEnd()
}

function handleDragOver(target: string, event: DragEvent) {
  dragDrop.onDragOver(target, event)
}

function handleDragLeave(target: string, event: DragEvent) {
  dragDrop.onDragLeave(target, event)
}

function handleDrop(target: string, event: DragEvent) {
  dragDrop.onDrop(target, event, persistence.groups.value, persistence.links.value, onSaved, toast)
}

function handleUnassign(entryId: string) {
  dragDrop.moveEntry(entryId, 'pool', persistence.groups.value, persistence.links.value, onSaved, toast)
}

function handlePin(entryId: string) {
  dragDrop.togglePin(entryId, persistence.groups.value, onSaved)
}

// Link system
const LINK_COLORS = ['#e57373', '#64b5f6', '#81c784', '#ffb74d', '#ce93d8', '#4dd0e1', '#fff176', '#a1887f']

function nextLinkColor(): string {
  const used = new Set(persistence.links.value.map(l => l.color))
  return LINK_COLORS.find(c => !used.has(c)) || LINK_COLORS[persistence.links.value.length % LINK_COLORS.length]
}

async function handleLink(entryId: string) {
  const existingLink = persistence.links.value.find(l => l.ids.includes(entryId))

  if (existingLink) {
    if (linkPending.value && linkPending.value !== entryId) {
      const pendingLink = persistence.links.value.find(l => l.ids.includes(linkPending.value!))
      if (pendingLink && pendingLink === existingLink) {
        linkPending.value = null
        toast('Bereits verknuepft')
        return
      }
      if (pendingLink) {
        pendingLink.ids.forEach(id => {
          if (!existingLink.ids.includes(id)) existingLink.ids.push(id)
        })
        persistence.links.value = persistence.links.value.filter(l => l !== pendingLink)
      } else {
        if (!existingLink.ids.includes(linkPending.value!)) existingLink.ids.push(linkPending.value!)
      }
      linkPending.value = null
      await persistence.save()
      toast('Verknuepft')
      return
    }
    // Remove from link
    existingLink.ids = existingLink.ids.filter(id => id !== entryId)
    if (existingLink.ids.length < 2) {
      persistence.links.value = persistence.links.value.filter(l => l !== existingLink)
    }
    linkPending.value = null
    await persistence.save()
    toast('Verknuepfung geloest')
    return
  }

  if (linkPending.value === null) {
    linkPending.value = entryId
    toast('Klicke einen zweiten Spieler zum Verknuepfen')
    return
  }

  if (linkPending.value === entryId) {
    linkPending.value = null
    toast('Verknuepfung abgebrochen')
    return
  }

  const pendingLink = persistence.links.value.find(l => l.ids.includes(linkPending.value!))
  if (pendingLink) {
    pendingLink.ids.push(entryId)
  } else {
    persistence.links.value.push({ ids: [linkPending.value, entryId], color: nextLinkColor() })
  }
  linkPending.value = null
  await persistence.save()
  toast('Spieler verknuepft')
}

// Export
const exportText = computed(() => {
  let text = `**Karazhan Gruppen \u2014 Raidwoche ${weekStartStr.value} \u2013 ${weekEndStr.value}**\n\n`
  for (let gi = 0; gi < groupCount.value; gi++) {
    const group = persistence.groups.value[gi] || []
    const roles = karaGroupRoles(group, entriesStore.entries)
    const tankTotal = karaGroupTankTotal(group, entriesStore.entries)
    const slot = persistence.groupSlots.value[gi]
    const parsedSlot = parseSlotKey(slot)
    text += `__Karazhan ${gi + 1}__`
    if (parsedSlot) text += ` \u2014 ${parsedSlot.day} ${parsedSlot.windowLabel}`
    text += ` (${roles.mt}MT/${roles.ot}OT/${roles.hl}H/${roles.dp}D)\n`
    if (group.length === 0) {
      text += `  (leer)\n`
    } else {
      group.forEach(p => {
        const entry = entriesStore.entries.find(e => e.id === p.entryId)
        if (!entry) return
        const mainRole = (entry.roles || [])[0] || 'DPS'
        const spec = (entry.specs || [])[0] || ''
        let roleLabel: string = mainRole
        if (mainRole === 'Tank' && p.tankRole) roleLabel = p.tankRole
        text += `  ${entry.charName} \u2014 ${entry.className}${spec ? ' (' + spec + ')' : ''} [${roleLabel}]${p.pinned ? ' \uD83D\uDCCC' : ''}\n`
      })
    }
    text += `\n`
  }
  const unassigned = entriesStore.entries.filter(e => !assignedIds.value.has(e.id))
  if (unassigned.length > 0) {
    text += `__Nicht eingeteilt (${unassigned.length}):__\n`
    unassigned.forEach(e => {
      text += `  ${e.charName} \u2014 ${e.className}\n`
    })
  }
  return text
})

function copyExport() {
  navigator.clipboard.writeText(exportText.value)
    .then(() => toast('In Zwischenablage kopiert'))
    .catch(() => toast('Kopieren fehlgeschlagen'))
}

// Day name → weekday index (Mon=1 … Sun=7, matching JS getDay offset)
const DAY_OFFSETS: Record<string, number> = {
  Montag: 0, Dienstag: 1, Mittwoch: 2, Donnerstag: 3,
  Freitag: 4, Samstag: 5, Sonntag: 6,
}

function slotToDate(gi: number): string | null {
  const slot = persistence.groupSlots.value[gi]
  const parsed = parseSlotKey(slot)
  if (!parsed) return null
  const ws = getIdWeekStart(persistence.weekOffset.value)
  // weekStart is Wednesday; compute offset: Mi=0, Do=1, Fr=2, Sa=3, So=4, Mo=5, Di=6
  const wedOffset = ((DAY_OFFSETS[parsed.day] ?? 0) - 2 + 7) % 7
  const d = new Date(ws)
  d.setDate(d.getDate() + wedOffset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function slotToTime(gi: number): string | null {
  const slot = persistence.groupSlots.value[gi]
  const parsed = parseSlotKey(slot)
  if (!parsed) return null
  const h = parseInt(parsed.windowLabel)
  return isNaN(h) ? null : `${String(h).padStart(2, '0')}:00`
}

const creatingRaid = ref<number | null>(null)

async function createRaidFromGroup(gi: number) {
  const group = persistence.groups.value[gi]
  if (!group || group.length === 0) {
    toast('Gruppe ist leer')
    return
  }

  const date = slotToDate(gi)
  const time = slotToTime(gi)
  if (!date || !time) {
    toast('Bitte erst einen Zeitslot fuer die Gruppe waehlen')
    return
  }

  creatingRaid.value = gi
  try {
    const raid = await raidsStore.save({
      instance: 'Karazhan',
      date,
      time,
      maxPlayers: 10,
      notes: '',
      description: `Karazhan Gruppe ${gi + 1} — automatisch erstellt aus Kara-Planung`,
    })

    if (!raid?.id) {
      toast('Raid konnte nicht erstellt werden')
      return
    }

    // Add all players as signups
    for (const p of group) {
      const entry = entriesStore.entries.find(e => e.id === p.entryId)
      if (!entry) continue

      // Determine role from tankRole assignment or entry specs
      let role: RoleName = 'DPS'
      if (p.tankRole === 'MT' || p.tankRole === 'OT') {
        role = 'Tank'
      } else {
        const roles = specsToRoles(entry.className, entry.specs)
        if (roles.length === 1) {
          role = roles[0]
        } else if (roles.includes('Heiler') && !roles.includes('DPS')) {
          role = 'Heiler'
        } else if (roles.includes('Tank')) {
          role = 'Tank'
        }
      }

      await raidsStore.signupOther(raid.id, {
        charName: entry.charName,
        className: entry.className,
        role,
        status: 'accepted',
        targetUserId: entry.userId,
        note: '',
      })
    }

    toast(`Raid erstellt mit ${group.length} Spielern`)
    router.push(`/raids/${raid.id}`)
  } catch (err) {
    console.error('Failed to create raid from group:', err)
    toast('Fehler beim Erstellen des Raids')
  } finally {
    creatingRaid.value = null
  }
}

function getAvailabilityForFilter(entry: typeof entriesStore.entries[number]): 'yes' | 'tentative' | 'unavailable' | null {
  if (!filterDay.value) return null
  if (!entry.availability) return 'unavailable'
  if (filterTime.value) {
    const qs = hourQuarters(filterTime.value).map(q => filterDay.value + '_' + q)
    const allYes = qs.every(q => entry.availability[q] === 'yes')
    const allAvail = qs.every(q => entry.availability[q] === 'yes' || entry.availability[q] === 'tentative')
    if (allYes) return 'yes'
    if (allAvail) return 'tentative'
    return 'unavailable'
  }
  const hasYes = SLOTS.some(s => entry.availability[filterDay.value + '_' + s] === 'yes')
  const hasTentative = SLOTS.some(s => entry.availability[filterDay.value + '_' + s] === 'tentative')
  if (hasYes) return 'yes'
  if (hasTentative) return 'tentative'
  return 'unavailable'
}

const poolAvailabilityMap = computed(() => {
  const map = new Map<string, 'yes' | 'tentative' | 'unavailable'>()
  if (!filterDay.value) return map
  for (const e of entriesStore.entries) {
    const status = getAvailabilityForFilter(e)
    if (status && status !== null) map.set(e.id, status)
  }
  return map
})

function onFilterDayChange() {
  filterTime.value = ''
}
</script>

<template>
  <div id="v-kara">
    <!-- Header -->
    <div class="kara-header">
      <div class="kara-week-nav">
        <button @click="prevWeek">&#x25C0;</button>
        <div class="kara-week-label">
          Raidwoche (Mi&ndash;Di)
          <small>{{ weekStartStr }} &ndash; {{ weekEndStr }}</small>
          <small v-if="persistence.lastSavedBy.value" class="kara-saved-by">
            Zuletzt: {{ persistence.lastSavedBy.value }}
          </small>
        </div>
        <button @click="nextWeek">&#x25B6;</button>
      </div>
      <div class="kara-actions">
        <button
          class="kara-btn"
          :class="{ primary: suggestMode }"
          title="Optimale Raidzeiten finden"
          @click="toggleSuggest"
        >&#x1F50D; Zeiten finden</button>
        <button
          class="kara-btn primary"
          title="Spieler optimal auf Gruppen verteilen"
          @click="autoGenerate"
        >&#x2728; Auto-Verteilen</button>
        <button
          class="kara-btn"
          title="Gruppenaufstellung als Text exportieren"
          @click="toggleExport"
        >&#x1F4CB; Export</button>
        <button
          class="kara-btn danger"
          title="Alle Zuweisungen zuruecksetzen"
          @click="confirmReset"
        >&#x21BA; Reset</button>
      </div>
    </div>

    <!-- Loading indicator -->
    <div v-if="persistence.loading.value" class="kara-loading">Lade Gruppenaufstellung...</div>

    <!-- Time slot suggestion picker -->
    <div v-if="suggestMode" class="kara-suggest-section">
      <div class="card">
        <div class="kara-suggest-title">
          <span>Raidzeit-Vorschlaege (3h-Fenster)</span>
          <button class="kara-btn" title="Beste Zeitfenster automatisch waehlen" @click="autoPickSlots">
            &#x2728; Beste {{ groupCount }} automatisch
          </button>
        </div>

        <div v-if="hasAnySlot" class="kara-slot-summary">
          <span
            v-for="(_, gi) in persistence.groupSlots.value"
            :key="gi"
            class="kara-group-slot-label"
            :style="{ opacity: persistence.groupSlots.value[gi] ? 1 : 0.4 }"
          >
            <template v-if="persistence.groupSlots.value[gi]">
              <strong>Gruppe {{ gi + 1 }}:</strong>
              {{ parseSlotKey(persistence.groupSlots.value[gi])?.day }}
              {{ parseSlotKey(persistence.groupSlots.value[gi])?.windowLabel }}
              <button class="kgs-remove" @click="removeSlot(gi)">&#x2716;</button>
            </template>
            <template v-else>
              Gruppe {{ gi + 1 }}: nicht zugewiesen
            </template>
          </span>
        </div>

        <div class="kara-suggest-list">
          <div v-if="suggestions.length === 0" class="kara-empty">
            Keine Verfuegbarkeitsdaten vorhanden. Spieler muessen erst Zeiten eintragen.
          </div>
          <div
            v-for="s in suggestions.slice(0, 20)"
            :key="s.key"
            class="kara-suggest-item"
            :class="{ assigned: persistence.groupSlots.value.includes(s.key) }"
          >
            <div class="kara-suggest-time">{{ s.day }} <small>{{ s.windowLabel }}</small></div>
            <div class="kara-suggest-bar">
              <div
                class="kara-suggest-bar-fill"
                :style="{ width: Math.round((s.total / Math.max(maxSuggestTotal, 1)) * 100) + '%' }"
              ></div>
            </div>
            <div class="kara-suggest-count">{{ s.total }} Spieler</div>
            <div class="kara-suggest-roles">
              <span style="color: var(--role-tank)">{{ s.tanks }}T</span>
              <span style="color: var(--role-heal)">{{ s.healers }}H</span>
              <span style="color: var(--role-dps)">{{ s.dps }}D</span>
            </div>
            <div class="kara-suggest-assign">
              <button
                v-for="(_, gi) in persistence.groupSlots.value"
                :key="gi"
                :class="{ active: persistence.groupSlots.value.indexOf(s.key) === gi }"
                :disabled="!!persistence.groupSlots.value[gi] && persistence.groupSlots.value[gi] !== s.key"
                @click="assignSlot(gi, s.key)"
              >G{{ gi + 1 }}</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Signup info banner -->
    <div v-if="karaSignupsStore.signups.length > 0" class="kara-signup-info">
      <strong>{{ karaSignupsStore.signups.length }} Kara-Anmeldungen:</strong>
      <span style="color: var(--role-tank)">{{ karaSignupsStore.roleCounts.Tank }} Tank</span>
      <span style="color: var(--role-heal)">{{ karaSignupsStore.roleCounts.Heiler }} Heiler</span>
      <span style="color: var(--role-dps)">{{ karaSignupsStore.roleCounts.DPS }} DPS</span>
      <span
        v-if="karaSignupsStore.signups.filter(s => {
          const e = entriesStore.entries.find(x => x.id === s.entryId)
          return e && Object.keys(e.availability || {}).length === 0 && !s.useCustomTimes
        }).length > 0"
        class="kara-signup-warn-count"
      >
        ({{ karaSignupsStore.signups.filter(s => {
          const e = entriesStore.entries.find(x => x.id === s.entryId)
          return e && Object.keys(e.availability || {}).length === 0 && !s.useCustomTimes
        }).length }} ohne Zeiten)
      </span>
    </div>

    <!-- Pool filter -->
    <div class="kara-filter">
      <div class="kara-filter-row">
        <span>Filter:</span>
        <select v-model="filterDay" @change="onFilterDayChange">
          <option value="">Alle Tage</option>
          <option v-for="d in DAYS" :key="d" :value="d">{{ d }}</option>
        </select>
        <select v-if="filterDay" v-model="filterTime">
          <option value="">Jede Uhrzeit</option>
          <option v-for="hl in HOUR_LABELS" :key="hl" :value="hl">{{ hl }}:00</option>
        </select>
        <select v-model="filterRole">
          <option value="">Alle Rollen</option>
          <option v-for="r in ROLES" :key="r" :value="r">{{ r }}</option>
        </select>
        <select v-model="filterClass">
          <option value="">Alle Klassen</option>
          <option v-for="c in CLS" :key="c.name" :value="c.name" :style="{ color: c.color }">{{ c.name }}</option>
        </select>
        <input
          v-model="filterName"
          type="text"
          class="kara-filter-name"
          placeholder="Name suchen..."
        />
        <label class="kara-filter-check">
          <input v-model="filterSignedUp" type="checkbox" />
          Angemeldete ({{ karaSignupsStore.signups.length }})
        </label>
      </div>
    </div>

    <!-- Layout: pool + N groups -->
    <div class="kara-layout">
      <KaraPool
        :pool="pool"
        :links="persistence.links.value"
        :is-drag-over="dragDrop.dragOverTarget.value === 'pool'"
        :no-entries="entriesStore.entries.length === 0"
        :show-assigned="showAssigned"
        :assigned-players="assignedPlayers"
        :signup-map="signupMap"
        :availability-map="poolAvailabilityMap"
        @link="handleLink"
        @toggle-show-assigned="showAssigned = !showAssigned"
        @dragstart="handleDragStart"
        @dragend="handleDragEnd"
        @dragover="handleDragOver('pool', $event)"
        @dragleave="handleDragLeave('pool', $event)"
        @drop="handleDrop('pool', $event)"
      />

      <div v-for="(_, gi) in persistence.groups.value" :key="gi" class="kara-group-wrapper">
        <KaraGroup
          :group-index="gi"
          :group="persistence.groups.value[gi] || []"
          :links="persistence.links.value"
          :group-slot="persistence.groupSlots.value[gi] || ''"
          :is-drag-over="dragDrop.dragOverTarget.value === 'group-' + gi"
          :removable="groupCount > 1"
          :overlap-map="overlapMap"
          @pin="handlePin"
          @unassign="handleUnassign"
          @link="handleLink"
          @set-tank-role="handleSetTankRole"
          @remove-slot="removeSlot"
          @remove-group="confirmRemoveGroup"
          @dragstart="handleDragStart"
          @dragend="handleDragEnd"
          @dragover="handleDragOver('group-' + gi, $event)"
          @dragleave="handleDragLeave('group-' + gi, $event)"
          @drop="handleDrop('group-' + gi, $event)"
        />
        <button
          v-if="authStore.isLoggedIn && (persistence.groups.value[gi] || []).length > 0"
          class="kara-create-raid-btn"
          :disabled="creatingRaid !== null"
          @click="createRaidFromGroup(gi)"
        >
          <template v-if="creatingRaid === gi">Erstelle Raid...</template>
          <template v-else>Raid erstellen aus Gruppe {{ gi + 1 }}</template>
        </button>
      </div>

      <!-- Add group button -->
      <button
        v-if="groupCount < persistence.KARA_MAX_GROUPS"
        class="kara-add-group"
        title="Gruppe hinzufuegen"
        @click="handleAddGroup"
      >
        <span class="kara-add-icon">+</span>
        <span>Gruppe hinzufuegen</span>
      </button>
    </div>

    <!-- Summary -->
    <div class="kara-comp-summary">
      <div class="kara-comp-card"><div class="num">{{ totalAssigned }}</div><div class="lbl">Verteilt</div></div>
      <div class="kara-comp-card"><div class="num">{{ unassignedCount }}</div><div class="lbl">Offen</div></div>
      <div class="kara-comp-card"><div class="num">{{ linkCount }}</div><div class="lbl">Links</div></div>
      <div class="kara-comp-card"><div class="num">{{ slotsSetCount }}/{{ groupCount }}</div><div class="lbl">Zeiten</div></div>
      <div class="kara-comp-card"><div class="num">{{ groupCount }}</div><div class="lbl">Gruppen</div></div>
    </div>

    <!-- Export -->
    <div v-if="showExport" class="kara-export-area">
      <div class="kara-export-header">
        <span class="kara-export-label">Export</span>
        <button class="kara-btn" @click="copyExport">&#x1F4CB; Kopieren</button>
      </div>
      <pre class="kara-export-text">{{ exportText }}</pre>
    </div>

    <!-- Reset modal -->
    <ConfirmModal
      :open="showResetModal"
      title="Gruppen zuruecksetzen"
      message="Alle Zuweisungen, Verknuepfungen und Zeitfenster fuer diese Raidwoche werden geloescht."
      @confirm="doReset"
      @cancel="showResetModal = false"
    />

    <!-- Remove group modal -->
    <ConfirmModal
      :open="removeGroupTarget >= 0"
      title="Gruppe entfernen"
      :message="'Karazhan ' + (removeGroupTarget + 1) + ' wird entfernt. Spieler gehen zurueck in den Pool.'"
      @confirm="doRemoveGroup"
      @cancel="removeGroupTarget = -1"
    />
  </div>
</template>

<style scoped>
.kara-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.kara-week-nav {
  display: flex;
  align-items: center;
  gap: 10px;
}

.kara-week-nav button {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--color-tx2);
  border-radius: 6px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.15s;
}

.kara-week-nav button:hover {
  background: rgba(255, 255, 255, 0.1);
}

.kara-week-label {
  font: 600 15px var(--font-heading);
  color: var(--color-gold);
  text-align: center;
}

.kara-week-label small {
  display: block;
  font-size: 12px;
  font-weight: 400;
  color: var(--color-tx3);
}

.kara-saved-by {
  color: var(--color-tx4) !important;
  font-size: 11px !important;
}

.kara-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.kara-btn {
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: var(--color-tx2);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;
}

.kara-btn:hover {
  background: rgba(255, 255, 255, 0.08);
}

.kara-btn.primary {
  background: rgba(201, 168, 76, 0.12);
  border-color: rgba(201, 168, 76, 0.25);
  color: var(--color-gold);
}

.kara-btn.primary:hover {
  background: rgba(201, 168, 76, 0.2);
}

.kara-btn.danger {
  color: #e57373;
  border-color: rgba(229, 115, 115, 0.2);
}

.kara-btn.danger:hover {
  background: rgba(229, 115, 115, 0.08);
}

/* Loading */
.kara-loading {
  text-align: center;
  color: var(--color-tx4);
  font-size: 13px;
  padding: 20px;
}

/* Suggest section */
.kara-suggest-section {
  margin-bottom: 16px;
}

.card {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 16px;
}

.kara-suggest-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font: 600 14px var(--font-heading);
  color: var(--color-gold);
  margin-bottom: 12px;
}

.kara-slot-summary {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.kara-group-slot-label {
  font-size: 12px;
  color: var(--color-tx2);
  padding: 4px 10px;
  background: rgba(201, 168, 76, 0.06);
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.kgs-remove {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-tx4);
  font-size: 10px;
  padding: 1px;
}

.kgs-remove:hover {
  color: #e57373;
}

.kara-suggest-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 400px;
  overflow-y: auto;
}

.kara-suggest-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid transparent;
}

.kara-suggest-item.assigned {
  border-color: rgba(201, 168, 76, 0.2);
  background: rgba(201, 168, 76, 0.04);
}

.kara-suggest-time {
  min-width: 110px;
  color: var(--color-tx2);
}

.kara-suggest-time small {
  color: var(--color-tx4);
}

.kara-suggest-bar {
  flex: 1;
  height: 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
  overflow: hidden;
}

.kara-suggest-bar-fill {
  height: 100%;
  background: rgba(201, 168, 76, 0.3);
  border-radius: 3px;
}

.kara-suggest-count {
  min-width: 65px;
  text-align: right;
  color: var(--color-tx3);
}

.kara-suggest-roles {
  display: flex;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
}

.kara-suggest-assign {
  display: flex;
  gap: 3px;
}

.kara-suggest-assign button {
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: var(--color-tx3);
  cursor: pointer;
  font-size: 11px;
  transition: all 0.15s;
}

.kara-suggest-assign button.active {
  background: rgba(201, 168, 76, 0.2);
  border-color: rgba(201, 168, 76, 0.4);
  color: var(--color-gold);
}

.kara-suggest-assign button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.kara-suggest-assign button:not(:disabled):hover {
  background: rgba(255, 255, 255, 0.08);
}

/* Signup info banner */
.kara-signup-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 8px 14px;
  border-radius: 8px;
  background: rgba(102, 187, 106, 0.06);
  border: 1px solid rgba(102, 187, 106, 0.15);
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--color-tx2);
}
.kara-signup-warn-count {
  color: #ffb74d;
  font-weight: 600;
}

/* Filter */
.kara-filter {
  margin-bottom: 12px;
}

.kara-filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--color-tx3);
}

.kara-filter-row select {
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: var(--color-card);
  color: var(--color-tx1);
  font-size: 12px;
}

.kara-filter-check {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  cursor: pointer;
  user-select: none;
  margin-left: auto;
}
.kara-filter-check input { accent-color: var(--color-gold); }

.kara-filter-name {
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: var(--color-card);
  color: var(--color-tx1);
  font-size: 12px;
  width: 120px;
}
.kara-filter-name::placeholder {
  color: var(--color-tx4);
}

/* Layout */
.kara-layout {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

/* Add group button */
.kara-add-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 120px;
  background: rgba(255, 255, 255, 0.02);
  border: 2px dashed rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  cursor: pointer;
  color: var(--color-tx4);
  font-size: 12px;
  transition: all 0.15s;
}

.kara-add-group:hover {
  border-color: rgba(201, 168, 76, 0.25);
  background: rgba(201, 168, 76, 0.04);
  color: var(--color-gold);
}

.kara-add-icon {
  font-size: 28px;
  font-weight: 300;
  line-height: 1;
}

/* Group wrapper & create raid button */
.kara-group-wrapper {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.kara-create-raid-btn {
  padding: 8px 14px;
  border-radius: 6px;
  font: 600 12px var(--font-body);
  cursor: pointer;
  border: 1px solid rgba(102, 187, 106, 0.25);
  background: rgba(102, 187, 106, 0.08);
  color: var(--color-heal);
  transition: all 0.15s;
  width: 100%;
  text-align: center;
  margin-top: -4px;
}
.kara-create-raid-btn:hover {
  background: rgba(102, 187, 106, 0.15);
  border-color: rgba(102, 187, 106, 0.4);
}
.kara-create-raid-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Summary */
.kara-comp-summary {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.kara-comp-card {
  text-align: center;
  padding: 12px 20px;
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  min-width: 80px;
}

.kara-comp-card .num {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-gold);
}

.kara-comp-card .lbl {
  font-size: 11px;
  color: var(--color-tx4);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Export */
.kara-export-area {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 16px;
}

.kara-export-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.kara-export-label {
  font-size: 12px;
  color: var(--color-tx4);
  text-transform: uppercase;
  letter-spacing: 1px;
}

.kara-export-text {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 6px;
  padding: 12px;
  font-size: 12px;
  color: var(--color-tx2);
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 400px;
  overflow-y: auto;
}

.kara-empty {
  color: var(--color-tx4);
  font-size: 13px;
  text-align: center;
  padding: 20px;
}

@media (max-width: 767px) {
  .kara-header {
    flex-direction: column;
    align-items: stretch;
  }

  .kara-actions {
    justify-content: center;
  }

  .kara-layout {
    grid-template-columns: 1fr;
  }

  .kara-suggest-item {
    flex-wrap: wrap;
  }
}
</style>

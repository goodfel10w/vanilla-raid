<script setup lang="ts">
import { computed } from 'vue'
import { useEntriesStore } from '@/stores/entries'
import { cc } from '@/lib/utils'
import { ROLE_COLORS } from '@/lib/constants'
import type { RoleName } from '@/lib/constants'
import ClassIcon from '@/components/shared/ClassIcon.vue'

const props = defineProps<{
  entryId: string
  inGroup: boolean
  pinned: boolean
  linkColor: string | null
  tankRole?: 'MT' | 'OT'
  overlapGroups?: number[]
  ghosted?: boolean
  ghostGroupIndex?: number
  signupSpec?: string
  availabilityStatus?: 'yes' | 'tentative' | 'unavailable' | null
}>()

const emit = defineEmits<{
  pin: [entryId: string]
  unassign: [entryId: string]
  link: [entryId: string]
  setTankRole: [entryId: string, role: 'MT' | 'OT' | undefined]
  dragstart: [entryId: string, event: DragEvent]
  dragend: []
}>()

const entriesStore = useEntriesStore()

const entry = computed(() => entriesStore.entries.find(e => e.id === props.entryId))
const allRoles = computed<RoleName[]>(() => {
  const roles = entry.value?.roles || []
  return roles.length ? roles as RoleName[] : ['DPS']
})
const isTank = computed(() => allRoles.value.includes('Tank'))
const allSpecs = computed(() => entry.value?.specs || [])
const playerNotes = computed(() => entry.value?.notes || '')

const availDotColor = computed(() => {
  if (!props.availabilityStatus) return null
  if (props.availabilityStatus === 'yes') return '#66bb6a'
  if (props.availabilityStatus === 'tentative') return '#ffb74d'
  return '#e57373'
})

const availDotTitle = computed(() => {
  if (!props.availabilityStatus) return ''
  if (props.availabilityStatus === 'yes') return 'Verfuegbar (sicher)'
  if (props.availabilityStatus === 'tentative') return 'Verfuegbar (vielleicht)'
  return 'Nicht verfuegbar'
})

const tankRoleLabel = computed(() => {
  if (!isTank.value || !props.inGroup) return null
  return props.tankRole || null
})

function cycleTankRole() {
  if (!isTank.value) return
  if (!props.tankRole) {
    emit('setTankRole', props.entryId, 'MT')
  } else if (props.tankRole === 'MT') {
    emit('setTankRole', props.entryId, 'OT')
  } else {
    emit('setTankRole', props.entryId, undefined)
  }
}
</script>

<template>
  <div
    v-if="entry"
    class="kara-player"
    :class="{ pinned, linked: !!linkColor, ghosted }"
    :style="linkColor ? { borderLeftColor: linkColor } : {}"
    :draggable="!ghosted"
    :data-entry-id="entryId"
    @dragstart="!ghosted && emit('dragstart', entryId, $event)"
    @dragend="emit('dragend')"
  >
    <!-- Row 1: identity + roles + actions -->
    <div class="kp-row1">
      <span
        v-if="availDotColor"
        class="kp-avail-dot"
        :style="{ background: availDotColor }"
        :title="availDotTitle"
      ></span>
      <ClassIcon :class-name="entry.className" size="sm" />
      <span class="kp-name" :style="{ color: cc(entry.className) }">{{ entry.charName }}</span>

      <!-- Tank role badge (clickable to cycle MT/OT) -->
      <button
        v-if="isTank && inGroup && !ghosted"
        class="kp-tank-role"
        :class="{ assigned: !!tankRoleLabel }"
        :style="{
          background: tankRoleLabel ? 'var(--role-tank)' + '33' : 'rgba(255,255,255,0.06)',
          color: tankRoleLabel ? 'var(--role-tank)' : 'var(--color-tx4)',
        }"
        :title="tankRoleLabel ? tankRoleLabel + ' (klick zum Aendern)' : 'Tank-Rolle zuweisen (MT/OT)'"
        @click.stop="cycleTankRole"
      >{{ tankRoleLabel || '?T' }}</button>

      <!-- All role badges -->
      <span
        v-for="r in allRoles"
        :key="r"
        class="kp-role"
        :style="{ background: (ROLE_COLORS[r] || '#888') + '22', color: ROLE_COLORS[r] || '#888' }"
      >{{ r }}</span>

      <!-- Ghost group badge -->
      <span
        v-if="ghosted && ghostGroupIndex !== undefined"
        class="kp-ghost-badge"
      >G{{ ghostGroupIndex + 1 }}</span>

      <!-- Overlap badges -->
      <span
        v-for="gi in (overlapGroups || [])"
        :key="gi"
        class="kp-overlap-badge"
        :title="'Auch verfuegbar fuer Gruppe ' + (gi + 1)"
      >G{{ gi + 1 }}</span>

      <span
        v-if="linkColor"
        class="kara-link-badge"
        :style="{ background: linkColor + '33', color: linkColor }"
      >L</span>
      <span
        v-if="signupSpec"
        class="kp-signup-badge"
        :title="'Angemeldet als ' + signupSpec"
      >{{ signupSpec }}</span>

      <span v-if="!ghosted" class="kp-actions">
        <button
          v-if="inGroup"
          class="kp-btn kp-pin"
          :title="pinned ? 'Loesen' : 'Fixieren'"
          @click.stop="emit('pin', entryId)"
        >{{ pinned ? '\uD83D\uDCCC' : '\uD83D\uDCCD' }}</button>
        <button
          v-if="inGroup"
          class="kp-btn"
          title="Zurueck zum Pool"
          @click.stop="emit('unassign', entryId)"
        >&#x2716;</button>
        <button
          class="kp-btn"
          title="Verknuepfen"
          @click.stop="emit('link', entryId)"
        >&#x1F517;</button>
      </span>
    </div>

    <!-- Row 2: specs + notes -->
    <div class="kp-row2">
      <span v-if="allSpecs.length" class="kp-specs">{{ allSpecs.join(', ') }}</span>
      <span v-if="playerNotes" class="kp-notes" :title="playerNotes">{{ playerNotes }}</span>
    </div>
  </div>
</template>

<style scoped>
.kara-player {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  cursor: grab;
  transition: all 0.15s;
  font-size: 13px;
}

.kara-player:hover {
  background: rgba(255, 255, 255, 0.06);
}

.kara-player.pinned {
  border-color: rgba(201, 168, 76, 0.3);
  background: rgba(201, 168, 76, 0.05);
}

.kara-player.linked {
  border-left: 3px solid;
}

.kara-player.ghosted {
  opacity: 0.45;
  cursor: default;
  border-style: dashed;
}

.kara-player:global(.dragging) {
  opacity: 0.4;
}

/* Row 1 */
.kp-row1 {
  display: flex;
  align-items: center;
  gap: 6px;
}

.kp-avail-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.kp-name {
  font-weight: 600;
  white-space: nowrap;
}

.kp-role {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: 600;
  white-space: nowrap;
}

.kp-tank-role {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: 700;
  white-space: nowrap;
  border: 1px solid rgba(255, 255, 255, 0.1);
  cursor: pointer;
  transition: all 0.15s;
}

.kp-tank-role:hover {
  border-color: var(--role-tank);
}

.kp-tank-role.assigned {
  border-color: transparent;
}

.kp-ghost-badge {
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 3px;
  font-weight: 700;
  background: rgba(201, 168, 76, 0.2);
  color: var(--color-gold);
}

.kp-overlap-badge {
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 3px;
  font-weight: 700;
  background: rgba(255, 183, 77, 0.2);
  color: #ffb74d;
}

.kara-link-badge {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  font-weight: 700;
}

.kp-signup-badge {
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 3px;
  font-weight: 600;
  background: rgba(102, 187, 106, 0.18);
  color: var(--color-heal);
  white-space: nowrap;
}

.kp-actions {
  margin-left: auto;
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.kp-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  padding: 2px 4px;
  border-radius: 3px;
  opacity: 0.5;
  transition: opacity 0.15s;
  color: var(--color-tx2);
}

.kp-btn:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.08);
}

/* Row 2 */
.kp-row2 {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 2px;
  min-height: 0;
}

.kp-specs {
  font-size: 11px;
  color: var(--color-tx3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.kp-notes {
  font-size: 10px;
  color: var(--color-tx4);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
  font-style: italic;
}
.kp-notes::before {
  content: '| ';
}
</style>

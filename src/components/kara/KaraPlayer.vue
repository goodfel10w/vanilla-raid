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
  signupRole?: string
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
const mainRole = computed<RoleName>(() => {
  const roles = entry.value?.roles || []
  return (roles[0] || 'DPS') as RoleName
})
const isTank = computed(() => mainRole.value === 'Tank')
const roleColor = computed(() => ROLE_COLORS[mainRole.value] || '#888')
const specText = computed(() => (entry.value?.specs || [])[0] || '')

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
    <ClassIcon :class-name="entry.className" size="sm" />
    <span class="kp-name" :style="{ color: cc(entry.className) }">{{ entry.charName }}</span>
    <span v-if="specText" class="kp-spec">{{ specText }}</span>

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

    <span
      v-else
      class="kp-role"
      :style="{ background: roleColor + '22', color: roleColor }"
    >{{ mainRole }}</span>

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
</template>

<style scoped>
.kara-player {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
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

.kp-name {
  font-weight: 600;
  white-space: nowrap;
}

.kp-spec {
  font-size: 11px;
  color: var(--color-tx3);
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
</style>

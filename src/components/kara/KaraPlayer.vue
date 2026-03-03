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
}>()

const emit = defineEmits<{
  pin: [entryId: string]
  unassign: [entryId: string]
  link: [entryId: string]
  dragstart: [entryId: string, event: DragEvent]
  dragend: []
}>()

const entriesStore = useEntriesStore()

const entry = computed(() => entriesStore.entries.find(e => e.id === props.entryId))
const mainRole = computed<RoleName>(() => {
  const roles = entry.value?.roles || []
  return (roles[0] || 'DPS') as RoleName
})
const roleColor = computed(() => ROLE_COLORS[mainRole.value] || '#888')
const specText = computed(() => (entry.value?.specs || [])[0] || '')
</script>

<template>
  <div
    v-if="entry"
    class="kara-player"
    :class="{ pinned, linked: !!linkColor }"
    :style="linkColor ? { borderLeftColor: linkColor } : {}"
    draggable="true"
    :data-entry-id="entryId"
    @dragstart="emit('dragstart', entryId, $event)"
    @dragend="emit('dragend')"
  >
    <ClassIcon :class-name="entry.className" size="sm" />
    <span class="kp-name" :style="{ color: cc(entry.className) }">{{ entry.charName }}</span>
    <span v-if="specText" class="kp-spec">{{ specText }}</span>
    <span
      class="kp-role"
      :style="{ background: roleColor + '22', color: roleColor }"
    >{{ mainRole }}</span>
    <span
      v-if="linkColor"
      class="kara-link-badge"
      :style="{ background: linkColor + '33', color: linkColor }"
    >L</span>
    <span class="kp-actions">
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

.kara-link-badge {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  font-weight: 700;
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

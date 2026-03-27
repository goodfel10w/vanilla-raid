<script setup lang="ts">
import type { Entry } from '@/types'
import type { KaraLink } from '@/composables/useKaraPersistence'
import KaraPlayer from './KaraPlayer.vue'

const props = defineProps<{
  pool: Entry[]
  links: KaraLink[]
  isDragOver: boolean
  noEntries: boolean
  showAssigned: boolean
  assignedPlayers?: { entry: Entry; groupIndex: number }[]
}>()

const emit = defineEmits<{
  link: [entryId: string]
  toggleShowAssigned: []
  dragstart: [entryId: string, event: DragEvent]
  dragend: []
  dragover: [event: DragEvent]
  dragleave: [event: DragEvent]
  drop: [event: DragEvent]
}>()

function getLinkColor(entryId: string): string | null {
  const lk = props.links.find(l => l.ids.includes(entryId))
  return lk ? lk.color : null
}
</script>

<template>
  <div class="kara-pool">
    <div class="kara-pool-title">
      Spieler-Pool <span class="kara-pool-count">{{ pool.length }}</span>
      <button
        class="kara-pool-toggle"
        :class="{ active: showAssigned }"
        title="Zugewiesene Spieler anzeigen"
        @click="emit('toggleShowAssigned')"
      >&#x1F441; Zugewiesene</button>
    </div>
    <div
      class="kara-dropzone pool-zone"
      :class="{ 'drag-over': isDragOver }"
      data-kara-drop="pool"
      @dragover="emit('dragover', $event)"
      @dragleave="emit('dragleave', $event)"
      @drop="emit('drop', $event)"
    >
      <div v-if="pool.length === 0 && (!showAssigned || !assignedPlayers?.length)" class="kara-empty">
        {{ noEntries ? 'Keine Eintraege vorhanden' : 'Alle Spieler sind verteilt' }}
      </div>
      <KaraPlayer
        v-for="e in pool"
        :key="e.id"
        :entry-id="e.id"
        :in-group="false"
        :pinned="false"
        :link-color="getLinkColor(e.id)"
        @link="emit('link', $event)"
        @dragstart="(id: string, ev: DragEvent) => emit('dragstart', id, ev)"
        @dragend="emit('dragend')"
      />
      <!-- Ghosted assigned players -->
      <template v-if="showAssigned && assignedPlayers?.length">
        <div class="kara-pool-divider">Zugewiesen</div>
        <KaraPlayer
          v-for="ap in assignedPlayers"
          :key="'ghost-' + ap.entry.id"
          :entry-id="ap.entry.id"
          :in-group="false"
          :pinned="false"
          :link-color="getLinkColor(ap.entry.id)"
          :ghosted="true"
          :ghost-group-index="ap.groupIndex"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.kara-pool {
  min-width: 0;
}

.kara-pool-title {
  font: 600 14px var(--font-heading);
  color: var(--color-gold);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.kara-pool-count {
  font-size: 12px;
  background: rgba(201, 168, 76, 0.15);
  color: var(--color-gold);
  padding: 1px 8px;
  border-radius: 10px;
}

.kara-pool-toggle {
  margin-left: auto;
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
  color: var(--color-tx4);
  cursor: pointer;
  transition: all 0.15s;
}

.kara-pool-toggle:hover {
  background: rgba(255, 255, 255, 0.06);
}

.kara-pool-toggle.active {
  background: rgba(201, 168, 76, 0.12);
  border-color: rgba(201, 168, 76, 0.25);
  color: var(--color-gold);
}

.kara-pool-divider {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--color-tx4);
  padding: 6px 0 2px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  margin-top: 4px;
}

.kara-dropzone {
  min-height: 100px;
  padding: 8px;
  border: 1px dashed rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: all 0.15s;
}

.kara-dropzone.drag-over {
  border-color: var(--color-gold);
  background: rgba(201, 168, 76, 0.05);
}

.kara-empty {
  color: var(--color-tx4);
  font-size: 13px;
  text-align: center;
  padding: 20px;
}
</style>

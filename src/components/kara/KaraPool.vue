<script setup lang="ts">
import type { Entry } from '@/types'
import type { KaraLink } from '@/composables/useKaraPersistence'
import KaraPlayer from './KaraPlayer.vue'

const props = defineProps<{
  pool: Entry[]
  links: KaraLink[]
  isDragOver: boolean
  noEntries: boolean
}>()

const emit = defineEmits<{
  link: [entryId: string]
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
    </div>
    <div
      class="kara-dropzone pool-zone"
      :class="{ 'drag-over': isDragOver }"
      data-kara-drop="pool"
      @dragover="emit('dragover', $event)"
      @dragleave="emit('dragleave', $event)"
      @drop="emit('drop', $event)"
    >
      <div v-if="pool.length === 0" class="kara-empty">
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
        @dragstart="emit('dragstart', $event, $event as unknown as DragEvent)"
        @dragend="emit('dragend')"
      />
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

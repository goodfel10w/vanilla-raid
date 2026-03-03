<script setup lang="ts">
import { computed } from 'vue'
import { useEntriesStore } from '@/stores/entries'
import type { KaraLink } from '@/composables/useKaraPersistence'
import type { KaraGroupPlayer } from '@/composables/useKaraPersistence'
import { karaGroupRoles, parseSlotKey, KARA_TANKS, KARA_HEALERS, KARA_DPS } from '@/composables/useKaraAutoSuggest'
import KaraPlayer from './KaraPlayer.vue'

const props = defineProps<{
  groupIndex: number
  group: KaraGroupPlayer[]
  links: KaraLink[]
  groupSlot: string
  isDragOver: boolean
}>()

const emit = defineEmits<{
  pin: [entryId: string]
  unassign: [entryId: string]
  link: [entryId: string]
  removeSlot: [gi: number]
  dragstart: [entryId: string, event: DragEvent]
  dragend: []
  dragover: [event: DragEvent]
  dragleave: [event: DragEvent]
  drop: [event: DragEvent]
}>()

const entriesStore = useEntriesStore()

const roles = computed(() => karaGroupRoles(props.group, entriesStore.entries))
const parsedSlot = computed(() => parseSlotKey(props.groupSlot))

function getLinkColor(entryId: string): string | null {
  const lk = props.links.find(l => l.ids.includes(entryId))
  return lk ? lk.color : null
}
</script>

<template>
  <div class="kara-group">
    <div class="kara-group-hdr">
      <div class="kara-group-title">
        Karazhan {{ groupIndex + 1 }}
        <span class="kara-group-count">{{ group.length }}/10</span>
      </div>
    </div>
    <div v-if="parsedSlot" class="kara-group-slot">
      <strong>{{ parsedSlot.day }} {{ parsedSlot.windowLabel }}</strong>
      <button class="kgs-remove" title="Zeit entfernen" @click="emit('removeSlot', groupIndex)">&#x2716;</button>
    </div>
    <div class="kara-role-bar">
      <span
        class="kara-role-tag"
        :class="roles.t >= KARA_TANKS ? 'ok' : 'need'"
        :style="{ background: 'var(--role-tank)' + '22', color: 'var(--role-tank)' }"
      >&#x1F6E1;&#xFE0F; {{ roles.t }}/{{ KARA_TANKS }}T</span>
      <span
        class="kara-role-tag"
        :class="roles.hl >= KARA_HEALERS ? 'ok' : 'need'"
        :style="{ background: 'var(--role-heal)' + '22', color: 'var(--role-heal)' }"
      >&#x1F49A; {{ roles.hl }}/{{ KARA_HEALERS }}H</span>
      <span
        class="kara-role-tag"
        :class="roles.dp >= KARA_DPS ? 'ok' : 'need'"
        :style="{ background: 'var(--role-dps)' + '22', color: 'var(--role-dps)' }"
      >&#x2694;&#xFE0F; {{ roles.dp }}/{{ KARA_DPS }}D</span>
    </div>
    <div
      class="kara-dropzone"
      :class="{ 'drag-over': isDragOver }"
      :data-kara-drop="'group-' + groupIndex"
      @dragover="emit('dragover', $event)"
      @dragleave="emit('dragleave', $event)"
      @drop="emit('drop', $event)"
    >
      <div v-if="group.length === 0" class="kara-empty">
        Spieler hierher ziehen
      </div>
      <KaraPlayer
        v-for="p in group"
        :key="p.entryId"
        :entry-id="p.entryId"
        :in-group="true"
        :pinned="p.pinned"
        :link-color="getLinkColor(p.entryId)"
        @pin="emit('pin', $event)"
        @unassign="emit('unassign', $event)"
        @link="emit('link', $event)"
        @dragstart="emit('dragstart', $event, $event as unknown as DragEvent)"
        @dragend="emit('dragend')"
      />
    </div>
  </div>
</template>

<style scoped>
.kara-group {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 12px;
  min-width: 0;
}

.kara-group-hdr {
  margin-bottom: 8px;
}

.kara-group-title {
  font: 600 14px var(--font-heading);
  color: var(--color-gold);
  display: flex;
  align-items: center;
  gap: 8px;
}

.kara-group-count {
  font-size: 12px;
  font-weight: 400;
  color: var(--color-tx3);
}

.kara-group-slot {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-tx2);
  padding: 4px 8px;
  background: rgba(201, 168, 76, 0.06);
  border-radius: 6px;
  margin-bottom: 8px;
}

.kgs-remove {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-tx4);
  font-size: 11px;
  padding: 2px;
  border-radius: 3px;
  transition: color 0.15s;
}

.kgs-remove:hover {
  color: var(--color-danger, #e57373);
}

.kara-role-bar {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.kara-role-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
}

.kara-role-tag.need {
  opacity: 0.6;
}

.kara-role-tag.ok {
  opacity: 1;
}

.kara-dropzone {
  min-height: 80px;
  padding: 6px;
  border: 1px dashed rgba(255, 255, 255, 0.08);
  border-radius: 6px;
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
  font-size: 12px;
  text-align: center;
  padding: 16px 8px;
}
</style>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useEntriesStore } from '@/stores/entries'
import type { KaraLink } from '@/composables/useKaraPersistence'
import type { KaraGroupPlayer } from '@/composables/useKaraPersistence'
import type { AvailabilityMap } from '@/types'
import { karaGroupRoles, karaGroupTankTotal, parseSlotKey, KARA_MT, KARA_OT, KARA_HEALERS, KARA_DPS } from '@/composables/useKaraAutoSuggest'
import { DAYS, SLOTS } from '@/lib/constants'
import KaraPlayer from './KaraPlayer.vue'

const props = defineProps<{
  groupIndex: number
  group: KaraGroupPlayer[]
  links: KaraLink[]
  groupSlot: string
  isDragOver: boolean
  removable: boolean
  overlapMap?: Map<string, number[]>
  availMap?: Map<string, AvailabilityMap>
}>()

const emit = defineEmits<{
  pin: [entryId: string]
  unassign: [entryId: string]
  link: [entryId: string]
  setTankRole: [entryId: string, role: 'MT' | 'OT' | undefined]
  assignSlot: [gi: number, key: string]
  removeSlot: [gi: number]
  removeGroup: [gi: number]
  dragstart: [entryId: string, event: DragEvent]
  dragend: []
  dragover: [event: DragEvent]
  dragleave: [event: DragEvent]
  drop: [event: DragEvent]
}>()

const entriesStore = useEntriesStore()

const roles = computed(() => karaGroupRoles(props.group, entriesStore.entries))
const tankTotal = computed(() => karaGroupTankTotal(props.group, entriesStore.entries))
const parsedSlot = computed(() => parseSlotKey(props.groupSlot))

// Inline time picker state
const pickerDay = ref('')
const pickerHour = ref('')
const startHours = Array.from({ length: 10 }, (_, i) => i + 12) // 12–21

function buildSlotKey(day: string, h: number): string {
  const endH = h + 3
  return day + '_' + String(h).padStart(2, '0') + ':00\u2013' + String(endH === 24 ? 0 : endH).padStart(2, '0') + ':00'
}

function onPickerChange() {
  if (pickerDay.value && pickerHour.value) {
    const key = buildSlotKey(pickerDay.value, parseInt(pickerHour.value))
    emit('assignSlot', props.groupIndex, key)
    pickerDay.value = ''
    pickerHour.value = ''
  }
}

function getLinkColor(entryId: string): string | null {
  const lk = props.links.find(l => l.ids.includes(entryId))
  return lk ? lk.color : null
}

function getPlayerTankRole(entryId: string): 'MT' | 'OT' | undefined {
  const p = props.group.find(g => g.entryId === entryId)
  return p?.tankRole
}

function getOverlapGroups(entryId: string): number[] {
  return props.overlapMap?.get(entryId) || []
}

// Per-player availability for the group's assigned time slot
const playerAvailability = computed(() => {
  const map = new Map<string, 'yes' | 'tentative' | 'unavailable'>()
  const parsed = parsedSlot.value
  if (!parsed) return map

  const startH = parseInt(parsed.windowLabel)
  if (isNaN(startH)) return map

  const qs: string[] = []
  for (let wh = startH; wh < startH + 3; wh++) {
    for (const m of [0, 15, 30, 45]) {
      qs.push(parsed.day + '_' + String(wh).padStart(2, '0') + ':' + String(m).padStart(2, '0'))
    }
  }

  props.group.forEach(p => {
    const entry = entriesStore.entries.find(e => e.id === p.entryId)
    if (!entry) {
      map.set(p.entryId, 'unavailable')
      return
    }
    const avail = props.availMap?.get(p.entryId) ?? entry.availability
    if (!avail) {
      map.set(p.entryId, 'unavailable')
      return
    }
    const allYes = qs.every(q => avail[q] === 'yes')
    const allAvail = qs.every(q => avail[q] === 'yes' || avail[q] === 'tentative')
    if (allYes) map.set(p.entryId, 'yes')
    else if (allAvail) map.set(p.entryId, 'tentative')
    else map.set(p.entryId, 'unavailable')
  })
  return map
})

const availSummary = computed(() => {
  let yes = 0, tentative = 0, unavailable = 0
  for (const status of playerAvailability.value.values()) {
    if (status === 'yes') yes++
    else if (status === 'tentative') tentative++
    else unavailable++
  }
  return { yes, tentative, unavailable }
})
</script>

<template>
  <div class="kara-group">
    <div class="kara-group-hdr">
      <div class="kara-group-title">
        Karazhan {{ groupIndex + 1 }}
        <span class="kara-group-count">{{ group.length }}/10</span>
      </div>
      <button
        v-if="removable"
        class="kara-group-remove"
        title="Gruppe entfernen"
        @click="emit('removeGroup', groupIndex)"
      >&#x2716;</button>
    </div>
    <div v-if="parsedSlot" class="kara-group-slot">
      <strong>{{ parsedSlot.day }} {{ parsedSlot.windowLabel }}</strong>
      <button class="kgs-remove" title="Zeit entfernen" @click="emit('removeSlot', groupIndex)">&#x2716;</button>
    </div>
    <div v-else class="kara-slot-picker">
      <select v-model="pickerDay" @change="onPickerChange">
        <option value="">Tag</option>
        <option v-for="d in DAYS" :key="d" :value="d">{{ d }}</option>
      </select>
      <select v-model="pickerHour" :disabled="!pickerDay" @change="onPickerChange">
        <option value="">Uhrzeit</option>
        <option v-for="h in startHours" :key="h" :value="String(h)">{{ String(h).padStart(2, '0') }}:00</option>
      </select>
    </div>
    <div class="kara-role-bar">
      <span
        class="kara-role-tag"
        :class="roles.mt >= KARA_MT ? 'ok' : 'need'"
        :style="{ background: 'var(--role-tank)' + '22', color: 'var(--role-tank)' }"
      >&#x1F6E1;&#xFE0F; {{ roles.mt }}/{{ KARA_MT }} MT</span>
      <span
        class="kara-role-tag"
        :class="roles.ot >= KARA_OT ? 'ok' : 'need'"
        :style="{ background: 'var(--role-tank)' + '18', color: 'var(--role-tank)' }"
      >&#x1F6E1;&#xFE0F; {{ roles.ot }}/{{ KARA_OT }} OT</span>
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
      <span
        v-if="tankTotal > roles.mt + roles.ot"
        class="kara-role-tag need"
        :style="{ background: 'var(--role-tank)' + '10', color: 'var(--role-tank)' }"
        title="Tanks ohne MT/OT Zuweisung"
      >{{ tankTotal - roles.mt - roles.ot }}?T</span>
    </div>
    <div v-if="parsedSlot && group.length > 0" class="kara-avail-summary">
      <span class="kara-avail-tag yes">{{ availSummary.yes }} sicher</span>
      <span v-if="availSummary.tentative > 0" class="kara-avail-tag tentative">{{ availSummary.tentative }} vielleicht</span>
      <span v-if="availSummary.unavailable > 0" class="kara-avail-tag unavailable">{{ availSummary.unavailable }} unsicher</span>
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
        :tank-role="getPlayerTankRole(p.entryId)"
        :overlap-groups="getOverlapGroups(p.entryId)"
        :availability-status="playerAvailability.get(p.entryId) ?? null"
        @pin="emit('pin', $event)"
        @unassign="emit('unassign', $event)"
        @link="emit('link', $event)"
        @set-tank-role="(id, role) => emit('setTankRole', id, role)"
        @dragstart="(id: string, ev: DragEvent) => emit('dragstart', id, ev)"
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
  display: flex;
  justify-content: space-between;
  align-items: center;
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

.kara-group-remove {
  background: none;
  border: 1px solid rgba(229, 115, 115, 0.2);
  border-radius: 4px;
  cursor: pointer;
  color: var(--color-tx4);
  font-size: 11px;
  padding: 2px 6px;
  transition: all 0.15s;
}

.kara-group-remove:hover {
  color: #e57373;
  background: rgba(229, 115, 115, 0.08);
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

.kara-slot-picker {
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
}

.kara-slot-picker select {
  flex: 1;
  padding: 4px 6px;
  font-size: 11px;
  font-family: var(--font-body);
  border: 1px solid var(--color-border);
  border-radius: 5px;
  background: rgba(0, 0, 0, 0.2);
  color: var(--color-tx2);
  cursor: pointer;
  min-width: 0;
}

.kara-slot-picker select:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.kara-role-bar {
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.kara-role-tag {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.kara-role-tag.need {
  opacity: 0.6;
}

.kara-role-tag.ok {
  opacity: 1;
}

.kara-avail-summary {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}

.kara-avail-tag {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.kara-avail-tag.yes {
  background: rgba(102, 187, 106, 0.15);
  color: #66bb6a;
}

.kara-avail-tag.tentative {
  background: rgba(255, 183, 77, 0.15);
  color: #ffb74d;
}

.kara-avail-tag.unavailable {
  background: rgba(229, 115, 115, 0.15);
  color: #e57373;
}

.kara-dropzone {
  min-height: 80px;
  padding: 6px;
  border: 1px dashed rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
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
